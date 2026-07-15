import { describe, test, expect, beforeAll, beforeEach } from "bun:test";
import {
  type Rng,
  StringUtil, Category, PointSource, Stat, Tracker,
  LedgerEntry, StatModifier, RulesetConfig, LiveCharacter, LorebookParser,
  Dice, Random,
  Severity, HealthTrack,
  DamagePacket, Kind, Source,
  UndeadPhysiology, SilverVulnerability, ArmorReaction,
  Pool, bloodForGeneration,
  MoralityTrait,
  ScopedStorage, LorebookManager, __resetLorebookMock, __resetStorageMock,
  CommandRouter, CommandParser, CharacterStore, PLAYER_CHARACTERS_CATEGORY, processAdventureInput,
  MeritFlawRegistry, SRD_CATEGORIES,
  makeRollSpec, parsePoolExpression, resolveSpec, executeRoll, RollModifierRegistry, DEFAULT_DIFFICULTY,
  overrideSpec, describeSpec, NamedRollStore, NAMED_ROLLS_CATEGORY,
  ExtendedRoll, applyInterval, ExtendedRollStore,
  readSuccessTable, describeTableReading, describeTable, SuccessTableRegistry, parseTableRows,
  compareRolls, applyContestRound, describeContest,
  ExtendedContestStore, SuccessTables, SUCCESS_TABLES_ENTRY,
  reloadAllConfigStores, resetAllConfigStores, ALL_CONFIG_STORES,
  describeCommandSpec, composeCommand, type CommandSpec,
  CONSTRAINT_RELATIONS, CONSTRAINT_DOMAINS, CreatorMode,
  type SuccessTable, type ExtendedContest, type RollExecution,
  parseAliasToken, AliasRegistry, PlayerStore,
  ConditionRegistry, CharacterConditions, CONDITIONS_ENTRY,
  makeConditionDef, describeConditionDef, parseConditionDuration, describeDuration,
  type ConditionDef, type ActiveCondition,
  makeConstraintGroup, describeConstraint, checkConstraints, ConstraintRegistry, CONSTRAINTS_ENTRY,
  type ConstraintGroup, type ConstraintRelation, type ConstraintDomain, type OwnedTraits,
  openConstraintWindow, api, __resetUiMock, __uiWindows, __uiClickButton,
  resourcesForTemplates, resourceEffect, CharacterResources,
  CharacterHealth, CharacterBoosts, healthLevelsForTemplates,
  resolveReply, renderPromptText, WizardSession, ResourceOverrides, RESOURCE_CONFIG_ENTRY, CONFIG_CATEGORY,
  DISCIPLINES, disciplineDef,
  TEMPLATE_MORTAL, TEMPLATE_THRALL, TEMPLATE_VAMPIRE, TEMPLATE_MAGE, TEMPLATE_DEMON,
  TEMPLATE_WEREWOLF, TEMPLATE_GHOUL, TEMPLATES,
  CharacterFactory,
} from "../src/index";

// A fresh story has no SRD lorebook categories; the script seeds them on load.
beforeAll(async () => { await LorebookManager.bootstrap(); });

// Deterministic d10s: maps each desired face (1-10) to the rng value that
// Random(1,10,rng) will turn back into that face. Throws if under-provisioned.
function seqRng(faces: number[]): Rng {
  let i = 0;
  return () => {
    if (i >= faces.length) throw new Error(`seqRng exhausted after ${faces.length} rolls`);
    return (faces[i++] - 0.5) / 10;
  };
}
const allTens: Rng = () => 0.95; // every die comes up 10

describe("StringUtil.toTitleCase", () => {
  test("splits separators and title-cases", () => {
    expect(StringUtil.toTitleCase("self-control")).toBe("Self Control");
    expect(StringUtil.toTitleCase("blood potency")).toBe("Blood Potency");
    expect(StringUtil.toTitleCase("OCCULT")).toBe("Occult");
    expect(StringUtil.toTitleCase("")).toBe("");
  });
});

describe("Random", () => {
  test("is inclusive and deterministic under an injected rng", () => {
    const r = seqRng([1, 10, 5]);
    expect(Random(1, 10, r)).toBe(1);
    expect(Random(1, 10, r)).toBe(10);
    expect(Random(1, 10, r)).toBe(5);
  });
});

describe("Dice", () => {
  test("counts successes at or above difficulty", () => {
    const res = Dice.roll(3, { difficulty: 6, rng: seqRng([6, 7, 2]) });
    expect(res.successes).toBe(2);
    expect(res.ones).toBe(0);
    expect(res.net).toBe(2);
    expect(res.outcome).toBe("success");
  });

  test("1s subtract successes", () => {
    const res = Dice.roll(3, { difficulty: 6, rng: seqRng([6, 6, 1]) });
    expect(res.net).toBe(1);
    expect(res.outcome).toBe("success");
  });

  test("a cancelled success is a failure, not a botch", () => {
    const res = Dice.roll(2, { difficulty: 6, rng: seqRng([6, 1]) });
    expect(res.net).toBe(0);
    expect(res.isBotch).toBe(false);
    expect(res.outcome).toBe("failure");
  });

  test("zero successes plus a 1 is a botch", () => {
    const res = Dice.roll(3, { difficulty: 6, rng: seqRng([1, 2, 3]) });
    expect(res.isBotch).toBe(true);
    expect(res.outcome).toBe("botch");
    expect(res.message).toContain("BOTCH");
  });

  test("10-again explodes by default, adding a re-rolled die", () => {
    const res = Dice.roll(1, { difficulty: 6, rng: seqRng([10, 2]) });
    expect(res.dice).toHaveLength(2);
    expect(res.dice[1].fromExplosion).toBe(true);
    expect(res.successes).toBe(1); // the 10; the re-rolled 2 misses
  });

  test("n-again of 9 explodes 9s and 10s", () => {
    const res = Dice.roll(1, { difficulty: 6, nAgain: 9, rng: seqRng([9, 2]) });
    expect(res.dice).toHaveLength(2);
    expect(res.successes).toBe(1);
  });

  test("n-again of 11 disables explosions", () => {
    const res = Dice.roll(2, { difficulty: 6, nAgain: 11, rng: seqRng([10, 10]) });
    expect(res.dice).toHaveLength(2);
    expect(res.successes).toBe(2);
  });

  test("rolls two named traits as one pool and labels the message", () => {
    const res = Dice.roll(
      [{ name: "dexterity", value: 3 }, { name: "brawl", value: 2 }],
      { difficulty: 6, rng: seqRng([6, 6, 2, 2, 2]) }
    );
    expect(res.pool).toBe(5);
    expect(res.message).toContain("Dexterity (3) + Brawl (2)");
  });

  test("explosion chains terminate at the safety cap", () => {
    const res = Dice.roll(5, { difficulty: 6, rng: allTens });
    expect(res.dice.length).toBe(200);
    expect(res.outcome).toBe("success");
  });

  test("an empty pool yields a clean failure", () => {
    const res = Dice.roll(0, { difficulty: 6 });
    expect(res.dice).toHaveLength(0);
    expect(res.outcome).toBe("failure");
    expect(res.isBotch).toBe(false);
  });
});

describe("Severity", () => {
  test("resolves by name and orders by rank", () => {
    expect(Severity.fromName("lethal")).toBe(Severity.LETHAL);
    expect(Severity.BASHING.Rank).toBeLessThan(Severity.AGGRAVATED.Rank);
    expect(Severity.LETHAL.IsAtLeast(Severity.BASHING)).toBe(true);
    expect(Severity.BASHING.Max(Severity.AGGRAVATED)).toBe(Severity.AGGRAVATED);
    expect(Severity.coerce("bashing")).toBe(Severity.BASHING);
  });
});

describe("DamagePacket", () => {
  test("normalizes kinds/source and describes itself", () => {
    const p = DamagePacket.of({ intensity: 3, severity: "lethal", kinds: ["Piercing"], source: "Gunshot" });
    expect(p.Severity).toBe(Severity.LETHAL);
    expect(p.HasKind("piercing")).toBe(true);
    expect(p.Source).toBe("gunshot");
    expect(p.describe()).toBe("3 lethal {piercing} from gunshot");
  });

  test("mutators return modified copies, leaving the original intact", () => {
    const p = DamagePacket.of({ intensity: 3, severity: "lethal", kinds: ["piercing"] });
    const bashing = p.WithSeverity(Severity.BASHING).AddKind("silver");
    expect(bashing.Severity).toBe(Severity.BASHING);
    expect(bashing.HasKind("silver")).toBe(true);
    expect(bashing.Unsoakable().Soakable).toBe(false);
    // original is frozen and unchanged
    expect(p.Severity).toBe(Severity.LETHAL);
    expect(p.HasKind("silver")).toBe(false);
    expect(p.Soakable).toBe(true);
  });
});

describe("Damage reactions (unit)", () => {
  test("UndeadPhysiology turns piercing lethal to bashing but not fire", () => {
    const undead = new UndeadPhysiology();
    const bullet = DamagePacket.of({ intensity: 4, severity: "lethal", kinds: [Kind.PIERCING] });
    expect(undead.Apply(bullet).Severity).toBe(Severity.BASHING);

    const torch = DamagePacket.of({ intensity: 4, severity: "lethal", kinds: [Kind.FIRE] });
    expect(undead.Apply(torch).Severity).toBe(Severity.AGGRAVATED);

    const club = DamagePacket.of({ intensity: 4, severity: "bashing" });
    expect(undead.Apply(club)).toBe(club); // untouched
  });

  test("SilverVulnerability makes silver aggravated and unsoakable", () => {
    const silver = new SilverVulnerability();
    const round = DamagePacket.of({ intensity: 4, severity: "lethal", kinds: [Kind.PIERCING, Kind.SILVER] });
    const out = silver.Apply(round);
    expect(out.Severity).toBe(Severity.AGGRAVATED);
    expect(out.Soakable).toBe(false);

    const plain = DamagePacket.of({ intensity: 4, severity: "lethal", kinds: [Kind.PIERCING] });
    expect(silver.Apply(plain)).toBe(plain); // untouched
  });

  test("ArmorReaction reduces intensity only for covered kinds", () => {
    const vest = new ArmorReaction("Kevlar", 3, [Kind.PIERCING]);
    const shot = DamagePacket.of({ intensity: 5, severity: "lethal", kinds: [Kind.PIERCING] });
    expect(vest.Apply(shot).Intensity).toBe(2);

    const bite = DamagePacket.of({ intensity: 5, severity: "lethal", kinds: [Kind.SLASHING] });
    expect(vest.Apply(bite)).toBe(bite); // vest doesn't cover slashing
  });
});

describe("HealthTrack", () => {
  test("fills levels and reports the wound penalty", () => {
    const h = new HealthTrack();
    h.ApplyDamage("bashing", 3);
    expect(h.Filled).toBe(3);
    expect(h.Level).toBe("Injured");
    expect(h.Penalty).toBe(-1);
    expect(h.IsIncapacitated).toBe(false);
  });

  test("excess bashing wraps around, upgrading to lethal", () => {
    const h = new HealthTrack();
    h.ApplyDamage("bashing", 7);
    h.ApplyDamage("bashing", 1);
    expect(h.Bashing).toBe(6);
    expect(h.Lethal).toBe(1);
    expect(h.Filled).toBe(7);
    expect(h.IsIncapacitated).toBe(true);
  });

  test("more severe damage replaces the least-severe wound on a full track", () => {
    const h = new HealthTrack();
    h.ApplyDamage("bashing", 7);
    h.ApplyDamage("aggravated", 1);
    expect(h.Bashing).toBe(6);
    expect(h.Aggravated).toBe(1);
    expect(h.Lethal).toBe(0);
  });

  test("a fully-aggravated track is dead, and overkill spills past it", () => {
    const h = new HealthTrack();
    h.ApplyDamage("aggravated", 7);
    expect(h.IsDead).toBe(true);
    h.ApplyDamage("aggravated", 2);
    expect(h.Aggravated).toBe(7);
    expect(h.Overkill).toBe(2);
  });

  test("heals a specific damage type", () => {
    const h = new HealthTrack();
    h.ApplyDamage("bashing", 4);
    expect(h.Heal("bashing", 3)).toBe(3);
    expect(h.Bashing).toBe(1);
    expect(h.Heal("bashing", 5)).toBe(1); // only one left to heal
  });

  test("summary captures the full state", () => {
    const h = new HealthTrack();
    h.ApplyDamage("lethal", 5);
    const s = h.Summary();
    expect(s).toMatchObject({ lethal: 5, filled: 5, capacity: 7, level: "Mauled", penalty: -2 });
  });
});

describe("Pool", () => {
  test("starts full by default and caps gains at max", () => {
    const p = new Pool("blood", 10);
    expect(p.Current).toBe(10);
    p.Spend(4);
    expect(p.Current).toBe(6);
    expect(p.Gain(10)).toBe(4); // only 4 headroom
    expect(p.Current).toBe(10);
  });

  test("enforces the per-turn spend limit", () => {
    const p = new Pool("blood", 15, 15, 3);
    p.Spend(3);
    expect(() => p.Spend(4)).toThrow(/per turn/);
  });

  test("rejects overspending and negative amounts", () => {
    const p = new Pool("quintessence", 20, 2);
    expect(() => p.Spend(3)).toThrow(/Not enough/);
    expect(() => p.Spend(-1)).toThrow(/negative/);
  });

  test("SetMax can shrink the current value and keep a ratio", () => {
    const p = new Pool("blood", 20, 20);
    p.SetMax(10);
    expect(p.Current).toBe(10);
    const q = new Pool("blood", 20, 10);
    q.SetMax(10, true); // half of 10
    expect(q.Current).toBe(5);
  });

  test("keeps an audit log", () => {
    const p = new Pool("blood", 10);
    p.Spend(2, "claws");
    p.Gain(1, "feeding");
    expect(p.AuditLog).toEqual([{ delta: -2, reason: "claws" }, { delta: 1, reason: "feeding" }]);
  });
});

describe("bloodForGeneration", () => {
  test("returns the standard table values", () => {
    expect(bloodForGeneration(13)).toEqual({ max: 10, perTurn: 1 });
    expect(bloodForGeneration(8)).toEqual({ max: 15, perTurn: 3 });
    expect(bloodForGeneration(4)).toEqual({ max: 50, perTurn: 10 });
  });

  test("clamps out-of-range generations", () => {
    expect(bloodForGeneration(99)).toEqual(bloodForGeneration(15));
    expect(bloodForGeneration(1)).toEqual(bloodForGeneration(3));
  });
});

describe("MoralityTrait", () => {
  test("degenerates and improves within 0..max and logs changes", () => {
    const m = new MoralityTrait("Road of Humanity", 5);
    expect(m.Category).toBe(Category.MORALITY);
    m.Degenerate();
    expect(m.Value).toBe(4);
    m.Degenerate(10); // clamps at 0
    expect(m.Value).toBe(0);
    m.Improve(3);
    expect(m.Value).toBe(3);
    expect(m.AuditLog).toHaveLength(3);
    expect(m.AuditLog[0]).toMatchObject({ delta: -1, value: 4 });
  });
});

describe("Templates: starting-value constraints", () => {
  test("a thrall's Resolve is locked to 1", () => {
    const ok = CharacterFactory.create(TEMPLATE_THRALL, "Bonded Servant");
    expect(ok.Trackers.get("resolve")!.Value).toBe(1);
    expect(() => CharacterFactory.create(TEMPLATE_THRALL, "Bad", { poolStarts: { resolve: 2 } }))
      .toThrow(/resolve must start between 1 and 1/);
  });

  test("a demon's Resolve may start in the 3-5 band", () => {
    const demon = CharacterFactory.create(TEMPLATE_DEMON, "Devil", { poolStarts: { resolve: 5 } });
    expect(demon.Trackers.get("resolve")!.Value).toBe(5);
    // Torment is an ascending morality now, not a tracker.
    expect(demon.Morality!.RoadName).toBe("Torment");
    expect(demon.Morality!.Value).toBe(3);
    expect(demon.Morality!.Polarity).toBe("ascending");
    expect(() => CharacterFactory.create(TEMPLATE_DEMON, "Bad", { poolStarts: { resolve: 2 } }))
      .toThrow(/resolve must start between 3 and 5/);
    expect(() => CharacterFactory.create(TEMPLATE_DEMON, "Bad", { poolStarts: { resolve: 6 } }))
      .toThrow(/resolve must start between 3 and 5/);
  });

  test("the TEMPLATES registry exposes all splats", () => {
    expect(Object.keys(TEMPLATES).sort()).toEqual(["demon", "ghoul", "mage", "mortal", "sorcerer", "thrall", "vampire", "werewolf"]);
  });
});

describe("Templates: morality & virtues presence", () => {
  test("mages have neither Road nor Virtues, Quintessence but no Paradox", () => {
    const mage = CharacterFactory.create(TEMPLATE_MAGE, "Hermetic");
    expect(mage.Morality).toBeUndefined();
    expect(mage.Virtues.size).toBe(0);
    expect(mage.Pools.has("quintessence")).toBe(true);
    expect(mage.Pools.has("paradox")).toBe(false);
  });

  test("ghouls are mortal-like but carry a non-generation blood pool", () => {
    const ghoul = CharacterFactory.create(TEMPLATE_GHOUL, "Renfield", {
      attributes: { stamina: 2 },
      traits: { potence: 1 }, // 🚧 Disciplines seeded as traits for now
      virtues: { conscience: 2, "self-control": 2, courage: 3 },
    });
    const blood = ghoul.GetPool("blood");
    expect(blood.Max).toBe(10);
    expect(blood.Current).toBe(0);      // must be fed by a domitor
    expect(blood.PerTurnLimit).toBe(1);
    // still human: has a Road and Virtues (unlike a vampire's undead physiology)
    expect(ghoul.Morality!.RoadName).toBe("Road of Humanity");
    expect(ghoul.Virtues.get("courage")!.Value).toBe(3);
    expect(ghoul.TraitValue("potence")).toBe(1);
  });

  test("vampires derive Road rating from Virtues and Willpower from Courage", () => {
    const v = CharacterFactory.create(TEMPLATE_VAMPIRE, "Cainite", {
      generation: 8,
      virtues: { conscience: 3, "self-control": 2, courage: 4 },
      attributes: { stamina: 3 },
    });
    expect(v.Morality!.RoadName).toBe("Road of Humanity");
    expect(v.Morality!.Value).toBe(5);              // conscience + self-control
    expect(v.Trackers.get("willpower")!.Value).toBe(4); // = courage
    expect(v.Virtues.get("courage")!.Value).toBe(4);
  });

  test("vampire blood pool is sized from generation", () => {
    const v = CharacterFactory.create(TEMPLATE_VAMPIRE, "Elder", { generation: 8 });
    const blood = v.GetPool("blood");
    expect(blood.Max).toBe(15);
    expect(blood.Current).toBe(15);
    expect(blood.PerTurnLimit).toBe(3);
  });
});

