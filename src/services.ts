import { log } from "./host";
import { StringUtil, Stat, Category } from "./core/traits";
import { SRD_CATEGORIES, SrdCategorySpec, SRD_HEADER_MARKER, DEFAULT_MERITS_FLAWS, MeritFlawDef } from "./rules";

// =============================================================================
// STORAGE & LOREBOOK MANAGERS - the script's editable database layer
// -----------------------------------------------------------------------------
// ScopedStorage namespaces storage under a uuid prefix (the script id by
// default) and pairs every persistent method with a temp* variant on
// api.v1.tempStorage - volatile scratch state the host clears when the script
// unloads. LorebookManager reads lorebook entries as data: rule lists live in
// entries whose text is a newline list (or JSON) beneath a human-readable
// header, so the user edits game data like a database table in the lorebook UI.
// =============================================================================
export class ScopedStorage {
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
      "[SYSTEM]: Storyteller setup",
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
  "Global configuration for this chronicle. The JSON below the marker holds",
  "story-wide settings (none are read yet - this card is the documented home",
  "for future global options). Edit in creator mode.",
];
export const TABLE_GENERAL_HEADER = [
  "Success tables for this category. The JSON below the marker is an array of",
  "tables (or a map name -> table). [[define-table]] writes here; you may add",
  "MORE cards to this category to split a large set - every card is read, and",
  "a later card's table shadows an earlier one with the same name.",
];

