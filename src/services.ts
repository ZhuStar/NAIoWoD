import { log } from "./host";
import { sys } from "./command";
import { StringUtil, Stat, Category } from "./core/traits";
import { EventBus, BusEvent, BusHandler, BusPriority, BusSubscribeOptions, busChannel, isLocalChannel } from "./core/bus";
import {
  CardValue, CardMap, parseCardText, formatCardText, canonicalCardText,
  asMap, asNamedList, asText,
} from "./core/cardtext";
import {
  SRD_CATEGORIES, SrdCategorySpec, SRD_HEADER_MARKER,
  DEFAULT_MERITS_FLAWS, MeritFlawDef, meritFlawFromCard, MERIT_FLAW_KINDS,
  DEFAULT_ARCANA, ArcanumDef, arcanumFromCard, ARCANUM_KINDS,
  OWNED_POWER_KINDS, kindOnCard,
} from "./rules";

// =============================================================================
// STORAGE & LOREBOOK MANAGERS - the script's editable database layer
// -----------------------------------------------------------------------------
// ScopedStorage namespaces storage under a uuid prefix (the script id by
// default) and pairs every persistent method with a temp* variant on
// api.v1.tempStorage - volatile scratch state the host clears when the script
// unloads. LorebookManager reads lorebook entries as data: rule lists live in
// entries whose text is a newline list (or CARD TEXT - see core/cardtext.ts)
// beneath a human-readable header, so the user edits game data like a database
// table in the lorebook UI.
// =============================================================================
// --- WHICH STORE ------------------------------------------------------------
// A frozen enum rather than four bare strings, so a request can NAME its store
// and be checked. There are four, and only two are ours to write:
//
//   story    persistent, per story, SHARED BY EVERY SCRIPT - the engine's home
//   temp     session scratch, cleared when the story closes
//   history  undo-aware; reserved for mechanical state, unused today
//   account  api.v1.storage - ACCOUNT-level, shared across every story. The
//            engine NEVER writes it (§7.85); listed so the name exists to be
//            refused rather than being an absence somebody fills in later.
export const STORE = Object.freeze({
  story: "story", temp: "temp", history: "history", account: "account",
} as const);
export type StoreName = typeof STORE[keyof typeof STORE];

// --- WHICH KEY --------------------------------------------------------------
// EVERY key the engine stores, in one place. They used to be thirteen inline
// template strings scattered across the store classes, which is how memory.md
// §6 ended up being the only complete list of what this engine persists - a
// document, not code, and so unable to fail when it drifted. A registry means
// the map of persistent state IS the map, and a rename cannot miss a caller.
//
// Values are the key WITHOUT the storage prefix; ScopedStorage adds that.
//
// TWO KINDS OF BUILDER, and the difference matters. A SUBJECT-keyed one takes a
// character or scene name and NORMALIZES it, so "Kvar The Bold" and
// "kvar-the-bold" are one record - the player types both. An ID-keyed one takes
// an opaque id the engine minted and must leave it exactly as it is; normalizing
// a uuid would quietly point at a different record. `extendedRoll`,
// `extendedContest` and `lorebookBackup` are the id-keyed ones.
export const KEY = Object.freeze({
  // Characters and the pointers into them
  character: (name: string) => `pc:${StringUtil.normalize(name)}`,
  currentCharacter: "current-character",
  defaultCharacter: "default-character",
  creatorMode: "creator-mode",
  // Per-character live state
  afflictions: (name: string) => `affl:${StringUtil.normalize(name)}`,
  resources: (name: string) => `res:${StringUtil.normalize(name)}`,
  health: (name: string) => `hp:${StringUtil.normalize(name)}`,
  boosts: (name: string) => `boost:${StringUtil.normalize(name)}`,
  uses: (name: string) => `uses:${StringUtil.normalize(name)}`,
  cooldowns: (name: string) => `cool:${StringUtil.normalize(name)}`,
  cray: (name: string) => `cray:${StringUtil.normalize(name)}`,
  castAttempts: (name: string) => `cast:${StringUtil.normalize(name)}`,
  // Rolls in flight
  extendedRoll: (id: string) => `xroll:${id}`,
  currentExtended: "current-extended",
  extendedContest: (id: string) => `xcontest:${id}`,
  currentContest: "current-contest",
  // The clock and the calendar
  clock: "time:clock",
  dates: "time:dates",
  scene: (name: string) => `scene:${StringUtil.normalize(name)}`,
  currentScene: "current-scene",
  generations: "gen:count",
  // Players, aliases, wizards, lorebook bookkeeping
  aliases: "aliases",
  currentPlayer: "current-player",
  defaultPlayer: "default-player",
  tableAliases: "table-aliases",
  wizard: "wizard:active",
  lorebookIds: "lb:ids",
  lorebookBackup: (category: string, entry: string) => `lb:backup:${category}/${entry}`,
} as const);

