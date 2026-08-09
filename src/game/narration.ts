// Split out of the former 7941-line src/game.ts (memory §7.91). The cut points
// are the file's own section banners and SOURCE ORDER IS PRESERVED across the
// split, so dist/naiowod.ts keeps the exact declaration order it had as one
// file - the artifact's only diff is which //#region each line sits in.
import { ParsedCommand, sys } from "../command";
import { StringUtil } from "../core/traits";
import { DEFAULT_SUCCESS_TABLES, SuccessTable, SuccessTableRegistry, describeTable, parseTableRows } from "../rolls";
import { LorebookManager, ReconcileFinding, ScopedStorage, TABLE_GENERAL_HEADER, TrackedLorebook, combineConfigTexts, ensurePath, reloadAllConfigStores, structuralHash, writeTrackedEntry } from "../services";
import { Scene, SceneStore, TABLES_CATEGORY, TableAliases, TableLibrary } from "../state";
import { disp, intOrUndef } from "./common";
import { resolveTableRef } from "./effects";

// =============================================================================
// STORYTELLER OUTPUT - the AI's private plans (§7.31, Pass B). The AI writes
// <hide op="append|overwrite">...</hide> in its narration; an onResponse hook
// strips those blocks from the story and folds them into the CURRENT scene's
// `plan`, which is mirrored into the Author's Note - semi-hidden: the AI re-reads
// it every turn, the player can peek at the AN panel, but it never lands in the
// prose. The Author's Note write is best-effort (needs the storyEdit permission);
// without it the plan still lives in the scene store (visible via scene-info).
// =============================================================================
export interface HideDirective { op: "append" | "overwrite"; content: string }

// Pull every <hide [op=...]>...</hide> block out of text. Returns the text with
// them removed and the directives in order (default op = append). PURE.
export function extractHideBlocks(text: string): { cleaned: string; directives: HideDirective[] } {
  const directives: HideDirective[] = [];
  const re = /<hide(?:\s+op\s*=\s*"?(append|overwrite)"?)?\s*>([\s\S]*?)<\/hide>/gi;
  const cleaned = text.replace(re, (_m, op: string | undefined, content: string) => {
    directives.push({ op: op === "overwrite" ? "overwrite" : "append", content: content.trim() });
    return "";
  });
  return { cleaned, directives };
}

const AN_PLAN_START = "<!--wod:scene-plan-->";
const AN_PLAN_END = "<!--/wod:scene-plan-->";

// Remove the engine-owned marked block from a text, leaving any player-authored
// Author's Note around it intact.
function stripMarkedBlock(text: string, start: string, end: string): string {
  const s = text.indexOf(start);
  if (s === -1) return text;
  const e = text.indexOf(end, s);
  const cut = e === -1 ? text.slice(0, s) : text.slice(0, s) + text.slice(e + end.length);
  return cut.replace(/\n{3,}/g, "\n\n").trim();
}

// Mirror the active scene's plan into the Author's Note as an engine-owned block
// (leaving the player's own note intact). Best-effort: swallow the storyEdit-
// permission error so the plan simply stays in the scene store.
export async function syncSceneToAuthorNote(scene: Scene | undefined): Promise<void> {
  const plan = scene?.plan?.trim() ?? "";
  const block = plan ? `${AN_PLAN_START}\n[Scene: ${disp(scene!.name)}] ${plan}\n${AN_PLAN_END}` : "";
  try {
    const current = String((await api.v1.an.get()) ?? "");
    const base = stripMarkedBlock(current, AN_PLAN_START, AN_PLAN_END);
    await api.v1.an.set(block ? (base ? `${base}\n${block}` : block) : base);
  } catch { /* no storyEdit permission - the plan still lives in the scene store */ }
}

// Apply hide directives to the current scene's plan, then re-sync the Author's
// Note. Returns whether a scene received them (a directive with no open scene is
// still stripped from the story, but has nowhere to be recorded).
export async function applyHideDirectives(directives: HideDirective[]): Promise<boolean> {
  if (!directives.length) return false;
  const scene = await SceneStore.current();
  if (!scene) return false;
  let plan = scene.plan ?? "";
  for (const d of directives) plan = d.op === "overwrite" ? d.content : (plan ? `${plan}\n${d.content}` : d.content);
  scene.plan = plan.trim() || undefined;
  await SceneStore.save(scene);
  await syncSceneToAuthorNote(scene);
  return true;
}