describe("LiveCharacter: soak rules differ by template", () => {
  function vampire(extra: Record<string, number> = {}) {
    return CharacterFactory.create(TEMPLATE_VAMPIRE, "Soaker", {
      generation: 13,
      attributes: { stamina: 3 },
      traits: extra,
    });
  }

  test("a vampire soaks lethal with Stamina + Fortitude", () => {
    const v = vampire({ fortitude: 2 }); // lethal soak pool = 3 + 2 = 5 dice
    const report = v.TakeDamage("lethal", 5, { rng: seqRng([6, 6, 2, 2, 2]) }); // 2 soaked
    expect(report.soaked).toBe(2);
    expect(report.applied).toBe(3);
    expect(v.Health.Lethal).toBe(3);
  });

  test("a vampire soaks aggravated only with Fortitude", () => {
    const withFort = vampire({ fortitude: 2 }); // agg soak pool = fortitude = 2 dice
    const r1 = withFort.TakeDamage("aggravated", 3, { rng: seqRng([6, 2]) });
    expect(r1.soaked).toBe(1);
    expect(r1.applied).toBe(2);

    const noFort = vampire(); // no Fortitude -> empty pool -> nothing soaked
    const r2 = noFort.TakeDamage("aggravated", 3);
    expect(r2.soakRoll).toBeNull();
    expect(r2.soaked).toBe(0);
    expect(r2.applied).toBe(3);
  });

  test("a mortal cannot soak lethal but can soak bashing", () => {
    const m = CharacterFactory.create(TEMPLATE_MORTAL, "Peasant", { attributes: { stamina: 3 } });
    const lethal = m.TakeDamage("lethal", 4);
    expect(lethal.soakRoll).toBeNull();
    expect(lethal.applied).toBe(4);

    const bashing = m.TakeDamage("bashing", 4, { rng: seqRng([6, 6, 2]) }); // 2 soaked
    expect(bashing.soaked).toBe(2);
    expect(bashing.applied).toBe(2);
  });

  test("soak can be skipped explicitly", () => {
    const v = vampire({ fortitude: 5 });
    const r = v.TakeDamage("lethal", 3, { soak: false });
    expect(r.soaked).toBe(0);
    expect(r.applied).toBe(3);
    expect(r.soakRoll).toBeNull();
  });
});

describe("The gunshot, four ways (character-owned packet resolution)", () => {
  // One and the same attack. Severity is decided by the target, not the weapon.
  const gunshot = () => DamagePacket.of({
    intensity: 4, severity: "lethal", kinds: [Kind.PIERCING], source: Source.GUNSHOT,
  });

  test("vampire: piercing lethal becomes bashing (no organs, no blood)", () => {
    const v = CharacterFactory.create(TEMPLATE_VAMPIRE, "Cainite", {
      generation: 13, attributes: { stamina: 3 }, traits: { fortitude: 2 },
    });
    const report = v.TakePacket(gunshot(), { soak: false });
    expect(report.severity).toBe("bashing");
    expect(report.applied).toBe(4);
    expect(v.Health.Bashing).toBe(4);
    expect(v.Health.Lethal).toBe(0);
    expect(report.trace.map(t => t.reaction)).toContain("Undead physiology");
    expect(report.original).toContain("lethal");
    expect(report.resolved).toContain("bashing");
  });

  test("mortal: lethal stays lethal and cannot be soaked - all of it lands", () => {
    const m = CharacterFactory.create(TEMPLATE_MORTAL, "Bystander", { attributes: { stamina: 3 } });
    const report = m.TakePacket(gunshot());
    expect(report.severity).toBe("lethal");
    expect(report.soakRoll).toBeNull();   // mortals have no lethal soak
    expect(report.applied).toBe(4);
    expect(m.Health.Lethal).toBe(4);
  });

  test("mortal in a vest: armour eats intensity before the (still unsoakable) lethal lands", () => {
    const cop = CharacterFactory.create(TEMPLATE_MORTAL, "Officer", {
      attributes: { stamina: 3 },
      reactions: [new ArmorReaction("Kevlar", 3, [Kind.PIERCING])],
    });
    const report = cop.TakePacket(gunshot());
    expect(report.incoming).toBe(4);
    expect(report.intensity).toBe(1);     // vest stopped 3 of the 4
    expect(report.severity).toBe("lethal");
    expect(report.soakRoll).toBeNull();
    expect(report.applied).toBe(1);
    expect(cop.Health.Lethal).toBe(1);
  });

  test("werewolf: plain lead is soaked away entirely", () => {
    const w = CharacterFactory.create(TEMPLATE_WEREWOLF, "Garou", { attributes: { stamina: 5 } });
    const report = w.TakePacket(gunshot(), { rng: seqRng([6, 7, 6, 7, 6]) }); // 5 soak successes
    expect(report.severity).toBe("lethal");   // alive, so no undead downgrade
    expect(report.soaked).toBeGreaterThanOrEqual(4);
    expect(report.applied).toBe(0);
    expect(w.Health.Filled).toBe(0);
  });

  test("werewolf + silver: aggravated, unsoakable - good luck", () => {
    const w = CharacterFactory.create(TEMPLATE_WEREWOLF, "Garou", { attributes: { stamina: 5 } });
    const silverShot = DamagePacket.of({
      intensity: 4, severity: "lethal", kinds: [Kind.PIERCING, Kind.SILVER], source: Source.GUNSHOT,
    });
    const report = w.TakePacket(silverShot, { rng: allTens }); // huge soak pool is irrelevant
    expect(report.severity).toBe("aggravated");
    expect(report.soakRoll).toBeNull();   // silver arrives Unsoakable, so no roll happens
    expect(report.soaked).toBe(0);
    expect(report.applied).toBe(4);
    expect(w.Health.Aggravated).toBe(4);
    expect(report.trace.map(t => t.reaction)).toContain("Silver/fire vulnerability");
  });
});

describe("LiveCharacter: pools, willpower and persistence", () => {
  test("spends Willpower and enforces blood per-turn limits", () => {
    const v = CharacterFactory.create(TEMPLATE_VAMPIRE, "Thirsty", { generation: 8 });
    v.SpendWillpower(2);
    expect(v.Trackers.get("willpower")!.Temporary).toBe(3);
    v.SpendPool("blood", 3, "celerity");
    expect(v.GetPool("blood").Current).toBe(12);
    expect(() => v.SpendPool("blood", 4)).toThrow(/per turn/);
  });

  test("mage spends and regains Quintessence", () => {
    const mage = CharacterFactory.create(TEMPLATE_MAGE, "Caster");
    expect(mage.GetPool("quintessence").Current).toBe(0);
    mage.GainPool("quintessence", 5, "node");
    mage.SpendPool("quintessence", 3, "effect");
    expect(mage.GetPool("quintessence").Current).toBe(2);
  });

  test("wound penalty flows through to the character", () => {
    const m = CharacterFactory.create(TEMPLATE_MORTAL, "Hurt", { attributes: { stamina: 0 } });
    m.TakeDamage("lethal", 5, { soak: false });
    expect(m.WoundPenalty).toBe(-2);
    expect(m.Health.Level).toBe("Mauled");
  });

  test("SaveToStory serializes the full sheet", async () => {
    const v = CharacterFactory.create(TEMPLATE_VAMPIRE, "Archive", {
      generation: 10,
      virtues: { conscience: 2, "self-control": 3, courage: 3 },
      attributes: { stamina: 2 },
    });
    v.TakeDamage("bashing", 2, { soak: false });
    const data = await v.SaveToStory();
    expect(data.name).toBe("Archive");
    expect(data.template).toBe("Vampire (Dark Ages)");
    expect(data.morality).toEqual({ road: "Road of Humanity", value: 5, polarity: "descending", unplayable: false });
    expect(data.pools.find(p => p.name === "blood")!.max).toBe(13);
    expect(data.health.bashing).toBe(2);
  });
});

describe("Automatic successes (Potence / Willpower)", () => {
  test("Dice.roll adds free successes and averts a botch", () => {
    const r = Dice.roll(3, { difficulty: 6, automaticSuccesses: 2, rng: seqRng([2, 2, 2]) });
    expect(r.automaticSuccesses).toBe(2);
    expect(r.successes).toBe(0); // dice only
    expect(r.net).toBe(2);
    const b = Dice.roll(2, { difficulty: 6, automaticSuccesses: 1, rng: seqRng([1, 2]) });
    expect(b.isBotch).toBe(false);
    expect(b.net).toBe(0);
  });
});

describe("Disciplines", () => {
  test("the registry records arenas and in-clan associations", () => {
    expect(disciplineDef("Potence")!.arena).toBe("physical");
    expect(DISCIPLINES.dominate.clans).toContain("ventrue");
  });

  test("the factory seeds Discipline dots; DisciplineRating and save read them", async () => {
    const v = CharacterFactory.create(TEMPLATE_VAMPIRE, "Boss", {
      generation: 8, disciplines: { potence: 3, dominate: 2 },
    });
    expect(v.DisciplineRating("potence")).toBe(3);
    expect(v.Disciplines.get("dominate")!.Category).toBe(Category.DISCIPLINE);
    expect((await v.SaveToStory()).disciplines.find(d => d.name === "potence")!.value).toBe(3);
  });

  test("Potence adds its rating as automatic successes", () => {
    const v = CharacterFactory.create(TEMPLATE_VAMPIRE, "Brute", { generation: 8, disciplines: { potence: 2 } });
    const r = v.Roll(3, { potence: true, rng: seqRng([2, 2, 2]) }); // 3 misses + 2 auto
    expect(r.automaticSuccesses).toBe(2);
    expect(r.net).toBe(2);
  });

  test("Celerity (and any Discipline) can add bonus dice via bonusDiceFrom", () => {
    const v = CharacterFactory.create(TEMPLATE_VAMPIRE, "Flash", { generation: 8, disciplines: { celerity: 2 } });
    const r = v.Roll([{ name: "dexterity", value: 3 }], { bonusDiceFrom: ["celerity"], rng: seqRng([6, 6, 6, 6, 6]) });
    expect(r.pool).toBe(5); // 3 + 2
  });

  test("Fortitude lets a ghoul soak lethal it otherwise couldn't", () => {
    const ghoul = CharacterFactory.create(TEMPLATE_GHOUL, "Bruiser", { disciplines: { fortitude: 3 } });
    const r = ghoul.RollSoak("lethal", seqRng([6, 6, 2]));
    expect(r.soakable).toBe(true);
    expect(r.pool).toBe(3);
    expect(r.soaked).toBe(2);
    // a plain mortal still can't soak lethal
    expect(CharacterFactory.create(TEMPLATE_MORTAL, "Nobody", { attributes: { stamina: 4 } }).RollSoak("lethal").soakable).toBe(false);
  });

  test("Fortitude is not double-counted for a vampire that already soaks lethal", () => {
    const v = CharacterFactory.create(TEMPLATE_VAMPIRE, "Elder", {
      generation: 8, attributes: { stamina: 3 }, disciplines: { fortitude: 2 },
    });
    expect(v.SoakPoolFor("lethal")).toBe(5); // stamina 3 + fortitude 2, not 7
  });
});

describe("ScopedStorage", () => {
  test("persists under the prefixed key and reads back", async () => {
    const s = new ScopedStorage("test-prefix");
    await s.set("alpha", { v: 1 });
    expect(await s.get("alpha")).toEqual({ v: 1 });
    expect(await s.has("alpha")).toBe(true);
    expect(await s.getOrDefault("missing", 42)).toBe(42);
  });

  test("setIfAbsent only writes once", async () => {
    const s = new ScopedStorage("test-sia");
    expect(await s.setIfAbsent("k", 1)).toBe(true);
    expect(await s.setIfAbsent("k", 2)).toBe(false);
    expect(await s.get("k")).toBe(1);
  });

  test("delete reports whether the key existed", async () => {
    const s = new ScopedStorage("test-del");
    await s.set("k", "x");
    expect(await s.delete("k")).toBe(true);
    expect(await s.delete("k")).toBe(false);
    expect(await s.has("k")).toBe(false);
  });

  test("prefixes isolate managers from each other", async () => {
    const a = new ScopedStorage("pref-a");
    const b = new ScopedStorage("pref-b");
    await a.set("k", "A");
    await b.set("k", "B");
    expect(await a.get("k")).toBe("A");
    expect(await b.get("k")).toBe("B");
  });

  test("temp variants use api.v1.tempStorage, separate from story storage", async () => {
    const s = new ScopedStorage("test-temp");
    expect(await s.tempSetIfAbsent("k", 1)).toBe(true);
    expect(await s.tempSetIfAbsent("k", 2)).toBe(false);
    expect(await s.tempGet("k")).toBe(1);
    expect(await s.tempGetOrDefault("nope", "fallback")).toBe("fallback");
    expect(await s.tempHas("k")).toBe(true);
    expect(await s.tempDelete("k")).toBe(true);
    expect(await s.tempHas("k")).toBe(false);
    expect(await s.has("k")).toBe(false); // persistent story storage never touched
  });
});

describe("LorebookManager", () => {
  test("resolves category names to ids and lists their entries", async () => {
    const entries = await LorebookManager.entriesInCategory("srd:abilities");
    expect(entries).toHaveLength(3); // talents + skills + knowledges
  });

  test("reads the ability lists from srd:abilities entries", async () => {
    expect(await LorebookManager.allTalents()).toContain("brawl");
    expect(await LorebookManager.allSkills()).toContain("ride");
    expect(await LorebookManager.allKnowledges()).toContain("occult");
    expect(await LorebookManager.allBackgrounds()).toContain("generation");
  });

  test("unknown categories and entries come back empty", async () => {
    expect(await LorebookManager.entriesInCategory("srd:nope")).toEqual([]);
    expect(await LorebookManager.listFrom("srd:abilities", "srd:abilities:nope")).toEqual([]);
    expect(await LorebookManager.entryText("srd:abilities", "srd:abilities:nope")).toBeUndefined();
  });
});

describe("Merits & Flaws", () => {
  test("the registry serves defaults case-insensitively", () => {
    expect(MeritFlawRegistry.get("Iron Will")!.points).toBe(3);
    expect(MeritFlawRegistry.get("iron-will")!.kind).toBe("merit");
  });

  test("plain merits and flaws attach and total their points", () => {
    const m = CharacterFactory.create(TEMPLATE_MORTAL, "Quirky");
    m.AddMeritFlaw("Acute Senses");
    m.AddMeritFlaw("Hunted");
    expect(m.HasMeritFlaw("acute-senses")).toBe(true);
    expect(m.MeritPointsSpent).toBe(1);
    expect(m.FlawPointsGained).toBe(4);
  });

  test("template prerequisites gate, match templates, and can be waived", () => {
    const mortal = CharacterFactory.create(TEMPLATE_MORTAL, "Warm");
    expect(() => mortal.AddMeritFlaw("Eat Food")).toThrow(/prerequisites not met/);
    mortal.AddMeritFlaw("Eat Food", { waivePrerequisites: true });
    expect(mortal.HasMeritFlaw("eat-food")).toBe(true);

    const vampire = CharacterFactory.create(TEMPLATE_VAMPIRE, "Cold", { generation: 12 });
    vampire.AddMeritFlaw("Eat Food"); // "vampire" matches "Vampire (Dark Ages)"
    expect(vampire.HasMeritFlaw("eat-food")).toBe(true);
  });

  test("tag prerequisites work against character tags (lorebook-defined merit)", async () => {
    MeritFlawRegistry.reset();
    const loaded = await MeritFlawRegistry.loadFromLorebook();
    expect(loaded).toBeGreaterThan(0); // the mock lorebook defines "Sturdy Stock"

    const revenant = CharacterFactory.create(TEMPLATE_GHOUL, "Sasha", { tags: ["revenant", "zantosa"] });
    revenant.AddMeritFlaw("Sturdy Stock");
    expect(revenant.HasMeritFlaw("sturdy-stock")).toBe(true);

    const plain = CharacterFactory.create(TEMPLATE_GHOUL, "Igor");
    expect(() => plain.AddMeritFlaw("Sturdy Stock")).toThrow(/tag:revenant/);
  });

  test("merit-on-merit prerequisites chain", () => {
    MeritFlawRegistry.register({ name: "Old Blood", kind: "merit", points: 2, requires: { meritsFlaws: ["iron-will"] } });
    const m = CharacterFactory.create(TEMPLATE_MORTAL, "Stubborn");
    expect(() => m.AddMeritFlaw("Old Blood")).toThrow(/merit-flaw:iron-will/);
    m.AddMeritFlaw("Iron Will");
    m.AddMeritFlaw("Old Blood");
    expect(m.MeritPointsSpent).toBe(5);
    MeritFlawRegistry.reset();
  });

  test("variable point costs validate the chosen rating", () => {
    MeritFlawRegistry.register({ name: "Contested Domain", kind: "flaw", points: [1, 2, 3] });
    const m = CharacterFactory.create(TEMPLATE_MORTAL, "Landed");
    expect(() => m.AddMeritFlaw("Contested Domain", { points: 5 })).toThrow(/one of \[1, 2, 3\]/);
    m.AddMeritFlaw("Contested Domain", { points: 2 });
    expect(m.FlawPointsGained).toBe(2);
    MeritFlawRegistry.reset();
  });

  test("duplicates and unknown names are rejected", () => {
    const m = CharacterFactory.create(TEMPLATE_MORTAL, "Once");
    m.AddMeritFlaw("Dark Secret");
    expect(() => m.AddMeritFlaw("Dark Secret")).toThrow(/already taken/);
    expect(() => m.AddMeritFlaw("Totally Made Up")).toThrow(/Unknown merit\/flaw/);
  });

  test("the factory seeds tags and merits/flaws; SaveToStory includes them", async () => {
    const v = CharacterFactory.create(TEMPLATE_VAMPIRE, "Milov", {
      generation: 10,
      tags: ["tzimisce"],
      meritsFlaws: ["Eat Food", { name: "Hunted" }],
    });
    expect(v.HasTag("tzimisce")).toBe(true);
    const data = await v.SaveToStory();
    expect(data.tags).toContain("tzimisce");
    expect(data.meritsFlaws).toContainEqual({ name: "eat-food", kind: "merit", points: 1 });
    expect(data.meritsFlaws).toContainEqual({ name: "hunted", kind: "flaw", points: 4 });
  });
});

