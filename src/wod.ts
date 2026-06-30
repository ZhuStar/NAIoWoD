// =============================================================================
// NAIoWoD - World of Darkness (Dark Ages) character system for NovelAI scripting
// -----------------------------------------------------------------------------
// Single-file module: at runtime inside NovelAI the host injects a global `api`
// object; locally (and in tests) the mock below is used instead. Everything is
// exported so the test suite can import it; for a NovelAI deployment you can run
// the `build` script (or simply strip the `export` keywords and the mock).
// =============================================================================

// --- API CONTRACT ---
interface WodApi {
  v1: {
    script: { id: string };
    storyStorage: { set: (key: string, value: unknown) => void };
    lorebook: { entries: () => Array<{ displayName: string; category: string }> };
  };
}

// --- API MOCK (yields to a real host-provided `api` when one exists) ---
const __host = globalThis as unknown as { api?: WodApi };
const api: WodApi = __host.api ?? {
  v1: {
    script: { id: "a1b2c3d4-script-uuid" },
    storyStorage: {
      set: (key: string, value: unknown) => {
        Log(`[STORAGE SAVE] Key: ${key} | Data:`, value);
      }
    },
    lorebook: {
      entries: () => [
        { displayName: "srd:ability:talent:brawl", category: "srd:ability" },
        { displayName: "srd:ability:skill:drive", category: "srd:ability" },
        { displayName: "srd:ability:knowledge:occult", category: "srd:ability" },
        { displayName: "srd:background:none:generation", category: "srd:background" }
      ]
    }
  }
};

// --- UTILITIES & CONSTANTS ---
export function Log(...args: unknown[]): void { console.log(...args); }

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
}

export type CategoryType = "physical" | "social" | "mental" | "talent" | "skill" | "knowledge" | "background" | "tracker";
export class Category {
  static readonly PHYSICAL = new Category("physical");
  static readonly SOCIAL = new Category("social");
  static readonly MENTAL = new Category("mental");
  static readonly TALENT = new Category("talent");
  static readonly SKILL = new Category("skill");
  static readonly KNOWLEDGE = new Category("knowledge");
  static readonly BACKGROUND = new Category("background");
  static readonly TRACKER = new Category("tracker");

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

// Extends Stat to handle temporary spendable points (Willpower, Blood, Quintessence)
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
    if (this._tempValue < amount) throw new Error(`Not enough temporary ${this._name} to spend.`);
    this._tempValue -= amount;
  }

  Regain(amount: number, canExceedPermanent: boolean = false) {
    this._tempValue += amount;
    if (!canExceedPermanent && this._tempValue > this.Value) {
      this._tempValue = this.Value;
    }
  }
}

// --- LOREBOOK PARSER ---
export class LorebookParser {
  static ParseFromApi(): { abilities: Map<string, Stat>, backgrounds: Map<string, Stat> } {
    const abilities = new Map<string, Stat>();
    const backgrounds = new Map<string, Stat>();

    const rawEntries = api.v1.lorebook.entries();

    rawEntries.forEach(entry => {
      const parsed = StringUtil.parseSrdName(entry.displayName);

      // Map the parsed subCategory string back to our strict Category constants
      let catObj: Category = Category.KNOWLEDGE; // fallback
      if (parsed.subCategory === 'talent') catObj = Category.TALENT;
      if (parsed.subCategory === 'skill') catObj = Category.SKILL;
      if (parsed.kind === 'background') catObj = Category.BACKGROUND;

      if (catObj === Category.BACKGROUND) {
        backgrounds.set(parsed.name, new Stat(parsed.name, catObj, 0));
      } else {
        abilities.set(parsed.name, new Stat(parsed.name, catObj, 0));
      }
    });

    return { abilities, backgrounds };
  }
}

// --- LIVE CHARACTER SHEET ---
export class LiveCharacter {
  private _xpRemaining: number = 0;
  private _downtimeRemaining: number = 0;

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

  // Storage Serialization
  SaveToStory() {
    const storageKey = `${api.v1.script.id}_char_${StringUtil.normalize(this.Name)}`;

    // Extracting just the data needed for persistence to avoid circular JSON issues
    const serializedData = {
      name: this.Name,
      template: this.Template,
      xp: this._xpRemaining,
      downtime: this._downtimeRemaining,
      attributes: Array.from(this.Attributes.entries()).map(([k, v]) => ({ name: k, value: v.Value, effective: v.EffectiveValue })),
      trackers: Array.from(this.Trackers.entries()).map(([k, v]) => ({ name: k, perm: v.Value, temp: v.Temporary }))
    };

    api.v1.storyStorage.set(storageKey, serializedData);
  }
}