// The onResponse handler: strip <hide> blocks from the AI's generated text and
// route them to the scene plan / Author's Note. Returns the cleaned text array
// for the host to insert, or undefined when there was nothing to change.
export async function processGeneratedText(text: string[]): Promise<string[] | undefined> {
  const joined = text.join("");
  if (!joined.toLowerCase().includes("<hide")) return undefined;
  const { cleaned, directives } = extractHideBlocks(joined);
  await applyHideDirectives(directives);
  return [cleaned];
}

// [[hide `text`]] / [[hide op=overwrite `text`]] - the manual counterpart: the ST
// or player writes to the current scene's plan directly (same routing).
export async function cmdHide(cmd: ParsedCommand): Promise<string> {
  const scene = await SceneStore.current();
  if (!scene) return sys(`No open scene to note. Start one with [[scene "name"]] first.`);
  const content = (cmd.named["text"] ?? cmd.positional.join(" ")).trim();
  if (!content) return sys(`hide needs text, e.g. [[hide text=\`the baron is the killer\`]] or [[hide op=overwrite text=\`...\`]].`);
  const op = (cmd.named["op"] ?? "append").toLowerCase() === "overwrite" ? "overwrite" : "append";
  await applyHideDirectives([{ op, content }]);
  const s = (await SceneStore.current())!;
  return sys(`Noted (${op}) to "${s.name}"'s plan. It rides the Author's Note now (${(s.plan ?? "").length} chars).`);
}

// List the success tables, or lay one out in full. A table interprets a number
// of successes; attach table=<name> to a roll/resist/contest to read it.
export async function cmdTables(cmd: ParsedCommand): Promise<string> {
  const arg = cmd.positional[0]?.trim();
  if (arg) {
    const ref = await resolveTableRef(arg);
    if (ref.error) return sys(`${ref.error}`);
    const t = SuccessTableRegistry.get(ref.key!);
    if (t) return sys(`${describeTable(t)}.`);
    // Not a table - maybe a subcategory: list its contents.
    const subs = await TableLibrary.subcategories();
    if (subs.includes(ref.key!)) {
      const items = SuccessTableRegistry.all().filter(x => x.name.startsWith(`${ref.key}:`))
        .map(x => x.name.slice(ref.key!.length + 1));
      return sys(`Tables in "${ref.key}": ${items.length ? items.join(", ") : "(none yet)"}. Address them as ${ref.key}::<name>.`);
    }
    return sys(`No success table "${ref.key}". See [[show-table]].`);
  }
  const all = SuccessTableRegistry.all();
  const label = (t: SuccessTable): string => t.description ? `${t.name} (${t.description})` : t.name;
  const groups = [`general: ${all.filter(t => !t.name.includes(":")).map(label).join("; ")}`];
  for (const sub of await TableLibrary.subcategories()) {
    const items = all.filter(t => t.name.startsWith(`${sub}:`)).map(t => t.name.slice(sub.length + 1));
    groups.push(`${sub}: ${items.length ? items.join(", ") : "(empty)"}`);
  }
  const aliases = await TableAliases.all();
  const aliasBit = Object.keys(aliases).length
    ? ` Aliases: ${Object.entries(aliases).map(([a, k]) => `@${a} -> ${k}`).join(", ")}.` : "";
  return sys(`Success tables - ${groups.join(" | ")}.${aliasBit} [[show-table <name|sub|sub::name>]] for detail; add table=<key|@alias> to a roll/resist/contest.`);
}

