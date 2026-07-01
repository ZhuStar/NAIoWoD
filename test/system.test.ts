import { describe, test, expect } from "bun:test";
import {
  type Rng,
  StringUtil, Category, Stat, Tracker,
  Dice, Random,
  Severity, HealthTrack,
  DamagePacket, Kind, Source,
  UndeadPhysiology, SilverVulnerability, ArmorReaction,
  Pool, bloodForGeneration,
  MoralityTrait,
  TEMPLATE_MORTAL, TEMPLATE_THRALL, TEMPLATE_VAMPIRE, TEMPLATE_MAGE, TEMPLATE_DEMON,
  TEMPLATE_WEREWOLF, TEMPLATES,
  CharacterFactory,
} from "../src/wod";

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
    const demon = CharacterFactory.create(TEMPLATE_DEMON, "Fallen", { poolStarts: { resolve: 5 } });
    expect(demon.Trackers.get("resolve")!.Value).toBe(5);
    expect(demon.Trackers.get("torment")!.Value).toBe(3);
    expect(() => CharacterFactory.create(TEMPLATE_DEMON, "Bad", { poolStarts: { resolve: 2 } }))
      .toThrow(/resolve must start between 3 and 5/);
    expect(() => CharacterFactory.create(TEMPLATE_DEMON, "Bad", { poolStarts: { resolve: 6 } }))
      .toThrow(/resolve must start between 3 and 5/);
  });

  test("the TEMPLATES registry exposes all splats", () => {
    expect(Object.keys(TEMPLATES).sort()).toEqual(["demon", "mage", "mortal", "thrall", "vampire", "werewolf"]);
  });
});

describe("Templates: morality & virtues presence", () => {
  test("mages have neither Road nor Virtues", () => {
    const mage = CharacterFactory.create(TEMPLATE_MAGE, "Hermetic");
    expect(mage.Morality).toBeUndefined();
    expect(mage.Virtues.size).toBe(0);
    expect(mage.Pools.has("quintessence")).toBe(true);
    expect(mage.Pools.has("paradox")).toBe(true);
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

  test("SaveToStory serializes the full sheet", () => {
    const v = CharacterFactory.create(TEMPLATE_VAMPIRE, "Archive", {
      generation: 10,
      virtues: { conscience: 2, "self-control": 3, courage: 3 },
      attributes: { stamina: 2 },
    });
    v.TakeDamage("bashing", 2, { soak: false });
    const data = v.SaveToStory();
    expect(data.name).toBe("Archive");
    expect(data.template).toBe("Vampire (Dark Ages)");
    expect(data.morality).toEqual({ road: "Road of Humanity", value: 5 });
    expect(data.pools.find(p => p.name === "blood")!.max).toBe(13);
    expect(data.health.bashing).toBe(2);
  });
});