describe("LorebookManager.bootstrap (self-seeding tutorial)", () => {
  test("creates missing categories, seeds tutorial entries, and asks the player", async () => {
    __resetLorebookMock();
    expect(await LorebookManager.entriesInCategory("srd:abilities")).toEqual([]);

    const r = await LorebookManager.bootstrap();
    expect(r.createdCategories).toEqual(SRD_CATEGORIES.map(s => s.name));
    expect(r.seededEntries).toBeGreaterThan(0);
    expect(r.message).toContain("srd:abilities"); // player-facing setup note
    expect(r.message).toContain("Storyteller setup");

    // parser strips the in-card instructions header; the marker + prose survive
    // in the entry text for the player to read/edit
    expect(await LorebookManager.allTalents()).toContain("brawl");
    const talentsText = await LorebookManager.entryText("srd:abilities", "srd:abilities:talents");
    expect(talentsText).toContain("one per line");
    expect(talentsText).toContain("=====");
  });

  test("is idempotent: existing categories are left untouched", async () => {
    __resetLorebookMock();
    await LorebookManager.bootstrap();
    const again = await LorebookManager.bootstrap();
    expect(again.createdCategories).toEqual([]);
    expect(again.seededEntries).toBe(0);
    expect(again.message).toBeNull();
  });
});

describe("LorebookManager.parseList (header marker + comments)", () => {
  test("ignores the header above the marker, strips comments, keeps items", () => {
    const text = [
      "Instructions the player may keep — anything up here is ignored.",
      "=====",
      "Alertness",
      "Brawl # the fisticuffs one",
      "# a whole-line note",
      "Melee // trailing note",
      "",
      "Occult /* inline */",
    ].join("\n");
    expect(LorebookManager.parseList(text)).toEqual(["alertness", "brawl", "melee", "occult"]);
  });

  test("with no marker, the whole text is data", () => {
    expect(LorebookManager.parseList("Foo\nBar")).toEqual(["foo", "bar"]);
  });
});

describe("CommandParser", () => {
  test("splits verb, positional args (in order), and named args", () => {
    const c = CommandParser.parse('roll strength+brawl 7 +1 requires=3 tags="off-hand, ambush"');
    expect(c.name).toBe("roll");
    expect(c.positional).toEqual(["strength+brawl", "7", "+1"]);
    expect(c.named.requires).toBe("3");
    expect(c.named.tags).toBe("off-hand,ambush");
  });

  test("quoted named values, case-insensitive keys, and quoted positionals", () => {
    const c = CommandParser.parse('create-playable name="Erik the Red" templates=vampire,werewolf');
    expect(c.name).toBe("create-playable");
    expect(c.named.name).toBe("erik-the-red");
    expect(c.named.templates).toBe("vampire,werewolf");

    expect(CommandParser.parse("creator-mode SET='true'").named.set).toBe("true");

    const e = CommandParser.parse('roll-for "Erik the Red" willpower');
    expect(e.name).toBe("roll-for");
    expect(e.positional).toEqual(["erik-the-red", "willpower"]);
  });
});

describe("[[create-playable]] and creator mode", () => {
  test("creates a potential multi-template character in lorebook + storage", async () => {
    const reply = await CommandRouter.route('create-playable name="Absurd Al" templates="vampire, werewolf, mage"');
    expect(reply).toContain("Created playable character");
    expect(reply).toContain("vampire+werewolf+mage");

    // storage copy
    const stored = await CharacterStore.load("Absurd Al");
    expect(stored!.templates).toEqual(["vampire", "werewolf", "mage"]);
    expect(stored!.stage).toBe("potential");
    expect(stored!.attributes.strength).toBe(1);   // nine Attributes seeded at 1
    expect(stored!.abilities.brawl).toBe(0);        // every Ability seeded at 0
    expect(stored!.poolStarts.willpower).toBe(0);   // Willpower seeded at 0
    expect(stored!.meritsFlaws).toEqual({});        // empty container

    // lorebook entry is the source of truth
    const text = await LorebookManager.entryText(PLAYER_CHARACTERS_CATEGORY, "pc:absurd-al");
    expect(text).toContain("=====");
    const parsed = JSON.parse(LorebookManager.contentBelowHeader(text!));
    expect(parsed.name).toBe("absurd-al");
    expect(parsed.templates).toEqual(["vampire", "werewolf", "mage"]);
  });

  test("rejects unknown templates, naming the valid ones", async () => {
    const reply = await CommandRouter.route('create-playable name="Bad" templates="vampire,unicorn"');
    expect(reply).toContain("Unknown template(s): unicorn");
    expect(reply).toContain("vampire");
    expect(await CharacterStore.load("Bad")).toBeUndefined();
  });

  test("refuses duplicate names", async () => {
    await CommandRouter.route('create-playable name="Twin" templates=mortal');
    const reply = await CommandRouter.route('create-playable name="Twin" templates=demon');
    expect(reply).toContain("already exists");
    expect((await CharacterStore.load("Twin"))!.templates).toEqual(["mortal"]);
  });

  test("creator mode syncs player lorebook edits into storage (lorebook wins)", async () => {
    await CommandRouter.route('create-playable name="Editable" templates=mortal');
    await CommandRouter.route("creator-mode set=true");

    // The player edits the sheet directly in the lorebook: becomes a ghoul.
    const char = (await CharacterStore.load("Editable"))!;
    const edited = { ...char, templates: ["ghoul"], tags: ["tzimisce-thrall"] };
    const newText = `edited by hand\n=====\n${JSON.stringify(edited, null, 2)}`;
    expect(await LorebookManager.updateEntryText(PLAYER_CHARACTERS_CATEGORY, "pc:editable", newText)).toBe(true);

    // Turning creator mode off picks the edit up (sync is lorebook -> storage).
    const reply = await CommandRouter.route("creator-mode set=false");
    expect(reply).toContain("Synced from lorebook");
    const synced = (await CharacterStore.load("Editable"))!;
    expect(synced.templates).toEqual(["ghoul"]);
    expect(synced.tags).toEqual(["tzimisce-thrall"]);
  });

  test("unparseable player edits are reported, not synced", async () => {
    await CommandRouter.route('create-playable name="Broken" templates=mortal');
    await CommandRouter.route("creator-mode set=true");
    await LorebookManager.updateEntryText(PLAYER_CHARACTERS_CATEGORY, "pc:broken", "junk\n=====\n{not json");
    const reply = await CommandRouter.route("creator-mode set=false");
    expect(reply).toContain("Could not parse");
    expect(reply).toContain("pc:broken");
    expect((await CharacterStore.load("Broken"))!.templates).toEqual(["mortal"]); // old copy intact
  });
});

describe("processAdventureInput (the [[...]] hook)", () => {
  test("replaces commands with OOC notes and suppresses generation for command-only input", async () => {
    const r = await processAdventureInput('[[creator-mode set=true]] [[creator-mode set=false]]');
    expect(r!.stopGeneration).toBe(true);
    expect(r!.inputText).toContain("Creator mode ON");
    expect(r!.inputText).toContain("Creator mode OFF");
    expect(r!.inputText).not.toContain("[[");
    expect(r!.inputText).not.toContain("\n"); // host forbids newlines
  });

  test("keeps surrounding prose and lets generation proceed", async () => {
    const r = await processAdventureInput('I sit down to plan. [[creator-mode set=false]] Then I sleep.');
    expect(r!.stopGeneration).toBe(false);
    expect(r!.inputText!.startsWith("I sit down to plan. ((OOC-Storyteller:")).toBe(true);
    expect(r!.inputText!.endsWith("Then I sleep.")).toBe(true);
  });

  test("returns undefined for plain input (leaves it untouched)", async () => {
    expect(await processAdventureInput("Just walking along.")).toBeUndefined();
  });

  test("unknown commands answer with the available list", async () => {
    const r = await processAdventureInput("[[frobnicate now=please]]");
    expect(r!.inputText).toContain('Unknown command "frobnicate"');
  });
});

describe("Morality polarity (Torment vs Humanity)", () => {
  test("an ascending Torment degenerates upward toward an unplayable 10", () => {
    const t = new MoralityTrait("Torment", 3, { polarity: "ascending" });
    expect(t.Polarity).toBe("ascending");
    t.Degenerate(2);                 // sins push Torment UP
    expect(t.Value).toBe(5);
    expect(t.IsUnplayable).toBe(false);
    t.Improve(1);                    // penance pulls it back DOWN
    expect(t.Value).toBe(4);
    t.Degenerate(20);                // clamps at the max
    expect(t.Value).toBe(10);
    expect(t.IsUnplayable).toBe(true);
  });

  test("a descending Humanity degenerates downward toward an unplayable 0", () => {
    const h = new MoralityTrait("Road of Humanity", 2); // descending by default
    h.Degenerate(2);
    expect(h.Value).toBe(0);
    expect(h.IsUnplayable).toBe(true);
  });
});

describe("Health: per-square penalties, conditions & heal policies", () => {
  test("extra levels and custom penalties come from the squares array", () => {
    const track = new HealthTrack([
      { name: "OK", penalty: 0 }, { name: "OK", penalty: 0 },
      { name: "Winded", penalty: -1 }, { name: "Down", penalty: -4 },
    ]);
    track.ApplyDamage("bashing", 2);
    expect(track.Penalty).toBe(0);
    track.ApplyDamage("bashing", 1);
    expect(track.Level).toBe("Winded");
    expect(track.Penalty).toBe(-1);
  });

  test("a condition reflects how many of its linked boxes are damaged", () => {
    const h = new HealthTrack({
      squares: [
        { name: "A", penalty: 0 },
        { name: "Gut", penalty: -1, condition: "poison" },
        { name: "Gut", penalty: -2, condition: "poison" },
      ],
      conditions: [{
        key: "poison", name: "Poisoned",
        state: (d) => d === 0 ? null : d === 1 ? "queasy" : "retching",
      }],
    });
    expect(h.Conditions()).toHaveLength(0);
    h.ApplyDamage("lethal", 2);   // fills boxes 0 and 1 -> one poison box
    expect(h.Conditions()[0]).toMatchObject({ state: "queasy", damaged: 1, total: 2 });
    h.ApplyDamage("lethal", 1);   // fills box 2 -> both poison boxes
    expect(h.Conditions()[0].state).toBe("retching");
  });

  test("unhealable boxes resist Heal; shallow wounds clear first", () => {
    const h = new HealthTrack([
      { name: "A", penalty: 0, heal: "never" },
      { name: "B", penalty: -1 },
      { name: "C", penalty: -1 },
    ]);
    h.ApplyDamage("lethal", 3);
    expect(h.Heal("lethal", 5)).toBe(2); // boxes 2 and 1 clear; box 0 ("never") can't
    expect(h.Lethal).toBe(1);
  });

  test("HealWithPoints stops when the budget runs out", () => {
    const h = new HealthTrack([
      { name: "A", penalty: 0, healCost: 2 },
      { name: "B", penalty: -1, healCost: 2 },
    ]);
    h.ApplyDamage("bashing", 2);
    expect(h.HealWithPoints("bashing", 2, 3)).toEqual({ healed: 1, pointsSpent: 2 });
  });

  test("special boxes only heal with allowSpecial", () => {
    const h = new HealthTrack([{ name: "A", penalty: 0, heal: "special" }]);
    h.ApplyDamage("aggravated", 1);
    expect(h.Heal("aggravated", 1)).toBe(0);
    expect(h.Heal("aggravated", 1, { allowSpecial: true })).toBe(1);
  });

  test("Summary includes active conditions; harmless no-ops; fatal kills", () => {
    const h = new HealthTrack({
      squares: [{ name: "A", penalty: 0, condition: "burning" }, { name: "B", penalty: -1 }],
      conditions: [{ key: "burning" }],
    });
    h.ApplyDamage("harmless", 3);
    expect(h.Filled).toBe(0);
    h.ApplyDamage("aggravated", 1);
    expect(h.Summary().conditions[0]).toMatchObject({ key: "burning", state: "active", damaged: 1 });
    h.ApplyDamage("fatal", 1);
    expect(h.Fatal).toBe(1);
    expect(h.IsDead).toBe(true);
  });
});

describe("StringUtil.normalize", () => {
  test("lowercases, trims and hyphenates whitespace", () => {
    expect(StringUtil.normalize("  Blood  Potency ")).toBe("blood-potency");
  });
});

describe("Category / PointSource value objects", () => {
  test("are frozen singletons", () => {
    expect(Object.isFrozen(Category.PHYSICAL)).toBe(true);
    expect(Object.isFrozen(PointSource.BASE)).toBe(true);
    expect(Category.PHYSICAL).toBe(Category.PHYSICAL);
    expect(Category.PHYSICAL).not.toBe(Category.SOCIAL);
  });
});

describe("Stat", () => {
  test("base value seeds the ledger and Value", () => {
    const s = new Stat("Strength", Category.PHYSICAL, 3);
    expect(s.Value).toBe(3);
    expect(s.Name).toBe("strength");
    expect(s.AuditLog).toHaveLength(1);
  });

  test("Allocate records auditable ledger entries", () => {
    const s = new Stat("Strength", Category.PHYSICAL, 1);
    s.Allocate(PointSource.FREEBIE, 2, 4);
    expect(s.Value).toBe(3);
    const last = s.AuditLog[s.AuditLog.length - 1] as LedgerEntry;
    expect(last.Source).toBe(PointSource.FREEBIE);
    expect(last.CostIncurred).toBe(4);
  });

  test("creation-phase cap is enforced for base/freebie", () => {
    const s = new Stat("Strength", Category.PHYSICAL, 4, 5, 7);
    expect(() => s.Allocate(PointSource.FREEBIE, 2)).toThrow(/cap of 5/);
  });

  test("post-creation sources use the absolute cap", () => {
    const s = new Stat("Strength", Category.PHYSICAL, 5, 5, 7);
    s.Allocate(PointSource.EXPERIENCE, 2); // 5 -> 7, allowed by absolute cap
    expect(s.Value).toBe(7);
  });

  test("immutable stats reject allocation", () => {
    const s = new Stat("Generation", Category.BACKGROUND, 3, 5, 5, true);
    expect(() => s.Allocate(PointSource.EXPERIENCE, 1)).toThrow(/immutable/);
  });

  test("EffectiveValue clamps to the absolute cap unless a modifier ignores it", () => {
    const s = new Stat("Strength", Category.PHYSICAL, 5, 5, 5);
    s.AddModifier(new StatModifier(3, false, false, "potence"));
    expect(s.EffectiveValue).toBe(5); // clamped
    s.RemoveModifierByDesc("potence");
    s.AddModifier(new StatModifier(3, false, true, "potence-uncapped"));
    expect(s.EffectiveValue).toBe(8); // cap bypassed
  });

  test("EffectiveValue never drops below zero", () => {
    const s = new Stat("Strength", Category.PHYSICAL, 2);
    s.AddModifier(new StatModifier(-5, false, false, "curse"));
    expect(s.EffectiveValue).toBe(0);
  });
});

describe("Tracker", () => {
  test("temporary value tracks permanent and supports spend/regain", () => {
    const wp = new Tracker("Willpower", Category.TRACKER, 5);
    expect(wp.Temporary).toBe(5);
    wp.Spend(2);
    expect(wp.Temporary).toBe(3);
    wp.Regain(10); // capped at permanent
    expect(wp.Temporary).toBe(5);
  });

  test("Regain may exceed permanent when allowed", () => {
    const wp = new Tracker("Willpower", Category.TRACKER, 5);
    wp.Regain(3, true);
    expect(wp.Temporary).toBe(8);
  });

  test("over-spending throws", () => {
    const wp = new Tracker("Willpower", Category.TRACKER, 2);
    expect(() => wp.Spend(3)).toThrow(/Not enough/);
  });

  test("Allocate raises both permanent and temporary", () => {
    const wp = new Tracker("Willpower", Category.TRACKER, 5);
    wp.Spend(5);
    wp.Allocate(PointSource.EXPERIENCE, 1);
    expect(wp.Value).toBe(6);
    expect(wp.Temporary).toBe(1);
  });
});

describe("LorebookParser", () => {
  test("builds abilities and backgrounds from the lorebook lists", async () => {
    const { abilities, backgrounds } = await LorebookParser.ParseFromApi();
    expect(abilities.has("brawl")).toBe(true);
    expect(abilities.get("brawl")!.Category).toBe(Category.TALENT);
    expect(abilities.get("ride")!.Category).toBe(Category.SKILL);
    expect(abilities.get("occult")!.Category).toBe(Category.KNOWLEDGE);
    expect(backgrounds.has("generation")).toBe(true);
  });
});

describe("LiveCharacter XP & downtime spending", () => {
  function makeChar() {
    const attrs = new Map<string, Stat>([["strength", new Stat("Strength", Category.PHYSICAL, 2)]]);
    const trackers = new Map<string, Tracker>([["willpower", new Tracker("Willpower", Category.TRACKER, 5)]]);
    return new LiveCharacter("Test", "Vampire", RulesetConfig.VAMPIRE, attrs, new Map(), new Map(), trackers);
  }

  test("spends XP on an attribute at the configured multiplier", () => {
    const c = makeChar();
    c.AwardXP(8);
    c.SpendXPOnAttribute("Strength"); // current 2 * 4 = 8
    expect(c.Attributes.get("strength")!.Value).toBe(3);
  });

  test("rejects XP spend when insufficient", () => {
    const c = makeChar();
    c.AwardXP(4);
    expect(() => c.SpendXPOnAttribute("Strength")).toThrow(/Not enough XP/);
  });

  test("downtime spend respects ruleset toggle", () => {
    const c = makeChar();
    c.AwardDowntime(10);
    c.SpendDowntimeOnAttribute("Strength"); // VAMPIRE uses downtime, cost 5
    expect(c.Attributes.get("strength")!.Value).toBe(3);
  });
});

describe("newPotential seeding", () => {
  test("nine Attributes at 1, every Ability at 0, Willpower at 0, empty containers", async () => {
    const c = await CharacterStore.newPotential("Seed Test", ["mortal"]);
    expect(Object.keys(c.attributes).length).toBe(9);
    expect(c.attributes.strength).toBe(1);
    expect(c.attributes.wits).toBe(1);
    expect(Object.keys(c.abilities).length).toBeGreaterThan(0);
    expect(c.abilities.brawl).toBe(0);
    expect(Object.values(c.abilities).every(v => v === 0)).toBe(true);
    expect(c.poolStarts.willpower).toBe(0);
    expect(c.meritsFlaws).toEqual({});
    expect(c.backgrounds).toEqual({});
  });
});