// Content-only structural hash: the tutorial header above the marker never
// participates, so editing instructions can't trip a conflict. JSON bodies are
// canonicalized (recursively sorted keys); anything unparseable falls back to
// whitespace-collapsed text. djb2, hex.
export function structuralHash(text: string): string {
  const body = LorebookManager.contentBelowHeader(text).trim();
  const canon = (v: unknown): unknown => Array.isArray(v) ? v.map(canon)
    : (v && typeof v === "object")
      ? Object.fromEntries(Object.keys(v as Record<string, unknown>).sort().map(k => [k, canon((v as Record<string, unknown>)[k])]))
      : v;
  let s: string;
  try { s = JSON.stringify(canon(JSON.parse(body))); } catch { s = body.replace(/\s+/g, " "); }
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
  private static readonly IDS_KEY = "lb:ids";
  private static _backupKey(category: string, entry: string): string { return `lb:backup:${category}/${entry}`; }

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

// Union of two config card texts (both must parse). Shapes are preserved from
// the FOUND (player's newer) card: map -> spread union; array-of-named-defs ->
// name-keyed union. The player's defs win collisions; backup-only defs are
// kept. The found card's header text stays. Undefined = not combinable.
export function combineConfigTexts(backupText: string, foundText: string): string | undefined {
  const parse = (t: string): unknown => {
    try { return JSON.parse(LorebookManager.contentBelowHeader(t).trim()); } catch { return undefined; }
  };
  const backup = parse(backupText);
  const found = parse(foundText);
  if (backup === undefined || found === undefined) return undefined;
  // Everything up to (and including) the found card's marker line; the JSON
  // goes back on its own line below it.
  const header = foundText.slice(0, foundText.length - LorebookManager.contentBelowHeader(foundText).length);
  let combined: unknown;
  if (Array.isArray(backup) && Array.isArray(found)) {
    const byName = new Map<string, unknown>();
    const keyOf = (d: unknown): string | undefined => {
      const n = (d as { name?: unknown })?.name;
      return typeof n === "string" ? StringUtil.normalize(n) : undefined;
    };
    const extras: unknown[] = [];
    for (const list of [backup, found]) {
      for (const d of list) {
        const k = keyOf(d);
        if (k !== undefined) byName.set(k, d); else if (list === found) extras.push(d);
      }
    }
    combined = [...byName.values(), ...extras];
  } else if (backup && found && typeof backup === "object" && typeof found === "object" && !Array.isArray(backup) && !Array.isArray(found)) {
    combined = { ...(backup as Record<string, unknown>), ...(found as Record<string, unknown>) };
  } else {
    return undefined;
  }
  return `${header}\n${JSON.stringify(combined, null, 2)}`;
}

// =============================================================================
// CONFIG STORES - the generic shape of "wod:config" registries
// -----------------------------------------------------------------------------
// Every story-config registry works the same way: ONE lorebook entry under the
// wod:config category (tutorial header above the marker, JSON below), parsed as
// an array OR a name -> def map, cached module-level for synchronous reads,
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
function configEntryText(header: string[], data: unknown): string {
  return [...header, SRD_HEADER_MARKER, JSON.stringify(data, null, 2)].join("\n");
}

// Parse an entry body as JSON; undefined when missing/unparseable (the entry
// stays for the player to fix - never destroyed by a bad edit).
export function parseConfigBody(text: string | undefined): unknown {
  if (!text) return undefined;
  const body = LorebookManager.contentBelowHeader(text).trim();
  if (!body) return undefined;
  try { return JSON.parse(body); } catch { return undefined; }
}

// Normalize a parsed config body (array of named defs OR name -> def map) to
// a list of partials that carry their name. Shared by ListConfigStore and the
// TableLibrary's multi-card loader.
export function parseNamedConfigList<T extends { name: string }>(parsed: unknown): Array<Partial<T> & { name: string }> {
  const list: Array<Partial<T> & { name: string }> = Array.isArray(parsed)
    ? parsed as Array<Partial<T> & { name: string }>
    : (parsed && typeof parsed === "object")
      ? Object.entries(parsed as Record<string, Partial<T>>).map(([name, d]) => ({ ...d, name } as Partial<T> & { name: string }))
      : [];
  return list.filter(d => d && typeof d.name === "string" && d.name.trim().length > 0);
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
export async function ensurePath(virtualPath: string, generalHeader: string[] = ["Data for this category. JSON below the marker."]): Promise<{ category: string; createdEntry: boolean }> {
  const category = `wod:${StringUtil.normalize(virtualPath)}`;
  const { id: categoryId } = await LorebookManager.ensureCategory(category);
  await TrackedLorebook.remember(category, undefined, categoryId);
  const seeded = [...generalHeader, SRD_HEADER_MARKER, "[]"].join("\n");
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
    await writeConfigEntry(this.entry, configEntryText(this._header, defs));
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
    this._cache = (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      ? parsed as Record<string, V>
      : {};
    return Object.keys(this._cache).length;
  }

  async save(map: Record<string, V>): Promise<void> {
    await writeConfigEntry(this.entry, configEntryText(this._header, map));
    this._cache = map;
  }
}

export class MeritFlawRegistry {
  private static _defs: Map<string, MeritFlawDef> =
    new Map(DEFAULT_MERITS_FLAWS.map(d => [StringUtil.normalize(d.name), d]));

  static get(name: string): MeritFlawDef | undefined {
    return MeritFlawRegistry._defs.get(StringUtil.normalize(name));
  }
  static all(): MeritFlawDef[] { return [...MeritFlawRegistry._defs.values()]; }
  static register(def: MeritFlawDef): void {
    MeritFlawRegistry._defs.set(StringUtil.normalize(def.name), def);
  }
  static reset(): void {
    MeritFlawRegistry._defs = new Map(DEFAULT_MERITS_FLAWS.map(d => [StringUtil.normalize(d.name), d]));
  }

  // Merge lorebook definitions over the defaults: every entry in the
  // srd:merits-flaws category whose text parses as a JSON array of defs.
  // Returns how many definitions were registered.
  static async loadFromLorebook(): Promise<number> {
    let count = 0;
    for (const entry of await LorebookManager.entriesInCategory("srd:merits-flaws")) {
      // Data is the JSON array below the header marker; anything else is skipped.
      const body = LorebookManager.contentBelowHeader(entry.text ?? "").trim();
      if (!body.startsWith("[")) continue;
      try {
        const parsed = JSON.parse(body);
        if (!Array.isArray(parsed)) continue;
        for (const def of parsed) {
          if (def && typeof def.name === "string" && (def.kind === "merit" || def.kind === "flaw")) {
            MeritFlawRegistry.register(def as MeritFlawDef);
            count++;
          }
        }
      } catch {
        log(`[MERITS] Skipping unparseable lorebook entry: ${entry.displayName}`);
      }
    }
    return count;
  }
}

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
