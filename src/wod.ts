// =============================================================================
// NAIoWoD - World of Darkness (Dark Ages) character system for NovelAI scripting
// -----------------------------------------------------------------------------
// Single-file module: at runtime inside NovelAI the host injects a global `api`
// object; locally (and in tests) the mock below is used instead. Everything is
// exported so the test suite can import it; for a NovelAI deployment you can run
// the `build` script (or simply strip the `export` keywords and the mock).
//
// Mechanics target the classic Storyteller system (Dark Ages flavour): d10 dice
// pools, 7-level health tracks with bashing/lethal/aggravated damage, soak rolls
// whose rules vary by template, and resource pools (Willpower, Blood, Resolve,
// Quintessence, Torment, ...) plus optional Roads/Virtues. Where a rule has
// multiple table interpretations the choice is noted in a comment.
// =============================================================================

// --- API CONTRACT ---
// Mirrors the real NovelAI scripting API (docs.novelai.net/en/scripting):
// storage & lorebook calls are async; lorebook entries are filtered by category
// *id* (categories() resolves names to ids); storyStorage offers setIfAbsent;
// the host also provides uuid() and log(). The mock below implements the same
// surface in memory so the engine behaves identically off-host and in tests.
// Exact host shape (docs/api-reference.html): the handler may be async, may
// rewrite the input and mode, and may stop generation. Newlines in the
// returned inputText are NOT allowed (the host replaces them with spaces).
export interface OnTextAdventureInputReturnValue {
  stopFurtherScripts?: boolean;
  inputText?: string;
  mode?: "action" | "dialogue" | "story";
  stopGeneration?: boolean;
}
export type OnTextAdventureInput = (params: {
  continuityId?: string;
  inputText?: string;
  rawInputText: string;
  mode?: "action" | "dialogue" | "story";
}) => OnTextAdventureInputReturnValue | void | Promise<OnTextAdventureInputReturnValue | void>;

export interface LorebookCondition { [k: string]: unknown }
export interface LorebookEntryData {
  id: string;
  displayName?: string;
  category?: string;   // owning category id (undefined = uncategorized)
  text?: string;
  keys?: string[];
  hidden?: boolean;
  enabled?: boolean;
  advancedConditions?: LorebookCondition[];
  forceActivation?: boolean;
}
export interface LorebookCategoryData {
  id: string;
  name?: string;
  enabled?: boolean;
  settings?: { entryHeader?: string };
}

// All four stores share this surface (docs/storage-api.html): set, get,
// remove, and list (all currently-set keys).
interface StorageApi {
  get: (key: string) => Promise<unknown>;
  set: (key: string, value: unknown) => Promise<void>;
  remove: (key: string) => Promise<void>;
  list: () => Promise<string[]>;
}

interface WodApi {
  v1: {
    script: { id: string; name?: string; version?: string; author?: string };
    uuid: () => string;
    log: (...args: unknown[]) => void;
    // Story-scoped storage: travels with the story file.
    storyStorage: StorageApi;
    // Story-scoped AND history-aware: a value is set at a point in the document
    // history, and undoing past that node reverts it. The natural home for
    // mechanical state (damage, pool spends) - adoption is a planned follow-up.
    historyStorage: StorageApi;
    // Session-scoped scratch: persists for the current session and is cleared
    // when the story is closed. For UI sync via storage keys and any state we
    // deliberately don't want to keep.
    tempStorage: StorageApi;
    lorebook: {
      entry: (entryId: string) => Promise<LorebookEntryData | null>;
      entries: (categoryId?: string) => Promise<LorebookEntryData[]>;
      categories: () => Promise<LorebookCategoryData[]>;
      // Per the API reference: create* take Partial objects and resolve to the
      // NEW ID (a string). Pass id: api.v1.uuid() to control/reuse the id.
      createCategory: (data: Partial<LorebookCategoryData>) => Promise<string>;
      createEntry: (data: Partial<LorebookEntryData>) => Promise<string>;
      updateEntry: (id: string, entry: Partial<LorebookEntryData>) => Promise<void>;
      removeEntry: (id: string) => Promise<void>;
    };
    hooks: { register: (event: "onTextAdventureInput", handler: OnTextAdventureInput) => void };
  };
}

// --- API MOCK (yields to a real host-provided `api` when one exists) ---
// The mock lorebook starts EMPTY, like a fresh NovelAI story: it is the script's
// job to create its categories and seed them (see LorebookManager.bootstrap).
const __host = globalThis as unknown as { api?: WodApi };
const __mockStore = new Map<string, unknown>();
const __mockHistoryStore = new Map<string, unknown>();
const __mockTempStore = new Map<string, unknown>();
let __mockCategories: LorebookCategoryData[] = [];
let __mockEntries: LorebookEntryData[] = [];
let __mockUuidCounter = 0;
const __mockUuid = (): string => {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  return g.crypto?.randomUUID?.() ?? `mock-uuid-${++__mockUuidCounter}`;
};
const __makeMockStore = (m: Map<string, unknown>): StorageApi => ({
  get: async (key) => m.get(key),
  set: async (key, value) => { m.set(key, value); },
  remove: async (key) => { m.delete(key); },
  list: async () => [...m.keys()],
});

// Test/off-host helper: wipe the mock lorebook back to a fresh (empty) story.
// A no-op concern on-host, where the real `api` (not this mock) is used.
export function __resetLorebookMock(): void { __mockCategories = []; __mockEntries = []; }

const api: WodApi = __host.api ?? {
  v1: {
    script: { id: "a1b2c3d4-script-uuid" },
    uuid: __mockUuid,
    log: (...args: unknown[]) => console.log(...args),
    storyStorage: __makeMockStore(__mockStore),
    // The mock is not history-aware (no document history off-host); it just
    // gives historyStorage its own bucket with the same surface.
    historyStorage: __makeMockStore(__mockHistoryStore),
    tempStorage: __makeMockStore(__mockTempStore), // session-scoped; cleared when the story closes
    lorebook: {
      entry: async (entryId: string) => __mockEntries.find(e => e.id === entryId) ?? null,
      categories: async () => __mockCategories,
      entries: async (categoryId?: string) =>
        categoryId === undefined ? __mockEntries : __mockEntries.filter(e => e.category === categoryId),
      // Mirror the host: generate a uuid when the caller doesn't supply one,
      // and resolve to the new ID (a string), per the API reference.
      createCategory: async (data) => { const c = { ...data, id: data.id ?? __mockUuid() }; __mockCategories.push(c); return c.id; },
      createEntry: async (data) => { const e = { ...data, id: data.id ?? __mockUuid() }; __mockEntries.push(e); return e.id; },
      updateEntry: async (id, entry) => {
        const i = __mockEntries.findIndex(e => e.id === id);
        if (i !== -1) __mockEntries[i] = { ...__mockEntries[i], ...entry, id };
      },
      removeEntry: async (id) => { __mockEntries = __mockEntries.filter(e => e.id !== id); },
    },
    // Off-host there is no engine to fire hooks; registering just records that a
    // handler exists (and keeps `hooks.register(...)` from throwing).
    hooks: {
      register: (event: "onTextAdventureInput", _handler: OnTextAdventureInput) => {
        log(`[HOOK REGISTER] ${event}`);
      }
    }
  }
};

// --- UTILITIES & CONSTANTS ---
// Project-wide logger: routes through the host's logger (console.log off-host).
export function log(...args: unknown[]): void { api.v1.log(...args); }

export class StringUtil {
  static normalize(str: string): string {
    return str.toLowerCase().trim().replace(/\s+/g, '-');
  }

  // Parses srd:ability:talent:brawl -> { kind: "ability", sub: "talent", name: "brawl" }
  static parseSrdName(srdString: string): { kind: string, subCategory: string, name: string } {
    const parts = srdString.toLowerCase().split(':');
    if (parts[0] !== 'srd' || parts.length < 4) return { kind: "unknown", subCategory: "none", name: srdString };
    return { kind: parts[1], subCategory: parts[2], name: parts.slice(3).join('-') };
  }