// --- THE ONE KEY THAT CANNOT LIVE BEHIND A SCRIPT ID ------------------------
// ScopedStorage prefixes every key with the script's OWN id, so script B cannot
// read what script A wrote unless it already knows A's id - and learning A's id
// is precisely what this key is for. So the directory lives at a FIXED prefix
// every unit can compute while knowing nothing at all.
//
// Nothing moves: this is a NEW key at a NEW prefix, so there is no migration
// here and no live save at risk. It is also the pattern the shared game state
// will eventually want, proved out somewhere it costs nothing.
export const REGISTRY_PREFIX = "naiowod";
export const DIRECTORY_KEY = "scripts";
// A cached address is dropped if nothing has confirmed it for this long, so a
// script that was deleted stops being written to to eventually.
const DIRECTORY_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export class ScopedStorage {
  // THE PREFIX IS ONE PLACE ON PURPOSE. Today it is this script's own id, which
  // is what keeps two unrelated scripts from colliding in a storyStorage they
  // both see. It is also the single line the multi-script split has to change:
  // several units sharing one game state must agree on a prefix, and a script
  // id is per-script by definition. Changing it is a MIGRATION, not an edit -
  // every existing story has its keys under the old one.
  constructor(public readonly StoragePrefix: string = api.v1.script.id) {}

  private _key(key: string): string { return `${this.StoragePrefix}_${key}`; }

  async get(key: string): Promise<unknown> {
    return api.v1.storyStorage.get(this._key(key));
  }
  async getOrDefault<T>(key: string, fallback: T): Promise<T> {
    const v = await this.get(key);
    return v === undefined ? fallback : v as T;
  }
  async set(key: string, value: unknown): Promise<void> {
    await api.v1.storyStorage.set(this._key(key), value);
  }
  // Writes only when the key is missing; returns whether it wrote.
  async setIfAbsent(key: string, value: unknown): Promise<boolean> {
    if (await this.has(key)) return false;
    await this.set(key, value);
    return true;
  }
  async has(key: string): Promise<boolean> {
    return (await this.get(key)) !== undefined;
  }
  // Returns whether the key existed before removal.
  async delete(key: string): Promise<boolean> {
    const existed = await this.has(key);
    await api.v1.storyStorage.remove(this._key(key));
    return existed;
  }
  // Keys this manager has set, with the storage prefix stripped back off.
  async list(): Promise<string[]> {
    const prefix = `${this.StoragePrefix}_`;
    return (await api.v1.storyStorage.list())
      .filter(k => k.startsWith(prefix))
      .map(k => k.slice(prefix.length));
  }

  // temp*: same API against api.v1.tempStorage - scratch state the host clears
  // whenever the script unloads (refresh, session end, toggling it off/on).
  async tempGet(key: string): Promise<unknown> {
    return api.v1.tempStorage.get(this._key(key));
  }
  async tempGetOrDefault<T>(key: string, fallback: T): Promise<T> {
    const v = await this.tempGet(key);
    return v === undefined ? fallback : v as T;
  }
  async tempSet(key: string, value: unknown): Promise<void> {
    await api.v1.tempStorage.set(this._key(key), value);
  }
  async tempSetIfAbsent(key: string, value: unknown): Promise<boolean> {
    if (await this.tempHas(key)) return false;
    await this.tempSet(key, value);
    return true;
  }
  async tempHas(key: string): Promise<boolean> {
    return (await this.tempGet(key)) !== undefined;
  }
  async tempDelete(key: string): Promise<boolean> {
    const existed = await this.tempHas(key);
    await api.v1.tempStorage.remove(this._key(key));
    return existed;
  }
}

export class LorebookManager {
  // The host API filters entries by category *id*; users think in category
  // *names* ("srd:abilities"), so resolve the name first.
  static async categoryIdByName(name: string): Promise<string | undefined> {
    const want = name.trim().toLowerCase();
    const categories = await api.v1.lorebook.categories();
    return categories.find(c => (c.name ?? "").trim().toLowerCase() === want)?.id;
  }

  static async entriesInCategory(categoryName: string): Promise<LorebookEntry[]> {
    const id = await LorebookManager.categoryIdByName(categoryName);
    if (id === undefined) return [];
    return api.v1.lorebook.entries(id);
  }

  // Text of the entry with the given displayName inside a category, or undefined.
  static async entryText(categoryName: string, displayName: string): Promise<string | undefined> {
    const want = displayName.trim().toLowerCase();
    for (const entry of await LorebookManager.entriesInCategory(categoryName)) {
      const label = (entry.displayName ?? (entry as { displayText?: string }).displayText ?? "").trim().toLowerCase();
      if (label === want) return entry.text;
    }
    return undefined;
  }

  // Everything above a marker line (>= 3 '=') is a human-readable header and is
  // ignored; the data is whatever follows. No marker -> the whole text is data.
  static contentBelowHeader(text: string): string {
    const m = text.match(/^[ \t]*={3,}[ \t]*$/m);
    return m && m.index !== undefined ? text.slice(m.index + m[0].length) : text;
  }