describe("rolls engine (rolls.ts)", () => {
  const resolve = (name: string): number =>
    (({ strength: 3, brawl: 2, dexterity: 4 } as Record<string, number>)[StringUtil.normalize(name)] ?? 0);

  test("parsePoolExpression sums traits and integer literals", () => {
    expect(parsePoolExpression("strength+brawl", resolve).total).toBe(5);
    expect(parsePoolExpression("3+2", resolve).total).toBe(5);
    expect(parsePoolExpression("dexterity", resolve).total).toBe(4);
    expect(parsePoolExpression("unknown", resolve).total).toBe(0);
  });

  test("executeRoll meets and falls short of the requirement", () => {
    const met = executeRoll(makeRollSpec({ pool: "strength+brawl", requires: 2 }), resolve, { rng: seqRng([6, 6, 2, 2, 2]) });
    expect(met.result!.net).toBe(2);
    expect(met.met).toBe(true);
    expect(met.outcome).toBe("success");

    const short = executeRoll(makeRollSpec({ pool: "brawl", requires: 3 }), resolve, { rng: seqRng([6, 2]) });
    expect(short.met).toBe(false);
    expect(short.outcome).toBe("failure");
  });

  test("a botch is reported as a botch", () => {
    const b = executeRoll(makeRollSpec({ pool: "strength", requires: 1 }), resolve, { rng: seqRng([1, 2, 3]) });
    expect(b.outcome).toBe("botch");
    expect(b.met).toBe(false);
  });

  test("difficulty can be an expression evaluated against the resolver", () => {
    expect(resolveSpec(makeRollSpec({ pool: "brawl", difficultyExpr: "strength+1" }), resolve).dieDifficulty).toBe(4); // 3+1
    expect(resolveSpec(makeRollSpec({ pool: "brawl", difficultyExpr: "strength+1", difficultyMod: 2 }), resolve).dieDifficulty).toBe(6); // 4+2
    expect(resolveSpec(makeRollSpec({ pool: "brawl", difficultyExpr: "2+3" }), resolve).dieDifficulty).toBe(5); // a calculation, not "2"
    expect(resolveSpec(makeRollSpec({ pool: "3", difficulty: 8 }), resolve).dieDifficulty).toBe(8); // numeric unchanged
  });

  test("difficultyExpr round-trips through describeSpec and overrideSpec", () => {
    const spec = makeRollSpec({ pool: "dexterity+dodge", difficultyExpr: "stamina+3" });
    expect(describeSpec(spec)).toContain("diff stamina+3");
    const numeric = overrideSpec(spec, { difficulty: 7 });   // numeric override replaces the expression
    expect(numeric.difficultyExpr).toBeUndefined();
    expect(numeric.difficulty).toBe(7);
    expect(numeric.pool).toBe("dexterity+dodge");            // pool never overridden
  });

  test("difficulty above 10 costs an extra success per point (not clamped away)", () => {
    const r = resolveSpec(makeRollSpec({ pool: "3", difficulty: 12, requires: 1 }), resolve);
    expect(r.dieDifficulty).toBe(10);
    expect(r.overflow).toBe(2);
    expect(r.requires).toBe(3);
  });

  test('the "impossible" policy fails an over-10 roll without rolling', () => {
    const exec = executeRoll(makeRollSpec({ pool: "5", difficulty: 12 }), resolve, { overDifficulty: "impossible" });
    expect(exec.outcome).toBe("impossible");
    expect(exec.result).toBeNull();
  });

  test("a tag modifier adjusts the roll (Acute Senses lowers difficulty)", () => {
    const r = resolveSpec(makeRollSpec({ pool: "strength", difficulty: 6, tags: ["Acute Senses"] }), resolve);
    expect(r.dieDifficulty).toBe(4);
    expect(r.appliedTags).toContain("acute-senses");
  });

  test("the Willpower tag grants an automatic success", () => {
    const r = executeRoll(makeRollSpec({ pool: "0", requires: 1, tags: ["Willpower"] }), resolve);
    expect(r.result!.automaticSuccesses).toBe(1);
    expect(r.met).toBe(true);
  });

  test("an unregistered tag is reported, not applied", () => {
    const r = resolveSpec(makeRollSpec({ pool: "strength", tags: ["made-up-tag"] }), resolve);
    expect(r.unknownTags).toContain("made-up-tag");
    expect(r.dieDifficulty).toBe(DEFAULT_DIFFICULTY);
  });
});

describe("[[play]], [[roll]] and [[roll-for]]", () => {
  beforeEach(() => { __resetStorageMock(); });

  test("the first created character becomes default and current", async () => {
    const reply = await CommandRouter.route('create-playable name="Rok" templates=mortal');
    expect(reply).toContain("Selected as your default character");
    expect((await CharacterStore.getCurrent())!.name).toBe("rok");
  });

  test("[[roll]] with no active character asks the player to select one", async () => {
    expect(await CommandRouter.route("roll strength")).toContain("No active character");
  });

  test("[[roll]] rolls the current character's resolved pool", async () => {
    await CommandRouter.route('create-playable name="Rok" templates=mortal');
    // Rok's Strength is the seeded 1 -> a one-die pool.
    const r = await CommandRouter.route("roll strength", { rng: seqRng([6]) });
    expect(r).toContain("Rok");
    expect(r).toContain("1 success");
    expect(r).toContain("meets requirement (1)");
  });

  test('[[play name=".."]] switches, [[play]] returns to the default', async () => {
    await CommandRouter.route('create-playable name="Rok" templates=mortal');   // default + current
    await CommandRouter.route('create-playable name="Sela" templates=mortal');
    await CommandRouter.route('play name="Sela"');
    expect((await CharacterStore.getCurrent())!.name).toBe("sela");
    const back = await CommandRouter.route("play");
    expect(back).toContain("default character");
    expect((await CharacterStore.getCurrent())!.name).toBe("rok");
  });

  test('[[roll-for "Name"]] rolls another character without changing selection', async () => {
    await CommandRouter.route('create-playable name="Rok" templates=mortal');   // default + current
    await CommandRouter.route('create-playable name="Sela" templates=mortal');
    const r = await CommandRouter.route('roll-for "Sela" dexterity', { rng: seqRng([6]) });
    expect(r).toContain("Sela");
    expect(r).toContain("1 success");
    expect((await CharacterStore.getCurrent())!.name).toBe("rok"); // unchanged
  });
});

describe("named rolls (@name library)", () => {
  beforeEach(async () => {
    __resetStorageMock();
    __resetLorebookMock();
    await LorebookManager.bootstrap();   // re-seed SRD abilities for create-playable
  });

  test("overrideSpec applies only supplied fields and never the pool", () => {
    const base = makeRollSpec({ pool: "dexterity+dodge", difficulty: 6, requires: 1, tags: ["specialty"] });
    const merged = overrideSpec(base, { difficulty: 8, diceMod: 2 });
    expect(merged.pool).toBe("dexterity+dodge");   // pool never overridden
    expect(merged.difficulty).toBe(8);
    expect(merged.diceMod).toBe(2);
    expect(merged.requires).toBe(1);                // untouched
    expect(merged.tags).toEqual(["specialty"]);     // untouched
  });

  test("NamedRollStore round-trips through the lorebook entry", async () => {
    expect(await NamedRollStore.get("dodge")).toBeUndefined();
    await NamedRollStore.save("Dodge", makeRollSpec({ pool: "dexterity+dodge", difficulty: 6 }));
    expect((await NamedRollStore.get("dodge"))!.pool).toBe("dexterity+dodge"); // normalized key
    expect(await NamedRollStore.names()).toContain("dodge");
    expect(await NamedRollStore.remove("dodge")).toBe(true);
    expect(await NamedRollStore.get("dodge")).toBeUndefined();
  });

  test("a hand-edited library entry is read live", async () => {
    await NamedRollStore.save("dodge", makeRollSpec({ pool: "dexterity+dodge" }));
    const map = { "power-attack": makeRollSpec({ pool: "strength+brawl", difficulty: 7 }) };
    const text = `edited by hand\n=====\n${JSON.stringify(map, null, 2)}`;
    await LorebookManager.updateEntryText(NAMED_ROLLS_CATEGORY, "wod:named-rolls:library", text);
    expect((await NamedRollStore.get("power-attack"))!.difficulty).toBe(7);
    expect(await NamedRollStore.get("dodge")).toBeUndefined(); // replaced by the edit
  });

  test("[[name-roll]] then [[roll @name]] with a per-use override", async () => {
    await CommandRouter.route('create-playable name="Rok" templates=mortal');
    expect(await CommandRouter.route("name-roll punch strength+brawl 6")).toContain('Saved roll "punch"');
    // Rok: Strength 1 + Brawl 0 = a one-die pool.
    const base = await CommandRouter.route("roll @punch", { rng: seqRng([6]) });
    expect(base).toContain("Rok");
    expect(base).toContain("1 success");
    // Override difficulty up to 9: the single die (face 6) now misses.
    const hard = await CommandRouter.route("roll @punch difficulty=9", { rng: seqRng([6]) });
    expect(hard).toContain("vs diff 9");
    expect(hard).toContain("Failure");
  });

  test('[[roll-for "X" @name]] uses the saved roll without changing selection', async () => {
    await CommandRouter.route('create-playable name="Rok" templates=mortal');   // default + current
    await CommandRouter.route('create-playable name="Sela" templates=mortal');
    await CommandRouter.route("name-roll dodge dexterity+dodge 6");
    const r = await CommandRouter.route('roll-for "Sela" @dodge', { rng: seqRng([6]) });
    expect(r).toContain("Sela");
    expect((await CharacterStore.getCurrent())!.name).toBe("rok"); // unchanged
  });

  test("list-rolls, forget-roll, and an unknown @name are reported", async () => {
    await CommandRouter.route('create-playable name="Rok" templates=mortal');
    expect(await CommandRouter.route("list-rolls")).toContain("No saved rolls");
    await CommandRouter.route("name-roll dodge dexterity+dodge");
    expect(await CommandRouter.route("list-rolls")).toContain("dodge");
    expect(await CommandRouter.route("roll @ghost", { rng: seqRng([]) })).toContain('No saved roll named "ghost"');
    expect(await CommandRouter.route("forget-roll dodge")).toContain("Forgot");
    expect(await CommandRouter.route("list-rolls")).toContain("No saved rolls");
  });
});

describe("extended rolls: applyInterval state machine", () => {
  const base: ExtendedRoll = {
    id: "x", label: "", base: makeRollSpec({ pool: "3" }), target: 5, maxRolls: 3,
    interval: "", onBotch: "fail", accumulated: 0, rollsUsed: 0, status: "open", log: [],
  };
  const twoHits = executeRoll(makeRollSpec({ pool: "3" }), () => 0, { rng: seqRng([6, 6, 2]) }); // net 2
  const botch = executeRoll(makeRollSpec({ pool: "2" }), () => 0, { rng: seqRng([1, 2]) });        // botch

  test("accumulates net successes toward the target, then succeeds", () => {
    let a = base;
    a = applyInterval(a, twoHits, "A").action;   // 2/5
    expect(a.accumulated).toBe(2);
    expect(a.status).toBe("open");
    a = applyInterval(a, twoHits, "A").action;   // 4/5
    expect(a.status).toBe("open");
    a = applyInterval(a, twoHits, "B").action;   // 6/5 -> succeeded
    expect(a.status).toBe("succeeded");
    expect(a.log.map(l => l.by)).toEqual(["A", "A", "B"]);
  });

  test("runs out of intervals and fails", () => {
    let a: ExtendedRoll = { ...base, target: 100, maxRolls: 2 };
    a = applyInterval(a, twoHits, "A").action;
    a = applyInterval(a, twoHits, "A").action;
    expect(a.rollsUsed).toBe(2);
    expect(a.status).toBe("failed");
  });

  test("a botch fails the action under the default policy", () => {
    const r = applyInterval(base, botch, "A");
    expect(r.action.status).toBe("failed");
    expect(r.note).toContain("botch");
  });

  test('the "lose-successes" policy zeroes progress but keeps going', () => {
    const a0: ExtendedRoll = { ...base, accumulated: 3, rollsUsed: 1, onBotch: "lose-successes" };
    const r = applyInterval(a0, botch, "A");
    expect(r.action.accumulated).toBe(0);
    expect(r.action.status).toBe("open");
  });

  test('the "ignore" policy treats a botch as a wasted interval', () => {
    const a0: ExtendedRoll = { ...base, accumulated: 3, rollsUsed: 1, onBotch: "ignore" };
    const r = applyInterval(a0, botch, "A");
    expect(r.action.accumulated).toBe(3);   // unchanged
    expect(r.action.rollsUsed).toBe(2);      // interval still consumed
    expect(r.action.status).toBe("open");
  });
});

describe("ExtendedRollStore.resolve", () => {
  beforeEach(() => { __resetStorageMock(); });
  const mk = (id: string, status: ExtendedRoll["status"] = "open"): ExtendedRoll => ({
    id, label: "", base: makeRollSpec({ pool: "3" }), target: 5, maxRolls: 3,
    interval: "", onBotch: "fail", accumulated: 0, rollsUsed: 0, status, log: [],
  });

  test("resolves the single open action, the current pointer, and an explicit id", async () => {
    await ExtendedRollStore.save(mk("a"));
    expect((await ExtendedRollStore.resolve())!.id).toBe("a");    // single open
    await ExtendedRollStore.save(mk("b"));
    expect(await ExtendedRollStore.resolve()).toBeUndefined();    // two open -> ambiguous
    await ExtendedRollStore.setCurrent("b");
    expect((await ExtendedRollStore.resolve())!.id).toBe("b");    // current pointer
    expect((await ExtendedRollStore.resolve("a"))!.id).toBe("a"); // explicit id
  });

  test("a closed current pointer falls back to the single open action", async () => {
    await ExtendedRollStore.save(mk("done", "succeeded"));
    await ExtendedRollStore.setCurrent("done");
    await ExtendedRollStore.save(mk("live"));
    expect((await ExtendedRollStore.resolve())!.id).toBe("live");
  });
});

describe("extended-roll commands", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); await LorebookManager.bootstrap(); });

  test("start then continue to success (accumulating across intervals)", async () => {
    await CommandRouter.route('create-playable name="Rok" templates=mortal'); // Strength 1 + Stamina 1 = 2 dice
    const start = await CommandRouter.route("extended-roll strength+stamina requires=3 intervals=4", { rng: seqRng([6, 6]) });
    expect(start).toContain("Rok starts extended");
    expect(start).toContain("2/3 successes");
    const cont = await CommandRouter.route("continue-roll", { rng: seqRng([6, 6]) });
    expect(cont).toContain("succeeded");   // 2 + 2 >= 3
  });

  test("a botch fails the whole action by default", async () => {
    await CommandRouter.route('create-playable name="Rok" templates=mortal');
    const start = await CommandRouter.route("extended-roll strength+stamina requires=9 intervals=3", { rng: seqRng([1, 2]) });
    expect(start).toContain("botch");
    expect(start).toContain("failed");
  });

  test("a continuation's dice-modifier brings in helpers", async () => {
    await CommandRouter.route('create-playable name="Rok" templates=mortal');
    await CommandRouter.route("extended-roll strength+stamina requires=20 intervals=5", { rng: seqRng([2, 2]) }); // i1: 0
    const cont = await CommandRouter.route("continue-roll dice-modifier=+3", { rng: seqRng([6, 6, 6, 6, 6]) });    // 2+3 dice
    expect(cont).toContain("5/20 successes");
  });

  test("roll-status, cancel-roll, and a second character continuing", async () => {
    await CommandRouter.route('create-playable name="Rok" templates=mortal');   // default + current
    await CommandRouter.route('create-playable name="Sela" templates=mortal');
    await CommandRouter.route('extended-roll strength+stamina requires=20 intervals=5 label=`Dig out`', { rng: seqRng([6, 6]) });
    expect(await CommandRouter.route("roll-status")).toContain("Dig out");

    await CommandRouter.route('play name="Sela"');
    const cont = await CommandRouter.route("continue-roll", { rng: seqRng([6, 6]) });
    expect(cont).toContain("Sela continues");
    expect(cont).toContain("4/20 successes"); // 2 (Rok) + 2 (Sela)

    expect(await CommandRouter.route("cancel-roll")).toContain("Cancelled");
    expect(await CommandRouter.route("roll-status")).toContain("No extended action");
  });
});

describe("resources: model", () => {
  test("resourcesForTemplates unions and dedupes, merging roles", () => {
    expect(resourcesForTemplates(["mortal"]).map(r => r.name)).toEqual(["willpower"]);
    const mage = resourcesForTemplates(["mage"]).map(r => r.name);
    expect(mage).toEqual(["willpower", "quintessence"]);
    // hybrid: mage + thrall -> willpower once, then quintessence + resolve
    expect(resourcesForTemplates(["mage", "thrall"]).map(r => r.name)).toEqual(["willpower", "quintessence", "resolve"]);
    expect(resourcesForTemplates([]).map(r => r.name)).toEqual(["willpower"]); // baseline
  });

  test("Willpower and Resolve carry their configured effects/roles", () => {
    expect(resourcesForTemplates(["mortal"])[0].effect?.apply).toEqual([{ op: "successes", amount: 1 }]);
    const resolve = resourcesForTemplates(["demon"]).find(r => r.name === "resolve")!;
    expect(resolve.effect?.apply).toEqual([{ op: "difficulty", amount: -2 }]);
    expect(resolve.roles).toContain("resolve");
  });
});

describe("CharacterResources", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); await LorebookManager.bootstrap(); });

  test("resolves by name and by role, spends/gains with clamping, and persists", async () => {
    const zul = await CharacterStore.newPotential("Zul", ["demon"]);
    expect(CharacterResources.resolveDef(zul, "resolve")!.name).toBe("resolve");
    expect(CharacterResources.resolveDef(zul, "magic-fuel")!.name).toBe("resolve"); // by role
    const def = CharacterResources.resolveDef(zul, "resolve")!;
    expect(await CharacterResources.current(zul, def)).toBe(3);           // template default
    expect((await CharacterResources.spend(zul, "resolve", 2)).spent).toBe(2);
    expect(await CharacterResources.current(zul, def)).toBe(1);
    expect((await CharacterResources.spend(zul, "resolve", 5)).spent).toBe(1); // only 1 left
    expect(await CharacterResources.current(zul, def)).toBe(0);
    await CharacterResources.gain(zul, "resolve", 100);
    expect(await CharacterResources.current(zul, def)).toBe(10);          // clamped at max
  });
});