// Author a success table from the command line (or the win-table window): the
// addressed category's GENERAL card - the same card the player can hand-edit.
// name may be "[sub::]name"; a missing subcategory prompts a modal. Labels
// ride the backtick-literal channel, so their case survives.
export async function cmdDefineTable(cmd: ParsedCommand): Promise<string> {
  const rawName = cmd.named["name"]?.trim();
  if (!rawName) return sys(`define-table needs name="..". See [[help define-table]].`);
  const segs = StringUtil.normalize(rawName).split(":").filter(Boolean);
  if (segs.length === 0) return sys(`define-table needs name="..". See [[help define-table]].`);
  if (segs.length > 2) return sys(`Table paths go one level deep for now (name="sub::name").`);
  const sub = segs.length === 2 ? segs[0] : undefined;
  const name = segs[segs.length - 1];
  const rows = parseTableRows(cmd.named["rows"]);
  if ("error" in rows) return sys(`${rows.error}`);
  // Only supplied fields land in the def; a supplied-but-unreadable number is
  // refused rather than silently dropped.
  const num = (key: string): number | undefined | { error: string } => {
    const raw = cmd.named[key];
    if (raw === undefined) return undefined;
    const n = intOrUndef(raw);
    return n === undefined ? { error: `${key}= must be a whole number (got "${raw}").` } : n;
  };
  const t: SuccessTable = { name: StringUtil.normalize(name) };
  if (rows.length) t.rows = rows;
  const vps = num("value-per-success");
  if (typeof vps === "object") return sys(`${vps.error}`);
  if (vps !== undefined) t.valuePerSuccess = vps;
  const cap = num("cap");
  if (typeof cap === "object") return sys(`${cap.error}`);
  if (cap !== undefined) t.cap = cap;
  const per = num("overflow-per");
  const value = num("overflow-value");
  if (typeof per === "object") return sys(`${per.error}`);
  if (typeof value === "object") return sys(`${value.error}`);
  const overflowLabel = cmd.named["overflow-label"]?.trim();
  if ((value !== undefined || overflowLabel) && per === undefined) {
    return sys(`overflow needs overflow-per=N (the batch size beyond the last row).`);
  }
  if (per !== undefined) {
    t.overflow = { per };
    if (value !== undefined) t.overflow.value = value;
    if (overflowLabel) t.overflow.label = overflowLabel;
  }
  for (const key of ["botch", "failure", "description"] as const) {
    const v = cmd.named[key]?.trim();
    if (v) t[key] = v;
  }
  if (!t.rows && t.valuePerSuccess === undefined && !t.botch && !t.failure) {
    return sys(`A table needs something to read - give it rows=, value-per-success=, botch= or failure=.`);
  }
  const key = sub ? `${sub}:${t.name}` : t.name;
  const shadows = !sub && DEFAULT_SUCCESS_TABLES.some(d => StringUtil.normalize(d.name) === t.name);
  if (sub && !(await LorebookManager.categoryIdByName(`${TABLES_CATEGORY}:${sub}`))) {
    // The subcategory doesn't exist: confirm its creation via a modal; the
    // pending def rides the closure and lands only on confirmation.
    void confirmModal(`Create table category "${sub}"?`,
      `Table category **${sub}** doesn't exist yet (lorebook category \`${TABLES_CATEGORY}:${sub}\`). Create it and define **${t.name}** inside it?`,
      [{
        label: "Create & define",
        run: async () => {
          const r = await TableLibrary.put(t, sub);
          return `Created "${sub}" and defined ${describeTable({ ...t, name: key })}.${r.shadowed ? " (currently shadowed by another card)" : ""}`;
        },
      }]);
    return sys(`Table category "${sub}" doesn't exist yet - answer the modal to create it and define ${t.name}.`);
  }
  const r = await TableLibrary.put(t, sub);
  const note = shadows ? ` (shadows the built-in - [[forget-table ${t.name}]] restores it)`
    : r.shadowed ? ` (note: another card in the category shadows this name right now)` : "";
  return sys(`Defined table ${describeTable({ ...t, name: key })}.${note} Attach with table=${sub ? `${sub}::${t.name}` : t.name}.`);
}