  // "blood-potency" / "self_control" -> "Blood Potency" / "Self Control"
  static toTitleCase(str: string): string {
    return str
      .replace(/[-_]+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(w => w.length > 0)
      .map(w => w[0].toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }
}

// =============================================================================
// STORAGE & LOREBOOK MANAGERS - the script's editable database layer
// -----------------------------------------------------------------------------
// StorageManager namespaces storage under a uuid prefix (the script id by
// default) and pairs every persistent method with a temp* variant on
// api.v1.tempStorage - volatile scratch state the host clears when the script
// unloads. LorebookManager reads lorebook entries as data: rule lists live in
// entries whose text is a newline list (or JSON) beneath a human-readable
// header, so the user edits game data like a database table in the lorebook UI.
// =============================================================================
export class StorageManager {
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

// A lorebook data entry is a human-readable header, then a marker line of '='
// (>= 3), then the data. On read, everything above the marker is ignored - so
// the instructions live right in the entry card the player edits, no separate
// readme needed. Below the marker, '#' or '//' start a note on list entries.
export const SRD_HEADER_MARKER = "=====";
function srdEntryText(header: string[], body: string[]): string {
  return [...header, SRD_HEADER_MARKER, ...body].join("\n");
}
const __srdEditNote = "You may delete, rename or add lines below before you start playing.";

export interface SrdSeedEntry { displayName: string; text: string; }
export interface SrdCategorySpec { name: string; blurb: string; entries: SrdSeedEntry[]; }

export const SRD_CATEGORIES: SrdCategorySpec[] = [
  {
    name: "srd:abilities",
    blurb: "the Talents, Skills and Knowledges available at creation (one per line)",
    entries: [
      { displayName: "srd:abilities:talents", text: srdEntryText(
        [`Talents your chronicle uses - one per line below the ${SRD_HEADER_MARKER} line.`, __srdEditNote, "Everything above the marker is ignored; '#' starts a note."],
        ["Alertness", "Athletics", "Awareness", "Brawl", "Empathy", "Expression", "Intimidation", "Leadership", "Legerdemain", "Subterfuge"]) },
      { displayName: "srd:abilities:skills", text: srdEntryText(
        [`Skills your chronicle uses - one per line below the ${SRD_HEADER_MARKER} line.`, __srdEditNote],
        ["Animal Ken", "Archery", "Commerce", "Crafts", "Etiquette", "Melee", "Performance", "Ride", "Stealth", "Survival"]) },
      { displayName: "srd:abilities:knowledges", text: srdEntryText(
        [`Knowledges your chronicle uses - one per line below the ${SRD_HEADER_MARKER} line.`, __srdEditNote],
        ["Academics", "Enigmas", "Hearth Wisdom", "Investigation", "Law", "Medicine", "Occult", "Politics", "Seneschal", "Theology"]) },
    ],
  },
  {
    name: "srd:backgrounds",
    blurb: "the Backgrounds available at creation (one per line)",
    entries: [
      { displayName: "srd:backgrounds:all", text: srdEntryText(
        [`Backgrounds characters may buy at creation - one per line below the ${SRD_HEADER_MARKER} line.`, __srdEditNote],
        ["Allies", "Contacts", "Domain", "Generation", "Herd", "Influence", "Mentor", "Resources", "Retainers", "Status"]) },
    ],
  },
  {
    name: "srd:merits-flaws",
    blurb: "custom Merits & Flaws (JSON), layered over the built-in list",
    entries: [
      { displayName: "srd:merits-flaws:custom", text: srdEntryText(
        [
          `Custom Merits & Flaws. Put a JSON array below the ${SRD_HEADER_MARKER} line; it is merged over the built-in list. Each definition:`,
          '  name        - display name',
          '  kind        - "merit" or "flaw"',
          '  points      - freebie cost (merit) / bonus (flaw); a number, or [1,2,3] for variable ratings',
          '  requires    - optional { "templates": [any-of], "tags": [all-of], "meritsFlaws": [all-of] }',
          '  description - optional text',
          "The two below are examples - edit or replace them.",
        ],
        [JSON.stringify([
          { name: "Sturdy Stock", kind: "merit", points: 2, requires: { tags: ["revenant"] }, description: "Hardy revenant lineage." },
          { name: "Illiterate", kind: "flaw", points: 1, description: "You cannot read or write." },
        ], null, 2)]) },
    ],
  },
];

export class LorebookManager {
  // The host API filters entries by category *id*; users think in category
  // *names* ("srd:abilities"), so resolve the name first.
  static async categoryIdByName(name: string): Promise<string | undefined> {
    const want = name.trim().toLowerCase();
    const categories = await api.v1.lorebook.categories();
    return categories.find(c => (c.name ?? "").trim().toLowerCase() === want)?.id;
  }

  static async entriesInCategory(categoryName: string): Promise<LorebookEntryData[]> {
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
  // comments and /* */ block comments stripped.
  static parseList(text: string): string[] {
    return LorebookManager.contentBelowHeader(text)
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .map(l => l.replace(/(^|\s)(#|\/\/).*$/, "$1").trim())
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
      "((OOC — Storyteller setup))",
      "I've added the lorebook categories this game needs and filled them with starter data and examples. Open your Lorebook and review / edit:",
      ...lines,
      `Each entry starts with instructions; the data is below its "${SRD_HEADER_MARKER}" line. Tune these to your chronicle, then we’re ready to play.`,
    ].join("\n");
  }
}

export type CategoryType =
  | "physical" | "social" | "mental"
  | "talent" | "skill" | "knowledge"
  | "background" | "tracker" | "virtue" | "morality" | "vital" | "discipline";
export class Category {
  static readonly PHYSICAL = new Category("physical");
  static readonly SOCIAL = new Category("social");
  static readonly MENTAL = new Category("mental");
  static readonly TALENT = new Category("talent");
  static readonly SKILL = new Category("skill");
  static readonly KNOWLEDGE = new Category("knowledge");
  static readonly BACKGROUND = new Category("background");
  static readonly TRACKER = new Category("tracker");
  static readonly VIRTUE = new Category("virtue");
  static readonly MORALITY = new Category("morality");
  static readonly VITAL = new Category("vital");
  static readonly DISCIPLINE = new Category("discipline");

  public readonly Name: string;
  private constructor(name: CategoryType) {
    this.Name = name;
    Object.freeze(this);
  }
}

export type PointSourceType = "base" | "freebie" | "experience" | "downtime";
export class PointSource {
  static readonly BASE = new PointSource("base");
  static readonly FREEBIE = new PointSource("freebie");
  static readonly EXPERIENCE = new PointSource("experience");
  static readonly DOWNTIME = new PointSource("downtime");

  public readonly Name: string;
  private constructor(name: PointSourceType) {
    this.Name = name;
    Object.freeze(this);
  }
}

// --- CONFIGURATION ---
export class RulesetConfig {
  constructor(
    public readonly AttrFreebieCost: number,
    public readonly AbilityFreebieCost: number,
    public readonly AttrXPMultiplier: number,
    public readonly AbilityXPMultiplier: number,
    public readonly UsesDowntime: boolean,
    public readonly AttrDowntimeCost: number = 0,
    public readonly AbilityDowntimeCost: number = 0
  ) {
    Object.freeze(this);
  }

  // Example rulesets
  static readonly VAMPIRE = new RulesetConfig(5, 2, 4, 2, true, 5, 2);
  static readonly MAGE = new RulesetConfig(5, 2, 4, 2, false);
}

// --- STATS, MODIFIERS & TRACKERS ---
export class LedgerEntry {
  constructor(
    public readonly Source: PointSource,
    public readonly AmountAdded: number,
    public readonly CostIncurred: number
  ) { Object.freeze(this); }
}

export class StatModifier {
  constructor(
    public readonly Amount: number,
    public readonly IsPermanent: boolean,
    public readonly IgnoresCap: boolean,
    public readonly Description: string
  ) { Object.freeze(this); }
}

export class Stat {
  protected readonly _name: string;
  protected readonly _category: Category;
  protected readonly _isImmutable: boolean;
  protected _creationCap: number;
  protected _absoluteCap: number;
  protected readonly _ledger: LedgerEntry[] = [];
  protected _modifiers: StatModifier[] = [];

  constructor(name: string, category: Category, baseValue: number, creationCap: number = 5, absoluteCap: number = 5, isImmutable: boolean = false) {
    this._name = StringUtil.normalize(name);
    this._category = category;
    this._creationCap = creationCap;
    this._absoluteCap = absoluteCap;
    this._isImmutable = isImmutable;

    if (baseValue > 0) this._ledger.push(new LedgerEntry(PointSource.BASE, baseValue, 0));
  }

  get Name(): string { return this._name; }
  get Category(): Category { return this._category; }

  // The actual dots bought on the sheet
  get Value(): number { return this._ledger.reduce((sum, entry) => sum + entry.AmountAdded, 0); }

  // The pool used for rolling (Value + Buffs - Debuffs)
  get EffectiveValue(): number {
    let eff = this.Value;
    let bypassesCap = false;

    for (const mod of this._modifiers) {
      eff += mod.Amount;
      if (mod.IgnoresCap) bypassesCap = true;
    }

    if (!bypassesCap && eff > this._absoluteCap) return this._absoluteCap;
    if (eff < 0) return 0;
    return eff;
  }

  get AuditLog(): LedgerEntry[] { return [...this._ledger]; }

  Allocate(source: PointSource, amount: number, cost: number = 0, bypassCaps: boolean = false): void {
    if (this._isImmutable) throw new Error(`Cannot modify immutable stat: ${this._name}`);

    const isCreationPhase = (source === PointSource.BASE || source === PointSource.FREEBIE);
    const activeCap = isCreationPhase ? this._creationCap : this._absoluteCap;

    if (!bypassCaps && this.Value + amount > activeCap) {
      throw new Error(`Stat ${this._name} cannot exceed cap of ${activeCap} via ${source.Name}.`);
    }
    this._ledger.push(new LedgerEntry(source, amount, cost));
  }

  AddModifier(mod: StatModifier) { this._modifiers.push(mod); }
  RemoveModifierByDesc(desc: string) {
    this._modifiers = this._modifiers.filter(m => m.Description !== desc);
  }
}

// Extends Stat to handle temporary spendable points (Willpower, Resolve, ...)
export class Tracker extends Stat {
  private _tempValue: number;

  constructor(name: string, category: Category, baseValue: number, creationCap: number = 10, absoluteCap: number = 10) {
    super(name, category, baseValue, creationCap, absoluteCap);
    this._tempValue = baseValue;
  }

  get Temporary(): number { return this._tempValue; }

  // Sync temporary points when permanent rating increases
  override Allocate(source: PointSource, amount: number, cost: number = 0, bypassCaps: boolean = false): void {
    super.Allocate(source, amount, cost, bypassCaps);
    this._tempValue += amount;
  }

  Spend(amount: number) {
    if (amount < 0) throw new Error("Cannot spend a negative amount.");
    if (this._tempValue < amount) throw new Error(`Not enough temporary ${this._name} to spend.`);
    this._tempValue -= amount;
  }

  Regain(amount: number, canExceedPermanent: boolean = false) {
    if (amount < 0) throw new Error("Cannot regain a negative amount.");
    this._tempValue += amount;
    if (!canExceedPermanent && this._tempValue > this.Value) {
      this._tempValue = this.Value;
    }
  }
}

// =============================================================================
// DICE - auditable Storyteller (World of Darkness) dice roller
// =============================================================================

// Random integer in [min, max]. Uses Math.random by default; an injectable Rng
// (returning a float in [0,1)) keeps rolls deterministic under test.
export type Rng = () => number;
const __defaultRng: Rng = () => Math.random();
export function Random(min: number, max: number, rng: Rng = __defaultRng): number {
  if (max < min) { const t = min; min = max; max = t; }
  return min + Math.floor(rng() * (max - min + 1));
}

export interface RollTrait { name: string; value: number; }
export interface RollOptions {
  difficulty?: number;        // default 6
  nAgain?: number;            // default 10 (10-again). 11 disables, 9 explodes 9s & 10s.
  automaticSuccesses?: number; // free successes (e.g. Potence, a spent Willpower)
  rng?: Rng;
  label?: string;             // header label when rolling a raw pool
}
export interface RollDie {
  face: number;
  symbol: string;        // bomb / explode / hit / miss
  isSuccess: boolean;
  isOne: boolean;
  explodes: boolean;
  fromExplosion: boolean;
}
export type RollOutcome = "botch" | "failure" | "success";
export interface RollResult {
  traits: RollTrait[];
  pool: number;
  difficulty: number;
  nAgain: number;
  dice: RollDie[];
  successes: number;          // dice meeting difficulty (incl. explosions)
  automaticSuccesses: number; // free successes added to the tally
  ones: number;               // dice showing a 1 (incl. explosions)
  net: number;                // successes + automaticSuccesses - ones
  isBotch: boolean;
  outcome: RollOutcome;
  message: string;
}

const DIE_BOMB = "\u{1F4A3}";    // bomb -> a rolled 1
const DIE_EXPLODE = "\u{1F4A5}"; // collision -> a die that explodes (n-again)
const DIE_HIT = "✅";        // check -> a success
const DIE_MISS = "❌";       // cross -> a failure
const MAX_DICE = 200;            // safety valve against pathological explosion chains

export class Dice {
  // Accepts either a raw pool size or a list of named traits (one or two are
  // typical, but any number is summed). Returns a fully auditable result.
  static roll(input: number | RollTrait[], options: RollOptions = {}): RollResult {
    const difficulty = options.difficulty ?? 6;
    const nAgain = Math.max(2, options.nAgain ?? 10); // never explode on faces < 2
    const automaticSuccesses = Math.max(0, options.automaticSuccesses ?? 0);
    const rng = options.rng ?? __defaultRng;

    const traits: RollTrait[] = typeof input === "number"
      ? [{ name: options.label ?? "Pool", value: input }]
      : input;
    const pool = Math.max(0, traits.reduce((s, t) => s + Math.max(0, t.value), 0));

    const dice: RollDie[] = [];
    let pending = pool;   // remaining dice from the initial pool
    let extra = 0;        // dice queued by explosions
    let rolled = 0;

    const rollOne = (fromExplosion: boolean): void => {
      const face = Random(1, 10, rng);
      const isOne = face === 1;
      const isSuccess = face >= difficulty;
      const explodes = face >= nAgain;
      let symbol = DIE_MISS;
      if (isOne) symbol = DIE_BOMB;
      else if (explodes) symbol = DIE_EXPLODE;
      else if (isSuccess) symbol = DIE_HIT;
      dice.push({ face, symbol, isSuccess, isOne, explodes, fromExplosion });
      if (explodes) extra++;
    };

    while ((pending > 0 || extra > 0) && rolled < MAX_DICE) {
      if (pending > 0) { pending--; rollOne(false); }
      else { extra--; rollOne(true); }
      rolled++;
    }

    const successes = dice.filter(d => d.isSuccess).length;
    const ones = dice.filter(d => d.isOne).length;
    const net = successes + automaticSuccesses - ones;

    // A botch is judged on the INITIAL roll only: zero successes and >= 1 one.
    // (A cancelled success is a failure, not a botch; a free success also averts it.)
    const initial = dice.filter(d => !d.fromExplosion);
    const initialSuccesses = initial.filter(d => d.isSuccess).length;
    const initialOnes = initial.filter(d => d.isOne).length;
    const isBotch = initialSuccesses === 0 && automaticSuccesses === 0 && initialOnes >= 1;

    const outcome: RollOutcome = isBotch ? "botch" : (net > 0 ? "success" : "failure");

    const autoText = automaticSuccesses > 0 ? ` +${automaticSuccesses} auto` : "";
    const header = traits.map(t => `${StringUtil.toTitleCase(t.name)} (${t.value})`).join(" + ") + autoText;
    const faces = dice.map(d => `${d.symbol}${d.face}`).join(" ");
    let resultLine: string;
    if (isBotch) resultLine = `${DIE_BOMB} BOTCH!`;
    else if (net > 0) resultLine = `${DIE_HIT} ${net} success${net === 1 ? "" : "es"}`;
    else resultLine = `${DIE_MISS} Failure`;
    const message = `${header} vs diff ${difficulty} [${faces}] -> ${resultLine}`;

    return { traits, pool, difficulty, nAgain, dice, successes, automaticSuccesses, ones, net, isBotch, outcome, message };
  }
}

// =============================================================================
// DAMAGE - severity, kind, intensity, source, and self-describing packets
// -----------------------------------------------------------------------------
// A hit is a DamagePacket. Four *independent* facts describe it:
//
//   * Severity  - bashing / lethal / aggravated: how hard it is to soak & heal.
//   * Intensity - the plain *number* of health levels the hit threatens.
//   * Kind(s)   - open-ended descriptors, in the spirit of D&D's energy/damage
//                 types: "piercing", "slashing", "silver", "fire", "sunlight"...
//                 A packet may carry several (a silver bullet is piercing+silver).
//   * Source    - where it came from ("gunshot", "claw", "fangs", "fall"); kept
//                 for flavour and future rules that key off the attack itself.
//
// Crucially, SEVERITY IS NOT INTRINSIC TO THE ATTACK. One gunshot (piercing,
// lethal) is lethal to a mortal, only *bashing* to a vampire (no organs to
// destroy, no blood to lose) and shrugged off entirely by a werewolf - unless
// the round is *silver*, which no amount of regeneration will soak. The target,
// not the weapon, has the final say: every character runs an incoming packet
// through its own DamageReactions - rewriting or ignoring parts of it - *before*
// it soaks and marks its health track.
// =============================================================================

// --- SEVERITY (the bashing / lethal / aggravated axis) ---
export type SeverityName = "harmless" | "bashing" | "lethal" | "aggravated" | "fatal";
export class Severity {
  static readonly HARMLESS = new Severity("harmless", 0)
  static readonly BASHING = new Severity("bashing", 1);
  static readonly LETHAL = new Severity("lethal", 2);
  static readonly AGGRAVATED = new Severity("aggravated", 3);
  static readonly FATAL = new Severity("fatal", 4);
  
  // Rank orders the three so the health track's wrap-around upgrade rule works
  // and reactions can ask for "at least this bad".
  private constructor(public readonly Name: SeverityName, public readonly Rank: number) { Object.freeze(this); }

  static fromName(name: SeverityName): Severity {
    switch (name) {
      case "bashing": return Severity.BASHING;
      case "lethal": return Severity.LETHAL;
      case "aggravated": return Severity.AGGRAVATED;
      case "harmless": return Severity.HARMLESS;
      case "fatal": return Severity.FATAL;
      default: throw new Error(`Unknown severity: ${name}`);
    }
  }
  static coerce(s: Severity | SeverityName): Severity {
    return typeof s === "string" ? Severity.fromName(s) : s;
  }

  // Ascending order; index === Rank.
  static readonly ORDER: readonly Severity[] = [
    Severity.HARMLESS, Severity.BASHING, Severity.LETHAL, Severity.AGGRAVATED, Severity.FATAL,
  ];
  // The singleton at a rank, clamped to [HARMLESS, FATAL].
  static atRank(rank: number): Severity {
    return Severity.ORDER[Math.max(0, Math.min(Severity.ORDER.length - 1, Math.round(rank)))];
  }

  IsAtLeast(other: Severity): boolean { return this.Rank >= other.Rank; }
  // The worse (higher-ranked) of two severities.
  Max(other: Severity): Severity { return this.Rank >= other.Rank ? this : other; }
  // Assume the value of the neighbouring singleton, clamped.
  Promote(steps: number = 1): Severity { return Severity.atRank(this.Rank + steps); }
  Demote(steps: number = 1): Severity { return Severity.atRank(this.Rank - steps); }
}

// --- KIND & SOURCE (open descriptor sets; any normalized string is valid) ---
export type DamageKind = string;
export type DamageSource = string;

// Common descriptors, surfaced as constants purely for discoverability and to
// dodge typos. The type is still `string`, so homebrew kinds need no ceremony.
export const Kind = {
  BLUDGEONING: "bludgeoning", PIERCING: "piercing", SLASHING: "slashing",
  SILVER: "silver", COLD_IRON: "cold-iron", FIRE: "fire", SUNLIGHT: "sunlight",
  COLD: "cold", ELECTRICITY: "electricity", POISON: "poison", ACID: "acid",
} as const;
export const Source = {
  GUNSHOT: "gunshot", BLADE: "blade", FIST: "fist", CLAW: "claw", FANGS: "fangs",
  FALL: "fall", FIRE: "fire", SUNLIGHT: "sunlight",
} as const;

export interface DamagePacketInit {
  intensity: number;
  severity: Severity | SeverityName;
  kinds?: Iterable<DamageKind>;
  source?: DamageSource | null;
  // Whether this packet may be soaked at all. Reactions can force `false`
  // (e.g. silver against a werewolf) to punch straight through a soak that
  // would otherwise apply.
  soakable?: boolean;
}

// An immutable description of one incoming hit. Every mutator returns a *copy*,
// so a reaction pipeline can rewrite a packet without disturbing the original.
export class DamagePacket {
  public readonly Intensity: number;
  public readonly Severity: Severity;
  public readonly Kinds: ReadonlySet<DamageKind>;
  public readonly Source: DamageSource | null;
  public readonly Soakable: boolean;

  constructor(init: DamagePacketInit) {
    this.Intensity = Math.max(0, Math.floor(init.intensity));
    this.Severity = Severity.coerce(init.severity);
    const kinds = new Set<DamageKind>();
    for (const k of init.kinds ?? []) {
      const n = StringUtil.normalize(k);
      if (n) kinds.add(n);
    }
    this.Kinds = kinds;
    this.Source = init.source ? StringUtil.normalize(init.source) : null;
    this.Soakable = init.soakable ?? true;
    Object.freeze(this);
  }

  static of(init: DamagePacketInit): DamagePacket { return new DamagePacket(init); }

  HasKind(kind: DamageKind): boolean { return this.Kinds.has(StringUtil.normalize(kind)); }
  HasAnyKind(...kinds: DamageKind[]): boolean { return kinds.some(k => this.HasKind(k)); }

  private _init(): DamagePacketInit {
    return {
      intensity: this.Intensity, severity: this.Severity,
      kinds: this.Kinds, source: this.Source, soakable: this.Soakable,
    };
  }
  With(patch: Partial<DamagePacketInit>): DamagePacket { return new DamagePacket({ ...this._init(), ...patch }); }
  WithSeverity(sev: Severity | SeverityName): DamagePacket { return this.With({ severity: sev }); }
  WithIntensity(n: number): DamagePacket { return this.With({ intensity: n }); }
  AddKind(kind: DamageKind): DamagePacket { return this.With({ kinds: [...this.Kinds, kind] }); }
  RemoveKind(kind: DamageKind): DamagePacket {
    const n = StringUtil.normalize(kind);
    return this.With({ kinds: [...this.Kinds].filter(k => k !== n) });
  }
  Unsoakable(): DamagePacket { return this.Soakable ? this.With({ soakable: false }) : this; }

  describe(): string {
    const kinds = this.Kinds.size ? ` {${[...this.Kinds].join(", ")}}` : "";
    const src = this.Source ? ` from ${this.Source}` : "";
    const soak = this.Soakable ? "" : " (unsoakable)";
    return `${this.Intensity} ${this.Severity.Name}${kinds}${src}${soak}`;
  }
}

// --- DAMAGE REACTIONS - a target's veto/rewrite of an incoming packet ---
// Folded left-to-right over the packet before soak; return the packet unchanged
// to pass. Ordering matters: put severity/kind rewrites before mitigation.
export interface DamageReaction {
  readonly Label: string;
  Apply(packet: DamagePacket, character: LiveCharacter): DamagePacket;
}

// Undead (vampires): no organs to rupture, no blood to bleed out. Piercing and
// ballistic wounds that would kill the living do only bashing; fire and sunlight
// are the classic aggravated exceptions and are never talked down.
export class UndeadPhysiology implements DamageReaction {
  readonly Label = "Undead physiology";
  Apply(packet: DamagePacket): DamagePacket {
    if (packet.HasAnyKind(Kind.FIRE, Kind.SUNLIGHT)) {
      return packet.WithSeverity(packet.Severity.Max(Severity.AGGRAVATED));
    }
    const piercing = packet.HasAnyKind(Kind.PIERCING) || packet.Source === Source.GUNSHOT;
    if (piercing && packet.Severity === Severity.LETHAL) {
      return packet.WithSeverity(Severity.BASHING);
    }
    return packet;
  }
}

// Regenerators (werewolves & kin): silver (and fire) slip past the healing
// factor - that damage is aggravated and cannot be soaked away. Everything else
// is left for their all-round Stamina soak to simply absorb.
export class SilverVulnerability implements DamageReaction {
  readonly Label = "Silver/fire vulnerability";
  constructor(private readonly kinds: DamageKind[] = [Kind.SILVER, Kind.FIRE]) {}
  Apply(packet: DamagePacket): DamagePacket {
    if (packet.HasAnyKind(...this.kinds)) {
      return packet.WithSeverity(packet.Severity.Max(Severity.AGGRAVATED)).Unsoakable();
    }
    return packet;
  }
}

// Worn protection: flat damage reduction against the kinds (or source) it
// actually stops - a ballistic vest turns a lethal gunshot survivable. A
// deliberate simplification of the tabletop "extra soak dice", chosen so that
// `intensity` alone tells the story of how much got through.
export class ArmorReaction implements DamageReaction {
  readonly Label: string;
  private readonly _covers: Set<DamageKind>;
  constructor(name: string, private readonly rating: number, covers: DamageKind[]) {
    this.Label = `Armor (${name})`;
    this._covers = new Set(covers.map(k => StringUtil.normalize(k)));
  }
  Apply(packet: DamagePacket): DamagePacket {
    if (this.rating <= 0) return packet;
    const stops = [...packet.Kinds].some(k => this._covers.has(k))
      || (packet.Source !== null && this._covers.has(packet.Source));
    return stops ? packet.WithIntensity(Math.max(0, packet.Intensity - this.rating)) : packet;
  }
}

// =============================================================================
// HEALTH - damage tracks & wound penalties
// =============================================================================

export interface HealthLevelDef { name: string; penalty: number; }

// Standard 7-level Storyteller health track.
export const STANDARD_HEALTH_LEVELS: HealthLevelDef[] = [
  { name: "Bruised", penalty: 0 },
  { name: "Hurt", penalty: -1 },
  { name: "Injured", penalty: -1 },
  { name: "Wounded", penalty: -2 },
  { name: "Mauled", penalty: -2 },
  { name: "Crippled", penalty: -5 },
  { name: "Incapacitated", penalty: -5 },
];

// How a square may be healed.
export type HealPolicy = "normal" | "never" | "special";

// A single health box. `penalty` is the wound penalty it imposes when it is the
// deepest damaged box. Everything else is optional, so a plain
// `{ name, penalty }` (a HealthLevelDef) is a valid square.
export interface HealthSquareDef {
  penalty: number;
  name?: string;
  condition?: string;   // key linking this box to a ConditionDef
  heal?: HealPolicy;    // default "normal"
  healCost?: number;    // healing points to clear this box (default 1)
}

// A condition wired to one or more boxes; its state depends on how many of its
// linked boxes are currently damaged.
export interface ConditionDef {
  key: string;
  name?: string;
  // Given how many linked boxes are damaged (and how many exist), return the
  // current state label, or null for "inactive". Default: active if any hurt.
  state?: (damaged: number, total: number) => string | null;
}

export interface HealthTrackConfig {
  squares: HealthSquareDef[];
  conditions?: ConditionDef[];
}

export interface ConditionState { key: string; name: string; state: string; damaged: number; total: number; }

export interface HealthSummary {
  bashing: number; lethal: number; aggravated: number;
  filled: number; capacity: number; overkill: number;
  penalty: number; level: string;
  isIncapacitated: boolean; isDead: boolean;
  conditions: ConditionState[];
}

// Damage is stored PER BOX, so boxes can carry conditions, heal costs, or be
// unhealable. Simple use (ApplyDamage / Heal / Penalty / Level / counts) needs
// none of that and behaves exactly like a plain Storyteller track.
export class HealthTrack {
  private readonly _defs: HealthSquareDef[];
  private readonly _damage: (Severity | null)[];
  private readonly _conditions: ConditionDef[];
  private _overkill = 0; // damage that spills past a fully-aggravated track
  private readonly _log: Array<{ severity: SeverityName; intensity: number }> = [];

  constructor(config: HealthSquareDef[] | HealthTrackConfig = STANDARD_HEALTH_LEVELS) {
    const cfg: HealthTrackConfig = Array.isArray(config) ? { squares: config } : config;
    if (cfg.squares.length === 0) throw new Error("Health track needs at least one square.");
    this._defs = cfg.squares.map(s => ({ heal: "normal", healCost: 1, ...s }));
    this._damage = this._defs.map(() => null);
    this._conditions = (cfg.conditions ?? []).map(c => ({ ...c }));
  }

  get Capacity(): number { return this._defs.length; }
  get Overkill(): number { return this._overkill; }
  get Filled(): number { return this._damage.reduce((n, d) => n + (d ? 1 : 0), 0); }
  get Bashing(): number { return this._count(Severity.BASHING); }
  get Lethal(): number { return this._count(Severity.LETHAL); }
  get Aggravated(): number { return this._count(Severity.AGGRAVATED); }
  get Fatal(): number { return this._count(Severity.FATAL); }
  CountBySeverity(sev: Severity | SeverityName): number { return this._count(Severity.coerce(sev)); }
  private _count(sev: Severity): number { return this._damage.reduce((n, d) => n + (d === sev ? 1 : 0), 0); }

  // Index of the deepest (highest-index) damaged box, or -1 if unhurt.
  private _deepest(): number {
    for (let i = this._damage.length - 1; i >= 0; i--) if (this._damage[i]) return i;
    return -1;
  }

  // Wound penalty = penalty of the deepest damaged box.
  get Penalty(): number { const i = this._deepest(); return i < 0 ? 0 : this._defs[i].penalty; }
  get Level(): string { const i = this._deepest(); return i < 0 ? "Healthy" : (this._defs[i].name ?? `Level ${i + 1}`); }
  get IsIncapacitated(): boolean { return this.Filled >= this.Capacity; }
  get IsDead(): boolean {
    return this._overkill > 0 || this.Aggravated >= this.Capacity || this._damage.some(d => d === Severity.FATAL);
  }

  ApplyDamage(severity: Severity | SeverityName, intensity: number): void {
    const sev = Severity.coerce(severity);
    if (intensity < 0) throw new Error("Damage intensity cannot be negative.");
    if (intensity === 0 || sev === Severity.HARMLESS) return; // harmless deals nothing
    this._log.push({ severity: sev.Name, intensity });
    for (let i = 0; i < intensity; i++) this._applyOne(sev);
  }

  // One level of damage: fill the first empty box; on a full track apply the
  // wrap-around rule (a more-severe hit replaces the least-severe wound,
  // otherwise the least-severe wound is upgraded one step).
  private _applyOne(sev: Severity): void {
    const empty = this._damage.indexOf(null);
    if (empty !== -1) { this._damage[empty] = sev; return; }

    // Full: least-severe filled box (deepest index among ties).
    let idx = -1, leastRank = Infinity;
    for (let i = this._damage.length - 1; i >= 0; i--) {
      const r = this._damage[i]!.Rank;
      if (r < leastRank) { leastRank = r; idx = i; }
    }
    const least = this._damage[idx]!;
    if (sev.Rank > least.Rank) this._damage[idx] = sev;                              // more severe replaces it
    else if (least.Rank < Severity.AGGRAVATED.Rank) this._damage[idx] = Severity.atRank(least.Rank + 1); // wrap up a step
    else this._overkill++;                                                           // aggravated+ full -> overkill
  }

  // Heals up to `amount` boxes of `severity`, shallowest (highest index) first.
  // "never" boxes are skipped; "special" ones only with `allowSpecial`. Returns
  // the number of boxes cleared.
  Heal(severity: Severity | SeverityName, amount: number, opts: { allowSpecial?: boolean } = {}): number {
    return this._heal(severity, amount, Infinity, opts.allowSpecial ?? false).healed;
  }

  // Cost-aware heal: each box costs its `healCost` from `healingPoints`; stops
  // when the budget or `amount` runs out. Returns boxes cleared and points spent.
  HealWithPoints(severity: Severity | SeverityName, amount: number, healingPoints: number, opts: { allowSpecial?: boolean } = {}): { healed: number; pointsSpent: number } {
    return this._heal(severity, amount, healingPoints, opts.allowSpecial ?? false);
  }

  private _heal(severity: Severity | SeverityName, amount: number, budget: number, allowSpecial: boolean): { healed: number; pointsSpent: number } {
    const sev = Severity.coerce(severity);
    if (amount < 0) throw new Error("Heal amount cannot be negative.");
    let healed = 0, pointsSpent = 0;
    for (let i = this._damage.length - 1; i >= 0 && healed < amount; i--) {
      if (this._damage[i] !== sev) continue;
      const policy = this._defs[i].heal ?? "normal";
      if (policy === "never") continue;
      if (policy === "special" && !allowSpecial) continue;
      const cost = this._defs[i].healCost ?? 1;
      if (cost > budget) continue;
      this._damage[i] = null;
      budget -= cost; pointsSpent += cost; healed++;
    }
    return { healed, pointsSpent };
  }

  Reset(): void { for (let i = 0; i < this._damage.length; i++) this._damage[i] = null; this._overkill = 0; }

  // Current state of every active condition wired to the track.
  Conditions(): ConditionState[] {
    const out: ConditionState[] = [];
    for (const c of this._conditions) {
      let damaged = 0, total = 0;
      for (let i = 0; i < this._defs.length; i++) {
        if (this._defs[i].condition === c.key) { total++; if (this._damage[i]) damaged++; }
      }
      const state = c.state ? c.state(damaged, total) : (damaged > 0 ? "active" : null);
      if (state != null) out.push({ key: c.key, name: c.name ?? c.key, state, damaged, total });
    }
    return out;
  }

  Summary(): HealthSummary {
    return {
      bashing: this.Bashing, lethal: this.Lethal, aggravated: this.Aggravated,
      filled: this.Filled, capacity: this.Capacity, overkill: this._overkill,
      penalty: this.Penalty, level: this.Level,
      isIncapacitated: this.IsIncapacitated, isDead: this.IsDead,
      conditions: this.Conditions(),
    };
  }
}

// =============================================================================
// SOAK - per-template rules for resisting damage
// =============================================================================
export interface SoakTypeRule { soakable: boolean; pool: string[]; }
export interface SoakSpec {
  bashing: SoakTypeRule;
  lethal: SoakTypeRule;
  aggravated: SoakTypeRule;
  difficulty: number;
}

// Mortals soak bashing with Stamina only; lethal/aggravated bypass them.
export const MORTAL_SOAK: SoakSpec = {
  bashing: { soakable: true, pool: ["stamina"] },
  lethal: { soakable: false, pool: [] },
  aggravated: { soakable: false, pool: [] },
  difficulty: 6,
};
// Vampires soak bashing & lethal with Stamina (+Fortitude); aggravated needs
// Fortitude alone (no Fortitude trait -> empty pool -> nothing soaked).
export const VAMPIRE_SOAK: SoakSpec = {
  bashing: { soakable: true, pool: ["stamina", "fortitude"] },
  lethal: { soakable: true, pool: ["stamina", "fortitude"] },
  aggravated: { soakable: true, pool: ["fortitude"] },
  difficulty: 6,
};
// Mages innately soak like mortals (their real defence is magic, not modelled).
export const MAGE_SOAK: SoakSpec = {
  bashing: { soakable: true, pool: ["stamina"] },
  lethal: { soakable: false, pool: [] },
  aggravated: { soakable: false, pool: [] },
  difficulty: 6,
};
// Demons (manifested) soak all three with Stamina.
export const DEMON_SOAK: SoakSpec = {
  bashing: { soakable: true, pool: ["stamina"] },
  lethal: { soakable: true, pool: ["stamina"] },
  aggravated: { soakable: true, pool: ["stamina"] },
  difficulty: 6,
};
// Werewolves regenerate: they soak every severity with Stamina and shrug off
// most punishment outright. Silver and fire are the exception - the
// SilverVulnerability reaction marks those packets Unsoakable, so this generous
// spec never even gets consulted for them.
export const WEREWOLF_SOAK: SoakSpec = {
  bashing: { soakable: true, pool: ["stamina"] },
  lethal: { soakable: true, pool: ["stamina"] },
  aggravated: { soakable: true, pool: ["stamina"] },
  difficulty: 6,
};

// =============================================================================
// RESOURCE POOLS - Blood, Quintessence, Paradox, ... (free-floating counters)
// =============================================================================
export class Pool {
  private _current: number;
  private _max: number;
  private readonly _name: string;
  private readonly _perTurn: number;
  private readonly _log: Array<{ delta: number; reason: string }> = [];

  constructor(name: string, max: number, start?: number, perTurnLimit: number = Infinity) {
    this._name = StringUtil.normalize(name);
    this._max = max;
    this._perTurn = perTurnLimit;
    this._current = Math.max(0, Math.min(start ?? max, max));
  }

  get Name(): string { return this._name; }
  get Current(): number { return this._current; }
  get Max(): number { return this._max; }
  get PerTurnLimit(): number { return this._perTurn; }
  get AuditLog(): Array<{ delta: number; reason: string }> { return [...this._log]; }

  // Resize the pool (e.g. a vampire lowering generation via diablerie).
  SetMax(max: number, keepRatio: boolean = false): void {
    if (max < 0) throw new Error("Pool max cannot be negative.");
    if (keepRatio && this._max > 0) this._current = Math.round((this._current / this._max) * max);
    this._max = max;
    if (this._current > max) this._current = max;
  }

  Spend(amount: number, reason: string = ""): void {
    if (amount < 0) throw new Error("Cannot spend a negative amount.");
    if (amount > this._perTurn) throw new Error(`Cannot spend more than ${this._perTurn} ${this._name} per turn.`);
    if (amount > this._current) throw new Error(`Not enough ${this._name}: have ${this._current}, need ${amount}.`);
    this._current -= amount;
    this._log.push({ delta: -amount, reason });
  }

  Gain(amount: number, reason: string = ""): number {
    if (amount < 0) throw new Error("Cannot gain a negative amount.");
    const before = this._current;
    this._current = Math.min(this._max, this._current + amount);
    const gained = this._current - before;
    this._log.push({ delta: gained, reason });
    return gained;
  }

  Refill(): void { this._current = this._max; }
}

export interface BloodStats { max: number; perTurn: number; }
// Vampire blood pool by generation (standard table; clamped to 3rd-15th).
const BLOOD_BY_GENERATION: Record<number, BloodStats> = {
  3: { max: 100, perTurn: 20 },
  4: { max: 50, perTurn: 10 },
  5: { max: 40, perTurn: 8 },
  6: { max: 30, perTurn: 6 },
  7: { max: 20, perTurn: 5 },
  8: { max: 15, perTurn: 3 },
  9: { max: 14, perTurn: 2 },
  10: { max: 13, perTurn: 1 },
  11: { max: 12, perTurn: 1 },
  12: { max: 11, perTurn: 1 },
  13: { max: 10, perTurn: 1 },
  14: { max: 10, perTurn: 1 },
  15: { max: 10, perTurn: 1 },
};
export function bloodForGeneration(generation: number): BloodStats {
  const g = Math.max(3, Math.min(15, Math.round(generation)));
  return { ...BLOOD_BY_GENERATION[g] };
}

// =============================================================================
// MORALITY - Roads / Humanity (optional; Mages have none)
// =============================================================================
export interface RoadDefinition {
  name: string;                       // e.g. "Road of Humanity"
  virtues: [string, string, string];  // the three Virtues this Road uses
  ratingVirtues: [string, string];    // which two sum to the starting rating
}

export const ROAD_OF_HUMANITY: RoadDefinition = {
  name: "Road of Humanity",
  virtues: ["conscience", "self-control", "courage"],
  ratingVirtues: ["conscience", "self-control"],
};
export const ROAD_OF_KINGS: RoadDefinition = {
  name: "Road of Kings",
  virtues: ["conviction", "self-control", "courage"],
  ratingVirtues: ["conviction", "self-control"],
};
export const ROAD_OF_THE_BEAST: RoadDefinition = {
  name: "Road of the Beast",
  virtues: ["conviction", "instinct", "courage"],
  ratingVirtues: ["conviction", "instinct"],
};

export type MoralityPolarity = "descending" | "ascending";

// A morality rating (a Road/Humanity, or Torment). "descending" traits worsen
// toward 0 (Humanity 0 = lost to the Beast); "ascending" traits worsen toward
// the max (Torment 10 = unplayable). Degenerate() always moves toward the bad
// extreme; Improve() toward the good one.
export class MoralityTrait {
  private _value: number;
  private readonly _max: number;
  private readonly _min: number;
  private readonly _unplayableAt: number;
  public readonly Polarity: MoralityPolarity;
  private readonly _log: Array<{ delta: number; reason: string; value: number }> = [];

  constructor(
    public readonly RoadName: string,
    value: number,
    opts: { max?: number; min?: number; polarity?: MoralityPolarity; unplayableAt?: number } = {}
  ) {
    this._max = opts.max ?? 10;
    this._min = opts.min ?? 0;
    this.Polarity = opts.polarity ?? "descending";
    this._unplayableAt = opts.unplayableAt ?? (this.Polarity === "descending" ? this._min : this._max);
    this._value = Math.max(this._min, Math.min(value, this._max));
  }

  get Value(): number { return this._value; }
  get Max(): number { return this._max; }
  get Min(): number { return this._min; }
  get Category(): Category { return Category.MORALITY; }
  get AuditLog(): Array<{ delta: number; reason: string; value: number }> { return [...this._log]; }

  // True once the rating has reached its unplayable extreme.
  get IsUnplayable(): boolean {
    return this.Polarity === "descending" ? this._value <= this._unplayableAt : this._value >= this._unplayableAt;
  }

  // Worsen: a sin / failed Virtue roll moves the rating toward its bad extreme.
  Degenerate(amount: number = 1, reason: string = "degeneration"): void {
    this._change((this.Polarity === "descending" ? -1 : 1) * Math.abs(amount), reason);
  }
  // Improve: penance / redemption moves the rating toward its good extreme.
  Improve(amount: number = 1, reason: string = "penance"): void {
    this._change((this.Polarity === "descending" ? 1 : -1) * Math.abs(amount), reason);
  }

  private _change(delta: number, reason: string): void {
    const next = Math.max(this._min, Math.min(this._value + delta, this._max));
    const applied = next - this._value;
    this._value = next;
    this._log.push({ delta: applied, reason, value: this._value });
  }
}

// How a template's morality is configured: which trait it is, its polarity,
// and how its starting value is derived.
export interface MoralityConfig {
  name: string;
  polarity: MoralityPolarity;
  road?: RoadDefinition;        // virtue-based moralities (Roads / Humanity)
  deriveFromVirtues?: boolean;  // start = sum of the Road's two rating Virtues
  start?: number;               // default start when not derived from Virtues
}

export const HUMANITY_MORALITY: MoralityConfig = {
  name: "Road of Humanity",
  polarity: "descending",
  road: ROAD_OF_HUMANITY,
  deriveFromVirtues: true,
};

// =============================================================================
// TEMPLATES - per-splat configuration including starting values
// =============================================================================
export type PoolKind = "tracker" | "pool";
export interface PoolDef {
  name: string;
  kind: PoolKind;
  start: number;            // default starting value
  startMin?: number;        // inclusive lower bound for a chosen start
  startMax?: number;        // inclusive upper bound for a chosen start
  startOptions?: number[];  // discrete allowed starts (overrides min/max if set)
  max: number;              // permanent cap (tracker) / capacity (pool)
  perTurnLimit?: number;    // pools only (e.g. blood expenditure per turn)
  fromGeneration?: boolean; // blood pool: max & perTurn derived from Generation
}

export class TemplateConfig {
  constructor(
    public readonly Name: string,
    public readonly Rules: RulesetConfig,
    public readonly Pools: PoolDef[],
    public readonly Soak: SoakSpec,
    // The template's morality (a Road/Humanity, or an ascending Torment), or
    // null for splats without one (Mage, Werewolf).
    public readonly Morality: MoralityConfig | null,
    public readonly HasVirtues: boolean,
    public readonly HealthLevels: HealthLevelDef[] = STANDARD_HEALTH_LEVELS,
    // Innate damage reactions granted to every character of this template
    // (e.g. a vampire's undead physiology). Copied onto the character at build
    // time so per-character armour can be appended without touching the template.
    public readonly Reactions: DamageReaction[] = []
  ) {}

  GetPool(name: string): PoolDef | undefined {
    const n = StringUtil.normalize(name);
    return this.Pools.find(p => StringUtil.normalize(p.name) === n);
  }
}

export const TEMPLATE_MORTAL = new TemplateConfig(
  "Mortal",
  new RulesetConfig(5, 2, 4, 2, false),
  [{ name: "willpower", kind: "tracker", start: 3, startMin: 1, startMax: 10, max: 10 }],
  MORTAL_SOAK,
  HUMANITY_MORALITY, true
);

export const TEMPLATE_THRALL = new TemplateConfig(
  "Thrall",
  new RulesetConfig(5, 2, 4, 2, false),
  [
    { name: "willpower", kind: "tracker", start: 3, startMin: 1, startMax: 10, max: 10 },
    // A thrall's bond grants only a flicker of Resolve: it must start at 1.
    { name: "resolve", kind: "tracker", start: 1, startMin: 1, startMax: 1, max: 10 },
  ],
  MORTAL_SOAK,
  HUMANITY_MORALITY, true
);

export const TEMPLATE_VAMPIRE = new TemplateConfig(
  "Vampire (Dark Ages)",
  RulesetConfig.VAMPIRE,
  [
    { name: "willpower", kind: "tracker", start: 5, startMin: 1, startMax: 10, max: 10 },
    { name: "blood", kind: "pool", start: 10, max: 10, perTurnLimit: 1, fromGeneration: true },
  ],
  VAMPIRE_SOAK,
  HUMANITY_MORALITY, true,
  STANDARD_HEALTH_LEVELS,
  [new UndeadPhysiology()]   // bullets & blades to bashing; fire/sunlight stay aggravated
);

// Dark Ages: Mage works magic through Foundation & Pillars (its answer to the
// Spheres), which live with the not-yet-modelled powers, not as a pool. The
// only pool is Quintessence; this line has no Paradox.
export const TEMPLATE_MAGE = new TemplateConfig(
  "Mage (Dark Ages)",
  RulesetConfig.MAGE,
  [
    { name: "willpower", kind: "tracker", start: 5, startMin: 1, startMax: 10, max: 10 },
    { name: "quintessence", kind: "pool", start: 0, max: 20 },
  ],
  MAGE_SOAK,
  null, false   // Mages have no Road/Humanity and no Virtues
);

// Dark Ages: Devil's Due.
export const TEMPLATE_DEMON = new TemplateConfig(
  "Demon (Dark Ages: Devil's Due)",
  new RulesetConfig(5, 2, 4, 2, false),
  [
    { name: "willpower", kind: "tracker", start: 5, startMin: 1, startMax: 10, max: 10 },
    // Resolve (the demon's spiritual power, 1-10): a fledgling starts in the 3-5 band.
    { name: "resolve", kind: "tracker", start: 3, startMin: 3, startMax: 5, max: 10 },
  ],
  DEMON_SOAK,
  // Torment is an ASCENDING morality: sins push it up toward an unplayable 10.
  { name: "Torment", polarity: "ascending", start: 3 }, false
);

// A modern-WoD illustration (not Dark Ages canon) kept here so the kind/severity
// system has a regenerator to show off: everything is soaked with Stamina, but
// the SilverVulnerability reaction makes silver and fire aggravated *and*
// unsoakable - the "good luck" case.
export const TEMPLATE_WEREWOLF = new TemplateConfig(
  "Werewolf",
  new RulesetConfig(5, 2, 4, 2, false),
  [
    { name: "willpower", kind: "tracker", start: 3, startMin: 1, startMax: 10, max: 10 },
    { name: "rage", kind: "pool", start: 1, max: 10 },
    { name: "gnosis", kind: "pool", start: 1, max: 10 },
  ],
  WEREWOLF_SOAK,
  null, false,   // Renown/Rage/Gnosis, not a Road or Virtues
  STANDARD_HEALTH_LEVELS,
  [new SilverVulnerability()]
);

// A ghoul is a mortal sustained by vampire vitae. Mechanically they are a mortal
// (still alive: Road/Humanity, Virtues, mortal soak) plus a Blood pool they do
// NOT generate - it must be fed by their domitor, starting near-empty and
// holding up to 10, spendable one point per turn.
//
// At creation a ghoul also gets 2 dots of Disciplines, one of which must be
// Potence: seed them via `disciplines: { potence: 1, ... }`. Potence and
// Fortitude have real mechanics now; 🚧 the template still can't *enforce* the
// 2-dots-incl-Potence rule until character creation is modelled.
export const TEMPLATE_GHOUL = new TemplateConfig(
  "Ghoul",
  new RulesetConfig(5, 2, 4, 2, false),
  [
    { name: "willpower", kind: "tracker", start: 3, startMin: 1, startMax: 10, max: 10 },
    { name: "blood", kind: "pool", start: 0, max: 10, perTurnLimit: 1 },
  ],
  MORTAL_SOAK,
  HUMANITY_MORALITY, true   // still human: Road/Humanity + Virtues
);

export const TEMPLATES: Record<string, TemplateConfig> = {
  mortal: TEMPLATE_MORTAL,
  thrall: TEMPLATE_THRALL,
  vampire: TEMPLATE_VAMPIRE,
  mage: TEMPLATE_MAGE,
  demon: TEMPLATE_DEMON,
  werewolf: TEMPLATE_WEREWOLF,
  ghoul: TEMPLATE_GHOUL,
};

// =============================================================================
// DISCIPLINES - vampiric (and ghoul/revenant) supernatural powers
// -----------------------------------------------------------------------------
// Rated traits (0-5). The registry is metadata: an "arena" and which Dark Ages
// clans hold it in-clan (for the future advancement-cost engine). A couple have
// wired mechanics today - Potence (automatic successes on Strength) and
// Fortitude (soak) - while the rest are rated dots plus the generic bonus-dice
// hook on `character.Roll`, until per-power effects and a turn system exist.
// =============================================================================
export type DisciplineArena = "physical" | "mental" | "social";
export interface DisciplineDef {
  name: string;
  arena: DisciplineArena;
  clans: string[];          // Dark Ages clans for whom it is in-clan
  description?: string;
}

export const DISCIPLINES: Record<string, DisciplineDef> = {
  potence:       { name: "Potence",       arena: "physical", clans: ["brujah", "lasombra", "nosferatu"], description: "Rating in automatic successes on feats of Strength." },
  fortitude:     { name: "Fortitude",     arena: "physical", clans: ["gangrel", "ventrue"], description: "Rating in soak dice; lets you soak what you otherwise couldn't." },
  celerity:      { name: "Celerity",      arena: "physical", clans: ["assamite", "brujah", "toreador"], description: "Extra speed (rating in bonus dice here, pending a turn system)." },
  animalism:     { name: "Animalism",     arena: "mental",   clans: ["gangrel", "nosferatu", "tzimisce"] },
  auspex:        { name: "Auspex",        arena: "mental",   clans: ["cappadocian", "malkavian", "toreador", "tzimisce"] },
  dominate:      { name: "Dominate",      arena: "mental",   clans: ["cappadocian", "lasombra", "tzimisce", "ventrue"] },
  obfuscate:     { name: "Obfuscate",     arena: "mental",   clans: ["assamite", "cappadocian", "nosferatu", "ravnos"] },
  presence:      { name: "Presence",      arena: "social",   clans: ["brujah", "followers-of-set", "toreador"] },
  obtenebration: { name: "Obtenebration", arena: "mental",   clans: ["lasombra"] },
  protean:       { name: "Protean",       arena: "physical", clans: ["gangrel"] },
  quietus:       { name: "Quietus",       arena: "physical", clans: ["assamite"] },
  serpentis:     { name: "Serpentis",     arena: "physical", clans: ["followers-of-set"] },
  vicissitude:   { name: "Vicissitude",   arena: "physical", clans: ["tzimisce"] },
  chimerstry:    { name: "Chimerstry",    arena: "mental",   clans: ["ravnos"] },
  mortis:        { name: "Mortis",        arena: "mental",   clans: ["cappadocian"] },
  thaumaturgy:   { name: "Thaumaturgy",   arena: "mental",   clans: ["tremere"] },
};

export function disciplineDef(name: string): DisciplineDef | undefined {
  return DISCIPLINES[StringUtil.normalize(name)];
}

// =============================================================================
// MERITS & FLAWS - optional quirks with (waivable) prerequisites
// -----------------------------------------------------------------------------
// Defaults live in an in-code list; the lorebook is the editable database on
// top: any entry in the "srd:merits-flaws" category whose text is a JSON array
// of definitions is merged over the defaults by MeritFlawRegistry
// .loadFromLorebook(). Prerequisites may name templates, free-form character
// tags ("toreador", "revenant", "inconnu", ...) and other Merits/Flaws; every
// check can be waived case-by-case.
// =============================================================================
export type MeritFlawKind = "merit" | "flaw";
export interface MeritFlawRequirements {
  templates?: string[];   // met if the character's template matches ANY listed
  tags?: string[];        // ALL listed tags must be present on the character
  meritsFlaws?: string[]; // ALL listed merits/flaws must already be taken
}
export interface MeritFlawDef {
  name: string;
  kind: MeritFlawKind;
  points: number | number[]; // freebie cost (merit) / bonus granted (flaw); array = variable rating
  requires?: MeritFlawRequirements;
  description?: string;
}

export const DEFAULT_MERITS_FLAWS: MeritFlawDef[] = [
  { name: "Acute Senses", kind: "merit", points: 1, description: "One sense is unusually sharp; -2 difficulty on related Perception rolls." },
  { name: "Ambidextrous", kind: "merit", points: 1, description: "No off-hand penalty." },
  { name: "Iron Will", kind: "merit", points: 3, description: "Resistant to Dominate and mental control." },
  { name: "Eat Food", kind: "merit", points: 1, requires: { templates: ["vampire"] }, description: "Can consume (and later expel) mortal food." },
  { name: "Efficient Digestion", kind: "merit", points: 3, requires: { templates: ["vampire"] }, description: "Gain an extra blood point for every two drawn." },
  { name: "Unbondable", kind: "merit", points: 4, requires: { templates: ["mortal", "thrall", "ghoul"] }, description: "Immune to the blood bond." },
  { name: "True Faith", kind: "merit", points: 7, requires: { templates: ["mortal"] }, description: "A wellspring of genuine faith (rating 1)." },
  { name: "Dark Secret", kind: "flaw", points: 1, description: "Exposure would be disastrous." },
  { name: "Nightmares", kind: "flaw", points: 1, description: "Nightly horrors that bleed into the day." },
  { name: "Prey Exclusion", kind: "flaw", points: 1, requires: { templates: ["vampire"] }, description: "You refuse to feed from a certain class of prey." },
  { name: "Vengeful", kind: "flaw", points: 2, description: "An old score you cannot let rest." },
  { name: "Haunted", kind: "flaw", points: 3, description: "A spiteful ghost follows you." },
  { name: "Hunted", kind: "flaw", points: 4, description: "Someone dangerous wants you destroyed." },
];

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

// --- LIVE CHARACTER SHEET ---
// One line of "what a reaction did to the packet", for auditability.
export interface ReactionTrace { reaction: string; from: string; to: string; }
export interface DamageReport {
  severity: SeverityName;  // the severity finally marked on the track
  incoming: number;        // packet intensity as it arrived (pre-reaction)
  intensity: number;       // packet intensity after reactions (what soak faced)
  soaked: number;
  applied: number;
  soakRoll: RollResult | null;
  original: string;        // packet.describe() before reactions
  resolved: string;        // packet.describe() after reactions
  trace: ReactionTrace[];  // every reaction that changed the packet, in order
  health: HealthSummary;
}
export interface SoakReport {
  soakable: boolean;
  pool: number;
  soaked: number;
  roll: RollResult | null;
}

export class LiveCharacter {
  private _xpRemaining: number = 0;
  private _downtimeRemaining: number = 0;

  // Extended state (populated by CharacterFactory; safe defaults keep the
  // original 7-argument constructor backwards compatible).
  public Health: HealthTrack = new HealthTrack();
  public Pools: Map<string, Pool> = new Map();
  public Virtues: Map<string, Stat> = new Map();
  public Traits: Map<string, Stat> = new Map(); // misc rated traits
  public Disciplines: Map<string, Stat> = new Map(); // rated supernatural powers (0-5)
  // Free-form prerequisite tags ("toreador", "revenant", "inconnu", ...) and
  // the Merits/Flaws taken against them.
  public Tags: Set<string> = new Set();
  public MeritsFlaws: Map<string, { def: MeritFlawDef; points: number }> = new Map();
  public Morality?: MoralityTrait;
  public Soak: SoakSpec = MORTAL_SOAK;
  // The character's say over incoming damage: reactions are folded over each
  // packet (in order) before soak, letting it rewrite or ignore parts of the
  // hit - a vampire turning bullets to bashing, a werewolf who cannot soak
  // silver, a vest eating the first few levels of a gunshot.
  public Reactions: DamageReaction[] = [];

  constructor(
    public readonly Name: string,
    public readonly Template: string,
    public readonly Rules: RulesetConfig,
    public readonly Attributes: Map<string, Stat>,
    public readonly Abilities: Map<string, Stat>,
    public readonly Backgrounds: Map<string, Stat>,
    public readonly Trackers: Map<string, Tracker>
  ) { }

  AwardXP(amount: number) { this._xpRemaining += amount; }
  AwardDowntime(amount: number) { this._downtimeRemaining += amount; }
  get XPRemaining(): number { return this._xpRemaining; }
  get DowntimeRemaining(): number { return this._downtimeRemaining; }

  SpendXPOnAttribute(statName: string) {
    const stat = this.Attributes.get(StringUtil.normalize(statName));
    if (!stat) throw new Error(`Attribute ${statName} not found.`);
    const cost = stat.Value * this.Rules.AttrXPMultiplier;
    if (this._xpRemaining < cost) throw new Error("Not enough XP.");
    stat.Allocate(PointSource.EXPERIENCE, 1, cost);
    this._xpRemaining -= cost;
  }

  SpendDowntimeOnAttribute(statName: string) {
    if (!this.Rules.UsesDowntime) throw new Error(`${this.Template} does not use Downtime points.`);
    const stat = this.Attributes.get(StringUtil.normalize(statName));
    if (!stat) throw new Error(`Attribute ${statName} not found.`);
    const cost = this.Rules.AttrDowntimeCost;
    if (this._downtimeRemaining < cost) throw new Error("Not enough Downtime.");
    stat.Allocate(PointSource.DOWNTIME, 1, cost);
    this._downtimeRemaining -= cost;
  }

  // --- Trait lookup (used by soak and ad-hoc rolls) -----------------------
  TraitValue(name: string): number {
    const n = StringUtil.normalize(name);
    const s = this.Attributes.get(n) ?? this.Abilities.get(n) ?? this.Backgrounds.get(n)
      ?? this.Virtues.get(n) ?? this.Disciplines.get(n) ?? this.Traits.get(n);
    return s ? s.EffectiveValue : 0;
  }

  // --- Tags & Merits/Flaws --------------------------------------------------
  AddTag(tag: string): void { this.Tags.add(StringUtil.normalize(tag)); }
  RemoveTag(tag: string): void { this.Tags.delete(StringUtil.normalize(tag)); }
  HasTag(tag: string): boolean { return this.Tags.has(StringUtil.normalize(tag)); }
  HasMeritFlaw(name: string): boolean { return this.MeritsFlaws.has(StringUtil.normalize(name)); }

  // Prerequisite check: a template requirement is met if the character's
  // template name contains it (or it is present as a tag); listed tags and
  // merits/flaws must ALL be present. Returns every unmet requirement so the
  // Storyteller can decide whether to waive.
  MeetsRequirements(req: MeritFlawRequirements | undefined): { ok: boolean; missing: string[] } {
    if (!req) return { ok: true, missing: [] };
    const missing: string[] = [];
    if (req.templates && req.templates.length > 0) {
      const template = StringUtil.normalize(this.Template);
      const hit = req.templates.some(t => template.includes(StringUtil.normalize(t)) || this.HasTag(t));
      if (!hit) missing.push(`template:${req.templates.join("|")}`);
    }
    for (const t of req.tags ?? []) if (!this.HasTag(t)) missing.push(`tag:${StringUtil.normalize(t)}`);
    for (const m of req.meritsFlaws ?? []) if (!this.HasMeritFlaw(m)) missing.push(`merit-flaw:${StringUtil.normalize(m)}`);
    return { ok: missing.length === 0, missing };
  }

  // Take a merit/flaw by registry name or inline definition. The chosen point
  // value must be one the definition allows; prerequisites throw unless waived.
  AddMeritFlaw(nameOrDef: string | MeritFlawDef, opts: { points?: number; waivePrerequisites?: boolean } = {}): void {
    const def = typeof nameOrDef === "string" ? MeritFlawRegistry.get(nameOrDef) : nameOrDef;
    if (!def) throw new Error(`Unknown merit/flaw: ${nameOrDef}`);
    const key = StringUtil.normalize(def.name);
    if (this.MeritsFlaws.has(key)) throw new Error(`${def.name} is already taken.`);
    if (!opts.waivePrerequisites) {
      const check = this.MeetsRequirements(def.requires);
      if (!check.ok) throw new Error(`${def.name} prerequisites not met: ${check.missing.join(", ")}`);
    }
    const allowed = Array.isArray(def.points) ? def.points : [def.points];
    const points = opts.points ?? allowed[0];
    if (!allowed.includes(points)) {
      throw new Error(`${def.name} must be taken at one of [${allowed.join(", ")}] points, got ${points}.`);
    }
    this.MeritsFlaws.set(key, { def, points });
  }

  // Bookkeeping for the future freebie engine (merits cost, flaws grant).
  get MeritPointsSpent(): number {
    let n = 0;
    for (const { def, points } of this.MeritsFlaws.values()) if (def.kind === "merit") n += points;
    return n;
  }
  get FlawPointsGained(): number {
    let n = 0;
    for (const { def, points } of this.MeritsFlaws.values()) if (def.kind === "flaw") n += points;
    return n;
  }

  // --- Disciplines & rolls ------------------------------------------------
  DisciplineRating(name: string): number {
    const d = this.Disciplines.get(StringUtil.normalize(name));
    return d ? d.EffectiveValue : 0;
  }

  // Roll a pool as this character, folding in Discipline effects: `potence` adds
  // the character's Potence rating as automatic successes; `bonusDiceFrom` adds
  // each named trait/Discipline's rating as bonus dice (e.g. Celerity, Auspex).
  Roll(input: number | RollTrait[], opts: {
    difficulty?: number; nAgain?: number; rng?: Rng; label?: string;
    automaticSuccesses?: number; potence?: boolean; bonusDiceFrom?: string[];
  } = {}): RollResult {
    let automaticSuccesses = opts.automaticSuccesses ?? 0;
    if (opts.potence) automaticSuccesses += this.DisciplineRating("potence");
    let bonusDice = 0;
    for (const name of opts.bonusDiceFrom ?? []) bonusDice += this.TraitValue(name);
    let pool: number | RollTrait[];
    if (typeof input === "number") pool = Math.max(0, input + bonusDice);
    else pool = bonusDice > 0 ? [...input, { name: "bonus", value: bonusDice }] : input;
    return Dice.roll(pool, {
      difficulty: opts.difficulty, nAgain: opts.nAgain, rng: opts.rng,
      label: opts.label, automaticSuccesses,
    });
  }

  // --- Health & soak -------------------------------------------------------
  get WoundPenalty(): number { return this.Health.Penalty; }

  // Soak rule for a severity; harmless/fatal are not in the SoakSpec and are
  // treated as not soakable. Fortitude (a Discipline) lets a character soak a
  // severity their template normally can't - e.g. a ghoul soaking lethal - with
  // Fortitude dice. (Templates that already soak it, like a vampire, are
  // unaffected, so Fortitude is never double-counted.)
  private _soakRule(sev: Severity): SoakTypeRule {
    const base = sev === Severity.BASHING ? this.Soak.bashing
      : sev === Severity.LETHAL ? this.Soak.lethal
      : sev === Severity.AGGRAVATED ? this.Soak.aggravated
      : { soakable: false, pool: [] };
    if (!base.soakable && this.TraitValue("fortitude") > 0) {
      return { soakable: true, pool: ["fortitude"] };
    }
    return base;
  }

  SoakPoolFor(severity: Severity | SeverityName): number {
    const rule = this._soakRule(Severity.coerce(severity));
    if (!rule.soakable) return 0;
    return rule.pool.reduce((sum, t) => sum + this.TraitValue(t), 0);
  }

  RollSoak(severity: Severity | SeverityName, rng?: Rng): SoakReport {
    const sev = Severity.coerce(severity);
    const rule = this._soakRule(sev);
    if (!rule.soakable) return { soakable: false, pool: 0, soaked: 0, roll: null };
    const pool = this.SoakPoolFor(sev);
    if (pool <= 0) return { soakable: true, pool: 0, soaked: 0, roll: null };
    const roll = Dice.roll(pool, { difficulty: this.Soak.difficulty, rng, label: `${sev.Name} soak` });
    return { soakable: true, pool, soaked: Math.max(0, roll.net), roll };
  }

  // Fold this character's reactions over an incoming packet, recording each
  // change. The returned packet is what actually gets soaked and applied.
  ResolveIncoming(packet: DamagePacket): { final: DamagePacket; trace: ReactionTrace[] } {
    let current = packet;
    const trace: ReactionTrace[] = [];
    for (const reaction of this.Reactions) {
      const next = reaction.Apply(current, this);
      if (next !== current) trace.push({ reaction: reaction.Label, from: current.describe(), to: next.describe() });
      current = next;
    }
    return { final: current, trace };
  }

  // The full pipeline: let the character reshape the packet, then soak (if the
  // resolved packet still permits it) and mark the remainder on the track.
  TakePacket(packet: DamagePacket, opts: { soak?: boolean; rng?: Rng } = {}): DamageReport {
    const { final, trace } = this.ResolveIncoming(packet);
    const doSoak = (opts.soak ?? true) && final.Soakable;
    let soaked = 0;
    let soakRoll: RollResult | null = null;
    if (doSoak) {
      const r = this.RollSoak(final.Severity, opts.rng);
      soaked = r.soaked;
      soakRoll = r.roll;
    }
    const applied = Math.max(0, final.Intensity - soaked);
    this.Health.ApplyDamage(final.Severity, applied);
    return {
      severity: final.Severity.Name,
      incoming: packet.Intensity,
      intensity: final.Intensity,
      soaked, applied, soakRoll,
      original: packet.describe(),
      resolved: final.describe(),
      trace,
      health: this.Health.Summary(),
    };
  }

  // Convenience wrapper: build a bare packet (optionally tagged with kinds and a
  // source) and run it through TakePacket.
  TakeDamage(
    severity: Severity | SeverityName,
    intensity: number,
    opts: { soak?: boolean; rng?: Rng; kinds?: DamageKind[]; source?: DamageSource } = {}
  ): DamageReport {
    const packet = new DamagePacket({ intensity, severity, kinds: opts.kinds, source: opts.source });
    return this.TakePacket(packet, opts);
  }

  Heal(severity: Severity | SeverityName, amount: number): number { return this.Health.Heal(severity, amount); }

  // --- Resource pools ------------------------------------------------------
  private _tracker(name: string): Tracker {
    const t = this.Trackers.get(StringUtil.normalize(name));
    if (!t) throw new Error(`Tracker ${name} not found.`);
    return t;
  }

  GetPool(name: string): Pool {
    const p = this.Pools.get(StringUtil.normalize(name));
    if (!p) throw new Error(`Pool ${name} not found.`);
    return p;
  }

  SpendWillpower(amount: number = 1): void { this._tracker("willpower").Spend(amount); }
  RegainWillpower(amount: number = 1): void { this._tracker("willpower").Regain(amount); }
  SpendPool(name: string, amount: number, reason: string = ""): void { this.GetPool(name).Spend(amount, reason); }
  GainPool(name: string, amount: number, reason: string = ""): number { return this.GetPool(name).Gain(amount, reason); }

  // --- Storage serialization ----------------------------------------------
  // Writes the sheet under `char_<name>` via a StorageManager (prefixed with
  // the script id, preserving the historical `<scriptId>_char_<name>` key).
  async SaveToStory() {
    const storage = new StorageManager();

    // Extracting just the data needed for persistence to avoid circular JSON issues
    const serializedData = {
      name: this.Name,
      template: this.Template,
      xp: this._xpRemaining,
      downtime: this._downtimeRemaining,
      attributes: Array.from(this.Attributes.entries()).map(([k, v]) => ({ name: k, value: v.Value, effective: v.EffectiveValue })),
      abilities: Array.from(this.Abilities.entries()).map(([k, v]) => ({ name: k, value: v.Value })),
      backgrounds: Array.from(this.Backgrounds.entries()).map(([k, v]) => ({ name: k, value: v.Value })),
      trackers: Array.from(this.Trackers.entries()).map(([k, v]) => ({ name: k, perm: v.Value, temp: v.Temporary })),
      pools: Array.from(this.Pools.entries()).map(([k, v]) => ({ name: k, current: v.Current, max: v.Max })),
      virtues: Array.from(this.Virtues.entries()).map(([k, v]) => ({ name: k, value: v.Value })),
      traits: Array.from(this.Traits.entries()).map(([k, v]) => ({ name: k, value: v.Value })),
      disciplines: Array.from(this.Disciplines.entries()).map(([k, v]) => ({ name: k, value: v.Value })),
      tags: [...this.Tags],
      meritsFlaws: Array.from(this.MeritsFlaws.values()).map(({ def, points }) => ({ name: StringUtil.normalize(def.name), kind: def.kind, points })),
      morality: this.Morality ? { road: this.Morality.RoadName, value: this.Morality.Value, polarity: this.Morality.Polarity, unplayable: this.Morality.IsUnplayable } : null,
      health: this.Health.Summary(),
    };

    await storage.set(`char_${StringUtil.normalize(this.Name)}`, serializedData);
    return serializedData;
  }
}

// =============================================================================
// CHARACTER FACTORY - build a LiveCharacter from a TemplateConfig
// =============================================================================
export interface CharacterCreationOptions {
  generation?: number;                   // Vampire blood-pool sizing
  road?: RoadDefinition;                 // override the template's default Road
  attributes?: Record<string, number>;   // optional seed (name -> dots)
  abilities?: Record<string, number>;
  backgrounds?: Record<string, number>;
  virtues?: Record<string, number>;       // Virtue dots (default 1 each)
  poolStarts?: Record<string, number>;    // chosen starting values for pools/trackers
  traits?: Record<string, number>;        // misc rated traits
  disciplines?: Record<string, number>;   // Discipline dots (e.g. { potence: 1, fortitude: 2 })
  tags?: string[];                        // prerequisite tags ("toreador", "revenant", ...)
  meritsFlaws?: Array<string | { name: string; points?: number; waive?: boolean }>;
  reactions?: DamageReaction[];           // extra damage reactions (e.g. worn armour), appended after the template's
}

export class CharacterFactory {
  static create(template: TemplateConfig, name: string, opts: CharacterCreationOptions = {}): LiveCharacter {
    const attributes = CharacterFactory._statMap(opts.attributes, Category.PHYSICAL);
    const abilities = CharacterFactory._statMap(opts.abilities, Category.SKILL);
    const backgrounds = CharacterFactory._statMap(opts.backgrounds, Category.BACKGROUND);
    const traits = CharacterFactory._statMap(opts.traits, Category.VITAL);
    const disciplines = CharacterFactory._statMap(opts.disciplines, Category.DISCIPLINE);
    const virtuesProvided = opts.virtues !== undefined;
    const road = opts.road ?? template.Morality?.road ?? ROAD_OF_HUMANITY;

    // Virtues (1-5) - only for templates that use them.
    const virtues = new Map<string, Stat>();
    if (template.HasVirtues) {
      for (const v of road.virtues) {
        const key = StringUtil.normalize(v);
        const dots = opts.virtues?.[v] ?? opts.virtues?.[key] ?? 1;
        virtues.set(key, new Stat(v, Category.VIRTUE, dots, 5, 5));
      }
    }

    // Trackers & pools, honouring per-template starting-value constraints.
    const trackers = new Map<string, Tracker>();
    const pools = new Map<string, Pool>();
    for (const def of template.Pools) {
      const key = StringUtil.normalize(def.name);
      const explicit = opts.poolStarts?.[def.name] ?? opts.poolStarts?.[key];
      const chosen = CharacterFactory._resolveStart(def, explicit);
      if (def.kind === "tracker") {
        trackers.set(key, new Tracker(def.name, Category.TRACKER, chosen, def.max, def.max));
      } else {
        let max = def.max;
        let perTurn = def.perTurnLimit ?? Infinity;
        let start = chosen;
        if (def.fromGeneration && opts.generation !== undefined) {
          const bs = bloodForGeneration(opts.generation);
          max = bs.max;
          perTurn = bs.perTurn;
          start = explicit !== undefined ? chosen : max; // default to a full pool
        }
        pools.set(key, new Pool(def.name, max, start, perTurn));
      }
    }

    // Derived start (Dark Ages): Willpower = Courage when the player set Virtues.
    if (template.HasVirtues && virtuesProvided && trackers.has("willpower")
        && opts.poolStarts?.["willpower"] === undefined) {
      const courage = virtues.get("courage");
      if (courage) trackers.set("willpower", new Tracker("willpower", Category.TRACKER, courage.Value, 10, 10));
    }

    const character = new LiveCharacter(
      name, template.Name, template.Rules, attributes, abilities, backgrounds, trackers
    );
    character.Pools = pools;
    character.Virtues = virtues;
    character.Traits = traits;
    character.Disciplines = disciplines;
    character.Soak = template.Soak;
    character.Health = new HealthTrack(template.HealthLevels);
    // Template reactions first (innate physiology), then per-character extras
    // like armour - so severity/kind rewrites happen before mitigation.
    character.Reactions = [...template.Reactions, ...(opts.reactions ?? [])];

    // Morality (a Road/Humanity, or an ascending Torment). Derive the start
    // from the two rating Virtues when the player engaged with Virtues.
    if (template.Morality) {
      const mc = template.Morality;
      let start = mc.start ?? (mc.polarity === "ascending" ? 0 : 5);
      if (mc.deriveFromVirtues && template.HasVirtues && virtuesProvided) {
        const r = mc.road ?? road;
        const [a, b] = r.ratingVirtues;
        start = (virtues.get(StringUtil.normalize(a))?.Value ?? 0) + (virtues.get(StringUtil.normalize(b))?.Value ?? 0);
      }
      character.Morality = new MoralityTrait(mc.name, start, { polarity: mc.polarity });
    }

    // Tags before merits/flaws, so tag-based prerequisites can be satisfied.
    for (const tag of opts.tags ?? []) character.AddTag(tag);
    for (const mf of opts.meritsFlaws ?? []) {
      if (typeof mf === "string") character.AddMeritFlaw(mf);
      else character.AddMeritFlaw(mf.name, { points: mf.points, waivePrerequisites: mf.waive });
    }

    return character;
  }

  private static _statMap(src: Record<string, number> | undefined, cat: Category): Map<string, Stat> {
    const m = new Map<string, Stat>();
    if (src) {
      for (const [k, v] of Object.entries(src)) {
        m.set(StringUtil.normalize(k), new Stat(k, cat, v, Math.max(5, v), Math.max(5, v)));
      }
    }
    return m;
  }

  // Validates a chosen starting value against the PoolDef constraints.
  private static _resolveStart(def: PoolDef, chosen: number | undefined): number {
    if (chosen === undefined) return def.start;
    if (def.startOptions && !def.startOptions.includes(chosen)) {
      throw new Error(`${def.name} must start at one of [${def.startOptions.join(", ")}], got ${chosen}.`);
    }
    const min = def.startMin ?? 0;
    const max = def.startMax ?? def.max;
    if (chosen < min || chosen > max) {
      throw new Error(`${def.name} must start between ${min} and ${max}, got ${chosen}.`);
    }
    return chosen;
  }
}

// =============================================================================
// COMMAND ROUTER - dispatch for inline [[...]] player commands
// -----------------------------------------------------------------------------
// Placeholder for the forthcoming command system: onTextAdventureInput below
// pulls every [[bracketed]] command out of the player's input and hands the
// inner text here. For now it just returns that text verbatim (a no-op parse);
// verbs like `roll`, `spend` or `damage` will be dispatched from here later.
// =============================================================================
// =============================================================================
// PLAYABLE CHARACTERS - potential characters created via [[create-playable]]
// -----------------------------------------------------------------------------
// A PlayableCharacter is the persisted record of a (possibly in-progress)
// player character: a name, one or MORE templates (hybrids are legal; how
// multiple templates merge is resolved later, at build time), and allocation
// buckets that start empty ("everything unassigned").
//
// Source of truth is the LOREBOOK entry (category wod:player-characters), which
// the player may edit directly while creator mode is on; storyStorage carries a
// synced copy for fast access. Sync always flows lorebook -> storage, never the
// other way, except when the script itself changes a character (save() writes
// both, lorebook first).
// =============================================================================
export const PLAYER_CHARACTERS_CATEGORY = "wod:player-characters";

export interface PlayableCharacter {
  id: string;
  name: string;
  templates: string[];                    // normalized TEMPLATES keys, 1+
  stage: "potential" | "ready";           // potential = not yet buildable
  attributes: Record<string, number>;     // all buckets start empty
  abilities: Record<string, number>;
  backgrounds: Record<string, number>;
  virtues: Record<string, number>;
  disciplines: Record<string, number>;
  traits: Record<string, number>;
  poolStarts: Record<string, number>;
  tags: string[];                         // free-form (clan, ghoul, ...)
}

export class CharacterStore {
  private static _storage = new StorageManager();
  private static _key(name: string): string { return `pc:${StringUtil.normalize(name)}`; }
  private static _entryName(name: string): string { return `pc:${StringUtil.normalize(name)}`; }

  static newPotential(name: string, templates: string[]): PlayableCharacter {
    return {
      id: api.v1.uuid(),
      name,
      templates: templates.map(t => StringUtil.normalize(t)),
      stage: "potential",
      attributes: {}, abilities: {}, backgrounds: {}, virtues: {},
      disciplines: {}, traits: {}, poolStarts: {},
      tags: [],
    };
  }

  private static _entryText(char: PlayableCharacter): string {
    return [
      `Player character sheet for ${char.name}. The JSON below the ${SRD_HEADER_MARKER} line is the`,
      "character's data. Edit it only while creator mode is on ([[creator-mode set=true]]);",
      "your edits are synced into the game when you issue any command or turn creator mode off.",
      SRD_HEADER_MARKER,
      JSON.stringify(char, null, 2),
    ].join("\n");
  }

  // Write-through save: lorebook entry (create or update) first, then storage.
  static async save(char: PlayableCharacter): Promise<void> {
    const { id: categoryId } = await LorebookManager.ensureCategory(PLAYER_CHARACTERS_CATEGORY);
    const want = CharacterStore._entryName(char.name);
    const entries = await api.v1.lorebook.entries(categoryId);
    const existing = entries.find(e => (e.displayName ?? "").trim().toLowerCase() === want);
    if (existing) {
      await api.v1.lorebook.updateEntry(existing.id, { text: CharacterStore._entryText(char) });
    } else {
      await api.v1.lorebook.createEntry({
        id: api.v1.uuid(), displayName: want, category: categoryId,
        text: CharacterStore._entryText(char),
      });
    }
    await CharacterStore._storage.set(CharacterStore._key(char.name), char);
  }

  static async load(name: string): Promise<PlayableCharacter | undefined> {
    return await CharacterStore._storage.get(CharacterStore._key(name)) as PlayableCharacter | undefined;
  }

  // Lorebook -> storage. The player's lorebook edits win; unparseable entries
  // are reported, not synced. Returns what happened for the OOC reply.
  static async syncFromLorebook(): Promise<{ synced: string[]; failed: string[] }> {
    const synced: string[] = [];
    const failed: string[] = [];
    for (const entry of await LorebookManager.entriesInCategory(PLAYER_CHARACTERS_CATEGORY)) {
      const label = (entry.displayName ?? "").trim();
      const body = LorebookManager.contentBelowHeader(entry.text ?? "").trim();
      if (!body.startsWith("{")) { if (label) failed.push(label); continue; }
      try {
        const char = JSON.parse(body) as PlayableCharacter;
        if (!char || typeof char.name !== "string" || !Array.isArray(char.templates)) { failed.push(label); continue; }
        await CharacterStore._storage.set(CharacterStore._key(char.name), char);
        synced.push(char.name);
      } catch {
        failed.push(label);
      }
    }
    return { synced, failed };
  }
}

// =============================================================================
// COMMAND ROUTER - dispatch for inline [[...]] player commands
// -----------------------------------------------------------------------------
// onTextAdventureInput pulls every [[bracketed]] command out of the player's
// input, dispatches it here, and replaces it with a single-line
// ((OOC-Storyteller: ...)) note (the host forbids newlines in inputText).
// Implemented verbs: creator-mode, create-playable. More (roll, damage,
// spend, extended-roll) plug into the same table.
// =============================================================================
export interface ParsedCommand { name: string; args: Record<string, string>; }

export class CommandRouter {
  private static _storage = new StorageManager();

  // `verb key=value key="quoted value"` -> { name: verb, args: {...} }
  static parse(body: string): ParsedCommand {
    const trimmed = body.trim();
    const nameMatch = trimmed.match(/^[A-Za-z][\w-]*/);
    const name = (nameMatch?.[0] ?? "").toLowerCase();
    const args: Record<string, string> = {};
    const argRe = /([A-Za-z][\w-]*)\s*=\s*("([^"]*)"|'([^']*)'|[^\s]+)/g;
    for (const m of trimmed.slice(name.length).matchAll(argRe)) {
      args[m[1].toLowerCase()] = m[3] ?? m[4] ?? m[2];
    }
    return { name, args };
  }

  static async creatorModeEnabled(): Promise<boolean> {
    return (await CommandRouter._storage.getOrDefault("creator-mode", false)) as boolean;
  }

  // Routes one command body to its handler; returns the OOC replacement text
  // (always a single line - the host strips newlines from inputText).
  static async route(body: string): Promise<string> {
    const cmd = CommandRouter.parse(body);
    // While creator mode is on, the player may have edited character entries:
    // pick those edits up before any command runs.
    if (await CommandRouter.creatorModeEnabled()) await CharacterStore.syncFromLorebook();

    switch (cmd.name) {
      case "creator-mode": return CommandRouter._creatorMode(cmd);
      case "create-playable": return CommandRouter._createPlayable(cmd);
      default:
        return `((OOC-Storyteller: Unknown command "${cmd.name}". Available: creator-mode, create-playable.))`;
    }
  }

  private static async _creatorMode(cmd: ParsedCommand): Promise<string> {
    const set = (cmd.args["set"] ?? "").toLowerCase();
    if (set !== "true" && set !== "false") {
      return `((OOC-Storyteller: creator-mode needs set=true or set=false.))`;
    }
    if (set === "true") {
      await CommandRouter._storage.set("creator-mode", true);
      return `((OOC-Storyteller: Creator mode ON. You may now edit entries in "${PLAYER_CHARACTERS_CATEGORY}" directly; edits are synced in when you issue a command or turn creator mode off.))`;
    }
    // Leaving creator mode: capture any final lorebook edits, then switch off.
    const { synced, failed } = await CharacterStore.syncFromLorebook();
    await CommandRouter._storage.set("creator-mode", false);
    const parts = [`Creator mode OFF.`];
    if (synced.length) parts.push(`Synced from lorebook: ${synced.join(", ")}.`);
    if (failed.length) parts.push(`Could not parse: ${failed.join(", ")} - fix the JSON and sync again.`);
    return `((OOC-Storyteller: ${parts.join(" ")}))`;
  }

  private static async _createPlayable(cmd: ParsedCommand): Promise<string> {
    const name = cmd.args["name"]?.trim();
    if (!name) return `((OOC-Storyteller: create-playable needs name="...".))`;
    const rawTemplates = (cmd.args["templates"] ?? cmd.args["template"] ?? "").split(",").map(t => StringUtil.normalize(t)).filter(t => t.length > 0);
    if (rawTemplates.length === 0) return `((OOC-Storyteller: create-playable needs templates="a,b,..." (at least one).))`;
    const unknown = rawTemplates.filter(t => !(t in TEMPLATES));
    if (unknown.length) {
      return `((OOC-Storyteller: Unknown template(s): ${unknown.join(", ")}. Valid: ${Object.keys(TEMPLATES).join(", ")}.))`;
    }
    if (await CharacterStore.load(name)) {
      return `((OOC-Storyteller: A character named "${name}" already exists. Edit it in creator mode, or pick another name.))`;
    }
    const char = CharacterStore.newPotential(name, rawTemplates);
    await CharacterStore.save(char);
    return `((OOC-Storyteller: Created playable character "${name}" [${rawTemplates.join("+")}] - all traits unassigned. Its sheet is the "pc:${StringUtil.normalize(name)}" entry in "${PLAYER_CHARACTERS_CATEGORY}"; use creator mode to edit it.))`;
  }
}

const COMMAND_PATTERN = /\[\[([\s\S]*?)\]\]/g;

// Replace every [[command]] in the player's adventure-mode input with its OOC
// note, running commands in order. If the input was ONLY commands (no prose),
// generation is suppressed - the player is operating the system, not the story.
export async function processAdventureInput(rawInputText: string): Promise<OnTextAdventureInputReturnValue | undefined> {
  const matches = [...rawInputText.matchAll(COMMAND_PATTERN)];
  if (matches.length === 0) return undefined; // not ours; leave input untouched

  let out = "";
  let cursor = 0;
  for (const m of matches) {
    out += rawInputText.slice(cursor, m.index);
    out += await CommandRouter.route(m[1]);
    cursor = (m.index ?? 0) + m[0].length;
  }
  out += rawInputText.slice(cursor);

  const prose = rawInputText.replace(COMMAND_PATTERN, "").trim();
  // The host forbids newlines in inputText (it would replace them with spaces).
  return { inputText: out.replace(/\n/g, " "), stopGeneration: prose.length === 0 };
}

api.v1.hooks.register("onTextAdventureInput", async (params: Parameters<OnTextAdventureInput>[0]) => {
  return processAdventureInput(params.rawInputText);
});