describe("executeRoll extra modifier", () => {
  test("folds an ad-hoc modifier in like a matched tag", () => {
    const r0 = () => 0;
    const auto = executeRoll(makeRollSpec({ pool: "1", requires: 1 }), r0, { rng: seqRng([2]), extra: { autoSuccesses: 1 } });
    expect(auto.result!.automaticSuccesses).toBe(1);
    expect(auto.met).toBe(true); // 0 dice successes + 1 auto
    expect(resolveSpec(makeRollSpec({ pool: "1", difficulty: 8 }), r0, { extra: { difficultyMod: -2 } }).dieDifficulty).toBe(6);
  });
});

describe("resource commands", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); await LorebookManager.bootstrap(); });

  test("[[resources]] lists the current character's resources", async () => {
    await CommandRouter.route('create-playable name="Merlin" templates=mage');
    const r = await CommandRouter.route("resources");
    expect(r).toContain("willpower");
    expect(r).toContain("quintessence");
  });

  test("[[roll ... spend=willpower]] deducts Willpower and adds an automatic success", async () => {
    await CommandRouter.route('create-playable name="Merlin" templates=mage');
    await CommandRouter.route("gain willpower 3");   // seeded at 0; give some to spend
    const r = await CommandRouter.route("roll strength spend=willpower", { rng: seqRng([2]) });
    expect(r).toContain("spent 1 willpower");
    expect(r).toContain("1 success");               // 0 dice + 1 automatic
    expect(await CommandRouter.route("resources")).toContain("willpower 2/10");
  });

  test("spending Resolve lowers difficulty by its configured amount", async () => {
    await CommandRouter.route('create-playable name="Zul" templates=demon');
    // Resolve starts at 3; difficulty 8 - 2 = 6, so the single die (face 6) now hits.
    const r = await CommandRouter.route("roll strength difficulty=8 spend=resolve", { rng: seqRng([6]) });
    expect(r).toContain("vs diff 6");
    expect(r).toContain("spent 1 resolve");
    expect(r).toContain("1 success");
  });

  test("standalone spend/gain adjust and clamp; spending with none is reported", async () => {
    await CommandRouter.route('create-playable name="Vlad" templates=vampire'); // Blood starts full (10)
    expect(await CommandRouter.route("spend blood 3")).toContain("Now 7/10");
    expect(await CommandRouter.route("gain blood 100")).toContain("Now 10/10");
    expect(await CommandRouter.route("spend willpower")).toContain("no willpower to spend"); // seeded at 0
  });
});

describe("resources v2: named effects, nAgain, mandatory costs", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); await LorebookManager.bootstrap(); });

  test("resourceEffect picks a named context effect or the default", () => {
    const resolve = resourcesForTemplates(["demon"]).find(r => r.name === "resolve")!;
    expect(resourceEffect(resolve)!.apply[0]).toEqual({ op: "difficulty", amount: -2 }); // default
    const cast = resourceEffect(resolve, "cast")!;
    const ops = Object.fromEntries(cast.apply.map(o => [o.op, o.amount]));
    expect(ops["successes"]).toBe(1);
    expect(ops["nagain"]).toBe(8);
    expect(ops["difficulty"]).toBe(-2);
    expect(resourceEffect(resolve, "nope")).toBeUndefined();
  });

  test("an effect's nAgain reaches the dice (via the extra modifier)", () => {
    const r0 = () => 0;
    // difficulty 6, 8-again: the 8 succeeds AND explodes into one more die.
    const exec = executeRoll(makeRollSpec({ pool: "1", difficulty: 6 }), r0, { rng: seqRng([8, 2]), extra: { nAgain: 8 } });
    expect(exec.result!.dice.length).toBe(2);
    expect(exec.result!.successes).toBe(1);
  });

  test("[[roll spend=resolve:cast]] applies the whole bundle", async () => {
    await CommandRouter.route('create-playable name="Zul" templates=demon'); // Resolve starts 3
    const r = await CommandRouter.route("roll strength difficulty=8 spend=resolve:cast", { rng: seqRng([2]) });
    expect(r).toContain("vs diff 6");                // 8 - 2
    expect(r).toContain("spent 1 resolve (cast)");
    expect(r).toContain("1 success");                // 0 dice + 1 automatic from the bundle
  });

  test("a mandatory spend refuses (and does not roll) when unaffordable", async () => {
    await CommandRouter.route('create-playable name="Odo" templates=sorcerer'); // Willpower seeded 0
    const r = await CommandRouter.route("roll strength spend=willpower!", { rng: seqRng([6]) });
    expect(r).toContain("can't");
    expect(r).toContain("not enough willpower");
    expect(r).not.toContain("success");              // never rolled
  });

  test("Willpower spent as pure spell fuel deducts without a dice bonus", async () => {
    await CommandRouter.route('create-playable name="Odo" templates=sorcerer');
    await CommandRouter.route("gain willpower 2");
    const r = await CommandRouter.route("roll strength spend=willpower:fuel", { rng: seqRng([2]) });
    expect(r).toContain("spent 1 willpower (fuel)");
    expect(r).toContain("Failure");                  // face 2, no auto-success from fuel
    expect(await CommandRouter.route("resources")).toContain("willpower 1/10");
  });

  test("an unknown named effect is refused", async () => {
    await CommandRouter.route('create-playable name="Zul" templates=demon');
    expect(await CommandRouter.route("roll strength spend=resolve:bogus", { rng: seqRng([6]) })).toContain('no "bogus" effect');
  });
});

describe("live health (CharacterHealth)", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); await LorebookManager.bootstrap(); });

  test("damage rebuilds a real track: penalties, counts, incapacitation", async () => {
    const c = await CharacterStore.newPotential("Hurt Guy", ["mortal"]);
    expect((await CharacterHealth.summary(c)).penalty).toBe(0);
    await CharacterHealth.damage(c, "lethal", 3);
    const s = await CharacterHealth.summary(c);
    expect(s.lethal).toBe(3);
    expect(s.penalty).toBe(-1);          // 3 filled on the standard track -> Injured
    expect(s.level).toBe("Injured");
    await CharacterHealth.damage(c, "bashing", 4);
    expect((await CharacterHealth.summary(c)).isIncapacitated).toBe(true);
  });

  test("heal is worst-first among the allowed severities", async () => {
    const c = await CharacterStore.newPotential("Mender", ["vampire"]);
    await CharacterHealth.damage(c, "bashing", 2);
    await CharacterHealth.damage(c, "lethal", 2);
    await CharacterHealth.damage(c, "aggravated", 1);
    // Allowed bashing+lethal only: heals the 2 lethal first, then 1 bashing.
    const { healed, summary } = await CharacterHealth.heal(c, ["bashing", "lethal"], 3);
    expect(healed).toBe(3);
    expect(summary.lethal).toBe(0);
    expect(summary.bashing).toBe(1);
    expect(summary.aggravated).toBe(1);  // untouched: not in the allowed list
  });

  test("healthLevelsForTemplates falls back to mortal", () => {
    expect(healthLevelsForTemplates([]).length).toBe(7);
    expect(healthLevelsForTemplates(["vampire"]).length).toBe(7);
  });
});

describe("attribute boosts (CharacterBoosts)", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); await LorebookManager.bootstrap(); });

  test("resolves increase targets against constraints", async () => {
    const c = await CharacterStore.newPotential("Surger", ["vampire"]);
    // group constraint: needs a pick, and the pick must fall inside it
    expect(CharacterBoosts.resolveIncreaseTarget(c, "physical", undefined)).toHaveProperty("need");
    expect(CharacterBoosts.resolveIncreaseTarget(c, "physical", "charisma")).toHaveProperty("error");
    expect(CharacterBoosts.resolveIncreaseTarget(c, "physical", "strength")).toEqual({ trait: "strength" });
    // bucket constraint: picks within the record's abilities
    expect(CharacterBoosts.resolveIncreaseTarget(c, "abilities", "brawl")).toEqual({ trait: "brawl" });
    expect(CharacterBoosts.resolveIncreaseTarget(c, "abilities", "strength")).toHaveProperty("error");
    // a specific-trait constraint needs no argument
    expect(CharacterBoosts.resolveIncreaseTarget(c, "brawl", undefined)).toEqual({ trait: "brawl" });
  });

  test("caps bound the TOTAL (record dots + boost) and clear works", async () => {
    const c = await CharacterStore.newPotential("Surger", ["vampire"]); // Strength dots = 1
    const r = await CharacterBoosts.add(c, "strength", 2, 4);
    expect(r.added).toBe(2);                       // 1 + 2 = 3, under the cap of 4
    const r2 = await CharacterBoosts.add(c, "strength", 5, 4);
    expect(r2.added).toBe(1);                      // only 1 more fits under 4 total
    await CharacterBoosts.clear(c);
    expect(await CharacterBoosts.all(c)).toEqual({});
  });
});

describe("heal & boost in play", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); await LorebookManager.bootstrap(); });

  test("[[damage]] -> [[health]] -> the wound penalty shrinks the next roll", async () => {
    await CommandRouter.route('create-playable name="Vlad" templates=vampire');
    const dmg = await CommandRouter.route("damage lethal 3");
    expect(dmg).toContain("penalty -1");
    expect(await CommandRouter.route("health")).toContain("Injured");
    // Pool of literal 5 with -1 wound penalty -> exactly 4 dice: seqRng(4 faces)
    // would throw if a 5th die were rolled.
    const r = await CommandRouter.route("roll 5", { rng: seqRng([6, 6, 6, 6]) });
    expect(r).toContain("wound penalty -1");
    expect(r).toContain("4 successes");
  });

  test("[[spend blood:heal]] heals worst-first and reports both lines", async () => {
    await CommandRouter.route('create-playable name="Vlad" templates=vampire'); // blood starts 10
    await CommandRouter.route("damage lethal 2");
    const r = await CommandRouter.route("spend blood:heal 2");
    expect(r).toContain("healing 2 boxes");
    expect(r).toContain("0B/0L/0A");
    expect(r).toContain("blood now 8/10");
  });

  test("[[spend blood:boost strength 2]] raises Strength for rolls until cleared", async () => {
    await CommandRouter.route('create-playable name="Vlad" templates=vampire');
    const boost = await CommandRouter.route("spend blood:boost strength 2");
    expect(boost).toContain("Strength +2");
    // Strength 1 + boost 2 = 3 dice.
    const r = await CommandRouter.route("roll strength", { rng: seqRng([6, 6, 6]) });
    expect(r).toContain("3 successes");
    await CommandRouter.route("clear-boosts");
    const r2 = await CommandRouter.route("roll strength", { rng: seqRng([6]) });
    expect(r2).toContain("1 success");
  });

  test("boosting a non-allowed category is refused without spending", async () => {
    await CommandRouter.route('create-playable name="Vlad" templates=vampire');
    const r = await CommandRouter.route("spend blood:boost charisma 2");
    expect(r).toContain("not a boostable");
    expect(await CommandRouter.route("resources")).toContain("blood 10/10"); // nothing spent
  });

  test("heal/boost effects are refused inside a roll, pointing at [[spend]]", async () => {
    await CommandRouter.route('create-playable name="Vlad" templates=vampire');
    const r = await CommandRouter.route("roll strength spend=blood:heal", { rng: seqRng([6]) });
    expect(r).toContain("healing effect");
    expect(r).toContain("outside a roll");
  });
});

describe("wizard engine (wizard.ts)", () => {
  const choice = {
    step: "s", title: "T", body: "b", kind: "choice" as const, default: "keep",
    options: [{ value: "keep", label: "Keep as is" }, { value: "customize", label: "Customize" }],
  };

  test("resolveReply: choices by number, value, label; keep; errors", () => {
    expect(resolveReply(choice, "2")).toEqual({ value: "customize" });
    expect(resolveReply(choice, "customize")).toEqual({ value: "customize" });
    expect(resolveReply(choice, "Keep as is")).toEqual({ value: "keep" });
    expect(resolveReply(choice, "keep")).toEqual({ value: "keep" });   // default
    expect(resolveReply(choice, "")).toEqual({ value: "keep" });        // empty -> default
    expect("error" in resolveReply(choice, "banana")).toBe(true);
    expect("error" in resolveReply(choice, "7")).toBe(true);
  });

  test("resolveReply: numbers and confirms", () => {
    const num = { step: "n", title: "N", body: "", kind: "number" as const, default: "3" };
    expect(resolveReply(num, "8")).toEqual({ value: "8" });
    expect(resolveReply(num, "keep")).toEqual({ value: "3" });
    expect("error" in resolveReply(num, "abc")).toBe(true);
    const yn = { step: "c", title: "C", body: "", kind: "confirm" as const };
    expect(resolveReply(yn, "y")).toEqual({ value: "yes" });
    expect(resolveReply(yn, "NO")).toEqual({ value: "no" });
    expect("error" in resolveReply(yn, "maybe")).toBe(true);
  });

  test("renderPromptText is a single line with options and hints", () => {
    const line = renderPromptText({ ...choice, progress: { at: 1, of: 3 } });
    expect(line).toContain("[1/3]");
    expect(line).toContain("1) Keep as is");
    expect(line).toContain('"cancel" exits');
    expect(line.includes("\n")).toBe(false);
  });
});

describe("resource overrides (the house-rule layer)", () => {
  beforeEach(async () => {
    __resetStorageMock(); __resetLorebookMock(); resetAllConfigStores();
    await LorebookManager.bootstrap();
  });

  test("resourcesForTemplates applies patches and adds custom resources", () => {
    const defs = resourcesForTemplates(["mage"], {
      quintessence: { start: 5, roles: ["magic-fuel", "resolve"] },
      "hearth-luck": { kind: "pool", start: 1, max: 5 },
    });
    const q = defs.find(d => d.name === "quintessence")!;
    expect(q.start).toBe(5);
    expect(q.roles).toContain("resolve");
    expect(defs.find(d => d.name === "hearth-luck")!.max).toBe(5); // custom added
  });

  test("save/load round-trips through the lorebook; hand-edits are honored", async () => {
    await ResourceOverrides.save({ willpower: { max: 8 } });
    ResourceOverrides.reset();
    expect(await ResourceOverrides.loadFromLorebook()).toBe(1);
    expect(ResourceOverrides.current().willpower.max).toBe(8);

    // The player hand-edits the entry (what creator mode allows).
    const edited = `notes\n=====\n${JSON.stringify({ willpower: { max: 6 } })}`;
    await LorebookManager.updateEntryText(CONFIG_CATEGORY, RESOURCE_CONFIG_ENTRY, edited);
    await ResourceOverrides.loadFromLorebook();
    expect(ResourceOverrides.current().willpower.max).toBe(6);
  });
});

describe("[[configure-resources]] wizard (text medium)", () => {
  beforeEach(async () => {
    __resetStorageMock(); __resetLorebookMock(); resetAllConfigStores();
    await LorebookManager.bootstrap();
  });
  // Plain input goes through the adventure hook - that's the reply channel.
  const reply = async (text: string): Promise<string> => {
    const r = await processAdventureInput(text);
    return r?.inputText ?? "";
  };

  test("full walk: customize willpower, add a role, save to the lorebook", async () => {
    await CommandRouter.route('create-playable name="Odo" templates=mortal'); // one resource: willpower
    const first = await CommandRouter.route("configure-resources");
    expect(first).toContain('Resource "willpower"');

    expect(await reply("2")).toContain("start");         // customize -> start prompt
    expect(await reply("5")).toContain("max");           // start=5 -> max prompt
    expect(await reply("8")).toContain("spend effect");  // max=8 -> effect prompt
    const roles = await reply("2");                      // autoSuccesses 1 -> 2
    expect(roles).toContain("Extra roles");
    const confirm = await reply("done");
    expect(confirm).toContain("Save changes?");
    const done = await reply("yes");
    expect(done).toContain("finished");
    expect(done).toContain("Saved 1 resource override");

    // The data landed and is live.
    const wp = ResourceOverrides.current().willpower;
    expect(wp.start).toBe(5);
    expect(wp.max).toBe(8);
    expect(wp.effect!.apply[0]).toEqual({ op: "successes", amount: 2 });
    expect(await CommandRouter.route("resources")).toContain("willpower 0/8"); // record's chosen start (0) still wins; max is patched
    // The wizard released plain input.
    expect(await processAdventureInput("just walking")).toBeUndefined();
  });

  test("roles step lets Quintessence serve as Resolve (by role)", async () => {
    await CommandRouter.route('create-playable name="Merlin" templates=mage');
    await CommandRouter.route("configure-resources");
    await reply("keep");                                  // willpower: keep
    await reply("keep");                                  // quintessence: keep
    await reply("quintessence: resolve");                 // add the role
    await reply("done");
    const done = await reply("yes");
    expect(done).toContain("Saved 1 resource override");
    const merlin = (await CharacterStore.getCurrent())!;
    expect(CharacterResources.resolveDef(merlin, "resolve")!.name).toBe("quintessence");
  });

  test("bad replies re-prompt; cancel exits without saving", async () => {
    await CommandRouter.route('create-playable name="Odo" templates=mortal');
    await CommandRouter.route("configure-resources");
    const err = await reply("banana");
    expect(err).toContain("reply with an option");
    expect(err).toContain('Resource "willpower"');        // same prompt again
    const bye = await reply("cancel");
    expect(bye).toContain("cancelled");
    expect(ResourceOverrides.current()).toEqual({});
    expect(await processAdventureInput("free again")).toBeUndefined();
  });

  test("needs a character; refuses a second concurrent wizard", async () => {
    expect(await CommandRouter.route("configure-resources")).toContain("No active character");
    await CommandRouter.route('create-playable name="Odo" templates=mortal');
    await CommandRouter.route("configure-resources");
    expect(await CommandRouter.route("configure-resources")).toContain("already running");
    await CommandRouter.route("cancel-wizard");
  });
});