// Create a table subcategory outright (the modal-less path).
export async function cmdDefineTableCategory(cmd: ParsedCommand): Promise<string> {
  const raw = (cmd.named["name"] ?? cmd.positional[0])?.trim();
  if (!raw) return sys(`define-table-category needs name="..".`);
  const sub = StringUtil.normalize(raw);
  if (sub.includes(":") || sub.startsWith("@")) {
    return sys(`A table category is a single name (no "::" and no "@") - subcategories go one level deep for now.`);
  }
  const existed = await LorebookManager.categoryIdByName(`${TABLES_CATEGORY}:${sub}`) !== undefined;
  await ensurePath(`config:success-tables:${sub}`, TABLE_GENERAL_HEADER);
  return existed
    ? sys(`Table category "${sub}" already exists.`)
    : sys(`Created table category "${sub}" (lorebook category "${TABLES_CATEGORY}:${sub}", card "general"). Define into it with [[define-table name="${sub}::<name>" ...]].`);
}

export async function cmdForgetTable(cmd: ParsedCommand): Promise<string> {
  const raw = cmd.positional[0]?.trim();
  if (!raw) return sys(`forget-table needs a name.`);
  const ref = await resolveTableRef(raw);
  if (ref.error) return sys(`${ref.error}`);
  const key = ref.key!;
  const { removed, still } = await TableLibrary.remove(key);
  if (!removed) {
    if (!SuccessTableRegistry.get(key)) return sys(`No table "${key}".`);
    return DEFAULT_SUCCESS_TABLES.some(d => StringUtil.normalize(d.name) === key)
      ? sys(`"${key}" is a built-in table - it can be shadowed with [[define-table]] but not deleted.`)
      : sys(`"${key}" isn't in its category's general card - it lives in another card; edit that card in creator mode.`);
  }
  const note = still === "built-in" ? ` The built-in "${key}" resurfaces.`
    : still === "another-card" ? ` Another card in the category still defines "${key}".` : "";
  return sys(`Forgot table "${key}".${note}`);
}

// --- TABLE ALIASES ------------------------------------------------------------
export async function cmdTableAlias(cmd: ParsedCommand): Promise<string> {
  const token = cmd.positional[0]?.trim();
  if (!token) {
    const all = await TableAliases.all();
    const items = Object.entries(all).map(([a, k]) => `@${a} -> ${k}`);
    return items.length
      ? sys(`Table aliases: ${items.join(", ")}. [[table-alias @a "<[sub::]name>"]] defines one.`)
      : sys(`No table aliases yet. [[table-alias @a "<[sub::]name>"]] defines one.`);
  }
  if (!token.startsWith("@")) return sys(`Table aliases start with "@", e.g. [[table-alias @qk "combat::quick-kill"]].`);
  const target = cmd.positional[1]?.trim();
  if (!target) return sys(`table-alias needs a target table, e.g. [[table-alias ${token} "combat::quick-kill"]].`);
  const ref = await resolveTableRef(target);
  if (ref.error) return sys(`${ref.error}`);
  await TableAliases.set(token, ref.key!);
  const advisory = SuccessTableRegistry.get(ref.key!) ? "" : ` (no table "${ref.key}" exists yet - the alias waits for it)`;
  return sys(`${token} now means table ${ref.key}.${advisory}`);
}

export async function cmdForgetTableAlias(cmd: ParsedCommand): Promise<string> {
  const token = cmd.positional[0]?.trim();
  if (!token || !token.startsWith("@")) return sys(`forget-table-alias needs an @alias.`);
  const removed = await TableAliases.remove(token);
  return removed
    ? sys(`Forgot table alias ${token}.`)
    : sys(`No table alias ${token}. [[table-alias]] lists them.`);
}

// =============================================================================
// LOREBOOK MODALS & RECONCILIATION
// -----------------------------------------------------------------------------
// Game-flow confirmations rendered as api.v1.ui MODALS (blocking, centered) -
// distinct from the spec-driven form WINDOWS in src/window.ts. Each action
// button runs its effect and shows the outcome in-modal; Cancel/Close dismiss.
// Reconciliation (the tracked-card drift check, services.ts) runs at init and
// on the creator-mode sync; identical recreations were already adopted
// silently there - only conflicts and deletions reach a modal, and each
// distinct drift prompts at most once per session (tempStorage guard).
// =============================================================================
const _reconGuard = new ScopedStorage();

