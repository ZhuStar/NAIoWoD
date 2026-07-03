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
  overrideSpec, NamedRollStore, NAMED_ROLLS_CATEGORY,
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
    expect(Object.keys(TEMPLATES).sort()).toEqual(["demon", "ghoul", "mage", "mortal", "thrall", "vampire", "werewolf"]);
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
    expect(await LorebookManager.allTalents()).toContain("Brawl");
    expect(await LorebookManager.allSkills()).toContain("Ride");
    expect(await LorebookManager.allKnowledges()).toContain("Occult");
    expect(await LorebookManager.allBackgrounds()).toContain("Generation");
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
    expect(await LorebookManager.allTalents()).toContain("Brawl");
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
    expect(LorebookManager.parseList(text)).toEqual(["Alertness", "Brawl", "Melee", "Occult"]);
  });

  test("with no marker, the whole text is data", () => {
    expect(LorebookManager.parseList("Foo\nBar")).toEqual(["Foo", "Bar"]);
  });
});

describe("CommandParser", () => {
  test("splits verb, positional args (in order), and named args", () => {
    const c = CommandParser.parse('roll strength+brawl 7 +1 requires=3 tags="off-hand, ambush"');
    expect(c.name).toBe("roll");
    expect(c.positional).toEqual(["strength+brawl", "7", "+1"]);
    expect(c.named.requires).toBe("3");
    expect(c.named.tags).toBe("off-hand, ambush");
  });

  test("quoted named values, case-insensitive keys, and quoted positionals", () => {
    const c = CommandParser.parse('create-playable name="Erik the Red" templates=vampire,werewolf');
    expect(c.name).toBe("create-playable");
    expect(c.named.name).toBe("Erik the Red");
    expect(c.named.templates).toBe("vampire,werewolf");

    expect(CommandParser.parse("creator-mode SET='true'").named.set).toBe("true");

    const e = CommandParser.parse('roll-for "Erik the Red" willpower');
    expect(e.name).toBe("roll-for");
    expect(e.positional).toEqual(["Erik the Red", "willpower"]);
  });

  test("CommandRouter.parse still delegates (deprecated)", () => {
    expect(CommandRouter.parse("play name=x").named.name).toBe("x");
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
    expect(parsed.name).toBe("Absurd Al");
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
    expect((await CharacterStore.getCurrent())!.name).toBe("Rok");
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
    expect((await CharacterStore.getCurrent())!.name).toBe("Sela");
    const back = await CommandRouter.route("play");
    expect(back).toContain("default character");
    expect((await CharacterStore.getCurrent())!.name).toBe("Rok");
  });

  test('[[roll-for "Name"]] rolls another character without changing selection', async () => {
    await CommandRouter.route('create-playable name="Rok" templates=mortal');   // default + current
    await CommandRouter.route('create-playable name="Sela" templates=mortal');
    const r = await CommandRouter.route('roll-for "Sela" dexterity', { rng: seqRng([6]) });
    expect(r).toContain("Sela");
    expect(r).toContain("1 success");
    expect((await CharacterStore.getCurrent())!.name).toBe("Rok"); // unchanged
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
    expect((await CharacterStore.getCurrent())!.name).toBe("Rok"); // unchanged
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
