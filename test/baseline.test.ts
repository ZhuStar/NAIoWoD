import { describe, test, expect } from "bun:test";
import {
  StringUtil, Category, PointSource, Stat, Tracker, RulesetConfig,
  LedgerEntry, StatModifier, LorebookParser, LiveCharacter
} from "../src/wod";

describe("StringUtil", () => {
  test("normalize lowercases, trims and hyphenates whitespace", () => {
    expect(StringUtil.normalize("  Blood  Potency ")).toBe("blood-potency");
  });

  test("parseSrdName splits a well-formed srd string", () => {
    expect(StringUtil.parseSrdName("srd:ability:talent:brawl")).toEqual({
      kind: "ability", subCategory: "talent", name: "brawl"
    });
  });

  test("parseSrdName joins trailing segments into the name", () => {
    expect(StringUtil.parseSrdName("srd:ability:skill:melee:two-handed").name).toBe("melee-two-handed");
  });

  test("parseSrdName falls back on malformed input", () => {
    expect(StringUtil.parseSrdName("garbage")).toEqual({ kind: "unknown", subCategory: "none", name: "garbage" });
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

describe("LiveCharacter (baseline)", () => {
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