describe("effect grammar v3 (open ops, costs, limits, ledger)", () => {
  beforeEach(async () => {
    __resetStorageMock(); __resetLorebookMock(); resetAllConfigStores();
    await LorebookManager.bootstrap();
    await CommandRouter.route('create-playable name="Odo" templates=mortal'); // Wits 1, Stamina 1, Brawl 0
    // A custom house-ruled resource exercising one grammar dimension per effect.
    await ResourceOverrides.save({
      mana: {
        kind: "pool", start: 10, max: 20,
        effects: {
          cheap:   { label: "Cheap trick", apply: [{ op: "dice", amount: 1 }], cost: { units: 3, reducedBy: { pool: "wits+2", perSuccess: 1 } } },
          bulk:    { label: "Bulk buy", apply: [{ op: "dice", amount: 1 }], cost: { units: 1, buys: 3 } },
          capped:  { label: "Capped", apply: [{ op: "dice", amount: 1 }], limits: { maxPerUse: 2 } },
          mend:    { label: "Mend", apply: [{ op: "heal", target: "all", fillToCap: true }] },
          empower: { label: "Empower Brawl", apply: [{ op: "increase", target: "brawl", fillToCap: true, cap: "stamina+2" }] },
          ward:    { label: "Ward of Clarity", apply: [{ op: "suspend", target: "majesty" }], limits: { uses: { n: 2, per: "scene" } } },
          precise: { label: "Precise", apply: [{ op: "difficulty", amount: -1, target: "melee" }] },
        },
      },
    });
  });

  test("a cost-reduction roll cuts the price (Iron Will style)", async () => {
    // Reduction roll first (wits+2 = 3 dice: 2 net), then the main roll (str 1 + 1 bonus die).
    const r = await CommandRouter.route("roll strength spend=mana:cheap", { rng: seqRng([6, 6, 2, 6, 6]) });
    expect(r).toContain("wits+2 roll offsets 2 cost");
    expect(r).toContain("spent 1 mana (cheap)");   // 3 - 2
    expect(r).toContain("2 successes");
    expect(await CommandRouter.route("resources")).toContain("mana 9/20");
  });

  test("`buys` prices one resource unit for several effect units", async () => {
    const r = await CommandRouter.route("roll strength spend=mana:bulk", { rng: seqRng([6, 6, 6, 6]) });
    expect(r).toContain("spent 1 mana (bulk)");
    expect(r).toContain("4 successes");            // 1 die + 3 bonus dice, all hits
  });

  test("maxPerUse clamps stacked applications", async () => {
    const r = await CommandRouter.route("roll strength spend=mana:capped spend-amount=5", { rng: seqRng([6, 6, 6]) });
    expect(r).toContain("capped at 2 per use");
    expect(r).toContain("spent 2 mana (capped)");
    expect(r).toContain("3 successes");            // 1 die + 2 bonus dice
  });

  test('heal "all" with fillToCap mends everything in one application', async () => {
    await CommandRouter.route("damage lethal 2");
    await CommandRouter.route("damage aggravated 1");
    const r = await CommandRouter.route("spend mana:mend");
    expect(r).toContain("healing 3 boxes");
    expect(r).toContain("0B/0L/0A");
    expect(r).toContain("mana now 9/20");
  });

  test("fillToCap increase honors a pool-expression cap", async () => {
    // cap = stamina+2 = 3; Brawl dots 0 -> boost fills to +3.
    const r = await CommandRouter.route("spend mana:empower");
    expect(r).toContain("Brawl +3");
    const roll = await CommandRouter.route("roll brawl", { rng: seqRng([6, 6, 6]) });
    expect(roll).toContain("3 successes");
  });

  test("an unknown op is preserved, noted, and counted in the ledger", async () => {
    const r1 = await CommandRouter.route("spend mana:ward");
    expect(r1).toContain("suspend majesty: recorded - Storyteller adjudicates");
    expect(r1).toContain("use 1/2 per scene");
    await CommandRouter.route("spend mana:ward");
    const r3 = await CommandRouter.route("spend mana:ward");
    expect(r3).toContain("use 3/2 per scene - OVER LIMIT");
    expect(await CommandRouter.route("resources")).toContain("ward (used 3)");
    expect(await CommandRouter.route("reset-uses")).toContain("counters reset");
    expect(await CommandRouter.route("resources")).not.toContain("(used");
  });

  test("an action-tag roll op applies only when the roll carries the tag", async () => {
    const miss = await CommandRouter.route("roll strength spend=mana:precise", { rng: seqRng([6]) });
    expect(miss).toContain('difficulty needs tag "melee" - skipped');
    expect(miss).toContain("vs diff 6");
    const hit = await CommandRouter.route("roll strength tags=melee spend=mana:precise", { rng: seqRng([6]) });
    expect(hit).toContain("vs diff 5");
  });

  test("a resource can replace another outright", async () => {
    await ResourceOverrides.save({
      focus: {
        kind: "tracker", start: 4, max: 10, replaces: ["willpower"],
        effect: { label: "Focus: +1 automatic success", apply: [{ op: "successes", amount: 1 }] },
      },
    });
    const odo = (await CharacterStore.getCurrent())!;
    expect(CharacterResources.defsFor(odo).map(d => d.name)).not.toContain("willpower"); // hidden
    expect(CharacterResources.resolveDef(odo, "willpower")!.name).toBe("focus");         // redirected
    const list = await CommandRouter.route("resources");
    expect(list).toContain("replaces: willpower");
    const r = await CommandRouter.route("roll strength spend=willpower", { rng: seqRng([2]) });
    expect(r).toContain("spent 1 focus");
    expect(r).toContain("1 success"); // the auto-success came from Focus
  });
});

// =============================================================================
// SUCCESS TABLES & CONTESTS
// =============================================================================
describe("success tables (readSuccessTable / describeTable)", () => {
  const degrees: SuccessTable = {
    name: "degrees", failure: "Failure", botch: "Botch",
    rows: [
      { at: 1, label: "Marginal" }, { at: 2, label: "Moderate" }, { at: 3, label: "Complete" },
      { at: 4, label: "Exceptional" }, { at: 5, label: "Phenomenal" },
    ],
  };
  const damage: SuccessTable = { name: "damage", valuePerSuccess: 1, failure: "No damage", botch: "Hit an ally" };
  const capped: SuccessTable = { name: "capped", cap: 5, rows: [{ at: 1, label: "one" }, { at: 5, label: "five" }] };
  const overflowing: SuccessTable = { name: "of", rows: [{ at: 1, label: "one" }, { at: 5, label: "five" }], overflow: { per: 2, value: 1, label: "bonus" } };
  const highBar: SuccessTable = { name: "hb", failure: "not enough", rows: [{ at: 3, label: "ok" }] };

  test("a ladder returns the highest row at or below the count", () => {
    expect(readSuccessTable(degrees, "success", 3).label).toBe("Complete");
    const top = readSuccessTable(degrees, "success", 6);   // no cap: extras are not wasted
    expect(top.label).toBe("Phenomenal");
    expect(top.wasted).toBe(0);
  });

  test("failure and botch read their own lines", () => {
    expect(readSuccessTable(degrees, "failure", 0).label).toBe("Failure");
    expect(readSuccessTable(degrees, "success", 0).label).toBe("Failure"); // zero successes = failure
    expect(readSuccessTable(damage, "botch", 0).label).toBe("Hit an ally");
    expect(readSuccessTable(highBar, "success", 2).label).toBe("not enough"); // below the lowest row
  });

  test("valuePerSuccess is the direct numeric function (damage/soak)", () => {
    const r = readSuccessTable(damage, "success", 4);
    expect(r.value).toBe(4);
    expect(describeTableReading(r)).toBe("4 successes = 4");
  });

  test("cap wastes extra successes", () => {
    const r = readSuccessTable(capped, "success", 7);
    expect(r.successes).toBe(5);
    expect(r.wasted).toBe(2);
    expect(r.label).toBe("five");
  });

  test("overflow adds a rule-specified bonus per batch beyond the last row", () => {
    const r = readSuccessTable(overflowing, "success", 9); // (9-5)/2 = 2 batches
    expect(r.value).toBe(2);
    expect(r.extra).toContain("bonus");
  });

  test("describeTable lays out the ladder and dimensions", () => {
    expect(describeTable(degrees)).toContain("1:Marginal");
    expect(describeTable(degrees)).toContain("5:Phenomenal");
    expect(describeTable(damage)).toContain("1/success");
  });

  test("the built-in tables are always registered", () => {
    expect(SuccessTableRegistry.get("damage")!.valuePerSuccess).toBe(1);
    expect(SuccessTableRegistry.get("degrees")!.rows!.length).toBe(5);
    expect(SuccessTableRegistry.get("soak")).toBeDefined();
  });
});

describe("resisted & contested rolls (compareRolls)", () => {
  const exec = (pool: string, faces: number[]): RollExecution =>
    executeRoll(makeRollSpec({ pool }), () => 0, { rng: seqRng(faces) });
  const three = exec("5", [6, 6, 6, 2, 2]);
  const two = exec("4", [6, 6, 2, 2]);
  const one = exec("3", [6, 2, 2]);
  const botchA = exec("2", [1, 2]);
  const botchB = exec("2", [1, 2]);

  test("resisted: only the actor's margin over the resister counts", () => {
    const o = compareRolls("resisted", three, one);
    expect(o.winner).toBe("a");
    expect(o.margin).toBe(2);
    expect(o.note).toContain("prevails by 2");
  });

  test("resisted: a tie (or the resister winning) means the action fails", () => {
    expect(compareRolls("resisted", two, two).winner).toBe("none");
    expect(compareRolls("resisted", two, two).note).toContain("resisted");
    expect(compareRolls("resisted", one, three).winner).toBe("none");
  });

  test("resisted: an actor botch fails and is flagged", () => {
    const o = compareRolls("resisted", botchA, one);
    expect(o.winner).toBe("none");
    expect(o.aBotch).toBe(true);
    expect(o.aNet).toBe(0);
    expect(o.note).toContain("botches");
  });

  test("contested: higher total wins, symmetric", () => {
    expect(compareRolls("contested", three, one).note).toContain("wins by 2");
    expect(compareRolls("contested", one, three).winner).toBe("b");
    expect(compareRolls("contested", one, three).note).toContain("loses by 2");
    expect(compareRolls("contested", two, two).note).toBe("tie");
  });

  test("both sides botching is a mutual disaster", () => {
    expect(compareRolls("contested", botchA, botchB).note).toContain("mutual disaster");
  });
});

describe("extended contests (applyContestRound)", () => {
  const exec = (pool: string, faces: number[]): RollExecution =>
    executeRoll(makeRollSpec({ pool }), () => 0, { rng: seqRng(faces) });
  const three = exec("3", [6, 6, 6]);
  const one = exec("3", [6, 2, 2]);
  const botch = exec("2", [1, 2]);
  const base: ExtendedContest = {
    id: "c", label: "",
    a: { name: "Anja", base: makeRollSpec({ pool: "3" }), accumulated: 0 },
    b: { name: "Bram", base: makeRollSpec({ pool: "3" }), accumulated: 0 },
    target: 5, maxRounds: 3, interval: "", onBotch: "fail", rounds: 0, status: "open", log: [],
  };

  test("both accumulate; the first to the goal wins", () => {
    let c = applyContestRound(base, three, one).contest;   // Anja 3, Bram 1
    expect(c.a.accumulated).toBe(3);
    expect(c.b.accumulated).toBe(1);
    expect(c.status).toBe("open");
    c = applyContestRound(c, three, one).contest;          // Anja 6 >= 5 -> wins
    expect(c.status).toBe("a");
  });

  test("a dead heat in the same round stays open (nobody got there first)", () => {
    const t3: ExtendedContest = { ...base, target: 3, maxRounds: 5, a: { ...base.a }, b: { ...base.b } };
    const r = applyContestRound(t3, three, three);         // both hit 3 -> equal -> open
    expect(r.contest.status).toBe("open");
  });

  test("under the fail policy, a botch loses the round outright", () => {
    expect(applyContestRound(base, botch, one).contest.status).toBe("b");
    expect(applyContestRound(base, botch, one).note).toContain("botches");
    expect(applyContestRound(base, botch, botch).contest.status).toBe("draw"); // both botch
  });

  test("running out of rounds is a draw", () => {
    let c: ExtendedContest = { ...base, target: 100, maxRounds: 2, a: { ...base.a }, b: { ...base.b } };
    c = applyContestRound(c, three, one).contest;
    c = applyContestRound(c, three, one).contest;
    expect(c.status).toBe("draw");
  });
});

describe("table= reading on rolls", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); resetAllConfigStores(); await LorebookManager.bootstrap(); });

  test("a roll hands its successes to a named table", async () => {
    await CommandRouter.route('create-playable name="Rok" templates=mortal');
    const r = await CommandRouter.route("roll 4 table=degrees", { rng: seqRng([6, 6, 6, 2]) }); // 3 successes
    expect(r).toContain("degrees:");
    expect(r).toContain("Complete");
  });

  test("the damage table turns successes straight into levels", async () => {
    await CommandRouter.route('create-playable name="Rok" templates=mortal');
    const r = await CommandRouter.route("roll 3 table=damage", { rng: seqRng([6, 6, 2]) }); // 2 successes
    expect(r).toContain("damage:");
    expect(r).toContain("= 2");
  });

  test("failure reads the table's failure line; an unknown table is reported", async () => {
    await CommandRouter.route('create-playable name="Rok" templates=mortal');
    const miss = await CommandRouter.route("roll 3 table=damage", { rng: seqRng([2, 2, 2]) }); // 0 successes
    expect(miss).toContain("No damage");
    const unknown = await CommandRouter.route("roll 3 table=nope", { rng: seqRng([6, 2, 2]) });
    expect(unknown).toContain('unknown table "nope"');
  });
});

describe("resisted & contested rolls (commands)", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); resetAllConfigStores(); await LorebookManager.bootstrap(); });

  test("resist: the actor's margin over a named resister decides it", async () => {
    await CommandRouter.route('create-playable name="Rok" templates=mortal');
    await CommandRouter.route('create-playable name="Erik" templates=mortal');
    await CommandRouter.route('play name="Rok"');
    // Rok rolls 4 dice, then Erik rolls 3 - they share the sequence in order.
    const r = await CommandRouter.route('resist 4 3 vs="Erik"', { rng: seqRng([6, 6, 6, 2, 6, 2, 2]) });
    expect(r).toContain("resisted");
    expect(r).toContain("Rok:");
    expect(r).toContain("Erik:");
    expect(r).toContain("prevails by 2");
  });

  test("resist: a tie means the action is resisted (oWoD classic), ad-hoc opposition", async () => {
    await CommandRouter.route('create-playable name="Rok" templates=mortal');
    const r = await CommandRouter.route("resist 4 3", { rng: seqRng([6, 6, 2, 2, 6, 6, 2]) }); // 2 vs 2
    expect(r).toContain("the action is resisted");
    expect(r).toContain("The Resistance"); // default ad-hoc label
  });

  test("contest: higher total wins; the note is from the actor's view", async () => {
    await CommandRouter.route('create-playable name="Rok" templates=mortal');
    const win = await CommandRouter.route("contest 4 3", { rng: seqRng([6, 6, 6, 2, 6, 2, 2]) }); // 3 vs 1
    expect(win).toContain("contested");
    expect(win).toContain("wins by 2");
    const lose = await CommandRouter.route("contest 3 4", { rng: seqRng([6, 2, 2, 6, 6, 6, 2]) }); // 1 vs 3
    expect(lose).toContain("loses by 2");
  });

  test("contest: a table reads the winning margin", async () => {
    await CommandRouter.route('create-playable name="Rok" templates=mortal');
    const r = await CommandRouter.route("contest 5 3 table=damage", { rng: seqRng([6, 6, 6, 6, 2, 6, 2, 2]) }); // 4 vs 1 -> margin 3
    expect(r).toContain("damage:");
    expect(r).toContain("= 3");
  });
});

describe("extended contests (commands)", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); await LorebookManager.bootstrap(); });

  test("open, continue, and race to the target against a named rival", async () => {
    await CommandRouter.route('create-playable name="Rok" templates=mortal');
    await CommandRouter.route('create-playable name="Erik" templates=mortal');
    await CommandRouter.route('play name="Rok"');
    const open = await CommandRouter.route('extended-contest 3 3 vs="Erik" target=5 rounds=4 label="Arm-wrestle"', { rng: seqRng([6, 6, 6, 6, 2, 2]) });
    expect(open).toContain("Rok opens");
    expect(open).toContain("arm-wrestle");
    expect(open).toContain("Rok 3/5");
    const cont = await CommandRouter.route("continue-contest", { rng: seqRng([6, 6, 6, 2, 2, 2]) }); // Rok 6/5 wins
    expect(cont).toContain("Rok WINS");
  });

  test("contest-status, then cancel-contest", async () => {
    await CommandRouter.route('create-playable name="Rok" templates=mortal');
    await CommandRouter.route('extended-contest 3 2 target=20 rounds=5 label=`Long haul`', { rng: seqRng([6, 6, 6, 6, 2]) });
    const status = await CommandRouter.route("contest-status");
    expect(status).toContain("Long haul");
    expect(status).toContain("recent:");
    expect(await CommandRouter.route("cancel-contest")).toContain("Cancelled contest");
    expect(await CommandRouter.route("contest-status")).toContain("No extended contest");
  });
});

describe("success tables: lorebook overlay & [[tables]]", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); resetAllConfigStores(); await LorebookManager.bootstrap(); });

  test("[[tables]] lists the built-ins; [[tables name]] lays one out", async () => {
    const list = await CommandRouter.route("tables");
    expect(list).toContain("degrees");
    expect(list).toContain("damage");
    expect(list).toContain("soak");
    const one = await CommandRouter.route("tables degrees");
    expect(one).toContain("Marginal");
    expect(one).toContain("Phenomenal");
  });

  test("a lorebook entry overlays new tables (array form), usable via table=", async () => {
    const tables = [{ name: "intimidate", rows: [{ at: 1, label: "Cowed" }, { at: 3, label: "Terrified" }] }];
    const text = `Success tables (JSON below the marker).\n=====\n${JSON.stringify(tables)}`;
    const { id } = await LorebookManager.ensureCategory(CONFIG_CATEGORY);
    await LorebookManager.ensureEntry(id, SUCCESS_TABLES_ENTRY, text);
    expect(await SuccessTables.loadFromLorebook()).toBe(1);
    expect(SuccessTableRegistry.get("intimidate")!.rows!.length).toBe(2);

    await CommandRouter.route('create-playable name="Rok" templates=mortal');
    const r = await CommandRouter.route("roll 5 table=intimidate", { rng: seqRng([6, 6, 6, 2, 2]) }); // 3 successes
    expect(r).toContain("intimidate:");
    expect(r).toContain("Terrified");
  });

  test("the map form (name -> table) also registers, defaults are re-seeded", async () => {
    const map = { luck: { valuePerSuccess: 2, failure: "no luck" } };
    const text = `notes\n=====\n${JSON.stringify(map)}`;
    const { id } = await LorebookManager.ensureCategory(CONFIG_CATEGORY);
    await LorebookManager.ensureEntry(id, SUCCESS_TABLES_ENTRY, text);
    await SuccessTables.loadFromLorebook();
    expect(readSuccessTable(SuccessTableRegistry.get("luck")!, "success", 3).value).toBe(6);
    expect(SuccessTableRegistry.get("damage")).toBeDefined(); // built-ins survive the overlay
  });
});