async function confirmModal(title: string, body: string, actions: { label: string; run: () => Promise<string> }[]): Promise<void> {
  const part = api.v1.ui.part;
  const handle = await api.v1.ui.modal.open({ title, size: "small", content: [] });
  const render = async (result?: string): Promise<void> => {
    const content: UIPart[] = [part.text({ text: body, markdown: true })];
    if (result === undefined) {
      content.push(part.row({ content: actions.map(a => part.button({ text: a.label, callback: async () => render(await a.run()) })) }));
      content.push(part.row({ content: [part.button({ text: "Cancel", callback: () => handle.close() })] }));
    } else {
      content.push(part.box({ content: [part.text({ text: result })] }));
      content.push(part.row({ content: [part.button({ text: "Close", callback: () => handle.close() })] }));
    }
    await handle.update({ content });
  };
  await render();
}

function openConflictModal(f: ReconcileFinding): void {
  const actions: { label: string; run: () => Promise<string> }[] = [{
    label: "Keep the new card",
    run: async () => {
      await TrackedLorebook.adopt(f.category, f.entry, f.foundId!, f.foundText!);
      await reloadAllConfigStores();
      return "Kept your new card - it is the tracked one now.";
    },
  }];
  const combined = f.backupText !== undefined && f.foundText !== undefined
    ? combineConfigTexts(f.backupText, f.foundText) : undefined;
  if (combined !== undefined) {
    actions.push({
      label: "Combine both",
      run: async () => {
        await api.v1.lorebook.updateEntry(f.foundId!, { text: combined });
        await TrackedLorebook.adopt(f.category, f.entry, f.foundId!, combined);
        await reloadAllConfigStores();
        return "Combined - your newer definitions won any collisions.";
      },
    });
  }
  if (f.backupText !== undefined) {
    actions.push({
      label: "Restore the old card",
      run: async () => {
        await api.v1.lorebook.updateEntry(f.foundId!, { text: f.backupText! });
        await TrackedLorebook.adopt(f.category, f.entry, f.foundId!, f.backupText!);
        await reloadAllConfigStores();
        return "Restored the card's last tracked text.";
      },
    });
  }
  void confirmModal(`Recreated card: ${f.entry}`,
    `The card **${f.entry}** in **${f.category}** was deleted and recreated with different content. What should happen?`,
    actions);
}

function openMissingModal(f: ReconcileFinding): void {
  const actions: { label: string; run: () => Promise<string> }[] = [];
  if (f.backupText !== undefined) {
    actions.push({
      label: "Restore from backup",
      run: async () => {
        await writeTrackedEntry(f.category, f.entry, f.backupText!);
        await reloadAllConfigStores();
        return "Restored the card from its backup.";
      },
    });
  }
  actions.push({
    label: "Forget it",
    run: async () => {
      await TrackedLorebook.forget(f.category, f.entry);
      await reloadAllConfigStores();
      return "Forgot the card - the engine no longer tracks or restores it.";
    },
  });
  void confirmModal(`Deleted card: ${f.entry}`,
    `The tracked card **${f.entry}** in **${f.category}** is gone from the lorebook. Restore it from the engine's backup, or let it go?`,
    actions);
}

// Detect tracked-card drift and surface it. Returns one-line notes for the
// caller's log/OOC reply; modals open fire-and-forget.
export async function reconcileLorebook(): Promise<string[]> {
  const notes: string[] = [];
  for (const f of await TrackedLorebook.reconcile()) {
    const card = `"${f.entry}" (${f.category})`;
    if (f.kind === "adopted") { notes.push(`re-adopted recreated card ${card}`); continue; }
    const sig = `recon:${f.category}/${f.entry}:${f.kind}:${structuralHash(f.foundText ?? f.backupText ?? "")}`;
    if (await _reconGuard.tempGet(sig)) continue;
    await _reconGuard.tempSet(sig, true);
    if (f.kind === "conflict") { openConflictModal(f); notes.push(`card ${card} was recreated with different content - a modal is waiting`); }
    else { openMissingModal(f); notes.push(`tracked card ${card} is gone - a modal is waiting`); }
  }
  return notes;
}