  // An entry's data as a list: one item per non-empty line, with '#'/'//' line
  // comments and /* */ block comments stripped. Items pass through the boundary
  // normalizer ("  Animal   Ken" -> "animal-ken") - lorebook data enters the
  // engine normalized, exactly like command arguments.
  static parseList(text: string): string[] {
    return LorebookManager.contentBelowHeader(text)
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .map(l => StringUtil.normalizeInput(l.replace(/(^|\s)(#|\/\/).*$/, "$1")))
      .filter(l => l.length > 0);
  }

  static async listFrom(categoryName: string, displayName: string): Promise<string[]> {
    const text = await LorebookManager.entryText(categoryName, displayName);
    return text === undefined ? [] : LorebookManager.parseList(text);
  }

  // Overwrite an entry's text (found by category + displayName). Returns
  // whether the entry existed. This is also what a player's manual lorebook
  // edit amounts to, so tests use it to simulate one.
  static async updateEntryText(categoryName: string, displayName: string, text: string): Promise<boolean> {
    const want = displayName.trim().toLowerCase();
    for (const entry of await LorebookManager.entriesInCategory(categoryName)) {
      if ((entry.displayName ?? "").trim().toLowerCase() === want) {
        await api.v1.lorebook.updateEntry(entry.id, { text });
        return true;
      }
    }
    return false;
  }

  static async allTalents(): Promise<string[]> { return LorebookManager.listFrom("srd:abilities", "srd:abilities:talents"); }
  static async allSkills(): Promise<string[]> { return LorebookManager.listFrom("srd:abilities", "srd:abilities:skills"); }
  static async allKnowledges(): Promise<string[]> { return LorebookManager.listFrom("srd:abilities", "srd:abilities:knowledges"); }
  static async allBackgrounds(): Promise<string[]> { return LorebookManager.listFrom("srd:backgrounds", "srd:backgrounds:all"); }

  // --- Bootstrap: create-if-missing + seed a tutorial -----------------------
  // Create a category if it doesn't exist; report whether we made it.
  static async ensureCategory(name: string): Promise<{ id: string; created: boolean }> {
    const existing = await LorebookManager.categoryIdByName(name);
    if (existing !== undefined) return { id: existing, created: false };
    // We keep the uuid (via api.v1.uuid()) so the category can be re-fetched or
    // recreated with the same id later. createCategory resolves to the new id.
    const id = await api.v1.lorebook.createCategory({ id: api.v1.uuid(), name, enabled: true });
    return { id, created: true };
  }

  // Create an entry unless one with that displayName already exists in the
  // category; returns whether it created it.
  static async ensureEntry(categoryId: string, displayName: string, text: string): Promise<boolean> {
    const want = displayName.trim().toLowerCase();
    const entries = await api.v1.lorebook.entries(categoryId);
    if (entries.some(e => (e.displayName ?? "").trim().toLowerCase() === want)) return false;
    await api.v1.lorebook.createEntry({ id: api.v1.uuid(), displayName, text, category: categoryId });
    return true;
  }

  // Ensure every SRD category exists, seeding tutorial/starter entries into any
  // we had to create. Categories the player already has are left untouched.
  // Returns what was created and a player-facing note asking them to review it
  // (null when nothing was created).
  static async bootstrap(specs: SrdCategorySpec[] = SRD_CATEGORIES): Promise<{ createdCategories: string[]; seededEntries: number; message: string | null }> {
    const created: string[] = [];
    let seeded = 0;
    for (const spec of specs) {
      const { id, created: madeCategory } = await LorebookManager.ensureCategory(spec.name);
      if (!madeCategory) continue; // respect existing player data
      created.push(spec.name);
      for (const entry of spec.entries) {
        if (await LorebookManager.ensureEntry(id, entry.displayName, entry.text)) seeded++;
      }
    }
    return { createdCategories: created, seededEntries: seeded, message: created.length ? LorebookManager._setupMessage(specs, created) : null };
  }

  private static _setupMessage(specs: SrdCategorySpec[], created: string[]): string {
    const lines = created.map(name => `• ${name} — ${specs.find(s => s.name === name)?.blurb ?? "game data"}`);
    return [
      sys("Storyteller setup"),
      "I've added the lorebook categories this game needs and filled them with starter data and examples. Open your Lorebook and review / edit:",
      ...lines,
      `Each entry starts with instructions; the data is below its "${SRD_HEADER_MARKER}" line. Tune these to your chronicle, then we’re ready to play.`,
    ].join("\n");
  }
}

// =============================================================================
// TRACKED CARDS - virtual subcategories, id map, backups, reconciliation
// -----------------------------------------------------------------------------
// NovelAI lorebook categories cannot nest, so nesting is CONCEPTUAL and this
// module owns the illusion (the subcategory policy, memory.md 7.21):
// a virtual path "a::b" (user input, folds to "a:b") maps to the REAL category
// named "wod:a:b"; every engine-owned category has a default entry "general" -
// the default write target. Every card the engine writes is TRACKED: its
// category/entry uuids live in the storyStorage id map (lb:ids) and its full
// text is backed up (lb:backup:<category>/<entry>) on every write and every
// healthy sighting. reconcileTracked() detects uuid drift: a card deleted and
// recreated with identical structure is re-adopted silently (we point our map
// at the NEW uuid - ids only have meaning through the map, so nothing is ever
// destroyed to preserve one); a structural conflict or a plain deletion is
// returned as a finding for the UI (game.ts opens the modal).
// =============================================================================
export const GENERAL_ENTRY = "general";

// Default tutorial headers for engine-seeded `general` cards.
export const CONFIG_GENERAL_HEADER = [
  "Global configuration for this chronicle. Below the marker holds story-wide",
  "settings (none are read yet - this card is the documented home for future",
  "global options). Edit in creator mode; the format is `key: value`, one per",
  "line, indenting to nest.",
];
export const TABLE_GENERAL_HEADER = [
  "Success tables for this category, written `name:` with the table's rows",
  "indented below it. [[define-table]] writes here; you may add MORE cards to",
  "this category to split a large set - every card is read, and a later card's",
  "table shadows an earlier one with the same name.",
];

// Content-only structural hash: the tutorial header above the marker never
// participates, so editing instructions can't trip a conflict. Card bodies are
// canonicalized (keys sorted, comments and layout gone); anything unreadable
// falls back to whitespace-collapsed text. djb2, hex.
export function structuralHash(text: string): string {
  const body = LorebookManager.contentBelowHeader(text).trim();
  // An empty (or comment-only) body has no data, so every such card hashes the
  // same - a re-created empty card is a re-creation, not an edit.
  const s = canonicalCardText(parseCardText(body));
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

export interface ReconcileFinding {
  category: string;
  entry: string;
  kind: "adopted" | "conflict" | "missing";
  backupText?: string;
  foundId?: string;
  foundText?: string;
}

export class TrackedLorebook {
  private static _storage = new ScopedStorage();
  private static readonly IDS_KEY = KEY.lorebookIds;
  private static _backupKey(category: string, entry: string): string { return KEY.lorebookBackup(category, entry); }

  private static async _ids(): Promise<Record<string, string>> {
    return ((await TrackedLorebook._storage.get(TrackedLorebook.IDS_KEY)) as Record<string, string> | undefined) ?? {};
  }
  private static async _saveIds(map: Record<string, string>): Promise<void> {
    await TrackedLorebook._storage.set(TrackedLorebook.IDS_KEY, map);
  }

  static async remember(category: string, entry: string | undefined, id: string): Promise<void> {
    const map = await TrackedLorebook._ids();
    map[entry === undefined ? `cat:${category}` : `ent:${category}/${entry}`] = id;
    await TrackedLorebook._saveIds(map);
  }
  static async idFor(category: string, entry?: string): Promise<string | undefined> {
    return (await TrackedLorebook._ids())[entry === undefined ? `cat:${category}` : `ent:${category}/${entry}`];
  }
  static async backupOf(category: string, entry: string): Promise<string | undefined> {
    return (await TrackedLorebook._storage.get(TrackedLorebook._backupKey(category, entry))) as string | undefined;
  }
  static async refreshBackup(category: string, entry: string, text: string): Promise<void> {
    await TrackedLorebook._storage.set(TrackedLorebook._backupKey(category, entry), text);
  }

  // Stop tracking a card (the player chose to let it go): map records + backup.
  static async forget(category: string, entry: string): Promise<void> {
    const map = await TrackedLorebook._ids();
    delete map[`ent:${category}/${entry}`];
    await TrackedLorebook._saveIds(map);
    await TrackedLorebook._storage.delete(TrackedLorebook._backupKey(category, entry));
  }

  // Every tracked card, as {category, entry} pairs (from the ent: map keys).
  static async trackedEntries(): Promise<{ category: string; entry: string }[]> {
    return Object.keys(await TrackedLorebook._ids())
      .filter(k => k.startsWith("ent:"))
      .map(k => {
        const [category, entry] = k.slice(4).split("/");
        return { category, entry };
      });
  }

  // Compare every tracked card against reality. Identical recreations are
  // adopted HERE (map re-pointed, backup refreshed); conflicts and deletions
  // are returned for the UI to resolve.
  static async reconcile(): Promise<ReconcileFinding[]> {
    const findings: ReconcileFinding[] = [];
    for (const { category, entry } of await TrackedLorebook.trackedEntries()) {
      const knownId = await TrackedLorebook.idFor(category, entry);
      const entries = await LorebookManager.entriesInCategory(category);
      const byId = knownId ? entries.find(e => e.id === knownId) : undefined;
      if (byId) { await TrackedLorebook.refreshBackup(category, entry, byId.text ?? ""); continue; }
      const want = entry.trim().toLowerCase();
      const byName = entries.find(e => (e.displayName ?? "").trim().toLowerCase() === want);
      const backupText = await TrackedLorebook.backupOf(category, entry);
      if (byName) {
        if (backupText !== undefined && structuralHash(byName.text ?? "") === structuralHash(backupText)) {
          await TrackedLorebook.remember(category, entry, byName.id);
          await TrackedLorebook.refreshBackup(category, entry, byName.text ?? "");
          findings.push({ category, entry, kind: "adopted", foundId: byName.id });
        } else {
          findings.push({ category, entry, kind: "conflict", backupText, foundId: byName.id, foundText: byName.text ?? "" });
        }
      } else {
        findings.push({ category, entry, kind: "missing", backupText });
      }
    }
    return findings;
  }

  // Accept the player's replacement card as the tracked one.
  static async adopt(category: string, entry: string, id: string, text: string): Promise<void> {
    await TrackedLorebook.remember(category, entry, id);
    await TrackedLorebook.refreshBackup(category, entry, text);
  }
}

// Union of two config card texts (both must read). Shapes are preserved from
// the FOUND (player's newer) card: block -> key union; list-of-named-defs ->
// name-keyed union. The player's defs win collisions; backup-only defs are
// kept. The found card's header text stays. Undefined = not combinable.
export function combineConfigTexts(backupText: string, foundText: string): string | undefined {
  const parse = (t: string): CardValue | undefined => parseCardText(LorebookManager.contentBelowHeader(t).trim());
  const backup = parse(backupText);
  const found = parse(foundText);
  if (backup === undefined || found === undefined) return undefined;
  // Everything up to (and including) the found card's marker line; the data
  // goes back on its own line below it.
  const header = foundText.slice(0, foundText.length - LorebookManager.contentBelowHeader(foundText).length);
  let combined: CardValue;
  if (Array.isArray(backup) && Array.isArray(found)) {
    const byName = new Map<string, CardValue>();
    const keyOf = (d: CardValue): string | undefined => {
      const n = asText(asMap(d)["name"]);
      return n === undefined ? undefined : StringUtil.normalize(n);
    };
    const extras: CardValue[] = [];
    for (const list of [backup, found]) {
      for (const d of list) {
        const k = keyOf(d);
        if (k !== undefined) byName.set(k, d); else if (list === found) extras.push(d);
      }
    }
    combined = [...byName.values(), ...extras];
  } else if (!Array.isArray(backup) && !Array.isArray(found)
    && backup !== null && found !== null && typeof backup === "object" && typeof found === "object") {
    combined = { ...backup, ...found };
  } else {
    return undefined;
  }
  return `${header}\n${formatCardText(combined)}`;
}

// =============================================================================
// CONFIG STORES - the generic shape of "wod:config" registries
// -----------------------------------------------------------------------------
// Every story-config registry works the same way: ONE lorebook entry under the
// wod:config category (tutorial header above the marker, card text below), read
// as a name -> def block (or a list of named defs), cached module-level for synchronous reads,
// reloaded at init and on the creator-mode sync points. These two classes ARE
// that pattern; a concrete registry is an instance, not a re-implementation.
// Instances self-register into ALL_CONFIG_STORES so reload/reset sweep every
// registry - adding a registry never touches a sync point again.
// =============================================================================
export const CONFIG_CATEGORY = "wod:config";

export interface ConfigStoreLike {
  readonly entry: string;
  loadFromLorebook(): Promise<number>;
  reset(): void;
}

export const ALL_CONFIG_STORES: ConfigStoreLike[] = [];

// Reload every config store from the lorebook; returns per-entry counts
// (init logs them; the creator-mode hook ignores them).
export async function reloadAllConfigStores(): Promise<{ entry: string; count: number }[]> {
  const out: { entry: string; count: number }[] = [];
  for (const store of ALL_CONFIG_STORES) {
    out.push({ entry: store.entry, count: await store.loadFromLorebook() });
  }
  return out;
}

// Clear every config store back to its shipped defaults (tests).
export function resetAllConfigStores(): void {
  for (const store of ALL_CONFIG_STORES) store.reset();
}

// The tutorial-above-the-marker entry text every store writes.
export function configEntryText(header: string[], data: CardValue): string {
  return [...header, SRD_HEADER_MARKER, formatCardText(data)].join("\n");
}

// A named-def registry, as a card writes it: `name:` with the def's fields
// indented below. (A def whose whole body is one scalar keeps that scalar.)
export function namedDefsToCard<T extends { name: string }>(defs: T[]): CardMap {
  const out: CardMap = {};
  for (const def of defs) {
    const { name, ...rest } = def as T & Record<string, unknown>;
    out[StringUtil.toTitleCase(String(name))] = rest as CardMap;
  }
  return out;
}

// Read an entry body as card text; undefined when missing/empty (the entry
// stays for the player to fix - never destroyed by a bad edit).
export function parseConfigBody(text: string | undefined): CardValue | undefined {
  if (!text) return undefined;
  return parseCardText(LorebookManager.contentBelowHeader(text).trim());
}

// Normalize a read config body (name -> def block, OR a list of defs that carry
// their own `name:`) to a list of partials that carry their name. Shared by
// ListConfigStore and the TableLibrary's multi-card loader.
export function parseNamedConfigList<T extends { name: string }>(parsed: CardValue | undefined): Array<Partial<T> & { name: string }> {
  return asNamedList(parsed).map(({ name, body }) => ({ ...body, name } as unknown as Partial<T> & { name: string }));
}

// Write-through for a TRACKED card in any category: create the category/entry
// on first use, else update in place; record ids in the map and refresh the
// backup (deletion insurance + the reconciliation baseline).
export async function writeTrackedEntry(categoryName: string, entryName: string, text: string): Promise<void> {
  const { id: categoryId } = await LorebookManager.ensureCategory(categoryName);
  await TrackedLorebook.remember(categoryName, undefined, categoryId);
  const created = await LorebookManager.ensureEntry(categoryId, entryName, text);
  if (!created) await LorebookManager.updateEntryText(categoryName, entryName, text);
  const want = entryName.trim().toLowerCase();
  const entry = (await api.v1.lorebook.entries(categoryId)).find(e => (e.displayName ?? "").trim().toLowerCase() === want);
  if (entry) await TrackedLorebook.remember(categoryName, entryName, entry.id);
  await TrackedLorebook.refreshBackup(categoryName, entryName, text);
}

// The wod:config family writes through the tracked path.
async function writeConfigEntry(entry: string, text: string): Promise<void> {
  await writeTrackedEntry(CONFIG_CATEGORY, entry, text);
}

// Ensure a VIRTUAL PATH exists: the real category `wod:<path>` plus its
// tracked `general` card (seeded with the given tutorial header + empty JSON
// when created; an existing card's text is never touched). The subcategory
// policy's one constructor.
export async function ensurePath(virtualPath: string, generalHeader: string[] = ["Data for this category, below the marker."]): Promise<{ category: string; createdEntry: boolean }> {
  const category = `wod:${StringUtil.normalize(virtualPath)}`;
  const { id: categoryId } = await LorebookManager.ensureCategory(category);
  await TrackedLorebook.remember(category, undefined, categoryId);
  const seeded = [...generalHeader, SRD_HEADER_MARKER, "# (nothing here yet)"].join("\n");
  const createdEntry = await LorebookManager.ensureEntry(categoryId, GENERAL_ENTRY, seeded);
  const want = GENERAL_ENTRY;
  const entry = (await api.v1.lorebook.entries(categoryId)).find(e => (e.displayName ?? "").trim().toLowerCase() === want);
  if (entry) {
    await TrackedLorebook.remember(category, GENERAL_ENTRY, entry.id);
    await TrackedLorebook.refreshBackup(category, GENERAL_ENTRY, entry.text ?? seeded);
  }
  return { category, createdEntry };
}

// A list of named defs, JSON array (or name -> def map) in the entry, overlaid
// on optional shipped defaults: the overlay SHADOWS a same-named default;
// remove() only deletes overlay entries (a shadowed default resurfaces).
export class ListConfigStore<T extends { name: string }> {
  readonly entry: string;
  private readonly _header: string[];
  private readonly _make: (raw: Partial<T> & { name: string }) => T;
  private readonly _defaults: T[];
  private readonly _onChanged?: (overlay: T[]) => void;
  private _overlay: T[] = [];

  constructor(opts: {
    entry: string;
    header: string[];
    make: (raw: Partial<T> & { name: string }) => T;
    defaults?: T[];
    // Fires on EVERY cache change (load/save/reset) - the seam for stores
    // whose consumers read a separate registry (success tables).
    onChanged?: (overlay: T[]) => void;
  }) {
    this.entry = opts.entry;
    this._header = opts.header;
    this._make = opts.make;
    this._defaults = opts.defaults ?? [];
    this._onChanged = opts.onChanged;
    ALL_CONFIG_STORES.push(this);
  }

  private _apply(overlay: T[]): void {
    this._overlay = overlay;
    this._onChanged?.(overlay);
  }

  get(name: string): T | undefined {
    const n = StringUtil.normalize(name);
    return this._overlay.find(d => d.name === n) ?? this._defaults.find(d => d.name === n);
  }
  all(): T[] {
    const names = new Set(this._overlay.map(d => d.name));
    return [...this._overlay, ...this._defaults.filter(d => !names.has(d.name))];
  }
  reset(): void { this._apply([]); }

  async loadFromLorebook(): Promise<number> {
    const parsed = parseConfigBody(await LorebookManager.entryText(CONFIG_CATEGORY, this.entry));
    this._apply(parseNamedConfigList<T>(parsed).map(d => this._make(d)));
    return this._overlay.length;
  }

  async save(defs: T[]): Promise<void> {
    await writeConfigEntry(this.entry, configEntryText(this._header, namedDefsToCard(defs)));
    this._apply(defs);
  }

  // Add or replace one def (by normalized name) and persist.
  async put(def: T): Promise<void> {
    await this.save([...this._overlay.filter(d => d.name !== def.name), def]);
  }

  // Remove an OVERLAY def; returns whether one existed (shipped defaults can
  // only be shadowed, never deleted).
  async remove(name: string): Promise<boolean> {
    const n = StringUtil.normalize(name);
    const rest = this._overlay.filter(d => d.name !== n);
    if (rest.length === this._overlay.length) return false;
    await this.save(rest);
    return true;
  }
}

// A name -> value map in the entry (the resource-overrides shape).
export class MapConfigStore<V> {
  readonly entry: string;
  private readonly _header: string[];
  private _cache: Record<string, V> = {};

  constructor(opts: { entry: string; header: string[] }) {
    this.entry = opts.entry;
    this._header = opts.header;
    ALL_CONFIG_STORES.push(this);
  }

  current(): Record<string, V> { return this._cache; }
  reset(): void { this._cache = {}; }

  async loadFromLorebook(): Promise<number> {
    const parsed = parseConfigBody(await LorebookManager.entryText(CONFIG_CATEGORY, this.entry));
    this._cache = asMap(parsed) as unknown as Record<string, V>;
    return Object.keys(this._cache).length;
  }

  async save(map: Record<string, V>): Promise<void> {
    await writeConfigEntry(this.entry, configEntryText(this._header, map as unknown as CardMap));
    this._cache = map;
  }
}

// TWO REGISTRIES, because they are two categories (rules.ts "OWNED POWERS").
// The shape below is shared; the contents never mix. A merits card that names
// an arcanum is skipped and REPORTED, saying where it belongs - the old
// behaviour filed it as a merit, which is exactly the conflation this split
// exists to end.
class OwnedPowerRegistry<T extends { name: string; kind: string }> {
  private _defs: Map<string, T>;
  constructor(
    private readonly _defaults: T[],
    private readonly _category: string,
    private readonly _read: (name: string, body: CardMap) => T | undefined,
    private readonly _label: string,
    private readonly _kinds: readonly string[],
    private readonly _elsewhere: string,
  ) {
    this._defs = new Map(_defaults.map(d => [StringUtil.normalize(d.name), d]));
  }
  get(name: string): T | undefined { return this._defs.get(StringUtil.normalize(name)); }
  all(): T[] { return [...this._defs.values()]; }
  register(def: T): void { this._defs.set(StringUtil.normalize(def.name), def); }
  reset(): void { this._defs = new Map(this._defaults.map(d => [StringUtil.normalize(d.name), d])); }
  get category(): string { return this._category; }

  // Merge lorebook definitions over the defaults: every entry in this
  // registry's category, read as `name:` blocks below the marker. Returns how
  // many definitions were registered.
  async loadFromLorebook(): Promise<number> {
    let count = 0;
    for (const entry of await LorebookManager.entriesInCategory(this._category)) {
      const parsed = parseCardText(LorebookManager.contentBelowHeader(entry.text ?? "").trim());
      if (parsed === undefined) continue;
      let skipped = 0;
      const misfiled: string[] = [];
      for (const { name, body } of asNamedList(parsed)) {
        const def = this._read(name, body);
        if (def) { this.register(def); count++; continue; }
        const claimed = kindOnCard(body);
        // A block that says what it is, in a category that does not hold that
        // kind, is not malformed - it is in the wrong drawer. Say which one.
        if (claimed && OWNED_POWER_KINDS.includes(claimed as never)) misfiled.push(`${name} (${claimed})`);
        else skipped++;
      }
      if (skipped) log(`[${this._label}] ${entry.displayName}: skipped ${skipped} definition(s) with no kind (${this._kinds.join("|")})`);
      if (misfiled.length) {
        log(`[${this._label}] ${entry.displayName}: ${misfiled.join(", ")} belong${misfiled.length === 1 ? "s" : ""} in ${this._elsewhere}, not here - not loaded`);
      }
    }
    return count;
  }
}

export const MeritFlawRegistry = new OwnedPowerRegistry<MeritFlawDef>(
  DEFAULT_MERITS_FLAWS, "srd:merits-flaws", meritFlawFromCard, "MERITS",
  MERIT_FLAW_KINDS, "srd:arcana",
);
export const ArcanumRegistry = new OwnedPowerRegistry<ArcanumDef>(
  DEFAULT_ARCANA, "srd:arcana", arcanumFromCard, "ARCANA",
  ARCANUM_KINDS, "srd:merits-flaws",
);

// --- LOREBOOK PARSER ---
// Builds zero-dot Stat maps from the lorebook ability/background lists (see
// LorebookManager): talents/skills/knowledges from srd:abilities, backgrounds
// from srd:backgrounds.
export class LorebookParser {
  static async ParseFromApi(): Promise<{ abilities: Map<string, Stat>, backgrounds: Map<string, Stat> }> {
    const abilities = new Map<string, Stat>();
    const backgrounds = new Map<string, Stat>();

    const groups: Array<[string[], Category]> = [
      [await LorebookManager.allTalents(), Category.TALENT],
      [await LorebookManager.allSkills(), Category.SKILL],
      [await LorebookManager.allKnowledges(), Category.KNOWLEDGE],
    ];
    for (const [names, cat] of groups) {
      for (const name of names) abilities.set(StringUtil.normalize(name), new Stat(name, cat, 0));
    }
    for (const name of await LorebookManager.allBackgrounds()) {
      backgrounds.set(StringUtil.normalize(name), new Stat(name, Category.BACKGROUND, 0));
    }
    return { abilities, backgrounds };
  }
}

// =============================================================================
// THE POST OFFICE - the bus, wired to the other scripts
// -----------------------------------------------------------------------------
// core/bus.ts is the dispatch rule; this is the half that knows about
// api.v1.messaging. The owner's picture: every script keeps a post office. You
// walk to it to send something; you wait at home and it brings you what
// arrived. Send something to yourself and you still get it.
//
// So `publish` does two things in one call, and the caller never has to know
// which of them mattered:
//
//   1. DELIVERS LOCALLY, synchronously, through the bus - because
//      api.v1.messaging.broadcast() excludes the sender and every messaging
//      call resolves on a later tick. An event that went out and came back
//      would arrive after the thing that raised it had already finished, which
//      is useless for "let a handler adjust this before it happens". This is a
//      correctness choice, not a performance one.
//   2. RELAYS ONWARD - unless the channel is local: (never leaves), or a
//      handler said `stop` (nothing further, here or anywhere).
//
// `subscribe` is the same idea from the other side: a handler registered here
// hears local events AND anything a sibling script broadcast on that channel,
// and `event.from` is how it tells them apart when it cares.
//
// NOBODY IS LISTENING, SO NOBODY IS TOLD. The owner's rule, and it removes the
// engine's most embarrassing cost: every command used to make TWO
// api.v1.messaging.broadcast() calls (`command` and `command:<verb>`) into an
// empty room, because nothing else was installed. The host offers no script
// directory - `api.v1.script.id` exists, there is no `listScripts` - so
// interest has to be ANNOUNCED:
//
//   * on open(), broadcast a hello carrying {scriptId, channels};
//   * hearing a hello, record what that script wants and `send` ours straight
//     back to it - targeted, so a script joining late learns about the ones
//     already running without setting off a broadcast storm;
//   * publish() touches the wire only when some remote has declared that
//     channel (or `*`, for a monitor that wants everything).
//
// Alone, the directory stays empty and the wire is never touched at all: the
// command path goes from two awaits to none (invariants §11 counts awaits).
// The hello itself is exempt, since it is how the directory bootstraps.
// =============================================================================
export const Bus = new EventBus();

// Where scripts introduce themselves. Deliberately NOT `local:` - it is the one
// message that must always cross.
export const HELLO_CHANNEL = "naiowod:hello";
export const INTEREST_ALL = "*";
// `reply` is what terminates the handshake: A broadcasts a hello, B records it
// and sends one back MARKED as a reply, and A records that without answering.
// Two messages per pair, once, ever. Without the flag they introduce each other
// forever.
interface Hello { scriptId: string; channels: string[]; reply?: boolean }

export class PostOffice {
  private static _wired: number | undefined;
  // scriptId -> the channels that script says it listens on.
  private static _remote = new Map<string, Set<string>>();
  // The Bus version our last announcement described, so a newly-subscribed
  // channel re-announces itself and a quiet turn costs nothing.
  private static _announcedAt = -1;

  /** Channels some OTHER script has declared. Exposed for tests and [[show-*]]. */
  static remoteInterest(): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const [id, set] of PostOffice._remote) out[id] = [...set].sort();
    return out;
  }

  private static wanted(channel: string): boolean {
    for (const set of PostOffice._remote.values()) {
      if (set.has(INTEREST_ALL) || set.has(channel)) return true;
    }
    return false;
  }

  // What we tell the others: every channel we listen on that could ever cross.
  private static ourChannels(): string[] {
    return Bus.channels().filter(c => !isLocalChannel(c) && c !== HELLO_CHANNEL);
  }

  // Say hello. `to` targets one script, `isReply` marks it as the answer that
  // ENDS the handshake. The two are separate on purpose: a hello sent to a
  // remembered address is targeted but still OPENING - we want an answer back,
  // because the answer is how we learn that script is still there.
  // --- THE REMEMBERED ADDRESSES ---------------------------------------------
  // ADDRESSES persist; INTEREST does not, and the split is the whole design.
  // Reloading `_remote` from disk would re-arm the wire for a script that may
  // have been deleted, undoing "nobody is listening, so nobody is told". So the
  // cache only ever answers "who do I say hello TO" - a remembered script earns
  // its way into `_remote`, and so earns relayed traffic, ONLY by answering.
  // A deleted script therefore costs exactly one wasted send per load, then
  // ages out of the cache; it never costs a relayed event.
  private static _registry = new ScopedStorage(REGISTRY_PREFIX);

  private static async directory(): Promise<Record<string, number>> {
    try {
      const raw = await PostOffice._registry.getOrDefault<Record<string, number>>(DIRECTORY_KEY, {});
      const cutoff = Date.now() - DIRECTORY_TTL_MS;
      return Object.fromEntries(
        Object.entries(raw).filter(([id, at]) => typeof at === "number" && at > cutoff && id !== api.v1.script.id),
      );
    } catch { return {}; }        // a host without storage is not an error
  }

  /** Record that a script exists at this id, so the next load can skip the broadcast. */
  static async remember(scriptId: string): Promise<void> {
    if (!scriptId || scriptId === api.v1.script.id) return;
    try {
      const dir = await PostOffice.directory();
      dir[scriptId] = Date.now();
      await PostOffice._registry.set(DIRECTORY_KEY, dir);
    } catch { /* nothing to remember with */ }
  }

  /** Addresses we remember from previous sessions. Exposed for tests and [[show-*]]. */
  static async remembered(): Promise<string[]> {
    return Object.keys(await PostOffice.directory()).sort();
  }

  private static async announce(to?: string, isReply = false): Promise<void> {
    const messaging = (api as { v1?: { messaging?: {
      broadcast?: (data: unknown, channel?: string) => Promise<void>;
      send?: (toScriptId: string, data: unknown, channel?: string) => Promise<void>;
    } } }).v1?.messaging;
    if (!messaging) return;
    const hello: Hello = {
      scriptId: api.v1.script.id, channels: PostOffice.ourChannels(),
      ...(isReply ? { reply: true } : {}),
    };
    PostOffice._announcedAt = Bus.version;
    try {
      if (to) await messaging.send?.(to, hello, HELLO_CHANNEL);
      else await messaging.broadcast?.(hello, HELLO_CHANNEL);
    } catch { /* a host without messaging is not an error */ }
  }

  // Start listening to the wire. Idempotent: calling it twice keeps the one
  // subscription, so init() may call it without bookkeeping.
  static async open(): Promise<void> {
    if (PostOffice._wired !== undefined) return;
    const messaging = (api as { v1?: { messaging?: {
      onMessage?: (cb: (m: unknown) => unknown, filter?: unknown) => Promise<number>;
    } } }).v1?.messaging;
    if (!messaging?.onMessage) return;   // a host without messaging is not an error
    PostOffice._wired = await messaging.onMessage((raw: unknown) => {
      const m = (raw ?? {}) as { fromScriptId?: string; channel?: string; data?: unknown; timestamp?: number };
      if (!m.channel) return;
      // A hello is directory traffic, not an event: record what they want, tell
      // them what we want, and do not put it on the bus.
      if (busChannel(m.channel) === HELLO_CHANNEL) {
        const hello = (m.data ?? {}) as Partial<Hello>;
        const who = hello.scriptId ?? m.fromScriptId;
        if (!who || who === api.v1.script.id) return;
        PostOffice._remote.set(who, new Set((hello.channels ?? []).map(busChannel)));
        // Answer an opening hello; never answer an answer.
        if (!hello.reply && m.fromScriptId) void PostOffice.announce(m.fromScriptId, true);
        // Remember the address. Next load we can write to them directly instead
        // of shouting into the room and waiting a tick for the answer.
        if (m.fromScriptId) void PostOffice.remember(m.fromScriptId);
        return;
      }
      // Arrived from outside, so it is announced with `from` set - and it is
      // NOT relayed onward: this script is a subscriber, not a repeater.
      Bus.emit(m.channel, m.data, { from: m.fromScriptId, at: m.timestamp });
    });
    // THE KNOWN KEY FIRST, THE BROADCAST ONLY IF IT MISSES. A remembered
    // address gets a targeted opening hello; if we remember nobody - first ever
    // load, or everyone has aged out - fall back to shouting into the room.
    // Either way the answers arrive on a LATER tick, so this is where init
    // waits, and it is safe to wait here precisely because init runs on ENABLE
    // rather than on a command that owes somebody a reply this turn.
    const known = await PostOffice.remembered();
    if (known.length) for (const id of known) await PostOffice.announce(id);
    else await PostOffice.announce();
  }

  static async close(): Promise<void> {
    const messaging = (api as { v1?: { messaging?: { unsubscribe?: (i: number) => Promise<void> } } }).v1?.messaging;
    // Best-effort: a host that has already dropped our subscription (a reload,
    // a fresh script run) will refuse the index, and that is not a failure -
    // the point of closing is that `_wired` stops claiming we are listening.
    if (PostOffice._wired !== undefined) {
      try { await messaging?.unsubscribe?.(PostOffice._wired); } catch { /* already gone */ }
    }
    PostOffice._wired = undefined;
    // The directory is only true while we are listening. Keeping it across a
    // close would let a stale entry keep the wire alive for a script that is no
    // longer there.
    PostOffice._remote.clear();
    PostOffice._announcedAt = -1;
    // The stored directory deliberately SURVIVES a close. `_remote` is "who is
    // listening right now" and is only true while we are; the directory is "who
    // has ever been here", which is what saves the next load a round-trip.
  }

  // Announce something. Local handlers have all run by the time this resolves;
  // the returned event carries their verdicts, so a caller may ask "was this
  // cancelled?" and act on the answer.
  static async publish<T>(channel: string, data: T): Promise<BusEvent<T>> {
    const event = Bus.emit(channel, data);
    // Handlers voted synchronously; now let whatever they STARTED finish. This
    // is what lets an event CAUSE something (apply an affliction, write a
    // store) rather than merely announce that it already happened.
    if (event.pending.length) {
      const settled = await Promise.allSettled(event.pending);
      for (const r of settled) if (r.status === "rejected") event.errors.push(`handler: ${String(r.reason)}`);
    }
    if (event.stopped || isLocalChannel(channel)) return event;
    // We only ever announced the channels we had at the time. Picking up a new
    // subscription since then means the others' picture of us is stale, so say
    // hello again - guarded by the Bus version, so a quiet turn costs nothing.
    if (PostOffice._wired !== undefined && Bus.version !== PostOffice._announcedAt) {
      await PostOffice.announce();
    }
    // NOBODY IS LISTENING, SO NOBODY IS TOLD. The whole point: alone, this
    // returns here and the wire is never touched.
    if (!PostOffice.wanted(event.channel)) return event;
    const messaging = (api as { v1?: { messaging?: {
      broadcast?: (data: unknown, channel?: string) => Promise<void>;
    } } }).v1?.messaging;
    // Only PLAIN DATA crosses a wire (the docs say "will be serialized"), which
    // is why the engine's shareable layers are already plain: TemplateDef,
    // ResourceDef, SavedRoll, the card text. A class instance would arrive
    // stripped of its methods, so nothing here tries to send one.
    try { await messaging?.broadcast?.(event.data, event.channel); }
    catch (err) { event.errors.push(`relay: ${err instanceof Error ? err.message : String(err)}`); }
    return event;
  }

  // A bare priority still works and still means the `on` phase; pass
  // `{ phase: "before" }` to veto, `{ phase: "after" }` to react.
  static subscribe<T = unknown>(
    channel: string,
    handler: BusHandler<T>,
    opts: BusPriority | BusSubscribeOptions = "normal",
  ): number {
    return Bus.on(channel, handler, opts);
  }
  static unsubscribe(id: number): boolean { return Bus.off(id); }
}