// =============================================================================
// CONSTRAINT GROUPS + the first api.v1.ui window
// =============================================================================
describe("constraint groups (checkConstraints, pure)", () => {
  const owned = (o: Partial<OwnedTraits>): OwnedTraits => ({ backgrounds: [], merits: [], flaws: [], templates: [], ...o });

  test("exclusive: holding more than max members is a violation", () => {
    const g = makeConstraintGroup({ name: "s", relation: "exclusive", domain: "background", members: ["status", "anonymity"], max: 1 });
    expect(checkConstraints([g], owned({ backgrounds: ["status", "anonymity"] })).length).toBe(1);
    expect(checkConstraints([g], owned({ backgrounds: ["status"] })).length).toBe(0);
  });

  test("forbidden: holding a member while in scope is a violation (out of scope is fine)", () => {
    const g = makeConstraintGroup({ name: "f", relation: "forbidden", domain: "flaw", members: ["dark-secret"], scope: ["vampire"] });
    expect(checkConstraints([g], owned({ flaws: ["dark-secret"], templates: ["vampire"] })).length).toBe(1);
    expect(checkConstraints([g], owned({ flaws: ["dark-secret"], templates: ["mortal"] })).length).toBe(0);
  });

  test("restricted: holding a member OUTSIDE its reserved scope is a violation", () => {
    const g = makeConstraintGroup({ name: "r", relation: "restricted", domain: "merit", members: ["true-faith"], scope: ["mortal"] });
    expect(checkConstraints([g], owned({ merits: ["true-faith"], templates: ["vampire"] })).length).toBe(1);
    expect(checkConstraints([g], owned({ merits: ["true-faith"], templates: ["mortal"] })).length).toBe(0);
  });

  test("domain 'any' checks every bucket; no membership = no violation", () => {
    const g = makeConstraintGroup({ name: "a", relation: "forbidden", domain: "any", members: ["haunted"] });
    expect(checkConstraints([g], owned({ flaws: ["haunted"] })).length).toBe(1);
    expect(checkConstraints([g], owned({ backgrounds: ["haunted"] })).length).toBe(1);
    expect(checkConstraints([g], owned({ merits: ["iron-will"] })).length).toBe(0);
  });

  test("makeConstraintGroup normalizes names/members and defaults relation/domain/max", () => {
    const g = makeConstraintGroup({ name: "  My Group ", members: ["Status", " Anonymity ", ""] });
    expect(g.name).toBe("my-group");
    expect(g.members).toEqual(["status", "anonymity"]);
    expect(g.relation).toBe("exclusive");
    expect(g.domain).toBe("any");
    expect(g.max).toBe(1);
  });

  test("an unknown relation/domain falls back rather than being lost", () => {
    const g = makeConstraintGroup({ name: "x", relation: "bogus" as unknown as ConstraintRelation, domain: "weird" as unknown as ConstraintDomain, members: ["a"] });
    expect(g.relation).toBe("exclusive");
    expect(g.domain).toBe("any");
    expect(describeConstraint(g)).toContain("exclusive");
  });
});

describe("constraint commands", () => {
  beforeEach(async () => {
    __resetStorageMock(); __resetLorebookMock(); resetAllConfigStores(); MeritFlawRegistry.reset();
    await LorebookManager.bootstrap();
  });

  test("define-constraint persists and round-trips through the lorebook", async () => {
    const r = await CommandRouter.route('define-constraint name="statuses" relation=exclusive domain=background members="status, anonymity" max=1 note=`pick one`');
    expect(r).toContain("Defined constraint");
    expect(ConstraintRegistry.get("statuses")!.members).toEqual(["status", "anonymity"]);
    // The registry rebuilds itself purely from the lorebook entry.
    ConstraintRegistry.reset();
    expect(ConstraintRegistry.all().length).toBe(0);
    expect(await ConstraintRegistry.loadFromLorebook()).toBe(1);
    const g = ConstraintRegistry.get("statuses")!;
    expect(g.relation).toBe("exclusive");
    expect(g.note).toBe("pick one");
  });

  test("defining the same name replaces it; list, show, forget", async () => {
    await CommandRouter.route('define-constraint name="foo" domain=merit members="iron-will"');
    await CommandRouter.route('define-constraint name="foo" relation=forbidden domain=flaw members="haunted, hunted"');
    expect(ConstraintRegistry.all().length).toBe(1);                 // replaced, not duplicated
    expect(ConstraintRegistry.get("foo")!.relation).toBe("forbidden");
    expect(await CommandRouter.route("constraints")).toContain("foo");
    expect(await CommandRouter.route("constraint foo")).toContain("Haunted"); // toTitleCase display
    expect(await CommandRouter.route("forget-constraint foo")).toContain("Forgot");
    expect(ConstraintRegistry.get("foo")).toBeUndefined();
    expect(await CommandRouter.route("constraints")).toContain("No constraint groups");
  });

  test("check-constraints flags the current character's conflicts", async () => {
    await CommandRouter.route('define-constraint name="statuses" relation=exclusive domain=background members="status, anonymity" max=1');
    await CommandRouter.route('define-constraint name="no-secrets" relation=forbidden domain=flaw members="dark-secret" scope="vampire"');
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    const c = (await CharacterStore.getCurrent())!;
    c.backgrounds = { status: 2, anonymity: 1 };   // 2 of an exclusive group
    c.meritsFlaws = { "dark-secret": 1 };           // a forbidden flaw for vampires
    await CharacterStore.save(c);
    const report = await CommandRouter.route("check-constraints");
    expect(report).toContain("2 constraint issues");
    expect(report).toContain("statuses");
    expect(report).toContain("forbidden");
  });

  test("check-constraints is clean when nothing conflicts", async () => {
    await CommandRouter.route('define-constraint name="statuses" relation=exclusive domain=background members="status, anonymity" max=1');
    await CommandRouter.route('create-playable name="Ok" templates=mortal');
    expect(await CommandRouter.route("check-constraints")).toContain("satisfies all");
  });
});

describe("constraint window ([[win-constraint]] emits define-constraint)", () => {
  beforeEach(async () => {
    __resetStorageMock(); __resetLorebookMock(); __resetUiMock(); resetAllConfigStores();
    await LorebookManager.bootstrap();
  });

  test("the window opens; filling it and clicking Create routes define-constraint", async () => {
    const opened = await CommandRouter.route("win-constraint");
    expect(opened).toContain("Opened the constraint-group window");
    expect(__uiWindows().length).toBe(1);
    expect(__uiWindows()[0].options.title).toContain("constraint");

    // The real host binds storageKey <-> tempStorage; off-host we set the temp
    // fields directly, then fire the Create button the window rendered.
    await api.v1.tempStorage.set("win:define-constraint:name", "vip-backgrounds");
    await api.v1.tempStorage.set("win:define-constraint:relation", "exclusive");
    await api.v1.tempStorage.set("win:define-constraint:domain", "background");
    await api.v1.tempStorage.set("win:define-constraint:members", "status, anonymity");
    await api.v1.tempStorage.set("win:define-constraint:max", "1");

    expect(await __uiClickButton("Create")).toBe(true);
    // The emitted command ran through the same CommandRouter -> the group exists.
    expect(ConstraintRegistry.get("vip-backgrounds")!.members).toEqual(["status", "anonymity"]);
    expect(await CommandRouter.route("constraints")).toContain("vip-backgrounds");
  });

  test("Create with no name reports back in-window without defining anything", async () => {
    await CommandRouter.route("win-constraint");
    expect(await __uiClickButton("Create")).toBe(true);
    expect(ConstraintRegistry.all().length).toBe(0);
  });

  test("openConstraintWindow can be called directly and seeds selector defaults", async () => {
    await openConstraintWindow();
    expect(await api.v1.tempStorage.get("win:define-constraint:relation")).toBe("exclusive");
    expect(await api.v1.tempStorage.get("win:define-constraint:domain")).toBe("background");
  });

  test("the form is DERIVED from the spec: selector rows render the rules vocabularies", async () => {
    await CommandRouter.route("win-constraint");
    const texts: string[] = [];
    const walk = (parts: Array<Record<string, unknown>>): void => {
      for (const p of parts ?? []) {
        if (p["type"] === "button" && typeof p["text"] === "string") texts.push(p["text"] as string);
        if (Array.isArray(p["content"])) walk(p["content"] as Array<Record<string, unknown>>);
      }
    };
    walk(__uiWindows()[0].options.content as unknown as Array<Record<string, unknown>>);
    for (const r of CONSTRAINT_RELATIONS) expect(texts.some(t => t === r || t === `• ${r}`)).toBe(true);
    for (const d of CONSTRAINT_DOMAINS) expect(texts.some(t => t === d || t === `• ${d}`)).toBe(true);
  });
});

// =============================================================================
// LOW-HANGING FRUIT: discoverability, expression difficulty, named-roll spend
// =============================================================================
describe("discoverability commands (help / characters / set-default)", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); await LorebookManager.bootstrap(); });

  test("[[help]] lists commands; [[help roll]] shows one; unknown verb is reported", async () => {
    const all = await CommandRouter.route("help");
    expect(all).toContain("commands:");
    expect(all).toContain("roll");
    expect(all).toContain("help");
    expect(await CommandRouter.route("help roll")).toContain("roll -");
    expect(await CommandRouter.route("help nope")).toContain('No command "nope"');
  });

  test("[[characters]] marks current/default; [[set-default]] changes it and [[play]] returns to it", async () => {
    await CommandRouter.route('create-playable name="Rok" templates=mortal');   // default + current
    await CommandRouter.route('create-playable name="Sela" templates=mortal');
    const list = await CommandRouter.route("characters");
    expect(list).toContain("Rok");
    expect(list).toContain("Sela");
    expect(list).toContain("current");
    expect(list).toContain("default");

    expect(await CommandRouter.route('set-default name="Sela"')).toContain("Sela is now the default");
    expect(await CharacterStore.getDefaultName()).toBe("sela");
    await CommandRouter.route("play");   // no name -> the (new) default
    expect((await CharacterStore.getCurrent())!.name).toBe("sela");
    expect(await CommandRouter.route("set-default name=Ghost")).toContain('No character named');
  });
});

describe("expression difficulty & named-roll spend (commands)", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); await LorebookManager.bootstrap(); });

  test("[[roll]] difficulty can be a trait calculation", async () => {
    await CommandRouter.route('create-playable name="Rok" templates=mortal'); // stamina = 1
    // difficulty=stamina+5 -> 1+5 = 6; pool "4" -> 4 dice.
    const r = await CommandRouter.route("roll 4 difficulty=stamina+5", { rng: seqRng([6, 6, 2, 2]) });
    expect(r).toContain("vs diff 6");
    expect(r).toContain("2 successes");
  });

  test("a named roll carries its spend and auto-pays on [[roll @name]]", async () => {
    await CommandRouter.route('create-playable name="Rok" templates=mortal');
    await CommandRouter.route("gain willpower 2");   // give Rok willpower to spend
    const saved = await CommandRouter.route("name-roll brace 2 spend=willpower");
    expect(saved).toContain("spend=willpower");
    expect(await CommandRouter.route("list-rolls")).toContain("spend=willpower");
    // 2 dice both fail (2,2), but the saved willpower spend grants +1 automatic
    // success -> proves the spend auto-applied without an explicit spend=.
    const r = await CommandRouter.route("roll @brace", { rng: seqRng([2, 2]) });
    expect(r).toContain("1 success");
  });
});

// =============================================================================
// BOUNDARY NORMALIZATION + CHARACTER ALIASES
// =============================================================================
describe("StringUtil.normalizeInput (the boundary normalizer)", () => {
  test("case and whitespace collapse to one internal form", () => {
    expect(StringUtil.normalizeInput("Alice and Bob")).toBe("alice-and-bob");
    expect(StringUtil.normalizeInput("ALIcE and BoB")).toBe("alice-and-bob");
    expect(StringUtil.normalizeInput("  Animal     Ken")).toBe("animal-ken");
  });

  test("spaces after @ are removed; :: is the space-tolerant path separator", () => {
    expect(StringUtil.normalizeInput("@ sire")).toBe("@sire");
    expect(StringUtil.normalizeInput("blood :: heal")).toBe("blood:heal");
    expect(StringUtil.normalizeInput("@char :: Erik :: sire")).toBe("@char:erik:sire");
    expect(StringUtil.normalizeInput("a:b")).toBe("a:b");           // single : untouched
    expect(StringUtil.normalizeInput("a : b")).toBe("a-:-b");       // spaced single : is not a path
  });

  test("list/pool separators tolerate spaces", () => {
    expect(StringUtil.normalizeInput("status, anonymity")).toBe("status,anonymity");
    expect(StringUtil.normalizeInput("strength + brawl")).toBe("strength+brawl");
  });

  test("idempotent: normalizing a normalized string is a no-op", () => {
    for (const s of ["alice-and-bob", "@char:erik:sire", "blood:heal", "status,anonymity"]) {
      expect(StringUtil.normalizeInput(s)).toBe(s);
    }
  });
});

describe("CommandParser: boundary normalization + backtick literals", () => {
  test("tokens and values normalize; backtick literals stay verbatim", () => {
    const c = CommandParser.parse('alias "@ KAT" name="Kat A  Rina" note=`Keep My   Case` `Verbatim Positional`');
    expect(c.positional[0]).toBe("@kat");
    expect(c.named.name).toBe("kat-a-rina");
    expect(c.named.note).toBe("Keep My   Case");
    expect(c.positional[1]).toBe("Verbatim Positional");
  });

  test(":: and @-space glue at the BODY level, so bare spaced paths are one token", () => {
    const c = CommandParser.parse("spend blood :: heal");
    expect(c.positional).toEqual(["blood:heal"]);          // glued before tokenizing
    const a = CommandParser.parse('alias @char :: default :: sire "Katarina"');
    expect(a.positional[0]).toBe("@char:default:sire");
    const d = CommandParser.parse('roll 3 spend="blood :: heal"');
    expect(d.named.spend).toBe("blood:heal");              // also inside quoted values
  });
});

describe("aliases: parseAliasToken + AliasRegistry", () => {
  beforeEach(() => { __resetStorageMock(); });

  test("parseAliasToken understands every form", () => {
    expect(parseAliasToken("@kat")).toEqual({ alias: "kat" });
    expect(parseAliasToken("@global:backup")).toEqual({ scope: "global", alias: "backup" });
    expect(parseAliasToken("@player:storyteller:kat")).toEqual({ scope: "player", owner: "storyteller", alias: "kat" });
    expect(parseAliasToken("@char:erik:sire")).toEqual({ scope: "character", owner: "erik", alias: "sire" });
    expect(parseAliasToken("@character:erik:sire")).toEqual({ scope: "character", owner: "erik", alias: "sire" });
    expect(parseAliasToken("@global")).toBeUndefined();       // malformed
    expect(parseAliasToken("@player:kat")).toBeUndefined();   // missing owner or alias
  });

  test("resolve walks character -> player -> global (most specific wins)", async () => {
    await AliasRegistry.set("global", undefined, "boss", "katarina");
    await AliasRegistry.set("player", "bob", "boss", "sela");
    await AliasRegistry.set("character", "erik", "boss", "rok");
    expect(await AliasRegistry.resolve("boss", { charKey: "erik", playerKey: "bob" })).toBe("rok");
    expect(await AliasRegistry.resolve("boss", { playerKey: "bob" })).toBe("sela");
    expect(await AliasRegistry.resolve("boss", {})).toBe("katarina");
    expect(await AliasRegistry.resolve("nobody", {})).toBeUndefined();
  });

  test("set overwrites; remove deletes only its scope", async () => {
    await AliasRegistry.set("global", undefined, "kat", "katarina");
    await AliasRegistry.set("global", undefined, "kat", "sela");     // overwrite
    expect(await AliasRegistry.lookup("global", undefined, "kat")).toBe("sela");
    expect(await AliasRegistry.remove("player", "bob", "kat")).toBe(false); // other scope untouched
    expect(await AliasRegistry.remove("global", undefined, "kat")).toBe(true);
    expect(await AliasRegistry.lookup("global", undefined, "kat")).toBeUndefined();
  });
});

describe("alias & player commands (e2e)", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); await LorebookManager.bootstrap(); });

  test("define in three scopes, then [[play @alias]] resolves most-specific-first", async () => {
    await CommandRouter.route('create-playable name="Katarina" templates=vampire');
    await CommandRouter.route('create-playable name="Sela" templates=mortal');
    await CommandRouter.route('create-playable name="Rok" templates=mortal');
    await CommandRouter.route('play name="Rok"');

    expect(await CommandRouter.route('alias @boss "Katarina"')).toContain("@boss now means Katarina globally");
    await CommandRouter.route('alias @player::storyteller::boss "Sela"');
    const r = await CommandRouter.route("play @boss");   // player scope beats global
    expect(r).toContain('Now playing "Sela"');

    await CommandRouter.route('alias @char::rok::boss "Rok"');
    await CommandRouter.route('play name="Rok"');
    expect(await CommandRouter.route("play @boss")).toContain('Now playing "Rok"'); // char scope beats both
  });

  test("[[player]] switches whose per-player aliases apply", async () => {
    await CommandRouter.route('create-playable name="Katarina" templates=vampire');
    await CommandRouter.route('create-playable name="Sela" templates=mortal');
    await CommandRouter.route('alias @player::bob::pal "Sela"');
    await CommandRouter.route('alias @player::storyteller::pal "Katarina"');
    expect(await CommandRouter.route("play @pal")).toContain("Katarina"); // storyteller is current by default
    expect(await CommandRouter.route('player name="Bob"')).toContain("Current player is now Bob");
    expect(await CommandRouter.route("play @pal")).toContain("Sela");
    expect(await CommandRouter.route("player")).toContain("Current player: Bob");
  });

  test("roll-for and vs= accept aliases; unknown alias reports helpfully", async () => {
    await CommandRouter.route('create-playable name="Rok" templates=mortal');
    await CommandRouter.route('create-playable name="Erik" templates=mortal');
    await CommandRouter.route('play name="Rok"');
    await CommandRouter.route('alias @rival "Erik"');
    const rf = await CommandRouter.route("roll-for @rival dexterity", { rng: seqRng([6]) });
    expect(rf).toContain("Erik");
    const rs = await CommandRouter.route('resist 4 3 vs="@rival"', { rng: seqRng([6, 6, 6, 2, 6, 2, 2]) });
    expect(rs).toContain("Erik:");
    expect(await CommandRouter.route("play @nobody")).toContain('Unknown alias "@nobody"');
  });

  test("aliases list + forget-alias + storyStorage persistence; @ names refused", async () => {
    await CommandRouter.route('create-playable name="Katarina" templates=vampire');
    await CommandRouter.route('alias @kat "Katarina"');
    await CommandRouter.route('alias @char::erik::sire "Katarina"');  // NPC-ish owner: no record needed
    const list = await CommandRouter.route("aliases");
    expect(list).toContain("global: @kat->Katarina");
    expect(list).toContain("character Erik: @sire->Katarina");
    // The map lives in storyStorage - a fresh AliasRegistry read still sees it.
    expect(await AliasRegistry.lookup("character", "erik", "sire")).toBe("katarina");
    expect(await CommandRouter.route("forget-alias @kat")).toContain("Forgot @kat");
    expect(await CommandRouter.route("aliases")).not.toContain("@kat");
    expect(await CommandRouter.route('create-playable name="@bad" templates=mortal')).toContain('cannot start with "@"');
  });

  test("normalization end-to-end: mixed-case creation, :: spend paths, backtick labels", async () => {
    await CommandRouter.route('create-playable name="ERIK   the  Red" templates=vampire');
    expect((await CharacterStore.load("erik-the-red"))!.name).toBe("erik-the-red");
    expect(await CommandRouter.route('play name="erik the red"')).toContain('Now playing "Erik The Red"');
    const spent = await CommandRouter.route("roll strength spend=blood", { rng: seqRng([6]) });
    expect(spent).toContain("Erik The Red");   // reply shows Title Case
    const q = await CommandRouter.route('roll 3 spend="blood :: heal"');
    expect(q).toContain("use [[spend");        // "blood :: heal" -> blood:heal (a standalone heal refuses in-roll)
  });
});

// =============================================================================
// CONDITIONS - parameterized states (bindings, chains, mirrors, live tags)
// =============================================================================
describe("conditions: defs + duration grammar (pure)", () => {
  test("parseConditionDuration reads the mini-grammar", () => {
    expect(parseConditionDuration("1 turn")).toEqual({ kind: "st", n: 1, unit: "turn" });
    expect(parseConditionDuration("2 scenes")).toEqual({ kind: "st", n: 2, unit: "scene" });
    expect(parseConditionDuration("until eye-contact-breaks")).toEqual({ kind: "until", until: "eye-contact-breaks" });
    expect(parseConditionDuration("instant")).toEqual({ kind: "instant" });
    expect(parseConditionDuration("whenever")).toBeUndefined();
    expect(describeDuration({ kind: "st", n: 1, unit: "turn" })).toBe("1 turn");
  });

  test("makeConditionDef normalizes; describeConditionDef lays it out", () => {
    const d = makeConditionDef({ name: " Feral  Whispers ", bindings: ["Target"], then: "Next Thing", tags: ["Off Hand"] });
    expect(d.name).toBe("feral-whispers");
    expect(d.bindings).toEqual(["target"]);
    expect(d.then).toBe("next-thing");
    expect(d.tags).toEqual(["off-hand"]);
    expect(describeConditionDef(d)).toContain("needs target");
  });

  test("the Feral Speech pair ships as defaults", () => {
    expect(ConditionRegistry.get("concentrating-on")!.then).toBe("feral-whispers");
    expect(ConditionRegistry.get("feral-whispers")!.mirror).toBe("feral-whispers");
  });
});

describe("conditions: registry overlay + define/forget commands", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); resetAllConfigStores(); await LorebookManager.bootstrap(); });

  test("define-condition writes the overlay and round-trips the lorebook", async () => {
    const r = await CommandRouter.route('define-condition name="dazed" tags="off-hand" duration="1 scene" description=`Head ringing`');
    expect(r).toContain("Defined condition dazed");
    ConditionRegistry.reset();
    expect(ConditionRegistry.get("dazed")).toBeUndefined();
    expect(await ConditionRegistry.loadFromLorebook()).toBe(1);
    expect(ConditionRegistry.get("dazed")!.tags).toEqual(["off-hand"]);
    expect(ConditionRegistry.get("dazed")!.description).toBe("Head ringing");
  });

  test("an overlay def can shadow a built-in; forgetting resurfaces it", async () => {
    await CommandRouter.route('define-condition name="feral-whispers" duration="2 scenes"');
    expect(describeDuration(ConditionRegistry.get("feral-whispers")!.duration)).toBe("2 scenes");
    expect(await CommandRouter.route("forget-condition feral-whispers")).toContain("resurfaces");
    expect(ConditionRegistry.get("feral-whispers")!.mirror).toBe("feral-whispers"); // the shipped def again
    expect(await CommandRouter.route("forget-condition feral-whispers")).toContain("built-in");
  });

  test("bad duration is refused with the grammar", async () => {
    expect(await CommandRouter.route('define-condition name="x" duration="sometimes"')).toContain("Can't read duration");
  });
});

describe("conditions: the Feral Speech flow (afflict/advance/lift, mirrors, NPCs)", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); resetAllConfigStores(); await LorebookManager.bootstrap(); });

  test("afflict validates bindings; @alias values resolve; conditions lists", async () => {
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    expect(await CommandRouter.route("afflict concentrating-on")).toContain("needs target=");
    await CommandRouter.route('alias @prey "Grey Wolf"');            // the wolf is an NPC - no sheet
    const r = await CommandRouter.route("afflict concentrating-on target=@prey");
    expect(r).toContain("Kvar is now concentrating-on (target: Grey Wolf)");
    expect(r).toContain("1 turn (ST-enforced)");
    expect(await CommandRouter.route("conditions")).toContain("concentrating-on (target: Grey Wolf)");
  });

  test("advance carries bindings into the successor and fires its mirror on the NPC", async () => {
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    await CommandRouter.route('afflict concentrating-on target="Grey Wolf"');
    const adv = await CommandRouter.route("advance concentrating-on");
    expect(adv).toContain("concentrating-on ends");
    expect(adv).toContain("Kvar is now feral-whispers (target: Grey Wolf)");
    expect(adv).toContain("Grey Wolf is now feral-whispers (target: Kvar)"); // the mirror, on a sheetless NPC
    expect(await CommandRouter.route('conditions "Grey Wolf"')).toContain("feral-whispers (target: Kvar)");
  });

  test("lift removes both sides of a mirrored condition; spend= is the shrug-off", async () => {
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    await CommandRouter.route('afflict feral-whispers target="Grey Wolf"');
    await CommandRouter.route("gain willpower 2");
    const lifted = await CommandRouter.route("lift feral-whispers spend=willpower");
    expect(lifted).toContain("shakes off feral-whispers");
    expect(lifted).toContain("spent 1 willpower");
    expect(lifted).toContain("feral-whispers lifted from Grey Wolf");
    expect(await CommandRouter.route("conditions")).toContain("no conditions");
    expect(await CommandRouter.route('conditions "Grey Wolf"')).toContain("no conditions");
  });

  test("advance with no successor and lifting an absent condition report cleanly", async () => {
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    await CommandRouter.route('afflict feral-whispers target="Grey Wolf"');
    expect(await CommandRouter.route("advance feral-whispers")).toContain("no successor");
    expect(await CommandRouter.route("lift concentrating-on")).toContain("does not have");
  });
});

describe("conditions: tags bite in rolls and contests", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); resetAllConfigStores(); await LorebookManager.bootstrap(); });

  test("an active condition's registered tag changes the roll TODAY", async () => {
    await CommandRouter.route('create-playable name="Rok" templates=mortal');
    // off-hand is a shipped RollModifier: +1 difficulty.
    await CommandRouter.route('define-condition name="dazed" tags="off-hand"');
    const before = await CommandRouter.route("roll 3", { rng: seqRng([6, 6, 6]) });
    expect(before).toContain("vs diff 6");
    await CommandRouter.route("afflict dazed");
    const after = await CommandRouter.route("roll 3", { rng: seqRng([6, 6, 6]) });
    expect(after).toContain("vs diff 7");
    await CommandRouter.route("lift dazed");
    const healed = await CommandRouter.route("roll 3", { rng: seqRng([6, 6, 6]) });
    expect(healed).toContain("vs diff 6");
  });

  test("contest sides carry their conditions too", async () => {
    await CommandRouter.route('create-playable name="Rok" templates=mortal');
    await CommandRouter.route('create-playable name="Erik" templates=mortal');
    await CommandRouter.route('play name="Rok"');
    await CommandRouter.route('define-condition name="dazed" tags="off-hand"');
    await CommandRouter.route('afflict dazed on="Erik"');
    // Erik's side (named opponent) rolls at +1 difficulty; Rok's stays at 6.
    const r = await CommandRouter.route('resist 3 3 vs="Erik"', { rng: seqRng([6, 6, 6, 6, 6, 6]) });
    expect(r).toContain("vs diff 6");
    expect(r).toContain("vs diff 7");
  });
});

// =============================================================================
// COMMAND SPECS - derived help + the one sanitizing composer
// =============================================================================
describe("command specs: derived help + composeCommand", () => {
  test("describeCommandSpec renders required/optional/enum/int/hint forms + openNamed + note", () => {
    const spec: CommandSpec = {
      summary: "does the thing",
      note: "a remark",
      params: [
        { key: "who", kind: "positional", required: true, hint: "<who>" },
        { key: "extra", kind: "positional" },
        { key: "mode", kind: "named", type: "enum", options: ["a", "b"], required: true },
        { key: "count", kind: "named", type: "int" },
        { key: "spend", kind: "named", hint: "res[::effect][!]" },
        { key: "note", kind: "named" },
      ],
      openNamed: true,
    };
    expect(describeCommandSpec("do-thing", spec)).toBe(
      'do-thing <who> [<extra>] mode=a|b [count=N] [spend=res[::effect][!]] [note=".."] [<key>=<value> ...]  (does the thing; a remark)');
  });

  test("[[help]] is DERIVED from the registered specs (one source of truth)", async () => {
    expect(await CommandRouter.route("help define-condition")).toContain('duration="1 turn|until x|instant"');
    expect(await CommandRouter.route("help define-constraint")).toContain("relation=exclusive|restricted|forbidden");
    expect(await CommandRouter.route("help creator-mode")).toContain("set=true|false");
    expect(await CommandRouter.route("help lift")).toContain("spend=res[::effect][!]");
    expect(await CommandRouter.route("help afflict")).toContain("[<key>=<value> ...]");
  });

  test("composeCommand quotes, strips breakers, honors literals/defaults, omits empties, passes openNamed extras", () => {
    const spec: CommandSpec = {
      summary: "x",
      openNamed: true,
      params: [
        { key: "cond", kind: "positional", required: true },
        { key: "relation", kind: "named", default: "exclusive" },
        { key: "members", kind: "named" },
        { key: "label", kind: "named", type: "literal" },
        { key: "empty", kind: "named" },
      ],
    };
    const body = composeCommand("afflict-ish", {
      cond: "feral whispers",
      members: 'status, "anonymity"',
      label: "Dig `out`",
      empty: "   ",
      target: "Grey Wolf",
    }, spec);
    expect(body).toBe('afflict-ish "feral whispers" relation=exclusive members="status, anonymity" label=`Dig out` target="Grey Wolf"');
  });

  test("compose -> parse round-trips through the real parser (values normalize; literals stay verbatim)", () => {
    const spec: CommandSpec = { summary: "x", params: [
      { key: "who", kind: "positional", required: true },
      { key: "name", kind: "named", required: true },
      { key: "note", kind: "named", type: "literal" },
    ] };
    const cmd = CommandParser.parse(composeCommand("afflict", { who: "Grey Wolf", name: "Feral Whispers", note: "Keep Verbatim" }, spec));
    expect(cmd.name).toBe("afflict");
    expect(cmd.positional[0]).toBe("grey-wolf");
    expect(cmd.named["name"]).toBe("feral-whispers");
    expect(cmd.named["note"]).toBe("Keep Verbatim");
  });
});

// =============================================================================
// CONFIG STORES - one self-registered list drives every sync point
// =============================================================================
describe("config stores: reload/reset-all", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); resetAllConfigStores(); await LorebookManager.bootstrap(); });

  test("every store self-registered into ALL_CONFIG_STORES", () => {
    expect(ALL_CONFIG_STORES.map(s => s.entry).sort()).toEqual([
      CONDITIONS_ENTRY, CONSTRAINTS_ENTRY, RESOURCE_CONFIG_ENTRY, SUCCESS_TABLES_ENTRY,
    ].sort());
  });

  test("reloadAllConfigStores reloads every registry and reports per-entry counts", async () => {
    await CommandRouter.route('define-condition name="dazed" tags="off-hand"');
    await CommandRouter.route('define-constraint name="statuses" relation=exclusive domain=background members="status"');
    resetAllConfigStores();
    expect(ConditionRegistry.get("dazed")).toBeUndefined();
    const counts = Object.fromEntries((await reloadAllConfigStores()).map(c => [c.entry, c.count]));
    expect(counts[CONDITIONS_ENTRY]).toBe(1);
    expect(counts[CONSTRAINTS_ENTRY]).toBe(1);
    expect(counts[RESOURCE_CONFIG_ENTRY]).toBe(0);
    expect(ConditionRegistry.get("dazed")!.tags).toEqual(["off-hand"]);
  });

  test("resetAllConfigStores clears overlays AND restores the success-table defaults", async () => {
    SuccessTableRegistry.register({ name: "degrees", failure: "X", rows: [] });   // shadow a shipped table
    await CommandRouter.route('define-condition name="dazed"');
    resetAllConfigStores();
    expect(SuccessTableRegistry.get("degrees")!.rows!.length).toBe(5);            // shipped default resurfaces
    expect(ConditionRegistry.get("dazed")).toBeUndefined();
  });
});

// =============================================================================
// ROUTER HOOKS - the game-registered creator-mode sync runs before dispatch
// =============================================================================
describe("command router: beforeRoute hooks (creator-mode live sync)", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); resetAllConfigStores(); await LorebookManager.bootstrap(); });

  test("while creator mode is on, a hand-edited config entry is live for the very NEXT command", async () => {
    await CommandRouter.route('define-condition name="dazed" description=`Old words`');
    await CommandRouter.route("creator-mode set=true");
    const entry = ["hand edit", "=====",
      JSON.stringify([{ name: "dazed", description: "New words", tags: ["off-hand"] }])].join("\n");
    await LorebookManager.updateEntryText(CONFIG_CATEGORY, CONDITIONS_ENTRY, entry);
    expect(await CommandRouter.route("condition dazed")).toContain("New words");   // the hook re-loaded it
    await CommandRouter.route("creator-mode set=false");
    expect(ConditionRegistry.get("dazed")!.tags).toEqual(["off-hand"]);            // off-path synced too
    expect(await CreatorMode.enabled()).toBe(false);
  });
});

// =============================================================================
// DEFINE-TABLE - command authoring for success tables (closes the config gap)
// =============================================================================
describe("define-table / forget-table (+ win-table): success-table authoring", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); __resetUiMock(); resetAllConfigStores(); await LorebookManager.bootstrap(); });

  test("parseTableRows: forms and refusals", () => {
    expect(parseTableRows(undefined)).toEqual([]);
    expect(parseTableRows("  ")).toEqual([]);
    expect(parseTableRows("1:Cowed, 3:Terrified=2")).toEqual([
      { at: 1, label: "Cowed" }, { at: 3, label: "Terrified", value: 2 },
    ]);
    expect(parseTableRows("1:cowed-and-shaking")).toEqual([{ at: 1, label: "cowed-and-shaking" }]);
    for (const bad of ["x:label", "3:", "3", "1:a=b"]) {
      expect("error" in parseTableRows(bad)).toBe(true);
    }
  });

  test("define-table with literal rows: verbatim labels, readable via table=, persists in the lorebook", async () => {
    const r = await CommandRouter.route('define-table name="intimidate" rows=`1:Cowed, 3:Terrified` failure=`They hold their ground` cap=6');
    expect(r).toContain("Defined table intimidate");
    expect(r).toContain("cap 6");
    expect(SuccessTableRegistry.get("intimidate")!.rows![1].label).toBe("Terrified"); // the literal channel kept the case
    await CommandRouter.route('create-playable name="Rok" templates=mortal');
    const roll = await CommandRouter.route("roll 5 table=intimidate", { rng: seqRng([6, 6, 6, 2, 2]) });
    expect(roll).toContain("Terrified");
    // The write went to the ONE lorebook entry: reload after reset re-registers it.
    resetAllConfigStores();
    expect(SuccessTableRegistry.get("intimidate")).toBeUndefined();
    await SuccessTables.loadFromLorebook();
    expect(SuccessTableRegistry.get("intimidate")!.failure).toBe("They hold their ground");
  });

  test("overflow params; empty tables and bad numbers are refused", async () => {
    const r = await CommandRouter.route('define-table name="brutality" rows=`1:Hurt` overflow-per=2 overflow-value=1 overflow-label=`extra maiming`');
    expect(r).toContain("overflow 1/2 (extra maiming)");
    expect(await CommandRouter.route('define-table name="empty"')).toContain("needs something to read");
    expect(await CommandRouter.route('define-table name="x" rows=`1:A` cap=lots')).toContain("whole number");
    expect(await CommandRouter.route('define-table name="x" rows=`1:A` overflow-value=1')).toContain("overflow-per");
  });

  test("shadowing a built-in and forgetting it: the shipped table resurfaces", async () => {
    const r = await CommandRouter.route('define-table name="degrees" value-per-success=1');
    expect(r).toContain("shadows the built-in");
    expect(SuccessTableRegistry.get("degrees")!.rows).toBeUndefined();        // shadowed
    const f = await CommandRouter.route("forget-table degrees");
    expect(f).toContain('The built-in "degrees" resurfaces');
    expect(SuccessTableRegistry.get("degrees")!.rows!.length).toBe(5);        // shipped ladder is back
    expect(await CommandRouter.route("forget-table damage")).toContain("can be shadowed");
    expect(await CommandRouter.route("forget-table nope")).toContain("No table");
  });

  test("win-table renders define-table's spec; Create defines through composeCommand", async () => {
    await CommandRouter.route("win-table");
    expect(__uiWindows().length).toBe(1);
    await api.v1.tempStorage.set("win:define-table:name", "fear");
    await api.v1.tempStorage.set("win:define-table:rows", "1:Uneasy, 4:Panicked");
    await api.v1.tempStorage.set("win:define-table:cap", "5");
    expect(await __uiClickButton("Create")).toBe(true);
    const t = SuccessTableRegistry.get("fear")!;
    expect(t.rows![1]).toEqual({ at: 4, label: "Panicked" });   // literal composition kept the case
    expect(t.cap).toBe(5);
  });
});
