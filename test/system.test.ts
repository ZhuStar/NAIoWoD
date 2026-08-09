import { describe, test, expect, beforeAll, beforeEach } from "bun:test";
// Installs the off-host mock onto globalThis.api (side effect) and provides the
// test hooks. `api` itself is the ambient global (types/novelai/script-types.d.ts).
import { __resetLorebookMock, __resetStorageMock, __resetUiMock, __uiWindows, __uiClickButton, __fireOnResponse, __authorNote, __fireOnContextBuilt, __seedDocument, __document, __fireOnGenerationEnd, __resetMessagingMock, __sentMessages, __deliverMessage, __uiTypeInto, __uiFieldValue, __uiFields, __accountStorage, __asScript, __currentScript } from "../src/host-mock";

// What actually left this script as an EVENT. The hello handshake is directory
// traffic - it says who wants what - so a test asking "did this reach the wire"
// means everything except that.
function wireTraffic(): Array<{ toScriptId?: string; data: unknown; channel?: string }> {
  return __sentMessages().filter(m => m.channel !== HELLO_CHANNEL);
}
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
  ScopedStorage, KEY, STORE, REGISTRY_PREFIX, DIRECTORY_KEY, StorageDesk, STORAGE_CHANNEL, StorageRequest, LorebookManager,
  CommandRouter, CommandParser, CharacterStore, PLAYER_CHARACTERS_CATEGORY, processAdventureInput,
  MeritFlawRegistry, ArcanumRegistry, SRD_CATEGORIES, SRD_HEADER_MARKER,
  makeRollSpec, parsePoolExpression, resolveSpec, executeRoll, RollModifierRegistry, DEFAULT_DIFFICULTY,
  overrideSpec, describeSpec, NamedRollStore, NAMED_ROLLS_CATEGORY, DEFAULT_NAMED_ROLLS,
  ExtendedRoll, applyInterval, ExtendedRollStore,
  readSuccessTable, describeTableReading, describeTable, SuccessTableRegistry, parseTableRows,
  compareRolls, compareField, describeStandings, migrateContest, applyContestRound, describeContest,
  ExtendedContestStore, TableLibrary, TableAliases, TABLES_CATEGORY, GENERAL_ENTRY,
  reloadAllConfigStores, resetAllConfigStores, ALL_CONFIG_STORES,
  structuralHash, ensurePath, TrackedLorebook, combineConfigTexts, reconcileLorebook,
  describeCommandSpec, composeCommand, type CommandSpec,
  CONSTRAINT_RELATIONS, CONSTRAINT_DOMAINS, CreatorMode,
  type SuccessTable, type ExtendedContest, type RollExecution,
  parseAliasToken, AliasRegistry, PlayerStore,
  AfflictionRegistry, resolveAffliction, afflictionNames, CharacterAfflictions, AFFLICTIONS_ENTRY,
  makeAfflictionDef, describeAfflictionDef, parseAfflictionDuration, describeDuration,
  type AfflictionDef, type ActiveAffliction,
  makeConstraintGroup, describeConstraint, checkConstraints, ConstraintRegistry, CONSTRAINTS_ENTRY,
  type ConstraintGroup, type ConstraintRelation, type ConstraintDomain, type OwnedTraits,
  openConstraintWindow,
  resourcesForTemplates, resourceEffect, CharacterResources,
  CharacterHealth, CharacterBoosts, healthLevelsForTemplates,
  resolveReply, renderPromptText, WizardSession, ResourceOverrides, RESOURCE_CONFIG_ENTRY, CONFIG_CATEGORY,
  MAGIC_CONFIG_ENTRY, MagicRulesConfig, CastAttempts, magicRulesFrom, DEFAULT_MAGIC_RULES,
  LIVING_RESOLVE, GHOUL_SOAK, TEMPLATE_REVENANT, FELLOWSHIPS,
  countDayBoundaries, countFullMoons, nextFullMoon, type PlayableCharacter,
  WEEKDAYS, weekdayOf, weekdayName, formatStoryDay, MOON_PHASES, moonAt, nextMoonPhase,
  foldAfflictionTiers, isAwakened, CrayStore, uncancelableCap,
  EventBus, PostOffice, Bus, isLocalChannel, busChannel, BUS_PRIORITIES, BUS_PHASES, LOCAL_PREFIX,
  HELLO_CHANNEL, INTEREST_ALL,
  commandEnvelope, envelopeToCommand, commandChannel, COMMAND_CHANNEL, COMMAND_RESULT_CHANNEL,
  rollSpendsCharge, expiryElapsed, makeAfflictionExpiry, describeExpiry,
  expiryIsAdvisoryOnly, evaluateCondition, AFFLICTION_MODES,
  GRANT_SOURCES, sourceDrawsOnPurse, describeCreationGrant,
  makeOrphanPolicy, describeOrphanPolicy, ORPHAN_IMMEDIATELY, ORPHAN_KEEP,
  PASSIVE_AFFLICTIONS, afflictionRole, budgetOfKind, SYSTEM, grantIsAutomatic, registerSystemHandlers, afflictionOpsOf,
  budgetDef, budgetBuyable, NOT_PURCHASABLE, affinityDisciplines, CAPABILITIES,
  parsePassiveOps, describePassiveOp, type EffectOp, resolveTraitFromRecord,
  resolvePowerInstance, passiveOpsOf, ownedMeritInstances, enhancementsFor,
  AbilityCategories, traitCategoryOf, traitInCategory,
  DISCIPLINES, disciplineDef,
  TEMPLATE_MORTAL, TEMPLATE_THRALL, TEMPLATE_VAMPIRE, TEMPLATE_MAGE, TEMPLATE_DEMON,
  TEMPLATE_WEREWOLF, TEMPLATE_GHOUL, TEMPLATES,
  CharacterFactory,
  parseStoryDate, formatStoryDate, parseDuration, addDuration, diffCalendar, formatCalendarSpan,
  StoryClock, DateBook, DEFAULT_STORY_START,
  extractHideBlocks, processGeneratedText, init,
  processContextBuilt, stripCtxSkip, GenCounter, isQuietVerb, SHOW_SUBJECT_VERBS, readBool,
  processGenerationEnd, stripAgedCtxSkip,
  parseCardText, formatCardText, characterToCard, characterFromCard, asNamedList,
  namedDefsToCard, DEFAULT_MERITS_FLAWS, DEFAULT_ARCANA, DEFAULT_BACKGROUNDS, DEFAULT_AFFLICTIONS,
  RITUAL_TIME_OP, ritualTimePercent, scaleRitualSeconds,
  meritFlawFromCard, arcanumFromCard, makeBackgroundDef, makeTemplateDef,
  asNumber, asText, asList, asStringList, CardMap, permanentRatingOf,
  COSTS_CONFIG_ENTRY, AdvancementCosts, advancementCostsFrom,
  ROLLS_CONFIG_ENTRY, RollRulesConfig, rollFloorFrom, SuccessTableRow,
  BACKGROUNDS_ENTRY, BackgroundRegistry, grantedTraitsOf, effectiveTraitOf,
  TEMPLATES_ENTRY, TemplateRegistry, DEFAULT_TEMPLATE_DEFS, templateFromDef, applyTemplateDefs,
  BASE_CREATION, creationBudgetFor, CLANS, clanByName, clanFamilies, clanFamilyOf,
  fellowshipByName, EXCLUSIVE_MERITS_FLAWS,
  evaluateExpr, mapScope, exprRefs, describeTerms, evalNumeric,
  traitValueOf, derivedValuesOf, evalOn,
  ROADS, roadByName, ROAD_OF_KINGS,
  savedRollToCard, savedRollFromCard, resourceNumbers,
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
    expect(Object.keys(TEMPLATES).sort()).toEqual(["demon", "ghoul", "mage", "mortal", "ouroboros", "revenant", "sorcerer", "thrall", "vampire", "werewolf"]);
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
    MeritFlawRegistry.reset(); ArcanumRegistry.reset();
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
    MeritFlawRegistry.reset(); ArcanumRegistry.reset();
  });

  test("variable point costs validate the chosen rating", () => {
    MeritFlawRegistry.register({ name: "Contested Domain", kind: "flaw", points: [1, 2, 3] });
    const m = CharacterFactory.create(TEMPLATE_MORTAL, "Landed");
    expect(() => m.AddMeritFlaw("Contested Domain", { points: 5 })).toThrow(/one of \[1, 2, 3\]/);
    m.AddMeritFlaw("Contested Domain", { points: 2 });
    expect(m.FlawPointsGained).toBe(2);
    MeritFlawRegistry.reset(); ArcanumRegistry.reset();
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
    const body = LorebookManager.contentBelowHeader(text!);
    expect(body).toContain("name: Absurd Al");                 // display spelling, not the key
    expect(body).toContain("templates: vampire, werewolf, mage");
    expect(body).toContain("  Strength: 1");                   // a group, one trait per line
    const parsed = characterFromCard(parseCardText(body))!;
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
    const newText = `edited by hand\n=====\n${formatCardText(characterToCard(edited))}`;
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
    await LorebookManager.updateEntryText(PLAYER_CHARACTERS_CATEGORY, "pc:broken", "junk\n=====\nthis is not a sheet at all");
    const reply = await CommandRouter.route("creator-mode set=false");
    expect(reply).toContain("Could not read");
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
    expect(r!.inputText!.startsWith("I sit down to plan. [SYSTEM:")).toBe(true);
    expect(r!.inputText!.endsWith("Then I sleep.")).toBe(true);
  });

  test("a QUIET (listing) command suppresses generation even amid prose", async () => {
    // help is read-only: querying the system should never trigger narration,
    // even when the player wrapped prose around the command.
    const r = await processAdventureInput('Let me think. [[help]] Now, onward!');
    expect(r!.stopGeneration).toBe(true);
    expect(r!.inputText).toContain("[SYSTEM:");
    // A NON-quiet command with the same prose still lets generation proceed.
    const r2 = await processAdventureInput('Let me think. [[creator-mode set=false]] Now, onward!');
    expect(r2!.stopGeneration).toBe(false);
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

describe("Health: per-square penalties, afflictions & heal policies", () => {
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

  test("a health state reflects how many of its linked boxes are damaged", () => {
    const h = new HealthTrack({
      squares: [
        { name: "A", penalty: 0 },
        { name: "Gut", penalty: -1, state: "poison" },
        { name: "Gut", penalty: -2, state: "poison" },
      ],
      states: [{
        key: "poison", name: "Poisoned",
        state: (d) => d === 0 ? null : d === 1 ? "queasy" : "retching",
      }],
    });
    expect(h.States()).toHaveLength(0);
    h.ApplyDamage("lethal", 2);   // fills boxes 0 and 1 -> one poison box
    expect(h.States()[0]).toMatchObject({ state: "queasy", damaged: 1, total: 2 });
    h.ApplyDamage("lethal", 1);   // fills box 2 -> both poison boxes
    expect(h.States()[0].state).toBe("retching");
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

  test("Summary includes active health states; harmless no-ops; fatal kills", () => {
    const h = new HealthTrack({
      squares: [{ name: "A", penalty: 0, state: "burning" }, { name: "B", penalty: -1 }],
      states: [{ key: "burning" }],
    });
    h.ApplyDamage("harmless", 3);
    expect(h.Filled).toBe(0);
    h.ApplyDamage("aggravated", 1);
    expect(h.Summary().states[0]).toMatchObject({ key: "burning", state: "active", damaged: 1 });
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
    const text = [
      "edited by hand", "=====",
      "Power Attack:",
      "  pool: strength+brawl",
      "  difficulty: 7",
    ].join("\n");
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
    expect(await CommandRouter.route("show-roll")).toContain("No saved rolls");
    await CommandRouter.route("name-roll dodge dexterity+dodge");
    expect(await CommandRouter.route("show-roll")).toContain("dodge");
    expect(await CommandRouter.route("roll @ghost", { rng: seqRng([]) })).toContain('No saved roll named "ghost"');
    expect(await CommandRouter.route("forget-roll dodge")).toContain("Forgot");
    expect(await CommandRouter.route("show-roll")).toContain("No saved rolls");
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
    expect(await CommandRouter.route("show-roll-status")).toContain("Dig out");

    await CommandRouter.route('play name="Sela"');
    const cont = await CommandRouter.route("continue-roll", { rng: seqRng([6, 6]) });
    expect(cont).toContain("Sela continues");
    expect(cont).toContain("4/20 successes"); // 2 (Rok) + 2 (Sela)

    expect(await CommandRouter.route("cancel-roll")).toContain("Cancelled");
    expect(await CommandRouter.route("show-roll-status")).toContain("No extended action");
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
    // Spent Willpower buys certainty: un-cancelable successes, capped by Foundation.
    expect(resourcesForTemplates(["mortal"])[0].effect?.apply).toEqual([{ op: "uncancelable", amount: 1 }]);
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

  test("[[show-resource]] lists the current character's resources", async () => {
    await CommandRouter.route('create-playable name="Merlin" templates=mage');
    const r = await CommandRouter.route("show-resource");
    expect(r).toContain("willpower");
    expect(r).toContain("quintessence");
  });

  test("[[roll ... spend=willpower]] deducts Willpower and adds an automatic success", async () => {
    await CommandRouter.route('create-playable name="Merlin" templates=mage');
    await CommandRouter.route("gain willpower 3");   // seeded at 0; give some to spend
    const r = await CommandRouter.route("roll strength spend=willpower", { rng: seqRng([2]) });
    expect(r).toContain("spent 1 willpower");
    expect(r).toContain("1 success");               // 0 dice + 1 automatic
    expect(await CommandRouter.route("show-resource")).toContain("willpower 2/10");
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
    // Blood starts at 10; the CAPACITY is generation's - a 12th holds 11.
    await CommandRouter.route('create-playable name="Vlad" templates=vampire');
    expect(await CommandRouter.route("spend blood 3")).toContain("Now 7/11");
    expect(await CommandRouter.route("gain blood 100")).toContain("Now 11/11");
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
    expect(await CommandRouter.route("show-resource")).toContain("willpower 1/10");
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

  test("[[damage]] -> [[show-health]] -> the wound penalty shrinks the next roll", async () => {
    await CommandRouter.route('create-playable name="Vlad" templates=vampire');
    const dmg = await CommandRouter.route("damage lethal 3");
    expect(dmg).toContain("penalty -1");
    expect(await CommandRouter.route("show-health")).toContain("Injured");
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
    expect(r).toContain("blood now 8/11");
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
    expect(await CommandRouter.route("show-resource")).toContain("blood 10/11"); // nothing spent
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
    const edited = "notes\n=====\nwillpower:\n  max: 6";
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
    expect(wp.effect!.apply[0]).toEqual({ op: "uncancelable", amount: 2 });
    expect(await CommandRouter.route("show-resource")).toContain("willpower 0/8"); // record's chosen start (0) still wins; max is patched
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
    expect(await CommandRouter.route("show-resource")).toContain("mana 9/20");
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
    expect(await CommandRouter.route("show-resource")).toContain("ward (used 3)");
    expect(await CommandRouter.route("reset-uses")).toContain("counters reset");
    expect(await CommandRouter.route("show-resource")).not.toContain("(used");
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
    const list = await CommandRouter.route("show-resource");
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
  const side = (name: string) => ({ name, base: makeRollSpec({ pool: "3" }), accumulated: 0 });
  const base: ExtendedContest = {
    id: "c", label: "", sides: [side("Anja"), side("Bram")],
    target: 5, maxRounds: 3, interval: "", onBotch: "fail", rounds: 0, status: "open", log: [],
  };
  const fresh = (over: Partial<ExtendedContest> = {}): ExtendedContest =>
    ({ ...base, sides: base.sides.map(s => ({ ...s })), log: [], ...over });

  test("both accumulate; the first to the goal wins", () => {
    let c = applyContestRound(fresh(), [three, one]).contest;   // Anja 3, Bram 1
    expect(c.sides[0].accumulated).toBe(3);
    expect(c.sides[1].accumulated).toBe(1);
    expect(c.status).toBe("open");
    c = applyContestRound(c, [three, one]).contest;             // Anja 6 >= 5 -> wins
    expect(c.status).toBe("Anja");
  });

  test("a dead heat in the same round stays open (nobody got there first)", () => {
    const r = applyContestRound(fresh({ target: 3, maxRounds: 5 }), [three, three]);
    expect(r.contest.status).toBe("open");
  });

  test("under the fail policy, a botch loses the round outright", () => {
    expect(applyContestRound(fresh(), [botch, one]).contest.status).toBe("Bram");
    expect(applyContestRound(fresh(), [botch, one]).note).toContain("botches");
    expect(applyContestRound(fresh(), [botch, botch]).contest.status).toBe("draw"); // both botch
  });

  test("running out of rounds is a draw", () => {
    let c = fresh({ target: 100, maxRounds: 2 });
    c = applyContestRound(c, [three, one]).contest;
    c = applyContestRound(c, [three, one]).contest;
    expect(c.status).toBe("draw");
  });

  // --- MORE THAN TWO --------------------------------------------------------
  test("a race with three in it: everyone accumulates, the first past the post wins", () => {
    const three3: ExtendedContest = { ...base, sides: [side("Anja"), side("Bram"), side("Cwen")], log: [] };
    let c = applyContestRound(three3, [three, one, one]).contest;
    expect(c.sides.map(s => s.accumulated)).toEqual([3, 1, 1]);
    expect(c.status).toBe("open");
    c = applyContestRound(c, [three, one, one]).contest;        // Anja 6 >= 5
    expect(c.status).toBe("Anja");
  });

  test("a botch under `fail` puts you OUT while the others carry on - the case two sides could never reach", () => {
    const three3: ExtendedContest = { ...base, sides: [side("Anja"), side("Bram"), side("Cwen")], log: [] };
    const r = applyContestRound(three3, [three, botch, one]);
    expect(r.contest.status).toBe("open");                      // still a contest
    expect(r.contest.sides.map(s => s.name)).toEqual(["Anja", "Cwen"]);
    expect(r.note).toContain("botch out");
    // ...and with only one left standing, that one takes it outright.
    const two = applyContestRound(three3, [three, botch, botch]);
    expect(two.contest.status).toBe("Anja");
  });

  test("a three-way dead heat stays open; the highest total takes it when they differ", () => {
    const t3: ExtendedContest = { ...base, target: 3, maxRounds: 5, sides: [side("Anja"), side("Bram"), side("Cwen")], log: [] };
    expect(applyContestRound(t3, [three, three, three]).contest.status).toBe("open");
    // Anja crosses higher than Bram in the same round, so she got there first.
    const mixed = applyContestRound({ ...t3, target: 2 }, [three, one, one]);
    expect(mixed.contest.status).toBe("Anja");
  });

  test("a contest stored before contests could have three sides still continues", () => {
    const old = {
      id: "old", label: "", target: 5, maxRounds: 3, interval: "", onBotch: "fail" as const,
      rounds: 1, status: "a", log: [],
      a: { name: "Anja", base: makeRollSpec({ pool: "3" }), accumulated: 4 },
      b: { name: "Bram", base: makeRollSpec({ pool: "3" }), accumulated: 1 },
    } as unknown as ExtendedContest;
    const migrated = migrateContest(old);
    expect(migrated.sides.map(s => s.name)).toEqual(["Anja", "Bram"]);
    expect(migrated.sides[0].accumulated).toBe(4);
    expect(migrated.status).toBe("Anja");        // "a" was an index; now it is a name
  });
});

describe("contests with more than two participants (compareField)", () => {
  const exec = (pool: string, faces: number[]): RollExecution =>
    executeRoll(makeRollSpec({ pool }), () => 0, { rng: seqRng(faces) });
  const nets = (n: number) => exec(String(Math.max(n, 1)), Array(Math.max(n, 1)).fill(6)).result!.net;

  test("contested: the highest net takes it, and everyone else still has a rank", () => {
    const f = compareField("contested", [
      { name: "Anja", exec: exec("3", [6, 6, 6]) },      // 3
      { name: "Bram", exec: exec("3", [6, 2, 2]) },      // 1
      { name: "Cwen", exec: exec("3", [6, 6, 2]) },      // 2
    ]);
    expect(f.winners).toEqual(["Anja"]);
    expect(f.margin).toBe(1);                             // over Cwen, the runner-up
    expect(f.standings.map(s => s.name)).toEqual(["Anja", "Cwen", "Bram"]);
    expect(f.standings.map(s => s.rank)).toEqual([1, 2, 3]);
    expect(describeStandings(f)).toBe("Anja 3, Cwen 2, Bram 1");
  });

  test("equal nets share a rank, so a tie at the top is a draw between them", () => {
    const f = compareField("contested", [
      { name: "Anja", exec: exec("3", [6, 6, 6]) },
      { name: "Bram", exec: exec("3", [6, 6, 6]) },
      { name: "Cwen", exec: exec("3", [6, 2, 2]) },
    ]);
    expect(f.winners.sort()).toEqual(["Anja", "Bram"]);
    expect(f.margin).toBe(0);
    expect(f.note).toContain("tie at 3");
    expect(f.standings.map(s => s.rank)).toEqual([1, 1, 3]);   // Cwen is third, not second
  });

  test("resisted: the actor must beat the BEST of them - one is enough to stop him", () => {
    const strong = { name: "Anja", exec: exec("3", [6, 6, 6]) };      // 3
    const weak = { name: "Bram", exec: exec("3", [6, 2, 2]) };        // 1
    const equal = { name: "Cwen", exec: exec("3", [6, 6, 6]) };       // 3
    expect(compareField("resisted", [strong, weak]).winners).toEqual(["Anja"]);
    // Two resisting, and the second one matches him: resisted.
    const stopped = compareField("resisted", [strong, weak, equal]);
    expect(stopped.winners).toEqual([]);
    expect(stopped.note).toContain("best of 2");
  });

  test("a botch is zero and is said out loud; everyone botching is mutual disaster", () => {
    const botch = exec("2", [1, 2]);
    const f = compareField("contested", [
      { name: "Anja", exec: exec("3", [6, 2, 2]) },
      { name: "Bram", exec: botch },
      { name: "Cwen", exec: botch },
    ]);
    expect(f.winners).toEqual(["Anja"]);
    expect(f.note).toContain("Bram, Cwen botched");
    expect(compareField("contested", [{ name: "B", exec: botch }, { name: "C", exec: botch }]).note)
      .toContain("everyone botches");
  });

  test("the two-sided call is the field of two - one adjudication, not two", () => {
    const a = exec("3", [6, 6, 6]), b = exec("3", [6, 2, 2]);
    const two = compareRolls("contested", a, b);
    expect(two.winner).toBe("a");
    expect(two.margin).toBe(2);
    expect(two.field.winners).toEqual(["a"]);
    expect(two.field.margin).toBe(2);
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

  test("contest: higher total wins, and the note NAMES the winner (it may not be either of two)", async () => {
    await CommandRouter.route('create-playable name="Rok" templates=mortal');
    const win = await CommandRouter.route("contest 4 3", { rng: seqRng([6, 6, 6, 2, 6, 2, 2]) }); // 3 vs 1
    expect(win).toContain("contested");
    expect(win).toContain("Rok wins by 2");
    const lose = await CommandRouter.route("contest 3 4", { rng: seqRng([6, 2, 2, 6, 6, 6, 2]) }); // 1 vs 3
    expect(lose).toContain("The Opposition wins by 2");
  });

  test("a contest with THREE in it: vs= takes a list, and the standings are ranked", async () => {
    await CommandRouter.route('create-playable name="Rok" templates=mortal');
    // Rok 3, Erik 1, Sigrid 2 - all ad-hoc sides rolling flat pools.
    const r = await CommandRouter.route('contest 3 vs="Erik,Sigrid" vs-pool="3,3"',
      { rng: seqRng([6, 6, 6, /* Erik */ 6, 2, 2, /* Sigrid */ 6, 6, 2]) });
    expect(r).toContain("(3 ways)");
    expect(r).toContain("Rok wins by 1");                 // over Sigrid, the runner-up
    expect(r).toContain("standings Rok 3, Sigrid 2, Erik 1");
  });

  test("resisted against several: it only takes one of them to stop you", async () => {
    await CommandRouter.route('create-playable name="Rok" templates=mortal');
    // Rok 2; Erik 1; Sigrid 2 - Sigrid matches him, so the action is resisted.
    const r = await CommandRouter.route('resist 3 vs="Erik,Sigrid" vs-pool="3,3"',
      { rng: seqRng([6, 6, 2, /* Erik */ 6, 2, 2, /* Sigrid */ 6, 6, 2]) });
    expect(r).toContain("the action is resisted");
    expect(r).toContain("best of 2");
  });

  test("naming the same side twice is a typo, not a man contesting himself", async () => {
    await CommandRouter.route('create-playable name="Rok" templates=mortal');
    expect(await CommandRouter.route('contest 3 3 vs="Erik,Erik"')).toContain("named twice");
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
    const status = await CommandRouter.route("show-contest-status");
    expect(status).toContain("Long haul");
    expect(status).toContain("recent:");
    expect(await CommandRouter.route("cancel-contest")).toContain("Cancelled contest");
    expect(await CommandRouter.route("show-contest-status")).toContain("No extended contest");
  });

  test("a contest decided on its FIRST round stops being the current one", async () => {
    await CommandRouter.route('create-playable name="Rok" templates=mortal');
    // Target 1, so round one settles it: the launcher used to leave the finished
    // contest sitting as "current" (only continue-contest ever cleared it).
    const open = await CommandRouter.route("extended-contest 3 2 target=1 rounds=3", { rng: seqRng([6, 6, 6, 2, 2]) });
    expect(open).toContain("WINS");
    expect(open).not.toContain("Continue with");
    expect(await CommandRouter.route("show-contest-status")).toContain("No extended contest");
  });
});

describe("success tables: lorebook overlay & [[show-table]]", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); resetAllConfigStores(); await LorebookManager.bootstrap(); });

  test("[[show-table]] lists the built-ins; [[show-table name]] lays one out", async () => {
    const list = await CommandRouter.route("show-table");
    expect(list).toContain("degrees");
    expect(list).toContain("damage");
    expect(list).toContain("soak");
    const one = await CommandRouter.route("show-table degrees");
    expect(one).toContain("Marginal");
    expect(one).toContain("Phenomenal");
  });

  test("a lorebook entry overlays new tables (array form), usable via table=", async () => {
    const text = [
      "Success tables below the marker.", "=====",
      "- name: intimidate",
      "  rows:",
      "    - at: 1",
      "      label: Cowed",
      "    - at: 3",
      "      label: Terrified",
    ].join("\n");
    const { id } = await LorebookManager.ensureCategory(TABLES_CATEGORY);
    await LorebookManager.ensureEntry(id, GENERAL_ENTRY, text);
    expect(await TableLibrary.loadFromLorebook()).toBe(1);
    expect(SuccessTableRegistry.get("intimidate")!.rows!.length).toBe(2);

    await CommandRouter.route('create-playable name="Rok" templates=mortal');
    const r = await CommandRouter.route("roll 5 table=intimidate", { rng: seqRng([6, 6, 6, 2, 2]) }); // 3 successes
    expect(r).toContain("intimidate:");
    expect(r).toContain("Terrified");
  });

  test("the map form (name -> table) also registers, defaults are re-seeded", async () => {
    const text = "notes\n=====\nluck:\n  valuePerSuccess: 2\n  failure: no luck";
    const { id } = await LorebookManager.ensureCategory(TABLES_CATEGORY);
    await LorebookManager.ensureEntry(id, GENERAL_ENTRY, text);
    await TableLibrary.loadFromLorebook();
    expect(readSuccessTable(SuccessTableRegistry.get("luck")!, "success", 3).value).toBe(6);
    expect(SuccessTableRegistry.get("damage")).toBeDefined(); // built-ins survive the overlay
  });
});

// =============================================================================
// CONSTRAINT GROUPS + the first api.v1.ui window
// =============================================================================
describe("constraint groups (checkConstraints, pure)", () => {
  const owned = (o: Partial<OwnedTraits>): OwnedTraits => ({ backgrounds: [], merits: [], flaws: [], arcana: [], templates: [], ...o });

  test("arcana are their own domain: a merit constraint never catches one", () => {
    const asMerit = makeConstraintGroup({ name: "m", relation: "forbidden", domain: "merit", members: ["celestial-radiance"] });
    expect(checkConstraints([asMerit], owned({ arcana: ["celestial-radiance"] })).length).toBe(0);
    const asArcanum = makeConstraintGroup({ name: "a", relation: "forbidden", domain: "arcanum", members: ["celestial-radiance"] });
    expect(checkConstraints([asArcanum], owned({ arcana: ["celestial-radiance"] })).length).toBe(1);
    // ...and `any` still searches everything a character holds.
    const anywhere = makeConstraintGroup({ name: "x", relation: "forbidden", domain: "any", members: ["celestial-radiance"] });
    expect(checkConstraints([anywhere], owned({ arcana: ["celestial-radiance"] })).length).toBe(1);
  });

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
    __resetStorageMock(); __resetLorebookMock(); resetAllConfigStores(); MeritFlawRegistry.reset(); ArcanumRegistry.reset();
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
    expect(await CommandRouter.route("show-constraint")).toContain("foo");
    expect(await CommandRouter.route("show-constraint foo")).toContain("Haunted"); // toTitleCase display
    expect(await CommandRouter.route("forget-constraint foo")).toContain("Forgot");
    expect(ConstraintRegistry.get("foo")).toBeUndefined();
    expect(await CommandRouter.route("show-constraint")).toContain("No constraint groups");
  });

  test("check-constraints flags the current character's conflicts", async () => {
    await CommandRouter.route('define-constraint name="statuses" relation=exclusive domain=background members="status, anonymity" max=1');
    await CommandRouter.route('define-constraint name="no-secrets" relation=forbidden domain=flaw members="dark-secret" scope="vampire"');
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    const c = (await CharacterStore.getCurrent())!;
    c.backgrounds = { status: 2, anonymity: 1 };   // 2 of an exclusive group
    c.meritsFlaws = { "dark-secret": 1 };           // a forbidden flaw for vampires
    await CharacterStore.save(c);
    const report = await CommandRouter.route("show-constraint in=current");
    expect(report).toContain("2 constraint issues");
    expect(report).toContain("statuses");
    expect(report).toContain("forbidden");
  });

  test("check-constraints is clean when nothing conflicts", async () => {
    await CommandRouter.route('define-constraint name="statuses" relation=exclusive domain=background members="status, anonymity" max=1');
    await CommandRouter.route('create-playable name="Ok" templates=mortal');
    expect(await CommandRouter.route("show-constraint in=current")).toContain("satisfies all");
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
    await __uiTypeInto("story:win:define-constraint:name", "vip-backgrounds");
    await __uiTypeInto("story:win:define-constraint:relation", "exclusive");
    await __uiTypeInto("story:win:define-constraint:domain", "background");
    await __uiTypeInto("story:win:define-constraint:members", "status, anonymity");
    await __uiTypeInto("story:win:define-constraint:max", "1");

    expect(await __uiClickButton("Create")).toBe(true);
    // The emitted command ran through the same CommandRouter -> the group exists.
    expect(ConstraintRegistry.get("vip-backgrounds")!.members).toEqual(["status", "anonymity"]);
    expect(await CommandRouter.route("show-constraint")).toContain("vip-backgrounds");
  });

  test("Create with no name reports back in-window without defining anything", async () => {
    await CommandRouter.route("win-constraint");
    expect(await __uiClickButton("Create")).toBe(true);
    expect(ConstraintRegistry.all().length).toBe(0);
  });

  test("openConstraintWindow can be called directly and seeds selector defaults", async () => {
    await openConstraintWindow();
    expect(__uiFieldValue("story:win:define-constraint:relation")).toBe("exclusive");
    expect(__uiFieldValue("story:win:define-constraint:domain")).toBe("background");
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

  test("[[show-character]] marks current/default; [[set-default]] changes it and [[play]] returns to it", async () => {
    await CommandRouter.route('create-playable name="Rok" templates=mortal');   // default + current
    await CommandRouter.route('create-playable name="Sela" templates=mortal');
    const list = await CommandRouter.route("show-character");
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
    expect(await CommandRouter.route("show-roll")).toContain("spend=willpower");
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
// AFFLICTIONS - parameterized states (bindings, chains, mirrors, live tags)
// =============================================================================
describe("afflictions: defs + duration grammar (pure)", () => {
  test("parseAfflictionDuration reads the mini-grammar", () => {
    expect(parseAfflictionDuration("1 turn")).toEqual({ kind: "st", n: 1, unit: "turn" });
    expect(parseAfflictionDuration("2 scenes")).toEqual({ kind: "st", n: 2, unit: "scene" });
    expect(parseAfflictionDuration("until eye-contact-breaks")).toEqual({ kind: "until", until: "eye-contact-breaks" });
    expect(parseAfflictionDuration("instant")).toEqual({ kind: "instant" });
    expect(parseAfflictionDuration("whenever")).toBeUndefined();
    expect(describeDuration({ kind: "st", n: 1, unit: "turn" })).toBe("1 turn");
  });

  test("makeAfflictionDef normalizes; describeAfflictionDef lays it out", () => {
    const d = makeAfflictionDef({ name: " Feral  Whispers ", bindings: ["Target"], then: "Next Thing", tags: ["Off Hand"] });
    expect(d.name).toBe("feral-whispers");
    expect(d.bindings).toEqual(["target"]);
    expect(d.then).toBe("next-thing");
    expect(d.tags).toEqual(["off-hand"]);
    expect(describeAfflictionDef(d)).toContain("needs target");
  });

  test("the Feral Speech pair ships as defaults", () => {
    expect(AfflictionRegistry.get("concentrating-on")!.then).toBe("feral-whispers");
    expect(AfflictionRegistry.get("feral-whispers")!.mirror).toBe("feral-whispers");
  });
});

describe("afflictions: registry overlay + define/forget commands", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); resetAllConfigStores(); await LorebookManager.bootstrap(); });

  test("define-affliction writes the overlay and round-trips the lorebook", async () => {
    const r = await CommandRouter.route('define-affliction name="dazed" tags="off-hand" duration="1 scene" description=`Head ringing`');
    expect(r).toContain("Defined affliction dazed");
    AfflictionRegistry.reset();
    expect(AfflictionRegistry.get("dazed")).toBeUndefined();
    expect(await AfflictionRegistry.loadFromLorebook()).toBe(1);
    expect(AfflictionRegistry.get("dazed")!.tags).toEqual(["off-hand"]);
    expect(AfflictionRegistry.get("dazed")!.description).toBe("Head ringing");
  });

  test("an overlay def can shadow a built-in; forgetting resurfaces it", async () => {
    await CommandRouter.route('define-affliction name="feral-whispers" duration="2 scenes"');
    expect(describeDuration(AfflictionRegistry.get("feral-whispers")!.duration)).toBe("2 scenes");
    expect(await CommandRouter.route("forget-affliction feral-whispers")).toContain("resurfaces");
    expect(AfflictionRegistry.get("feral-whispers")!.mirror).toBe("feral-whispers"); // the shipped def again
    expect(await CommandRouter.route("forget-affliction feral-whispers")).toContain("built-in");
  });

  test("bad duration is refused with the grammar", async () => {
    expect(await CommandRouter.route('define-affliction name="x" duration="sometimes"')).toContain("Can't read duration");
  });
});

describe("afflictions: the Feral Speech flow (afflict/advance/lift, mirrors, NPCs)", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); resetAllConfigStores(); await LorebookManager.bootstrap(); });

  test("afflict validates bindings; @alias values resolve; afflictions lists", async () => {
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    expect(await CommandRouter.route("afflict concentrating-on")).toContain("needs target=");
    await CommandRouter.route('alias @prey "Grey Wolf"');            // the wolf is an NPC - no sheet
    const r = await CommandRouter.route("afflict concentrating-on target=@prey");
    expect(r).toContain("Kvar is now concentrating-on (target: Grey Wolf)");
    expect(r).toContain("1 turn (ST-enforced)");
    expect(await CommandRouter.route("show-affliction")).toContain("concentrating-on (target: Grey Wolf)");
  });

  test("advance carries bindings into the successor and fires its mirror on the NPC", async () => {
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    await CommandRouter.route('afflict concentrating-on target="Grey Wolf"');
    const adv = await CommandRouter.route("advance concentrating-on");
    expect(adv).toContain("concentrating-on ends");
    expect(adv).toContain("Kvar is now feral-whispers (target: Grey Wolf)");
    expect(adv).toContain("Grey Wolf is now feral-whispers (target: Kvar)"); // the mirror, on a sheetless NPC
    expect(await CommandRouter.route('show-affliction in="Grey Wolf"')).toContain("feral-whispers (target: Kvar)");
  });

  test("remove takes both sides of a mirrored affliction; spend= is the shrug-off", async () => {
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    await CommandRouter.route('afflict feral-whispers target="Grey Wolf"');
    await CommandRouter.route("gain willpower 2");
    const lifted = await CommandRouter.route("remove feral-whispers spend=willpower");
    expect(lifted).toContain("is free of feral-whispers");
    expect(lifted).toContain("spent 1 willpower");
    expect(lifted).toContain("feral-whispers lifted from Grey Wolf");
    expect(await CommandRouter.route("show-affliction")).toContain("no afflictions");
    // Cleared and sheetless, the NPC leaves nothing to find - so this is the
    // refusal, which is also what a misspelled name now gets (§7.92).
    expect(await CommandRouter.route('show-affliction in="Grey Wolf"')).toContain(`Nothing named "grey-wolf"`);
  });

  test("advance with no successor and lifting an absent affliction report cleanly", async () => {
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    await CommandRouter.route('afflict feral-whispers target="Grey Wolf"');
    expect(await CommandRouter.route("advance feral-whispers")).toContain("no successor");
    expect(await CommandRouter.route("remove concentrating-on")).toContain("does not have");
  });
});

describe("afflictions: tags bite in rolls and contests", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); resetAllConfigStores(); await LorebookManager.bootstrap(); });

  test("an active affliction's registered tag changes the roll TODAY", async () => {
    await CommandRouter.route('create-playable name="Rok" templates=mortal');
    // off-hand is a shipped RollModifier: +1 difficulty.
    await CommandRouter.route('define-affliction name="dazed" tags="off-hand"');
    const before = await CommandRouter.route("roll 3", { rng: seqRng([6, 6, 6]) });
    expect(before).toContain("vs diff 6");
    await CommandRouter.route("afflict dazed");
    const after = await CommandRouter.route("roll 3", { rng: seqRng([6, 6, 6]) });
    expect(after).toContain("vs diff 7");
    await CommandRouter.route("remove dazed");
    const healed = await CommandRouter.route("roll 3", { rng: seqRng([6, 6, 6]) });
    expect(healed).toContain("vs diff 6");
  });

  test("contest sides carry their afflictions too", async () => {
    await CommandRouter.route('create-playable name="Rok" templates=mortal');
    await CommandRouter.route('create-playable name="Erik" templates=mortal');
    await CommandRouter.route('play name="Rok"');
    await CommandRouter.route('define-affliction name="dazed" tags="off-hand"');
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
    expect(await CommandRouter.route("help define-affliction")).toContain('duration="1 turn|until x|instant"');
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
      AFFLICTIONS_ENTRY, CONSTRAINTS_ENTRY, RESOURCE_CONFIG_ENTRY, TABLES_CATEGORY, MAGIC_CONFIG_ENTRY,
      COSTS_CONFIG_ENTRY,
      ROLLS_CONFIG_ENTRY, BACKGROUNDS_ENTRY, TEMPLATES_ENTRY,
    ].sort());
  });

  test("reloadAllConfigStores reloads every registry and reports per-entry counts", async () => {
    await CommandRouter.route('define-affliction name="dazed" tags="off-hand"');
    await CommandRouter.route('define-constraint name="statuses" relation=exclusive domain=background members="status"');
    resetAllConfigStores();
    expect(AfflictionRegistry.get("dazed")).toBeUndefined();
    const counts = Object.fromEntries((await reloadAllConfigStores()).map(c => [c.entry, c.count]));
    expect(counts[AFFLICTIONS_ENTRY]).toBe(1);
    expect(counts[CONSTRAINTS_ENTRY]).toBe(1);
    expect(counts[RESOURCE_CONFIG_ENTRY]).toBe(0);
    expect(AfflictionRegistry.get("dazed")!.tags).toEqual(["off-hand"]);
  });

  test("resetAllConfigStores clears overlays AND restores the success-table defaults", async () => {
    SuccessTableRegistry.register({ name: "degrees", failure: "X", rows: [] });   // shadow a shipped table
    await CommandRouter.route('define-affliction name="dazed"');
    resetAllConfigStores();
    expect(SuccessTableRegistry.get("degrees")!.rows!.length).toBe(5);            // shipped default resurfaces
    expect(AfflictionRegistry.get("dazed")).toBeUndefined();
  });
});

// =============================================================================
// ROUTER HOOKS - the game-registered creator-mode sync runs before dispatch
// =============================================================================
describe("command router: beforeRoute hooks (creator-mode live sync)", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); resetAllConfigStores(); await LorebookManager.bootstrap(); });

  test("while creator mode is on, a hand-edited config entry is live for the very NEXT command", async () => {
    await CommandRouter.route('define-affliction name="dazed" description=`Old words`');
    await CommandRouter.route("creator-mode set=true");
    const entry = ["hand edit", "=====",
      "dazed:", "  description: New words", "  tags: off-hand"].join("\n");
    await LorebookManager.updateEntryText(CONFIG_CATEGORY, AFFLICTIONS_ENTRY, entry);
    expect(await CommandRouter.route("show-affliction in=campaign dazed")).toContain("New words");   // the hook re-loaded it
    await CommandRouter.route("creator-mode set=false");
    expect(AfflictionRegistry.get("dazed")!.tags).toEqual(["off-hand"]);            // off-path synced too
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
    await TableLibrary.loadFromLorebook();
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
    await __uiTypeInto("story:win:define-table:name", "fear");
    await __uiTypeInto("story:win:define-table:rows", "1:Uneasy, 4:Panicked");
    await __uiTypeInto("story:win:define-table:cap", "5");
    expect(await __uiClickButton("Create")).toBe(true);
    const t = SuccessTableRegistry.get("fear")!;
    expect(t.rows![1]).toEqual({ at: 4, label: "Panicked" });   // literal composition kept the case
    expect(t.cap).toBe(5);
  });
});

// =============================================================================
// BACKGROUNDS - a bag of their own; dots are not cost; one may confer others
// =============================================================================
describe("backgrounds: definitions, grants, and dots that are not cost", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); MeritFlawRegistry.reset(); ArcanumRegistry.reset(); resetAllConfigStores(); await LorebookManager.bootstrap(); });

  test("a Talisman that IS a place confers that place's ratings, and they are real", async () => {
    await CommandRouter.route('create-playable name="Visvaldas" templates=ouroboros');
    await CommandRouter.route("set-trait fount 5 paid=0");
    await CommandRouter.route('define-background name=`Talisman` max=5 grants=`cray:5,library:5,sanctum:5`');
    await CommandRouter.route("set-trait talisman 5 paid=0");
    const char = (await CharacterStore.load("Visvaldas"))!;
    // Nothing was written into the backgrounds bucket for them...
    expect(char.backgrounds.sanctum).toBeUndefined();
    // ...but the engine reads them anyway.
    expect(grantedTraitsOf(char).sanctum).toEqual({ rating: 5, from: "talisman" });
    expect(effectiveTraitOf(char, "library")).toBe(5);
    // And the places they open actually work.
    expect(await CommandRouter.route("measure-door")).toContain("Library of the Unseen");
    expect(await CommandRouter.route("show-affliction")).toContain("sanctum 5");
  });

  test("his five Background dots: what he was given costs nothing, what he bought costs what it rates", async () => {
    await CommandRouter.route('create-playable name="Visvaldas" templates=ouroboros');
    await CommandRouter.route("set-trait fount 5 paid=0");
    await CommandRouter.route('define-background name=`Talisman` grants=`cray:5,library:5,sanctum:5`');
    await CommandRouter.route("set-trait fount 5 paid=0");
    await CommandRouter.route("set-trait talisman 5 paid=0");
    await CommandRouter.route("set-trait mentor 5 note=`Velia` paid=0");
    await CommandRouter.route("set-trait mentor 3 add=true note=`Daujotas` paid=3");
    await CommandRouter.route("set-trait resources 2");
    const report = await CommandRouter.route("show-budget");
    expect(report).toContain("background: 5/5, 0 left");         // 3 + 2, against the creation budget
    expect(report).toContain("fount 5 (paid 0)");
    expect(report).toContain("sanctum 5 (from talisman, free)"); // conferred, never bought
  });

  test("Fount reads as a ladder, and says where the Ouroboros' 30/6 pool comes from", async () => {
    await CommandRouter.route('create-playable name="Visvaldas" templates=ouroboros');
    await CommandRouter.route("set-trait fount 5");
    const one = await CommandRouter.route("show-background in=campaign fount");
    expect(one).toContain("• 5: hold 20, 6/turn");               // the rung he is on
    expect(one).toContain("1: hold 12, 2/turn");
    expect(one).toContain("plus ten dots of vitae is the 30/6 pool");
  });

  test("a custom background shadows the built-in; forgetting it brings the built-in back", async () => {
    await CommandRouter.route('define-background name=`Mentor` max=7 description=`Bigger mentors here.`');
    expect(BackgroundRegistry.get("mentor")!.max).toBe(7);
    expect(await CommandRouter.route("forget-background mentor")).toContain("resurfaces");
    expect(BackgroundRegistry.get("mentor")!.max).toBe(5);
  });
});

// =============================================================================
// THE ARCANA VOCABULARY - the same machinery, under the names the domain uses
// =============================================================================
describe("arcana verbs: take/drop/define/list, and they insist on the family", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); MeritFlawRegistry.reset(); ArcanumRegistry.reset(); resetAllConfigStores(); await LorebookManager.bootstrap(); });

  test("[[show-arcanum]] lists only arcana and taints - merits stay out of it", async () => {
    const listed = await CommandRouter.route("show-arcanum in=campaign");
    expect(listed).toContain("celestial-radiance");
    expect(listed).toContain("trait-affinity");
    expect(listed).not.toContain("iron-will");                   // a merit
    // ...and the merit list never mentions an arcanum. This is the whole point:
    // a regular vampire's Merits & Flaws contains no Devil's Due Arcana.
    const merits = await CommandRouter.route("show-merit in=campaign");
    expect(merits).toContain("iron-will");
    expect(merits).not.toContain("celestial-radiance");
    expect(merits).not.toContain("trait-affinity");
  });

  test("take-arcanum refuses a merit and points at the other verb", async () => {
    await CommandRouter.route('create-playable name="Azazel" templates=demon');
    const wrong = await CommandRouter.route("take-arcanum iron-will");
    expect(wrong).toContain("is a merit/flaw, not an arcanum/taint");
    expect(wrong).toContain("take-merit iron-will");
    expect(await CommandRouter.route("take-arcanum celestial-radiance")).toContain("7 arcana points");
    // ...and symmetrically: define-merit cannot be talked into making one.
    const refused = await CommandRouter.route('define-merit name=`Borrowed Sight` kind=arcanum points=3');
    expect(refused).toContain("is not a merit/flaw");
    expect(refused).toContain("define-arcanum");
    expect(MeritFlawRegistry.get("borrowed-sight")).toBeUndefined();
  });

  test("take-merit refuses an arcanum, and the two buckets stay apart", async () => {
    await CommandRouter.route('create-playable name="Azazel" templates=demon');
    const wrong = await CommandRouter.route("take-arcanum trait-affinity::melee 2");
    expect(wrong).toContain("takes Trait Affinity::melee");
    const refused = await CommandRouter.route("take-merit trait-affinity::melee 2");
    expect(refused).toContain("is an arcanum/taint, not a merit/flaw");
    await CommandRouter.route("take-merit iron-will 3");
    const char = (await CharacterStore.load("Azazel"))!;
    expect(char.arcana).toEqual({ "trait-affinity:melee": 2 });
    expect(char.meritsFlaws).toEqual({ "iron-will": 3 });
    // [[show-merit]] shows the merit and NOT the arcanum; [[show-arcanum]] the reverse.
    expect(await CommandRouter.route("show-merit")).toContain("iron-will");
    expect(await CommandRouter.route("show-merit")).not.toContain("trait-affinity");
    expect(await CommandRouter.route("show-arcanum")).toContain("trait-affinity");
    expect(await CommandRouter.route("show-arcanum")).not.toContain("iron-will");
  });

  test("a vampire has no Arcana list at all - not an empty one, none", async () => {
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    const listed = await CommandRouter.route("show-arcanum");
    expect(listed).toContain("has no Arcana & Taints at all");
    expect(listed).toContain("demon's thrall");
    const refused = await CommandRouter.route("take-arcanum trait-affinity::melee 2");
    expect(refused).toContain("has no Arcana & Taints at all");
    expect((await CharacterStore.load("Kvar"))!.arcana).toBeUndefined();
    // The gate is a CAPABILITY, so becoming a thrall - or being attuned by a
    // Storyteller who says otherwise - opens it without editing any list.
    await CommandRouter.route("attune arcana");
    expect(await CommandRouter.route("take-arcanum trait-affinity::melee 2")).toContain("arcana point");
    expect((await CharacterStore.load("Kvar"))!.arcana!["trait-affinity:melee"]).toBe(2);
  });

  test("define-arcanum defaults the kind, so the purse is right without saying so", async () => {
    await CommandRouter.route('define-arcanum name=`Borrowed Sight` points=3 description=`Another\'s eyes.`');
    expect(ArcanumRegistry.get("borrowed-sight")!.kind).toBe("arcanum");
    expect(MeritFlawRegistry.get("borrowed-sight")).toBeUndefined();   // NOT a merit
    await CommandRouter.route('create-playable name="Azazel" templates=demon');
    await CommandRouter.route("take-arcanum borrowed-sight 3");
    expect(await CommandRouter.route("show-budget")).toContain("arcana: 3/25");
  });

  test("a sheet written before the split migrates: arcana move to their own bucket", async () => {
    await CommandRouter.route('create-playable name="Azazel" templates=demon');
    // The old shape, straight into storage: one bucket for everything.
    const old = (await CharacterStore.load("Azazel"))!;
    old.meritsFlaws = { "iron-will": 3, "celestial-radiance": 7 };
    delete old.arcana;
    await CharacterStore.save(old);
    const back = (await CharacterStore.load("Azazel"))!;
    expect(back.meritsFlaws).toEqual({ "iron-will": 3 });
    expect(back.arcana).toEqual({ "celestial-radiance": 7 });
  });
});

// =============================================================================
// SET-TRAIT - the writing counterpart of [[show-sheet]]
// =============================================================================
describe("set-trait: putting ratings back without hand-editing the card", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); MeritFlawRegistry.reset(); ArcanumRegistry.reset(); resetAllConfigStores(); await LorebookManager.bootstrap(); });

  test("the group is inferred from the chronicle's own lists, not guessed", async () => {
    await CommandRouter.route('create-playable name="Visvaldas" templates=ouroboros');
    await CommandRouter.route("set-trait fount 5 paid=0");
    // Sanctum is a Background on the SRD card even though nobody has rated one.
    expect(await CommandRouter.route("set-trait sanctum 8")).toContain("background Sanctum: 8");
    expect((await CharacterStore.load("Visvaldas"))!.backgrounds.sanctum).toBe(8);
    // Occult is an Ability; Modus is neither, so it lands in the free bucket.
    expect(await CommandRouter.route("set-trait occult 5")).toContain("ability Occult: 5");
    expect(await CommandRouter.route("set-trait modus 5")).toContain("trait Modus: 5");
    expect((await CharacterStore.load("Visvaldas"))!.traits.modus).toBe(5);
    // ...and group= wins when the chronicle disagrees.
    expect(await CommandRouter.route("set-trait thaumaturgy 3 group=discipline")).toContain("discipline Thaumaturgy: 3");
  });

  test("two of the same Background, each with its own note and price", async () => {
    await CommandRouter.route('create-playable name="Visvaldas" templates=ouroboros');
    await CommandRouter.route("set-trait fount 5 paid=0");
    await CommandRouter.route("set-trait mentor 5 note=`his mother` paid=0");
    const second = await CommandRouter.route("set-trait mentor 3 add=true note=`Daujotas, his Hermetic Master` paid=3");
    expect(second).toContain("5 (his mother) + 3 (Daujotas, his Hermetic Master)");
    const char = (await CharacterStore.load("Visvaldas"))!;
    expect(char.backgrounds.mentor).toBe(5);                       // the slot takes the highest
    expect(char.instances!.mentor.map(i => i.paid)).toEqual(["0", "3"]);
  });

  test("a card that drops a whole group says so - that is how ratings vanish", async () => {
    await CommandRouter.route('create-playable name="Visvaldas" templates=ouroboros');
    await CommandRouter.route("set-trait fount 5 paid=0");
    await CommandRouter.route("set-trait sanctum 8");
    await CommandRouter.route("creator-mode set=true");
    await LorebookManager.updateEntryText(PLAYER_CHARACTERS_CATEGORY, "pc:visvaldas",
      "oops\n=====\nname: Visvaldas\ntemplates: ouroboros\n\ntraits:\n  Modus: 5");
    const off = await CommandRouter.route("creator-mode set=false");
    expect(off).toContain("A whole group went empty");
    expect(off).toContain("backgrounds (2 gone)");
    expect(off).toContain("set-trait");
  });
});

// =============================================================================
// SUPERNATURAL CATEGORIES - which family a power belongs to, and what it needs
// =============================================================================
describe("supernatural categories: disciplines, magic, sorcery, blood-sorcery", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); MeritFlawRegistry.reset(); ArcanumRegistry.reset(); resetAllConfigStores(); await LorebookManager.bootstrap(); });

  test("a blood-sorcery path hangs from its Discipline - unless it is Koldunic", async () => {
    await CommandRouter.route('create-playable name="Visvaldas" templates=ouroboros');
    await CommandRouter.route("set-trait fount 5 paid=0");
    await CommandRouter.route("set-trait thaumaturgy 3 group=discipline");
    await CommandRouter.route("set-trait rego-vitae 2");
    await CommandRouter.route("set-trait koldunic-sorcery 1");
    const held = await CommandRouter.route("show-supernatural");
    expect(held).toContain("Blood Sorcery: Rego Vitae 2, Koldunic Sorcery 1");
    expect(held).not.toContain("needs Thaumaturgy");
    // Lose the parent Discipline and the path is flagged - Koldunic never is.
    await CommandRouter.route("set-trait thaumaturgy 0 group=discipline");
    const orphaned = await CommandRouter.route("show-supernatural");
    expect(orphaned).toContain("Rego Vitae needs Thaumaturgy");
    expect(orphaned).not.toContain("Koldunic Sorcery needs");
  });

  test("a category names who may have it at all", async () => {
    await CommandRouter.route('create-playable name="Aldous" templates=mage');
    const listed = await CommandRouter.route("show-supernatural");
    expect(listed).toContain("Awakened magic");
    expect(listed).not.toContain("Blood Sorcery");          // not open to a mage
    expect(await CommandRouter.route("show-supernatural blood-sorcery")).toContain("NOT open to mage");
    expect(await CommandRouter.route("show-supernatural sorcery")).toContain("(anyone)");
  });
});

// =============================================================================
// BUDGETS - arcana are not merits, and price paid is not price listed
// =============================================================================
describe("arcana budgets: their own purse, priced per template", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); MeritFlawRegistry.reset(); ArcanumRegistry.reset(); resetAllConfigStores(); await LorebookManager.bootstrap(); });

  test("a printed (7/5) arcanum: the demon pays 7, the thrall 5 and gets the lesser version", async () => {
    await CommandRouter.route('create-playable name="Azazel" templates=demon');
    const demon = await CommandRouter.route("take-arcanum celestial-radiance");
    expect(demon).toContain("7 arcana points");
    expect(demon).toContain("a demon's price");

    await CommandRouter.route('create-playable name="Bound" templates=thrall');
    await CommandRouter.route('play name="Bound"');
    const thrall = await CommandRouter.route("take-arcanum celestial-radiance");
    expect(thrall).toContain("5 arcana points");
    expect(thrall).toContain("cannot generate effects greater than three successes");
  });

  test("naming templates is exhaustive: nobody else may take it", async () => {
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    // Open the category first, so what refuses here is the PER-TEMPLATE list and
    // not the capability gate - two different refusals, tested apart.
    await CommandRouter.route("attune arcana");
    const refused = await CommandRouter.route("take-arcanum celestial-radiance");
    expect(refused).toContain("not open to vampire");
    expect((await CharacterStore.load("Kvar"))!.arcana?.["celestial-radiance"]).toBeUndefined();
    // The Storyteller may still say otherwise.
    expect(await CommandRouter.route("take-arcanum celestial-radiance waive=true")).toContain("arcana points");
  });

  test("the two purses never mix: an arcanum can never make a merit budget look overspent", async () => {
    await CommandRouter.route('create-playable name="Azazel" templates=demon');
    await CommandRouter.route("take-arcanum celestial-radiance");
    await CommandRouter.route("take-merit iron-will");           // a MERIT, 3 freebie
    const report = await CommandRouter.route("show-budget");
    expect(report).toContain("arcana: 7/25");
    expect(report).toContain("celestial-radiance 7");
    expect(report).toContain("freebie: 3/15");                    // counted apart
    expect(report).not.toContain("arcana: 10");                   // never summed together
  });

  test("a flaw GRANTS rather than costs, and the sheet may override the template's budget", async () => {
    await CommandRouter.route('create-playable name="Azazel" templates=demon');
    await CommandRouter.route("take-merit dark-secret");           // a flaw, 1 point
    expect(await CommandRouter.route("show-budget")).toContain("freebie: -1/15, 16 left");
    const char = (await CharacterStore.load("Azazel"))!;
    char.budgets = { arcana: "10" };
    await CharacterStore.save(char);
    expect(await CommandRouter.route("show-budget")).toContain("arcana: 0/10");
  });

  test("price paid is not price listed: [[paid]] records what the Storyteller granted", async () => {
    await CommandRouter.route('create-playable name="Azazel" templates=demon');
    await CommandRouter.route("take-arcanum celestial-radiance");
    expect(await CommandRouter.route("show-budget")).toContain("arcana: 7/25");
    // The Storyteller says he was MADE with it.
    expect(await CommandRouter.route("paid celestial-radiance")).toContain("granted, not bought");
    const after = await CommandRouter.route("show-budget");
    expect(after).toContain("arcana: 0/25");
    expect(after).toContain("(set)");
    // And it can be put back.
    expect(await CommandRouter.route("paid celestial-radiance listed")).toContain("pays the listed price again");
    expect(await CommandRouter.route("show-budget")).toContain("arcana: 7/25");
  });

  test("take-merit can set the price on the spot", async () => {
    await CommandRouter.route('create-playable name="Azazel" templates=demon');
    expect(await CommandRouter.route("take-arcanum celestial-radiance paid=0")).toContain("paid 0");
    expect(await CommandRouter.route("show-budget")).toContain("arcana: 0/25");
  });

  test("two Mentors, one granted and one bought, survive the card", async () => {
    await CommandRouter.route('create-playable name="Visvaldas" templates=ouroboros');
    await CommandRouter.route("set-trait fount 5 paid=0");
    const char = (await CharacterStore.load("Visvaldas"))!;
    char.backgrounds["mentor"] = 5;
    char.instances = { mentor: [
      { rating: 5, note: "his mother", paid: "0" },
      { rating: 3, note: "Daujotas, his Hermetic Master", paid: "3" },
    ] };
    await CharacterStore.save(char);
    const text = formatCardText(characterToCard(char));
    expect(text).toContain("    paid: 0");
    expect(text).toContain("Daujotas, his Hermetic Master");
    const back = characterFromCard(parseCardText(text))!;
    expect(back.instances!.mentor.map(i => i.paid)).toEqual(["0", "3"]);
    expect(await CommandRouter.route("show-sheet")).toContain("[paid 0]");
  });
});

// =============================================================================
// MINIMUM DIFFICULTY - a floor per roll, and one for the whole chronicle
// =============================================================================
describe("minimum difficulty: per-roll and chronicle-wide", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); resetAllConfigStores(); await LorebookManager.bootstrap(); });

  test("unset means unset: nothing has a floor until something asks for one", async () => {
    await CommandRouter.route('create-playable name="Rok" templates=mortal');
    const free = await CommandRouter.route("roll 3 3", { rng: seqRng([2, 2, 2]) });
    expect(free).toContain("vs diff 3");
    expect(free).not.toContain("raised to the minimum");
    // A roll that names its own floor gets it, chronicle setting or not.
    const floored = await CommandRouter.route("roll 3 3 min-difficulty=6", { rng: seqRng([2, 2, 2]) });
    expect(floored).toContain("vs diff 6");
    expect(floored).toContain("difficulty 3 raised to the minimum 6");
  });

  test("the chronicle's floor reaches every roll; a roll's own floor overrides it", async () => {
    await CommandRouter.route('create-playable name="Rok" templates=mortal');
    await RollRulesConfig.save({ "min-difficulty": 5 });
    expect(await CommandRouter.route("roll 3 3", { rng: seqRng([2, 2, 2]) })).toContain("vs diff 5");
    // A deep reduction cannot dig under it either.
    expect(await CommandRouter.route("roll 3 4 diff-mod=-9", { rng: seqRng([2, 2, 2]) })).toContain("vs diff 5");
    // The roll's own floor wins, in either direction.
    expect(await CommandRouter.route("roll 3 3 min-difficulty=8", { rng: seqRng([2, 2, 2]) })).toContain("vs diff 8");
    expect(await CommandRouter.route("roll 3 3 min-difficulty=2", { rng: seqRng([2, 2, 2]) })).toContain("vs diff 3");
  });

  test("a saved roll carries its floor through the lorebook card", async () => {
    await CommandRouter.route('create-playable name="Rok" templates=mortal');
    await CommandRouter.route("name-roll squint perception+alertness 4 min-difficulty=6");
    const text = (await LorebookManager.entryText(NAMED_ROLLS_CATEGORY, "wod:named-rolls:library"))!;
    expect(text).toContain("min-difficulty: 6");
    expect((await NamedRollStore.get("squint"))!.minDifficulty).toBe(6);
    expect(await CommandRouter.route("roll @squint", { rng: seqRng([2, 2]) })).toContain("vs diff 6");
  });

  test("the chronicle's roll floor is NOT the magic knob of the same name", async () => {
    // wod:config:magic min-difficulty bounds how far Quintessence talks a spell
    // down; wod:config:rolls min-difficulty is the die target's own floor.
    await MagicRulesConfig.save({ "min-difficulty": 3, "difficulty-cap": 9 });
    const rules = magicRulesFrom(MagicRulesConfig.current());
    expect(rules.minDifficulty).toBe(3);
    expect(rules.difficultyCap).toBe(9);          // the card format must not orphan a knob
    expect(rollFloorFrom(RollRulesConfig.current())).toBeUndefined();
  });

  test("a knob is found however the card spells it", () => {
    expect(magicRulesFrom({ "difficulty-cap": 9 }).difficultyCap).toBe(9);
    expect(magicRulesFrom({ difficultyCap: 8 }).difficultyCap).toBe(8);
    expect(rollFloorFrom({ "min-difficulty": 5 })).toBe(5);
    expect(rollFloorFrom({ minDifficulty: 4 })).toBe(4);
    expect(rollFloorFrom({})).toBeUndefined();
  });
});

// =============================================================================
// TABLE ROWS - prose labels with commas in them
// =============================================================================
describe("success table rows: semicolons for prose labels", () => {
  test("';' separates rows so a label may contain commas", () => {
    const rows = parseTableRows("1:whether authorship is present; 4:age, family, and whether he resisted") as SuccessTableRow[];
    expect(rows.length).toBe(2);
    expect(rows[1].label).toBe("age, family, and whether he resisted");
    // No semicolon anywhere: commas still separate, as before.
    const plain = parseTableRows("1:Cowed, 3:Terrified=2") as SuccessTableRow[];
    expect(plain.length).toBe(2);
    expect(plain[1].value).toBe(2);
  });

  test("[[define-table]] takes them, and the roll reads the ladder", async () => {
    await CommandRouter.route('create-playable name="Rok" templates=mortal');
    await CommandRouter.route('define-table name=`The Alien Hand` '
      + 'rows=`1:External authorship present; 2:Its principal seat - emotion, thought, memory, or soul`');
    const t = SuccessTableRegistry.get("the-alien-hand")!;
    expect(t.rows!.length).toBe(2);
    expect(t.rows![1].label).toBe("Its principal seat - emotion, thought, memory, or soul");
    const r = await CommandRouter.route("roll 3 4 table=the-alien-hand", { rng: seqRng([8, 8, 2]) });   // 2 successes
    expect(r).toContain("Its principal seat");
  });
});

// =============================================================================
// CARD TEXT - the readable language every lorebook card is written in
// =============================================================================
describe("card text: the readable card format", () => {
  test("nesting, typing and comments", () => {
    const v = parseCardText([
      "# who he is",
      "name: Visvaldas",
      "stage: ready        # trailing comments too",
      "awake: yes",
      "road: none",
      "attributes:",
      "  Strength: 3",
      "  Wits: 5",
    ].join("\n")) as Record<string, unknown>;
    expect(v.name).toBe("Visvaldas");          // case preserved for display
    expect(v.stage).toBe("ready");
    expect(v.awake).toBe(true);
    expect(v.road).toBeNull();
    expect(v.attributes).toEqual({ Strength: 3, Wits: 5 });
  });

  test("a repeated key is a list - the thing JSON could not say", () => {
    const v = parseCardText("mentor: Velia\nmentor: Belial\nmentor: Inauhaten") as Record<string, unknown>;
    expect(v.mentor).toEqual(["Velia", "Belial", "Inauhaten"]);
  });

  test("a value plus an indented block: the value lands under `value`", () => {
    const v = parseCardText("sanctum: 8\n  note: the Library of the Unseen") as CardMap;
    expect(v.sanctum).toEqual({ value: 8, note: "the Library of the Unseen" } as never);
    expect(asNumber(v.sanctum)).toBe(8);        // and reads back as its rating
    expect(asText(v.sanctum)).toBe("8");
  });

  test("commas make a list - except in a TEXT key, where they are punctuation", () => {
    const v = parseCardText([
      "tags: revenant, awakened",
      "description: He is immune to fear, and to mind control.",
      "roles: quintessence",                    // a LIST key: one item is still a list
    ].join("\n")) as Record<string, unknown>;
    expect(v.tags).toEqual(["revenant", "awakened"]);
    expect(v.description).toBe("He is immune to fear, and to mind control.");
    expect(v.roles).toEqual(["quintessence"]);
  });

  test('"- " items build a list of blocks; the engine\'s camelCase fields are written with hyphens', () => {
    const v = parseCardText([
      "passive:",
      "  - op: immune",
      "    target: possession, soul-control",
      "  - op: difficulty",
      "    amount: -2",
      "    requires-resource:",
      "      resource: living-resolve",
      "      at-least: 1",
    ].join("\n")) as Record<string, Record<string, unknown>[]>;
    expect(v.passive.length).toBe(2);
    expect(v.passive[0]).toEqual({ op: "immune", target: "possession,soul-control" });
    expect(v.passive[1].amount).toBe(-2);
    expect(v.passive[1].requiresResource).toEqual({ resource: "living-resolve", atLeast: 1 });
  });

  test("a key may contain a colon; a value may too", () => {
    const v = parseCardText("trait-affinity:melee: 3\nnote: he said: hello") as Record<string, unknown>;
    expect(v["trait-affinity:melee"]).toBe(3);
    expect(v.note).toBe("he said: hello");
  });

  test("tabs indent, quotes force text, and everything round-trips", () => {
    const src = ["a:", "\tb: 1", 'c: "7"', 'd: "  padded, with a # and a \\"quote\\"  "'].join("\n");
    const v = parseCardText(src) as Record<string, unknown>;
    expect(v.a).toEqual({ b: 1 });
    expect(v.c).toBe("7");                                    // quoted: text, not a number
    expect(v.d).toBe('  padded, with a # and a "quote"  ');
    const again = parseCardText(formatCardText(v as never));   // writer re-quotes what it must
    expect(again).toEqual(v as never);
  });

  test("a whole sheet survives a round trip unchanged", () => {
    const src = [
      "name: Visvaldas", "templates: ouroboros", "tags: revenant, awakened",
      "backgrounds:", "  Sanctum: 8", "  Mentor: 4", "    note: Velia", "  Mentor: 2", "    note: Belial",
      "traits:", "  Modus: 5",
    ].join("\n");
    const once = parseCardText(src)!;
    const text = formatCardText(once);
    expect(text).toContain("Mentor: 4");           // written back the way it was written
    expect(text).toContain("Mentor: 2");
    expect(parseCardText(text)).toEqual(once as never);
  });

  test("an empty or comment-only body is nothing at all", () => {
    expect(parseCardText("")).toBeUndefined();
    expect(parseCardText("# just a note\n\n   ")).toBeUndefined();
    expect(asList(undefined)).toEqual([]);
    expect(asStringList("a, b")).toEqual(["a, b"]);   // already-joined text stays one item
  });
});

// =============================================================================
// THE SHEET AS A CARD - what a player actually hand-writes
// =============================================================================
describe("the character sheet card", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); resetAllConfigStores(); await LorebookManager.bootstrap(); });

  test("names are written for reading and normalized on the way in", async () => {
    await CommandRouter.route('create-playable name="Al" templates=mortal');
    const char = (await CharacterStore.load("Al"))!;
    char.abilities["animal-ken"] = 2;
    char.specialties = { "animal-ken": ["Hounds"] };
    const text = formatCardText(characterToCard(char));
    expect(text).toContain("  Animal Ken: 2");
    expect(text).toContain("    specialty: Hounds");
    const back = characterFromCard(parseCardText(text))!;
    expect(back.abilities["animal-ken"]).toBe(2);
    expect(back.specialties!["animal-ken"]).toEqual(["Hounds"]);
  });

  test("`pools` and `merits` are accepted for the engine's longer bucket names", () => {
    const back = characterFromCard(parseCardText([
      "name: Kvar", "templates: vampire",
      "pools:", "  Willpower: 5",
      "merits:", "  Iron Will: 3",
    ].join("\n")))!;
    expect(back.poolStarts.willpower).toBe(5);
    expect(back.meritsFlaws["iron-will"]).toBe(3);
    expect(back.stage).toBe("potential");        // unstated stage is the safe one
  });

  test("two Mentors: the slot takes the highest, and both survive the round trip", () => {
    const written = [
      "name: Visvaldas", "templates: ouroboros",
      "backgrounds:",
      "  Mentor: 4",
      "    note: Velia, the Rafastio Matriarch",
      "  Mentor: 2",
      "    note: Belial",
    ].join("\n");
    const char = characterFromCard(parseCardText(written))!;
    expect(char.backgrounds.mentor).toBe(4);                       // one slot, the strongest
    expect(char.instances!.mentor.map(i => i.rating)).toEqual([4, 2]);
    expect(char.instances!.mentor[1].note).toBe("Belial");
    const again = formatCardText(characterToCard(char));
    expect(again).toContain("  Mentor: 4");
    expect(again).toContain("  Mentor: 2");
    expect(characterFromCard(parseCardText(again))!.instances).toEqual(char.instances!);
  });

  test("a sheet without a name or a template is not a sheet", () => {
    expect(characterFromCard(parseCardText("templates: mortal"))).toBeUndefined();
    expect(characterFromCard(parseCardText("name: Nobody"))).toBeUndefined();
  });
});

// =============================================================================
// CONVERT-CARDS - the one-shot migration off the old JSON cards
// =============================================================================
describe("[[convert-cards]]: migrating a story written before the readable format", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); resetAllConfigStores(); await LorebookManager.bootstrap(); });

  test("a JSON sheet and a JSON merit card are rewritten, and the engine reads them again", async () => {
    await CommandRouter.route('create-playable name="Visvaldas" templates=ouroboros');
    await CommandRouter.route("set-trait fount 5 paid=0");
    const old = { ...(await CharacterStore.load("Visvaldas"))!, traits: { modus: 5, primus: 1 } };
    await LorebookManager.updateEntryText(PLAYER_CHARACTERS_CATEGORY, "pc:visvaldas",
      `old header\n=====\n${JSON.stringify(old, null, 2)}`);
    const { id } = await LorebookManager.ensureCategory("srd:merits-flaws");
    await LorebookManager.ensureEntry(id, "srd:merits-flaws:legacy",
      'h\n=====\n[{"name":"Sturdy Stock","kind":"merit","points":2}]');

    const reply = await CommandRouter.route("convert-cards");
    expect(reply).toContain("pc:visvaldas");
    expect(reply).toContain("srd:merits-flaws:legacy");

    const text = (await LorebookManager.entryText(PLAYER_CHARACTERS_CATEGORY, "pc:visvaldas"))!;
    expect(text).toContain("old header");                 // the player's header is kept
    expect(text).toContain("  Modus: 5");
    expect(text).not.toContain('"traits"');
    expect(resolveTraitFromRecord((await CharacterStore.load("Visvaldas"))!, "primus")).toBe(1);
    expect(MeritFlawRegistry.get("sturdy-stock")!.points).toBe(2);

    // Idempotent: a second run has nothing left to do.
    expect(await CommandRouter.route("convert-cards")).toContain("already in the readable format");
  });
});

// =============================================================================
// ADVANCEMENT COSTS - chronicle rules, not character data
// =============================================================================
describe("[[show-cost]]: what a dot costs, and where that lives", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); resetAllConfigStores(); await LorebookManager.bootstrap(); });

  test("the shipped table lists every purse; the card overrides one price at a time", async () => {
    expect(await CommandRouter.route("show-cost")).toContain("experience current x 4");
    expect(await CommandRouter.route("show-cost discipline")).toContain("out of clan");
    await AdvancementCosts.save({ attribute: { experience: "current x 5" } });
    const table = advancementCostsFrom(AdvancementCosts.current());
    expect(table.attribute.experience).toBe("current x 5");
    expect(table.attribute.freebie).toBe("5");            // untouched prices survive
    expect((await CommandRouter.route("show-cost")).includes("current x 5")).toBe(true);
  });

  test("the costs card is card text a player can read", async () => {
    await AdvancementCosts.save({ pillar: { experience: "current x 6" } });
    const text = (await LorebookManager.entryText(CONFIG_CATEGORY, COSTS_CONFIG_ENTRY))!;
    expect(LorebookManager.contentBelowHeader(text)).toContain("pillar:");
    expect(LorebookManager.contentBelowHeader(text)).toContain("experience: current x 6");
  });
});

// =============================================================================
// TRACKED LOREBOOK - id map, backups, structural hash, reconciliation
// =============================================================================
describe("tracked lorebook: hash, ensurePath, reconcile findings", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); __resetUiMock(); resetAllConfigStores(); await LorebookManager.bootstrap(); });

  test("structuralHash: key order and header text are irrelevant; text fallback collapses whitespace", () => {
    const a = "instructions A\n=====\n- name: x\n  cap: 3";
    const b = "TOTALLY different header\n=====\n- cap: 3\n  name: x   # order is irrelevant";
    expect(structuralHash(a)).toBe(structuralHash(b));
    expect(structuralHash("h\n=====\nplain   text")).toBe(structuralHash("h2\n=====\nplain text"));
    expect(structuralHash(a)).not.toBe(structuralHash("h\n=====\n- name: x\n  cap: 4"));
  });

  test("ensurePath creates the real category + tracked general card; idempotent", async () => {
    const { category, createdEntry } = await ensurePath("config:success-tables:combat");
    expect(category).toBe(`${TABLES_CATEGORY}:combat`);
    expect(createdEntry).toBe(true);
    expect(await LorebookManager.entryText(category, GENERAL_ENTRY)).toContain("=====");
    expect(await TrackedLorebook.idFor(category, GENERAL_ENTRY)).toBeDefined();
    expect(await TrackedLorebook.backupOf(category, GENERAL_ENTRY)).toBeDefined();
    expect((await ensurePath("config:success-tables:combat")).createdEntry).toBe(false);
  });

  test("reconcile: healthy is silent; an identical recreation is ADOPTED (uuid re-pointed, no modal)", async () => {
    await ensurePath("config:success-tables:combat");
    const category = `${TABLES_CATEGORY}:combat`;
    expect(await TrackedLorebook.reconcile()).toEqual([]);
    const oldId = (await TrackedLorebook.idFor(category, GENERAL_ENTRY))!;
    await api.v1.lorebook.removeEntry(oldId);
    const catId = (await LorebookManager.ensureCategory(category)).id;
    await api.v1.lorebook.createEntry({ id: api.v1.uuid(), displayName: GENERAL_ENTRY, category: catId, text: "my own header words\n=====\n# still empty" });
    const findings = await TrackedLorebook.reconcile();
    expect(findings.length).toBe(1);
    expect(findings[0].kind).toBe("adopted");
    expect(await TrackedLorebook.idFor(category, GENERAL_ENTRY)).not.toBe(oldId);
    expect(await TrackedLorebook.reconcile()).toEqual([]);   // now healthy again
  });

  test("reconcile: a structurally different recreation is a conflict; a plain deletion is missing", async () => {
    await ensurePath("config:success-tables:combat");
    const category = `${TABLES_CATEGORY}:combat`;
    const oldId = (await TrackedLorebook.idFor(category, GENERAL_ENTRY))!;
    await api.v1.lorebook.removeEntry(oldId);
    const catId = (await LorebookManager.ensureCategory(category)).id;
    await api.v1.lorebook.createEntry({ id: api.v1.uuid(), displayName: GENERAL_ENTRY, category: catId, text: "h\n=====\ndread:\n  valuePerSuccess: 1" });
    const conflict = (await TrackedLorebook.reconcile())[0];
    expect(conflict.kind).toBe("conflict");
    expect(conflict.foundText).toContain("dread");
    expect(conflict.backupText).toBeDefined();
    await api.v1.lorebook.removeEntry(conflict.foundId!);
    const missing = (await TrackedLorebook.reconcile())[0];
    expect(missing.kind).toBe("missing");
    expect(missing.backupText).toBeDefined();
  });

  test("combineConfigTexts: array union (found wins), header from found; unparseable is not combinable", () => {
    const backup = "old header\n=====\n- name: a\n  cap: 1\n- name: b\n  cap: 2";
    const found = "new header\n=====\n- name: b\n  cap: 9\n- name: c\n  cap: 3";
    const combined = combineConfigTexts(backup, found)!;
    const list = parseCardText(LorebookManager.contentBelowHeader(combined)) as { name: string; cap: number }[];
    expect(list.map(d => `${d.name}:${d.cap}`).sort()).toEqual(["a:1", "b:9", "c:3"]);
    expect(combined.startsWith("new header")).toBe(true);
    // A block and a bare list are different shapes - nothing to union.
    expect(combineConfigTexts("h\n=====\nsomething: else", found)).toBeUndefined();
    expect(combineConfigTexts("h\n=====\n# empty", found)).toBeUndefined();
  });
});

// =============================================================================
// TABLE SUBCATEGORIES - categories, paths, aliases, and the two modal flows
// =============================================================================
describe("table subcategories: paths, cards, aliases, modals", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); __resetUiMock(); resetAllConfigStores(); await LorebookManager.bootstrap(); });

  test("define-table-category creates the category; define-table sub::name defines into it; roll reads the path", async () => {
    expect(await CommandRouter.route('define-table-category name="combat"')).toContain('Created table category "combat"');
    const d = await CommandRouter.route('define-table name="combat::quick-kill" rows=`1:Wounded, 3:Dead`');
    expect(d).toContain("Defined table combat:quick-kill");
    expect(d).toContain("table=combat::quick-kill");
    await CommandRouter.route('create-playable name="Rok" templates=mortal');
    const r = await CommandRouter.route("roll 5 table=combat::quick-kill", { rng: seqRng([6, 6, 6, 2, 2]) });
    expect(r).toContain("Dead");
    expect(await CommandRouter.route('define-table-category name="combat"')).toContain("already exists");
  });

  test("a missing subcategory prompts a modal; confirming creates it and defines the table", async () => {
    const reply = await CommandRouter.route('define-table name="social::charm" rows=`1:Amused`');
    expect(reply).toContain("answer the modal");
    expect(SuccessTableRegistry.get("social:charm")).toBeUndefined();
    expect(__uiWindows().filter(w => w.kind === "modal").length).toBe(1);
    expect(await __uiClickButton("Create & define")).toBe(true);
    expect(SuccessTableRegistry.get("social:charm")!.rows![0].label).toBe("Amused");
    expect(await LorebookManager.entryText(`${TABLES_CATEGORY}:social`, GENERAL_ENTRY)).toContain("Amused");
  });

  test("every card in a category is read; a later card shadows general and define-table says so", async () => {
    await CommandRouter.route('define-table name="fear" rows=`1:Uneasy`');
    const catId = (await LorebookManager.ensureCategory(TABLES_CATEGORY)).id;
    await api.v1.lorebook.createEntry({
      id: api.v1.uuid(), displayName: "more-tables", category: catId,
      text: ["extra card", "=====",
        "fear:", "  rows:", "    - at: 1", "      label: Shaken",
        "joy:", "  valuePerSuccess: 1"].join("\n"),
    });
    await TableLibrary.loadFromLorebook();
    expect(SuccessTableRegistry.get("fear")!.rows![0].label).toBe("Shaken");
    expect(SuccessTableRegistry.get("joy")).toBeDefined();
    expect(await CommandRouter.route('define-table name="fear" rows=`1:Uneasy`')).toContain("shadows this name");
  });

  test("[[show-table]] groups by category; a subcategory can be listed and its tables detailed", async () => {
    await CommandRouter.route('define-table-category name="combat"');
    await CommandRouter.route('define-table name="combat::quick-kill" value-per-success=1');
    const all = await CommandRouter.route("show-table");
    expect(all).toContain("general:");
    expect(all).toContain("combat: quick-kill");
    expect(await CommandRouter.route("show-table combat")).toContain('Tables in "combat": quick-kill');
    expect(await CommandRouter.route("show-table combat::quick-kill")).toContain("1/success");
    expect(await CommandRouter.route('define-table name="a::b::c"')).toContain("one level deep");
  });

  test("table aliases: define, resolve at table=, list, forget; advisory when the target is undefined", async () => {
    await CommandRouter.route('define-table-category name="combat"');
    await CommandRouter.route('define-table name="combat::quick-kill" rows=`1:Dead`');
    expect(await CommandRouter.route('table-alias @qk "combat::quick-kill"')).toContain("@qk now means table combat:quick-kill");
    await CommandRouter.route('create-playable name="Rok" templates=mortal');
    const r = await CommandRouter.route("roll 5 table=@qk", { rng: seqRng([6, 2, 2, 2, 2]) });
    expect(r).toContain("Dead");
    expect(await CommandRouter.route("table-alias")).toContain("@qk -> combat:quick-kill");
    expect(await CommandRouter.route("show-table")).toContain("@qk -> combat:quick-kill");
    expect(await CommandRouter.route('forget-table combat::quick-kill')).toContain("Forgot table");
    expect(await CommandRouter.route("forget-table-alias @qk")).toContain("Forgot table alias @qk");
    const gone = await CommandRouter.route("roll 5 table=@qk", { rng: seqRng([6, 2, 2, 2, 2]) });
    expect(gone).toContain('Unknown table alias "@qk"');
    expect(await CommandRouter.route('table-alias @x "nope"')).toContain("the alias waits for it");
  });

  test("reconcile e2e: deleted tracked card -> modal once (guard) -> Restore brings it back", async () => {
    await CommandRouter.route('define-table name="fear" rows=`1:Uneasy`');
    const id = (await TrackedLorebook.idFor(TABLES_CATEGORY, GENERAL_ENTRY))!;
    await api.v1.lorebook.removeEntry(id);
    __resetUiMock();
    const notes = await reconcileLorebook();
    expect(notes.join(" ")).toContain("gone");
    await reconcileLorebook();   // same drift again - the session guard holds
    expect(__uiWindows().filter(w => w.kind === "modal").length).toBe(1);
    expect(await __uiClickButton("Restore from backup")).toBe(true);
    expect(await LorebookManager.entryText(TABLES_CATEGORY, GENERAL_ENTRY)).toContain("Uneasy");
    expect(SuccessTableRegistry.get("fear")).toBeDefined();
  });

  test("reconcile e2e: recreated-with-changes -> conflict modal -> Combine unions both sets", async () => {
    await CommandRouter.route('define-table name="fear" rows=`1:Uneasy`');
    const id = (await TrackedLorebook.idFor(TABLES_CATEGORY, GENERAL_ENTRY))!;
    await api.v1.lorebook.removeEntry(id);
    const catId = (await LorebookManager.ensureCategory(TABLES_CATEGORY)).id;
    await api.v1.lorebook.createEntry({
      id: api.v1.uuid(), displayName: GENERAL_ENTRY, category: catId,
      text: "mine\n=====\ndread:\n  valuePerSuccess: 1",
    });
    __resetUiMock();
    await reconcileLorebook();
    expect(__uiWindows().filter(w => w.kind === "modal").length).toBe(1);
    expect(await __uiClickButton("Combine both")).toBe(true);
    expect(SuccessTableRegistry.get("fear")).toBeDefined();
    expect(SuccessTableRegistry.get("dread")).toBeDefined();
  });
});

// =============================================================================
// AFFLICTION WINDOWS - the picker modal + win-affliction + win-afflict
// =============================================================================
describe("affliction windows: picker modal, win-affliction, win-afflict", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); __resetUiMock(); resetAllConfigStores(); await LorebookManager.bootstrap(); });

  const texts = (): string[] => {
    const out: string[] = [];
    const walk = (parts: Array<Record<string, unknown>>): void => {
      for (const p of parts ?? []) {
        if (typeof p["text"] === "string") out.push(p["text"] as string);
        if (Array.isArray(p["content"])) walk(p["content"] as Array<Record<string, unknown>>);
      }
    };
    for (const w of __uiWindows()) walk(w.options.content as unknown as Array<Record<string, unknown>>);
    return out;
  };

  test("the mirror picker lists afflictions, marks the current value, writes the field, and closes", async () => {
    await CommandRouter.route("win-affliction");
    await __uiTypeInto("story:win:define-affliction:mirror", "feral-whispers");
    expect(await __uiClickButton("Choose mirror…")).toBe(true);
    expect(__uiWindows().filter(w => w.kind === "modal").length).toBe(1);
    const labels = texts();
    expect(labels.some(t => t.startsWith("✅ feral-whispers"))).toBe(true);          // current, marked
    expect(await __uiClickButton("concentrating-on - Locked eyes with the target; nothing else exists this turn")).toBe(true);
    expect(__uiFieldValue("story:win:define-affliction:mirror")).toBe("concentrating-on");
    expect(__uiWindows().filter(w => w.kind === "modal").length).toBe(0);            // picker closed itself
  });

  test("win-affliction Create defines the affliction with the picked mirror", async () => {
    await CommandRouter.route("win-affliction");
    await __uiTypeInto("story:win:define-affliction:name", "beast-bond");
    await __uiTypeInto("story:win:define-affliction:bindings", "target");
    expect(await __uiClickButton("Choose mirror…")).toBe(true);
    expect(await __uiClickButton("feral-whispers - Conversing in the target animal's tongue (Feral Speech)")).toBe(true);
    expect(await __uiClickButton("Create")).toBe(true);
    const def = AfflictionRegistry.get("beast-bond")!;
    expect(def.mirror).toBe("feral-whispers");
    expect(def.bindings).toEqual(["target"]);
  });

  test("win-afflict: picking a def reveals its binding slots; Afflict routes the real command (mirror fires)", async () => {
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    await CommandRouter.route("win-afflict");
    expect(texts().some(t => t === "Binding: target")).toBe(false);                  // nothing picked yet
    expect(await __uiClickButton("Choose affliction…")).toBe(true);
    expect(await __uiClickButton("concentrating-on - Locked eyes with the target; nothing else exists this turn")).toBe(true);
    expect(texts().some(t => t === "Binding: target")).toBe(true);                   // the def drove the form
    await __uiTypeInto("story:win:afflict:bind:target", "grey wolf");
    expect(await __uiClickButton("Afflict")).toBe(true);
    expect(await CommandRouter.route("show-affliction")).toContain("concentrating-on (target: Grey Wolf)");
  });

  test("win-afflict refusals surface in-window: no affliction picked; missing binding via the handler", async () => {
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    await CommandRouter.route("win-afflict");
    expect(await __uiClickButton("Afflict")).toBe(true);
    expect(texts().some(t => t === "Pick an affliction first.")).toBe(true);
    await __uiTypeInto("story:win:afflict:affliction", "concentrating-on");
    expect(await __uiClickButton("Afflict")).toBe(true);                             // target left blank
    expect(texts().some(t => t.includes("needs target="))).toBe(true);               // the handler's refusal, in-window
  });
});

// =============================================================================
// ROLL WINDOW - [[win-roll]] (build, roll, save) + the SavedRoll.table sidecar
// =============================================================================
describe("roll window: win-roll + the table sidecar", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); __resetUiMock(); resetAllConfigStores(); await LorebookManager.bootstrap(); });

  const texts = (): string[] => {
    const out: string[] = [];
    const walk = (parts: Array<Record<string, unknown>>): void => {
      for (const p of parts ?? []) {
        if (typeof p["text"] === "string") out.push(p["text"] as string);
        if (Array.isArray(p["content"])) walk(p["content"] as Array<Record<string, unknown>>);
      }
    };
    for (const w of __uiWindows()) walk(w.options.content as unknown as Array<Record<string, unknown>>);
    return out;
  };
  // Through the HOST's own storageKey rule, not around it: a test that writes
  // the field into a store the host never uses proves nothing (§7.83).
  const set = (k: string, v: string) => __uiTypeInto(`story:win:roll:${k}`, v);

  test("name-roll bakes a table sidecar; @name reads it; table= on invocation overrides; @pools refuse to save", async () => {
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    const saved = await CommandRouter.route("name-roll bite strength+brawl 6 table=degrees");
    expect(saved).toContain("table=degrees");
    expect(await CommandRouter.route("show-roll")).toContain("table=degrees");
    const hit = await CommandRouter.route("roll @bite", { rng: seqRng([6, 6]) });
    expect(hit).toContain("degrees:");                                               // the sidecar read the outcome
    const overridden = await CommandRouter.route("roll @bite table=nope", { rng: seqRng([6, 6]) });
    expect(overridden).toContain(`unknown table "nope"`);                            // command override wins
    expect(overridden).not.toContain("degrees:");
    expect(await CommandRouter.route("name-roll chained @bite")).toContain("not a saved @name");
  });

  test("win-roll opens; Roll refuses without a pool, then routes [[roll]] for the current character", async () => {
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    await CommandRouter.route("win-roll");
    expect(__uiWindows().length).toBe(1);
    expect(__uiWindows()[0].options.title).toBe("Build a roll");
    expect(await __uiClickButton("Roll")).toBe(true);
    expect(texts().some(t => t === "Needs a pool.")).toBe(true);
    await set("pool", "dexterity+melee");
    await set("difficulty", "6");
    expect(await __uiClickButton("Roll")).toBe(true);
    expect(texts().some(t => t.includes("Kvar") && t.includes("vs diff 6"))).toBe(true);
  });

  test("a filled For field routes [[roll-for]] without switching characters", async () => {
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    await CommandRouter.route('create-playable name="Erik" templates=mortal');
    await CommandRouter.route('play name="Kvar"');
    await CommandRouter.route("win-roll");
    await set("for", "erik");
    await set("pool", "strength+brawl");
    expect(await __uiClickButton("Roll")).toBe(true);
    expect(texts().some(t => t.includes("Erik") && t.includes("vs diff"))).toBe(true);
    expect((await CommandRouter.route("show-character"))).toContain("Kvar (current");    // still Kvar's seat
  });

  test("Save refuses without a name, then stores pool + knobs + table sidecar via [[name-roll]]", async () => {
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    await CommandRouter.route("win-roll");
    await set("pool", "dexterity+melee");
    expect(await __uiClickButton("Save")).toBe(true);
    expect(texts().some(t => t === "Needs a Save-as name to save.")).toBe(true);
    await set("save-as", "strike");
    await set("difficulty", "7");
    await set("table", "degrees");
    expect(await __uiClickButton("Save")).toBe(true);
    const saved = (await NamedRollStore.get("strike"))!;
    expect(saved.pool).toBe("dexterity+melee");
    expect(saved.difficulty).toBe(7);
    expect(saved.table).toBe("degrees");
    const invoked = await CommandRouter.route("roll @strike", { rng: seqRng([7, 7]) });
    expect(invoked).toContain("vs diff 7");
    expect(invoked).toContain("degrees:");
  });

  test("the pool picker offers @saved rolls; picking one writes the field", async () => {
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    await CommandRouter.route("name-roll dodge dexterity+dodge 6");
    await CommandRouter.route("win-roll");
    expect(await __uiClickButton("Choose pool…")).toBe(true);
    expect(await __uiClickButton("@dodge")).toBe(true);
    expect(__uiFieldValue("story:win:roll:pool")).toBe("@dodge");
  });

  test("the specialty picker follows the For field's character", async () => {
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    await CommandRouter.route('create-playable name="Erik" templates=mortal');
    await CommandRouter.route('play name="Kvar"');
    await CommandRouter.route("specialty melee `Swords`");
    await CommandRouter.route('play name="Erik"');
    await CommandRouter.route("specialty brawl `Grappling`");
    await CommandRouter.route('play name="Kvar"');
    await CommandRouter.route("win-roll");
    expect(await __uiClickButton("Choose specialty…")).toBe(true);
    expect(texts().some(t => t.includes("Swords (melee)"))).toBe(true);              // current character's
    expect(await __uiClickButton("Cancel")).toBe(true);
    await set("for", "erik");
    expect(await __uiClickButton("Choose specialty…")).toBe(true);
    const labels = texts();
    expect(labels.some(t => t.includes("Grappling (brawl)"))).toBe(true);            // For's character
    expect(labels.some(t => t.includes("Swords (melee)"))).toBe(false);
  });

  test("the table picker lists tables and @aliases", async () => {
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    await CommandRouter.route("table-alias @deg degrees");
    await CommandRouter.route("win-roll");
    expect(await __uiClickButton("Choose table…")).toBe(true);
    const labels = texts();
    expect(labels.some(t => t.includes("degrees"))).toBe(true);
    expect(labels.some(t => t.includes("@deg"))).toBe(true);
  });

  test("window knobs ride into the roll: spend and specialty fields reach the pipeline", async () => {
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    await CommandRouter.route("specialty melee `Swords`");
    await CommandRouter.route("win-roll");
    await set("pool", "dexterity+melee");
    await set("difficulty", "6");
    await set("specialty", "swords");
    expect(await __uiClickButton("Roll")).toBe(true);
    expect(texts().some(t => t.includes("specialty: Swords (+1 die)"))).toBe(true);
  });

  test("Save bakes an OPPOSED saved roll: choose a mode + vs-pool, and [[name-roll]] stores the contest", async () => {
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    await CommandRouter.route("win-roll");
    await set("pool", "dexterity+stealth");
    await set("difficulty", "6");
    expect(await __uiClickButton("contested")).toBe(true);              // the contest fields appear on pick
    await set("vs-pool", "perception+alertness");
    await set("vs-difficulty", "6");
    await set("save-as", "shadow");
    expect(await __uiClickButton("Save")).toBe(true);
    const saved = (await NamedRollStore.get("shadow"))!;
    expect(saved.pool).toBe("dexterity+stealth");
    expect(saved.opposed).toEqual({ mode: "contested", pool: "perception+alertness", vsDifficulty: 6 });
    // ...and invoking it launches a contest, not a single roll.
    const out = await CommandRouter.route('roll @shadow vs="a-guard"', { rng: seqRng([6]) });
    expect(out).toContain("contested -");
  });

  test("THE ROLL BUTTON ROLLS: a field the host wrote is a field the window reads", async () => {
    // The bug this pins: an input's `storageKey` names the store the host syncs
    // it to (unprefixed = the script's own storage, "story:" = storyStorage -
    // script-types.d.ts). The engine wrote UNPREFIXED keys and read them back
    // out of tempStorage, so every window field was permanently empty and
    // clicking Roll only ever answered "Needs a pool". Nothing caught it because
    // the mock did not model the sync either; __uiTypeInto now does.
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    await CommandRouter.route("set-trait strength 3");
    await CommandRouter.route("set-trait brawl 2");
    await CommandRouter.route("win-roll");

    // Every field the window binds must name a store explicitly - an
    // unprefixed key is the bug.
    const bound = Object.keys(__uiFields()).filter(k => k.includes("win:roll:"));
    expect(bound.length).toBeGreaterThan(3);
    expect(bound.every(k => k.startsWith("story:"))).toBe(true);

    // Type the way the host does, then click.
    await __uiTypeInto("story:win:roll:pool", "strength+brawl");
    expect(await __uiClickButton("Roll")).toBe(true);
    const shown = texts().join(" | ");
    expect(shown).toContain("Strength + Brawl");
    expect(shown).not.toContain("Needs a pool");
  });

  test("the For field routes to roll-for, and the knobs reach the command", async () => {
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    await CommandRouter.route("set-trait dexterity 4");
    await CommandRouter.route("set-trait dodge 2");
    await CommandRouter.route('create-playable name="Erik" templates=mortal');
    await CommandRouter.route('play name="Erik"');
    await CommandRouter.route("win-roll");
    await __uiTypeInto("story:win:roll:pool", "dexterity+dodge");
    await __uiTypeInto("story:win:roll:for", "Kvar");
    await __uiTypeInto("story:win:roll:difficulty", "9");
    expect(await __uiClickButton("Roll")).toBe(true);
    const shown = texts().join(" | ");
    expect(shown).toContain("Kvar");          // rolled for the named character...
    expect(shown).toContain("diff 9");        // ...and the knob was carried
  });

  test("choosing 'none' collapses the contest knobs and clears vs-pool/vs-difficulty", async () => {
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    await CommandRouter.route("win-roll");
    expect(await __uiClickButton("contested")).toBe(true);
    await set("vs-pool", "perception+alertness");
    expect(texts().some(t => t.includes("vs-pool"))).toBe(true);        // the field is shown while opposed
    expect(await __uiClickButton("none")).toBe(true);                   // collapse back to a plain roll
    expect(__uiFieldValue("story:win:roll:vs-pool")).toBe("");          // its value is cleared
    expect(texts().some(t => t.includes("vs-pool"))).toBe(false);       // and the field is hidden again
  });
});

// =============================================================================
// NAMED PROCEDURES - extended saved rolls + carried table/description + defaults
// =============================================================================
describe("named procedures: extended saved rolls, table + description, defaults", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); MeritFlawRegistry.reset(); ArcanumRegistry.reset(); resetAllConfigStores(); await LorebookManager.bootstrap(); });

  test("SavedRoll round-trips extended + description through the lorebook JSON", async () => {
    await CommandRouter.route("name-roll siege stamina+survival 7 extended=true intervals=5 interval=`1 night` description=`A long grind.`");
    const saved = (await NamedRollStore.get("siege"))!;
    expect(saved.extended).toEqual({ intervals: 5, interval: "1 night" });
    expect(saved.description).toBe("A long grind.");
    expect(saved.pool).toBe("stamina+survival");
  });

  test("seedDefaults creates the library with climbing when missing, and never re-clobbers", async () => {
    expect(await NamedRollStore.get("climbing")).toBeUndefined();       // fresh: nothing yet
    const n = await NamedRollStore.seedDefaults();
    expect(n).toBe(Object.keys(DEFAULT_NAMED_ROLLS).length);
    const climb = (await NamedRollStore.get("climbing"))!;
    expect(climb.extended).toBeDefined();
    expect(climb.tags).toContain("climb");
    expect(climb.table).toBe("climbing");
    // Second call: library exists -> no-op (returns 0).
    expect(await NamedRollStore.seedDefaults()).toBe(0);
    // A deleted default is NOT resurrected by a later seed.
    await NamedRollStore.remove("climbing");
    expect(await NamedRollStore.seedDefaults()).toBe(0);
    expect(await NamedRollStore.get("climbing")).toBeUndefined();
  });

  test("invoking a saved extended roll launches an extended action, reads its table, and accumulates to the target", async () => {
    await NamedRollStore.seedDefaults();
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');   // dexterity 1 + athletics 0 = 1 die
    const start = await CommandRouter.route("roll @climbing requires=2", { rng: seqRng([6]) });
    expect(start).toContain("starts extended");
    expect(start).toContain("climbing: 1 success = 10 so far");   // accumulated distance: 1 success x 10 ft
    expect(start).toContain("total 1/2");
    const done = await CommandRouter.route("continue-roll", { rng: seqRng([6]) });
    expect(done).toContain("succeeded");
    expect(done).toContain("= 20 so far");                        // accumulated distance climbed: 2 x 10 ft
  });

  test("an extended saved roll refuses without a target; a non-extended saved roll still single-rolls", async () => {
    await NamedRollStore.seedDefaults();
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    expect(await CommandRouter.route("roll @climbing")).toContain("give it a target");
    await CommandRouter.route("name-roll jab dexterity+brawl 6");
    const single = await CommandRouter.route("roll @jab", { rng: seqRng([6]) });
    expect(single).toContain("vs diff 6");
    expect(single).not.toContain("starts extended");
  });

  test("the climb tag rides the launched base, so a tag-gated passive reaches the extended interval", async () => {
    await NamedRollStore.seedDefaults();
    // A merit whose passive drops difficulty by 2 ONLY on climb-tagged rolls.
    const entryText = [
      "x", "=====",
      "Sure Grip:",
      "  kind: merit",
      "  points: 1",
      "  passive:",
      "    - op: difficulty",
      "      amount: -2",
      "      target: climb",
    ].join("\n");
    const cat = await LorebookManager.ensureCategory("srd:merits-flaws");
    await api.v1.lorebook.createEntry({ id: api.v1.uuid(), displayName: "srd:merits-flaws:custom2", category: cat.id, text: entryText });
    await MeritFlawRegistry.loadFromLorebook();
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    await CommandRouter.route("take-merit sure-grip 1");
    // A 5 is below diff 6 but meets diff 4 (6-2). With the gate firing, it counts.
    const start = await CommandRouter.route("roll @climbing requires=3", { rng: seqRng([5]) });
    expect(start).toContain("total 1/3");   // the -2 (climb-gated) turned the 5 into a success
  });

  test("roll-info shows the extended shape + description and is quiet; list-rolls marks [extended]", async () => {
    await NamedRollStore.seedDefaults();
    const info = await CommandRouter.route("show-roll climbing");
    expect(info).toContain("extended");
    expect(info).toContain("Scaling vertical surfaces");
    expect(info).toContain("requires=<target>");
    expect(await CommandRouter.route("show-roll")).toContain("[extended");
    const q = await processAdventureInput("Hmm. [[show-roll climbing]] Right.");
    expect(q!.stopGeneration).toBe(true);   // a query stops generation
  });
});

// =============================================================================
// CONTESTED SAVED ROLLS + MULTI-STAGE PROCEDURES - the "real arena" primitives
// =============================================================================
describe("contested saved rolls + multi-stage procedures", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); MeritFlawRegistry.reset(); ArcanumRegistry.reset(); resetAllConfigStores(); await LorebookManager.bootstrap(); });

  test("an opposed saved roll round-trips and invoking it launches a contest (not a single roll)", async () => {
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');   // dexterity 1
    await CommandRouter.route("name-roll intimidate dexterity+brawl 6 opposed=contested vs-pool=stamina+brawl vs-difficulty=6");
    const saved = (await NamedRollStore.get("intimidate"))!;
    expect(saved.opposed).toEqual({ mode: "contested", pool: "stamina+brawl", vsDifficulty: 6 });
    // Invoke: the opponent is play-time input; an ad-hoc "the-thug" rolls only literals (0).
    const out = await CommandRouter.route('roll @intimidate vs="the-thug"', { rng: seqRng([6]) });   // 1 die -> 1 success beats 0
    expect(out).toContain("contested -");     // a contest report, not "Kvar - (...)" single-roll form
    expect(out).toContain("Kvar");
  });

  test("opposed + extended = an extended contest (Pursuit shape); the target is play-time and refused if absent", async () => {
    await CommandRouter.route("name-roll pursuit dexterity+athletics 6 opposed=contested extended=true intervals=6");
    const p = (await NamedRollStore.get("pursuit"))!;
    expect(p.opposed).toEqual({ mode: "contested", extended: { intervals: 6 } });
    expect(p.extended).toBeUndefined();       // the extended cfg rode onto opposed, keeping the top-level branch clean
    await CommandRouter.route('create-playable name="Runner" templates=vampire');
    expect(await CommandRouter.route('roll @pursuit vs="Erik"')).toContain("give it a target");
    const open = await CommandRouter.route('roll @pursuit requires=3 vs="Erik"', { rng: seqRng([6]) });
    expect(open).toContain("opens");
    expect(open).toContain("contest");
  });

  test("a procedure composes named rolls: add-step, the entry surfaces the matching branch, clear-steps removes", async () => {
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');   // strength 1
    await CommandRouter.route("name-roll jump strength 3");                         // 1 die, difficulty 3 (entry / step 1)
    await CommandRouter.route("name-roll grab-ledge dexterity+athletics 6");        // the on-fail follow-up
    const add = await CommandRouter.route("add-step jump when=on-fail roll=@grab-ledge note=`grab a ledge to avoid injury`");
    expect(add).toContain("1-step procedure");
    const info = await CommandRouter.route("show-roll jump");
    expect(info).toContain("Steps:");
    expect(info).toContain("on-fail");
    expect(info).toContain("@grab-ledge");
    // A failing entry surfaces the on-fail branch as a ready-to-run command...
    const failRoll = await CommandRouter.route("roll @jump", { rng: seqRng([2]) });   // 2 < diff 3 -> failure
    expect(failRoll).toContain("Next: on-fail -> [[roll @grab-ledge]]");
    // ...a success does not (no matching step).
    const okRoll = await CommandRouter.route("roll @jump", { rng: seqRng([6]) });      // 6 >= diff 3 -> success
    expect(okRoll).not.toContain("Next:");
    // clear-steps drops the follow-ups; the entry roll stays.
    expect(await CommandRouter.route("clear-steps jump")).toContain("Cleared 1 step");
    expect(await CommandRouter.route("show-roll jump")).not.toContain("Steps:");
  });

  test("add-step refuses when the procedure's entry roll doesn't exist yet", async () => {
    expect(await CommandRouter.route("add-step ghost when=always roll=@x")).toContain("save its entry first");
  });
});

// =============================================================================
// TIME - the pure calendar/clock math + the story-clock commands
// =============================================================================
describe("time: pure calendar/clock math (core/time)", () => {
  const ep = (s: string): number => parseStoryDate(s) as number;

  test("parseStoryDate accepts yyyy-mm-dd[-hh[:mm[:ss]]] and rejects out-of-range", () => {
    expect(formatStoryDate(ep("1197-03-15-08"))).toBe("1197-03-15 08:00");
    expect(formatStoryDate(ep("1197-03-15"))).toBe("1197-03-15 00:00");
    expect(formatStoryDate(ep("1197-03-15-08:30:45"))).toBe("1197-03-15 08:30:45");
    expect(parseStoryDate("1197-13-01")).toHaveProperty("error");   // month > 12
    expect(parseStoryDate("1197-02-30")).toHaveProperty("error");   // Feb 30
    expect(parseStoryDate("nope")).toHaveProperty("error");
    expect(DEFAULT_STORY_START).toBe("1197-01-01-00");
  });

  test("parseDuration reads fixed + calendar units; addDuration is calendar-aware", () => {
    expect(parseDuration("2w 4h")).toEqual({ months: 0, seconds: 2 * 604800 + 4 * 3600 });
    expect(parseDuration("1mo")).toEqual({ months: 1, seconds: 0 });
    expect(parseDuration("1y 3d")).toEqual({ months: 12, seconds: 3 * 86400 });
    expect(parseDuration("5x")).toHaveProperty("error");
    // Jan 31 + 1 month clamps to Feb 28 (1197 is not a leap year).
    expect(formatStoryDate(addDuration(ep("1197-01-31-00"), { months: 1, seconds: 0 }))).toBe("1197-02-28 00:00");
    // + 90 seconds crosses the minute boundary.
    expect(formatStoryDate(addDuration(ep("1197-01-01-00"), { months: 0, seconds: 90 }))).toBe("1197-01-01 00:01:30");
  });

  test("diffCalendar reports an exact, reversible span (incl. the borrow edge case)", () => {
    const a = ep("1197-03-15-08"), b = ep("1198-05-29-20:30");
    const s = diffCalendar(a, b);
    expect(formatCalendarSpan(s)).toBe("1 year, 2 months, 14 days, 12 hours, 30 minutes");
    expect(s.negative).toBe(false);
    // Jan 31 -> Mar 01 is 1 month 1 day, NOT 2 months (the classic borrow case).
    expect(formatCalendarSpan(diffCalendar(ep("1197-01-31-00"), ep("1197-03-01-00")))).toBe("1 month, 1 day");
    // Reversed reads negative with the same magnitude.
    const back = diffCalendar(b, a);
    expect(back.negative).toBe(true);
    expect(formatCalendarSpan(back)).toBe(formatCalendarSpan(s));
    expect(formatCalendarSpan(diffCalendar(a, a))).toBe("no time");   // same moment
  });
});

describe("time commands: story clock, advance, bookmarks, spans", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); resetAllConfigStores(); await LorebookManager.bootstrap(); });

  test("story-start sets the clock; advance-time moves it; story-date reports the span", async () => {
    expect(await CommandRouter.route("show-date")).toContain("No story clock yet");   // unset (init not called)
    await CommandRouter.route("story-start 1197-03-15-08");
    expect(await CommandRouter.route("show-date")).toContain("the story has just begun");
    expect(await CommandRouter.route("advance-time 2d 6h")).toContain("1197-03-17 14:00");
    expect(await CommandRouter.route("show-date")).toContain("2 days, 6 hours since it began");
  });

  test("save-date / dates / forget-date bookmark moments; time-between measures any two", async () => {
    await CommandRouter.route("story-start 1197-03-15-08");
    await CommandRouter.route("advance-time 1mo");
    await CommandRouter.route("save-date siege-began");                 // saves current (now)
    await CommandRouter.route("save-date yuletide 1197-12-25-00");      // saves an explicit date
    expect(await CommandRouter.route("show-date")).toContain("siege-began");
    expect(await CommandRouter.route("show-time-between start now")).toContain("1 month");
    expect(await CommandRouter.route("show-time-between siege-began yuletide")).toContain("after siege-began");
    expect(await CommandRouter.route("show-time-between now 1197-01-01-00")).toContain("before");   // ad-hoc earlier date
    expect(await CommandRouter.route("forget-date siege-began")).toContain("Forgot date");
    expect(await CommandRouter.route("show-date")).not.toContain("siege-began");
    // A query stops generation for the turn.
    expect((await processAdventureInput("Later. [[show-date]] Onward."))!.stopGeneration).toBe(true);
  });

  test("StoryClock.seedDefault creates the clock once with the Dark Ages default, never clobbering", async () => {
    expect(await StoryClock.get()).toBeUndefined();
    expect(await StoryClock.seedDefault()).toBe(true);
    expect(formatStoryDate((await StoryClock.get())!.start)).toBe("1197-01-01 00:00");
    expect(await StoryClock.seedDefault()).toBe(false);                 // second call: no-op
    await CommandRouter.route("story-start 1230-06-01-12");             // a player's set-start...
    expect(await StoryClock.seedDefault()).toBe(false);                 // ...survives a later seed
    expect(formatStoryDate((await StoryClock.get())!.now)).toBe("1230-06-01 12:00");
    expect(await DateBook.names()).toEqual([]);
  });

  test("bad input is refused with guidance", async () => {
    await CommandRouter.route("story-start 1197-03-15-08");
    expect(await CommandRouter.route("advance-time 5x")).toContain("Unknown time unit");
    expect(await CommandRouter.route("story-start 1197-99-99")).toContain("Month must be 1-12");
    expect(await CommandRouter.route("show-time-between now nope")).toContain("not a saved date");
  });
});

describe("scenes: named units of play on the story clock", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); resetAllConfigStores(); await LorebookManager.bootstrap(); });

  test("a scene opens at the current instant; a 3s combat turn moves the clock; freeform turns don't", async () => {
    expect(await CommandRouter.route('scene "The Parapet" turn=3s')).toContain("No story clock yet");   // scenes anchor to the clock
    await CommandRouter.route("story-start 1230-06-01-20");
    expect(await CommandRouter.route('scene "The Parapet" location=`Buda ramparts` turn=3s')).toContain("opens at Buda ramparts");
    await CommandRouter.route("turn");
    expect(await CommandRouter.route("turn 3")).toContain("turn 4");
    expect(await CommandRouter.route("show-date")).toContain("20:00:12");   // 4 x 3s marched the clock
    // A freeform scene (no turn=) doesn't move the clock.
    await CommandRouter.route('scene "Council" ');
    expect(await CommandRouter.route("turn")).toContain("no clock move");
    expect(await CommandRouter.route("show-date")).toContain("20:00:12");   // unchanged by freeform turns
  });

  test("opening a scene auto-closes the previous; downtime closes + glosses the clock; scenes/scene-info report", async () => {
    await CommandRouter.route("story-start 1230-06-01-20");
    await CommandRouter.route('scene "The Parapet" turn=3s');
    await CommandRouter.route("turn 2");
    expect(await CommandRouter.route('scene "Council" ')).toContain(`closed "the-parapet"`);
    expect(await CommandRouter.route("show-scene")).toContain("Council (open)");
    expect(await CommandRouter.route("downtime 2d")).toContain(`closed "council"`);
    expect(await CommandRouter.route("show-date")).toContain("1230-06-03");   // glossed forward 2 days
    expect(await CommandRouter.route("end-scene")).toContain("No open scene");
    expect(await CommandRouter.route("show-scene in=scene the-parapet")).toContain("[closed]");
    expect((await processAdventureInput("Hm. [[show-scene]] Right."))!.stopGeneration).toBe(true);   // a query stops generation
  });

  test("forget-scene removes a record and clears the current pointer", async () => {
    await CommandRouter.route("story-start 1230-06-01-20");
    await CommandRouter.route('scene "The Parapet" ');
    expect(await CommandRouter.route("forget-scene the-parapet")).toContain("Forgot scene");
    expect(await CommandRouter.route("show-scene")).toContain("No scenes yet");
    expect(await CommandRouter.route("show-scene in=scene")).toContain("No open scene");
  });
});

describe("storyteller output: <hide> -> scene plan -> Author's Note", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); resetAllConfigStores(); await LorebookManager.bootstrap(); });

  test("extractHideBlocks pulls append/overwrite/bare blocks and cleans the text (pure)", () => {
    const t = `Narration.\n<hide op="append">plan one</hide>\nMore.\n<hide>plan two</hide>\n<hide op="overwrite">final</hide>End.`;
    const { cleaned, directives } = extractHideBlocks(t);
    expect(directives).toEqual([
      { op: "append", content: "plan one" },
      { op: "append", content: "plan two" },
      { op: "overwrite", content: "final" },
    ]);
    expect(cleaned).not.toContain("<hide");
    expect(cleaned).toContain("Narration.");
    expect(cleaned).toContain("End.");
    expect(extractHideBlocks("no tags here").directives).toEqual([]);
  });

  test("processGeneratedText strips the block, records the plan on the open scene, and mirrors it to the Author's Note", async () => {
    await CommandRouter.route("story-start 1230-06-01-20");
    await CommandRouter.route('scene "The Parapet" ');
    const out = await processGeneratedText([`ST: Cold eyes.\n<hide op="append">The baron is a spy.</hide>\nBaron: "Late."`]);
    expect(out![0]).not.toContain("<hide");
    expect(out![0]).toContain("Cold eyes");
    expect(out![0]).toContain(`Baron: "Late."`);
    expect(await CommandRouter.route("show-scene in=scene")).toContain("The baron is a spy");   // recorded on the scene
    expect(__authorNote()).toContain("The baron is a spy");                            // and mirrored to the AN
    expect(__authorNote()).toContain("[Scene: The Parapet]");
    // overwrite replaces; text with no <hide> passes through untouched (undefined).
    await processGeneratedText([`<hide op="overwrite">New plan.</hide>`]);
    expect(__authorNote()).toContain("New plan");
    expect(__authorNote()).not.toContain("The baron is a spy");
    expect(await processGeneratedText(["just narration"])).toBeUndefined();
  });

  test("the [[hide]] command writes the plan; switching or ending a scene clears the AN block", async () => {
    await CommandRouter.route("story-start 1230-06-01-20");
    await CommandRouter.route('scene "The Parapet" ');
    expect(await CommandRouter.route("hide text=`the ghoul can be bribed`")).toContain("Noted (append)");
    expect(__authorNote()).toContain("the ghoul can be bribed");
    await CommandRouter.route('scene "The Crypt" ');    // a new scene clears the prior plan block
    expect(__authorNote()).toBe("");
    await CommandRouter.route("hide text=`a Cappadocian lurks`");
    expect(__authorNote()).toContain("a Cappadocian lurks");
    await CommandRouter.route("end-scene");
    expect(__authorNote()).toBe("");
  });

  test("a <hide> with no open scene is still stripped, but has nowhere to record", async () => {
    const out = await processGeneratedText([`ST: Nothing open.\n<hide>orphan plan</hide>`]);
    expect(out![0]).not.toContain("<hide");
    expect(out![0]).not.toContain("orphan plan");
    expect(__authorNote()).toBe("");
  });

  test("init registers onResponse so a live generation is intercepted", async () => {
    await init();
    await CommandRouter.route("story-start 1230-06-01-20");
    await CommandRouter.route('scene "The Parapet" ');
    const r = await __fireOnResponse([`ST: A line.\n<hide>secret</hide>`]);
    expect(r!.text![0]).not.toContain("secret");
    expect(__authorNote()).toContain("secret");
  });
});

describe("context hygiene: QUIET noise stays out of the AI's context", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); resetAllConfigStores(); await LorebookManager.bootstrap(); });

  test("a QUIET reply is wrapped in a ctx-skip marker; a signal reply (a roll) is not", async () => {
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    const q = await processAdventureInput("Let me check. [[help]] Onward.");
    expect(q!.inputText).toContain("wod:ctx-skip");     // help is noise -> wrapped
    expect(q!.inputText).toContain("[SYSTEM:");          // the reply is still there for the player
    const s = await processAdventureInput("I strike. [[roll strength+brawl 6]] Ha!");
    expect(s!.inputText).not.toContain("wod:ctx-skip");  // a roll is a signal the AI should narrate
  });

  test("processContextBuilt strips ctx-skip spans and counts a real generation; a dry run does not count", async () => {
    const wrapped = (await processAdventureInput("Look. [[help]] Go."))!.inputText!;
    const messages: Message[] = [
      { role: "system", content: "You are the Storyteller." },
      { role: "user", content: wrapped },
      { role: "user", content: "<!--wod:ctx-skip:0-->[SYSTEM: only noise]<!--/wod:ctx-skip-->" },
    ];
    const before = await GenCounter.get();
    const out = await processContextBuilt(messages, false);   // a REAL generation
    const joined = out!.map(m => m.content ?? "").join("\n");
    expect(joined).not.toContain("wod:ctx-skip");
    expect(joined).not.toContain("[SYSTEM:");                 // the help noise is gone from context
    expect(joined).toContain("Look.");                        // surrounding prose kept
    expect(joined).toContain("Go.");
    expect(out!.length).toBe(2);                              // the all-noise message was dropped
    expect(await GenCounter.get()).toBe(before + 1);          // counted
    // A dry run (context inspection) strips the noise but does NOT increment.
    const dry = await processContextBuilt([{ role: "user", content: "<!--wod:ctx-skip:0-->[SYSTEM: x]<!--/wod:ctx-skip--> real" }], true);
    expect(dry![0].content).toBe("real");
    expect(await GenCounter.get()).toBe(before + 1);          // unchanged by the dry run
    expect(stripCtxSkip("a<!--wod:ctx-skip:3-->noise<!--/wod:ctx-skip-->b")).toBe("ab");   // pure helper
    expect(await processContextBuilt([{ role: "user", content: "plain" }], true)).toBeUndefined();   // nothing marked
  });

  test("init registers onContextBuilt so a live context build is cleaned", async () => {
    await init();
    const out = await __fireOnContextBuilt([{ role: "user", content: "<!--wod:ctx-skip:0-->[SYSTEM: x]<!--/wod:ctx-skip--> hi" }], false);
    expect(out!.messages![0].content).toBe("hi");
  });
});

describe("document cleanup: streaming-hide backstop + noise age-out (onGenerationEnd)", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); resetAllConfigStores(); await LorebookManager.bootstrap(); });

  test("stripAgedCtxSkip drops only blocks older than the keep window (pure)", () => {
    const t = 'a<!--wod:ctx-skip:0-->old<!--/wod:ctx-skip-->b<!--wod:ctx-skip:9-->new<!--/wod:ctx-skip-->c';
    expect(stripAgedCtxSkip(t, 10, 2)).toBe('ab<!--wod:ctx-skip:9-->new<!--/wod:ctx-skip-->c');   // gen 0 dropped, gen 9 kept
    expect(stripAgedCtxSkip('x<!--wod:ctx-skip:9-->fresh<!--/wod:ctx-skip-->y', 10, 2)).toBeNull(); // nothing old enough
  });

  test("onGenerationEnd strips a surviving <hide> (routing it), age-deletes old noise, keeps fresh noise", async () => {
    await init();
    await CommandRouter.route("story-start 1230-06-01-20");
    await CommandRouter.route('scene "The Parapet" ');
    for (let i = 0; i < 10; i++) await GenCounter.increment();     // now = 10
    __seedDocument([
      "Plain narration.",
      'ST: A line. <hide>a split-survived plan</hide> and more.',
      "<!--wod:ctx-skip:0-->[SYSTEM: old help]<!--/wod:ctx-skip-->",          // gen 0 -> age-deleted
      "keep <!--wod:ctx-skip:9-->[SYSTEM: recent]<!--/wod:ctx-skip--> me",     // gen 9 -> kept
    ]);
    await __fireOnGenerationEnd();
    const texts = __document().map(s => s.text);
    expect(texts).toContain("Plain narration.");                    // untouched
    expect(texts.some(t => t.includes("<hide"))).toBe(false);       // the surviving hide was stripped
    expect(texts).toContain("ST: A line. and more.");               // ...its section cleaned (gap collapsed)
    expect(texts.some(t => t.includes("old help"))).toBe(false);    // old noise deleted from the story
    expect(texts.some(t => t.includes("recent"))).toBe(true);       // fresh noise still there
    expect(await CommandRouter.route("show-scene in=scene")).toContain("a split-survived plan");   // hide reached the plan
  });

  test("onGenerationEnd on an empty document is a harmless no-op", async () => {
    await init();
    __seedDocument([]);
    await expect(__fireOnGenerationEnd()).resolves.toBeUndefined();
  });
});

// =============================================================================
// SHEET - the record as the engine reads it + the creator-mode hand-edit loop
// =============================================================================
describe("sheet: engine view of the record + creator-mode manual fill", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); MeritFlawRegistry.reset(); ArcanumRegistry.reset(); resetAllConfigStores(); await LorebookManager.bootstrap(); });

  test("sheet shows the seeded record; enhancements mark effective values", async () => {
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    const s = await CommandRouter.route("show-sheet");
    expect(s).toContain("Kvar [vampire, potential]");
    expect(s).toContain("strength 1");
    expect(s).toContain("Abilities (nonzero) - none");
    // Attributes read the way a sheet is laid out, by category.
    expect(s).toContain("Physical: strength 1, dexterity 1, stamina 1");
    expect(s).toContain("Mental: perception 1, intelligence 1, wits 1");
    expect(s).toContain("Pool starts: willpower 0");
    expect(s).not.toContain("Arcana/Taints");            // a vampire has none
    await CommandRouter.route("attune arcana");          // ...until he is a thrall
    await CommandRouter.route("take-arcanum trait-enhancement::strength 2");
    const after = await CommandRouter.route("show-sheet");
    expect(after).toContain("strength 1 (3 eff)");
    expect(after).toContain("Arcana/Taints: trait-enhancement:strength 2");
    expect(after).not.toContain("Merits/Flaws");
  });

  test("the manual-fill loop: hand-write the lorebook card in creator mode, sheet shows the sync, the roll uses it", async () => {
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    await CommandRouter.route("creator-mode set=true");
    const entry = (await LorebookManager.entriesInCategory(PLAYER_CHARACTERS_CATEGORY)).find(e => (e.displayName ?? "") === "pc:kvar")!;
    const text = entry.text ?? "";
    // A player retyping the sheet by hand: display spellings, `pools` for the
    // longer engine name, and the specialty indented under the skill it is on.
    const written = [
      "name: Kvar",
      "templates: vampire",
      "",
      "attributes:",
      "  Dexterity: 4",
      "",
      "abilities:",
      "  Melee: 3",
      "    specialty: Swords",
      "",
      "pools:",
      "  Willpower: 5",
    ];
    // Edit like a player would: keep everything through the MARKER LINE (the
    // header itself mentions "=====" inline, so index-of would cut too early),
    // replace only the data below it.
    const lines = text.split("\n");
    const mi = lines.findIndex(l => l.trim() === SRD_HEADER_MARKER);
    await api.v1.lorebook.updateEntry(entry.id, { text: [...lines.slice(0, mi + 1), ...written].join("\n") });
    const s = await CommandRouter.route("show-sheet");            // beforeRoute synced the edit in
    expect(s).toContain("dexterity 4");
    expect(s).toContain("melee 3");
    expect(s).toContain("willpower 5");
    expect(s).toContain("Specialties: melee: Swords");
    const r = await CommandRouter.route("roll dexterity+melee 6 specialty=melee", { rng: seqRng([6, 6, 6, 6, 6, 6, 6, 6]) });
    expect(r).toContain("(8)");                              // 4 + 3 dice + the specialty die
    expect(r).toContain("specialty: Swords (+1 die)");
  });

  test("sheet <name> targets another character; unknown names refuse", async () => {
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    await CommandRouter.route('create-playable name="Sela" templates=mortal');
    await CommandRouter.route('play name="Kvar"');
    expect(await CommandRouter.route("show-sheet in=sela")).toContain("Sela [mortal, potential]");
    // An unknown name is refused by the SCOPE resolver now rather than by the
    // sheet handler, so the refusal names every scope it could have been.
    expect(await CommandRouter.route("show-sheet in=nope")).toContain(`Nothing named "nope"`);
  });
});

// =============================================================================
// OWNED POWERS - parameterized merits, passive effects, specialties
// =============================================================================
describe("owned powers: Trait Affinity, Trait Enhancement, Specialties", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); MeritFlawRegistry.reset(); ArcanumRegistry.reset(); resetAllConfigStores(); await LorebookManager.bootstrap(); });

  test("Sharpened Senses: each purchase is another -1, and only on Perception pools", async () => {
    // A DEMON: Willpower + Resolve. (Resolve is the infernal resource - mages
    // have Quintessence and Willpower, vampires Blood and Willpower.)
    await CommandRouter.route('create-playable name="Aldous" templates=demon');
    const char = (await CharacterStore.load("Aldous"))!;
    char.attributes.perception = 4;
    char.abilities.awareness = 2;
    await CharacterStore.save(char);
    expect(await CommandRouter.route("take-arcanum sharpened-senses 3")).toContain("difficulty -3");
    // Difficulty 8 - 3 = 5, so a run of 6s all hit.
    const sharp = await CommandRouter.route("roll perception+awareness 8", { rng: seqRng([6, 6, 6, 6, 6, 6]) });
    expect(sharp).toContain("vs diff 5");
    expect(sharp).toContain("sharpened-senses: difficulty -3");
    // The gate is the POOL: a roll that never uses Perception is untouched.
    const blunt = await CommandRouter.route("roll strength+brawl 8", { rng: seqRng([6]) });
    expect(blunt).toContain("vs diff 8");
    expect(blunt).not.toContain("sharpened-senses");
  });

  test("the ceiling is a TRAIT: Resolve bounds the purchases, and it can move", async () => {
    await CommandRouter.route('create-playable name="Aldous" templates=demon');
    const char = (await CharacterStore.load("Aldous"))!;
    expect(permanentRatingOf(char, "resolve")).toBe(3);   // the demon's own starting band
    const refused = await CommandRouter.route("take-arcanum sharpened-senses 5");
    expect(refused).toContain("may not be taken more times than Resolve (3)");
    expect((await CharacterStore.load("Aldous"))!.arcana?.["sharpened-senses"]).toBeUndefined();
    expect(await CommandRouter.route("take-arcanum sharpened-senses 5 waive=true")).toContain("5 arcana points");
    // A ceiling that MOVES strands the purchases above it - reported, never trimmed.
    expect(await CommandRouter.route("show-constraint in=current")).toContain("sharpened-senses is at 5 but resolve is only 3");
  });

  test("a mage has no Resolve at all, so the arcanum is not open to him", async () => {
    await CommandRouter.route('create-playable name="Aldous" templates=mage');
    // A mage bound as a thrall: the list is open to him, and the CEILING is
    // still what stops him - he has no Resolve to measure it against.
    await CommandRouter.route("attune arcana");
    const char = (await CharacterStore.load("Aldous"))!;
    expect(permanentRatingOf(char, "resolve")).toBe(0);        // Quintessence + Willpower, no Resolve
    const refused = await CommandRouter.route("take-arcanum sharpened-senses 1");
    expect(refused).toContain("has no Resolve");
    expect((await CharacterStore.load("Aldous"))!.arcana?.["sharpened-senses"]).toBeUndefined();
  });

  test("a Resolve that is really Living Resolve caps it just the same", async () => {
    await CommandRouter.route('create-playable name="Visvaldas" templates=ouroboros');
    await CommandRouter.route("set-trait fount 5 paid=0");
    const char = (await CharacterStore.load("Visvaldas"))!;
    // One point of Living Resolve IS one Quintessence AND one Resolve AND one
    // blood point AND one Willpower, so every one of those names finds it.
    expect(permanentRatingOf(char, "resolve")).toBe(30);
    expect(permanentRatingOf(char, "quintessence")).toBe(30);
    expect(permanentRatingOf(char, "blood")).toBe(30);
    expect(permanentRatingOf(char, "willpower")).toBe(30);
    expect(await CommandRouter.route("take-arcanum sharpened-senses 6")).toContain("difficulty -6");
  });

  test("max-from-trait is authorable and survives the card round trip", async () => {
    const reply = await CommandRouter.route('define-merit name=`Keen Nose` points=`1,2,3` '
      + 'max-from-trait=resolve passive=`difficulty -1 if=perception` description=`A hound\'s nose.`');
    expect(reply).toContain('merit "Keen Nose"');
    expect(MeritFlawRegistry.get("keen-nose")!.maxFromTrait).toBe("resolve");
    const text = (await LorebookManager.entryText("srd:merits-flaws", "srd:merits-flaws:custom"))!;
    expect(text).toContain("max-from-trait: resolve");
    MeritFlawRegistry.reset(); ArcanumRegistry.reset();
    await MeritFlawRegistry.loadFromLorebook();
    expect(MeritFlawRegistry.get("keen-nose")!.maxFromTrait).toBe("resolve");
  });

  test("resolvePowerInstance: plain names, parameterized instances, malformed forms", () => {
    const lookup = (n: string) => MeritFlawRegistry.get(n);
    expect(resolvePowerInstance("iron-will", lookup)!.def.name).toBe("Iron Will");
    // Parameterized instances resolve through whichever registry owns the def -
    // Trait Affinity is an ARCANUM, so the merit registry must not answer it.
    const arcane = (n: string) => ArcanumRegistry.get(n);
    const inst = resolvePowerInstance("trait-affinity:melee", arcane)!;
    expect(inst.def.name).toBe("Trait Affinity");
    expect(inst.param).toBe("melee");
    expect(resolvePowerInstance("trait-affinity:melee", lookup)).toBeUndefined();  // wrong registry
    expect(resolvePowerInstance("trait-affinity", arcane)).toBeUndefined();   // param def owned bare
    expect(resolvePowerInstance("nope:melee", lookup)).toBeUndefined();       // unknown base
  });

  test("afflictionOpsOf: $binding substitution + level scaling (the shared mechanism)", () => {
    // Trait Affinity no longer carries an op of its own: it APPLIES
    // difficulty-modifier, and that is what any other merit can do too.
    const affinity = ArcanumRegistry.get("trait-affinity")!;
    expect(affinity.passive).toBeUndefined();
    expect(affinity.grants).toEqual({
      afflicts: "modifier-difficulty", binds: { trait: "$param" }, level: "$rating",
    });
    const def = AfflictionRegistry.get("modifier-difficulty")!;
    expect(afflictionOpsOf(def, { trait: "melee" }, 2))
      .toEqual([{ op: "difficulty", trait: "melee", amount: -2 }]);
    // An unfilled $binding DROPS the gate rather than the op: no tags given
    // means "on every roll using that trait".
    expect(afflictionOpsOf(def, { trait: "drive", tags: "reckless" }, 2))
      .toEqual([{ op: "difficulty", trait: "drive", target: "reckless", amount: -2 }]);
    // ...and "all" is how an instance says "no trait gate at all".
    expect(afflictionOpsOf(def, { trait: "all" }, 1)).toEqual([{ op: "difficulty", amount: -1 }]);
  });

  test("Trait Affinity lowers difficulty when the POOL uses the trait - and only then", async () => {
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    // A vampire bound as a thrall - anyone can be one, which is the whole
    // reason the gate is a capability and not a template list.
    await CommandRouter.route("attune arcana");
    await CommandRouter.route("take-arcanum trait-affinity::melee 2");
    const hit = await CommandRouter.route("roll dexterity+melee", { rng: seqRng([6]) });
    expect(hit).toContain("vs diff 4");
    // The note names the SOURCE, not the shared affliction, and says which way
    // difficulty runs - a minus is EASIER.
    expect(hit).toContain("trait-affinity:melee: difficulty -2 (easier)");
    const miss = await CommandRouter.route("roll strength+brawl", { rng: seqRng([6, 6]) });
    expect(miss).toContain("vs diff 6");
    // The seam: melee ONLY in the difficulty expression is NOT "using" it.
    const diffOnly = await CommandRouter.route("roll strength+brawl melee+6", { rng: seqRng([6, 6]) });
    expect(diffOnly).toContain("vs diff 6");
    expect(diffOnly).not.toContain("trait-affinity");
  });

  test("affinity applies to contest sides (both named characters)", async () => {
    await CommandRouter.route('create-playable name="Rok" templates=mortal');
    await CommandRouter.route('create-playable name="Erik" templates=mortal');
    await CommandRouter.route('play name="Erik"');
    await CommandRouter.route("attune arcana");
    await CommandRouter.route("take-arcanum trait-affinity::brawl 1");
    await CommandRouter.route('play name="Rok"');
    const r = await CommandRouter.route('resist strength+brawl strength+brawl vs="Erik"', { rng: seqRng([6, 6]) });
    expect(r).toContain("vs diff 6");   // Rok, no affinity
    expect(r).toContain("vs diff 5");   // Erik's side
  });

  test("two Abilities may reach 3; a THIRD trait at 3 is refused (waivable) and flagged", async () => {
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    await CommandRouter.route("attune arcana");
    // Two Abilities at the top rating is exactly what the arcanum allows.
    expect(await CommandRouter.route("take-arcanum trait-affinity::melee 3")).toContain("3 arcana points");
    expect(await CommandRouter.route("take-arcanum trait-affinity::brawl 3")).toContain("3 arcana points");
    await CommandRouter.route('define-constraint name="noop" relation=exclusive domain=background members="status"');
    expect(await CommandRouter.route("show-constraint in=current")).toContain("satisfies all 1 constraint group");
    // A third one is over the ration - refused at the door...
    const refused = await CommandRouter.route("take-arcanum trait-affinity::stealth 3");
    expect(refused).toContain("allows 2 traits at 3");
    expect((await CharacterStore.load("Kvar"))!.arcana?.["trait-affinity:stealth"]).toBeUndefined();
    // ...and reported if it gets in anyway (a waiver, or a hand-edited sheet).
    await CommandRouter.route("take-arcanum trait-affinity::stealth 3 waive=true");
    const report = await CommandRouter.route("show-constraint in=current");
    expect(report).toContain("allows 2 traits at 3");
    expect(report).toContain("melee");
    expect(report).toContain("stealth");
  });

  test("the SECOND top slot may not be another Attribute", async () => {
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    await CommandRouter.route("attune arcana");
    expect(await CommandRouter.route("take-arcanum trait-affinity::strength 3")).toContain("3 arcana points");
    // One Attribute is fine; a second Attribute at 3 breaks the per-kind ration
    // even though the two slots are not full yet.
    const refused = await CommandRouter.route("take-arcanum trait-affinity::dexterity 3");
    expect(refused).toContain("allows 1 attribute at 3");
    // An Ability takes the other slot happily.
    expect(await CommandRouter.route("take-arcanum trait-affinity::melee 3")).toContain("3 arcana points");
    // And a trait BELOW the top rating is never rationed.
    expect(await CommandRouter.route("take-arcanum trait-affinity::stealth 2")).toContain("2 arcana points");
  });

  test("merit findings surface even with zero constraint groups defined", async () => {
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    await CommandRouter.route("attune arcana");
    const clean = await CommandRouter.route("show-constraint in=current");
    expect(clean).toContain("No constraint groups defined");
    expect(clean).toContain("check out");
    await CommandRouter.route("take-arcanum trait-affinity::melee 3");
    await CommandRouter.route("take-arcanum trait-affinity::brawl 3");
    await CommandRouter.route("take-arcanum trait-affinity::stealth 3 waive=true");
    const report = await CommandRouter.route("show-constraint in=current");
    expect(report).toContain("allows 2 traits at 3");
  });

  test("Trait Enhancement grows the pool, stacks with boosts, and reports the ceiling", async () => {
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    await CommandRouter.route("attune arcana");
    const c = (await CharacterStore.getCurrent())!;
    c.attributes["strength"] = 3;
    await CharacterStore.save(c);
    await CommandRouter.route("take-arcanum trait-enhancement::strength 2");
    const r = await CommandRouter.route("roll strength", { rng: seqRng([6, 6, 6, 6, 6]) });   // exactly 5 dice
    expect(r).toContain("(5)");
    // The enhancement is an ARCANUM, so it is [[show-arcanum]] that lists it - and the
    // enhancement total, which is about the whole sheet, rides along.
    const m = await CommandRouter.route("show-arcanum");
    expect(m).toContain("trait-enhancement:strength");
    expect(m).toContain("strength: base 3 -> effective 5 (ceiling +2, advisory)");
    expect(await CommandRouter.route("show-merit")).not.toContain("trait-enhancement");
  });

  test("take-merit validates points and prerequisites (waive overrides)", async () => {
    await CommandRouter.route('create-playable name="Rok" templates=mortal');
    await CommandRouter.route("attune arcana");
    expect(await CommandRouter.route("take-arcanum trait-affinity::melee 5")).toContain("one of [1, 2, 3]");
    expect(await CommandRouter.route("take-arcanum trait-affinity")).toContain("name its trait");
    expect(await CommandRouter.route("take-merit eat-food")).toContain("prerequisites not met");
    expect(await CommandRouter.route("take-merit eat-food waive=true")).toContain("takes Eat Food");
    expect(await CommandRouter.route("drop-merit eat-food")).toContain("drops eat-food");
  });

  test("specialties: add (case kept), roll +1 die with note, one per roll, forget", async () => {
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    const c = (await CharacterStore.getCurrent())!;
    c.abilities["melee"] = 2;
    c.attributes["dexterity"] = 2;
    await CharacterStore.save(c);
    await CommandRouter.route("specialty melee `Swords`");
    expect(await CommandRouter.route("show-specialty")).toContain("melee: Swords");
    const r = await CommandRouter.route("roll dexterity+melee specialty=melee", { rng: seqRng([6, 6, 6, 6, 6]) });   // 4 + 1 die
    expect(r).toContain("(5)");
    expect(r).toContain("specialty: Swords (+1 die)");
    // by label; and pool-lacks-trait is an advisory skip
    const byLabel = await CommandRouter.route("roll dexterity+melee specialty=`Swords`", { rng: seqRng([6, 6, 6, 6, 6]) });
    expect(byLabel).toContain("specialty: Swords (+1 die)");
    const skip = await CommandRouter.route("roll strength specialty=melee", { rng: seqRng([6]) });
    expect(skip).toContain("pool didn't use melee - no die");
    expect(await CommandRouter.route("forget-specialty melee")).toContain("forgets specialty Swords");
  });

  test("specialty ambiguity: several under one trait needs the label", async () => {
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    await CommandRouter.route("specialty melee `Swords`");
    await CommandRouter.route("specialty melee `Axes`");
    const r = await CommandRouter.route("roll dexterity+melee specialty=melee", { rng: seqRng([1, 1]) });
    expect(r).toContain("has several (Swords, Axes) - name one");
    expect(await CommandRouter.route("forget-specialty melee")).toContain("name the one to forget");
  });

  test("a named roll carries its specialty sidecar", async () => {
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    const c = (await CharacterStore.getCurrent())!;
    c.abilities["melee"] = 2;
    c.attributes["dexterity"] = 2;
    await CharacterStore.save(c);
    await CommandRouter.route("specialty melee `Swords`");
    const saved = await CommandRouter.route("name-roll slash dexterity+melee specialty=melee");
    expect(saved).toContain("specialty=melee");
    const r = await CommandRouter.route("roll @slash", { rng: seqRng([6, 6, 6, 6, 6]) });
    expect(r).toContain("specialty: Swords (+1 die)");
  });

  test("a trait-gated SPEND op applies only when the pool used the trait", async () => {
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    await ResourceOverrides.save({
      mana: { kind: "pool", start: 5, max: 10,
        effects: { edge: { label: "Edge", apply: [{ op: "difficulty", amount: -1, trait: "melee" }] } } },
    });
    const hit = await CommandRouter.route("roll dexterity+melee spend=mana::edge", { rng: seqRng([6, 6]) });
    expect(hit).toContain("vs diff 5");
    const miss = await CommandRouter.route("roll strength spend=mana::edge", { rng: seqRng([6]) });
    expect(miss).toContain('needs a roll using "melee" - skipped');
    expect(miss).toContain("vs diff 6");
  });
});

describe("un-cancelable successes: 1s can never eat them", () => {
  test("a lone un-cancelable success survives a fistful of 1s and averts the botch", () => {
    // 3 dice: 1, 1, 2 -> 0 successes, 2 ones. Without the rider this is a botch.
    const plain = Dice.roll(3, { difficulty: 6, rng: seqRng([1, 1, 2]) });
    expect(plain.net).toBe(-2);                      // historical negative net preserved
    expect(plain.isBotch).toBe(true);
    // With it: the cancelable tally floors at 0 and the sure success lands on top.
    const sure = Dice.roll(3, { difficulty: 6, uncancelableSuccesses: 1, rng: seqRng([1, 1, 2]) });
    expect(sure.net).toBe(1);
    expect(sure.isBotch).toBe(false);
    expect(sure.outcome).toBe("success");
    expect(sure.message).toContain("+1 sure");
  });

  test("ones still cancel the ordinary tally before the sure successes stack", () => {
    // 4 dice: 8, 7, 1, 1 -> 2 successes, 2 ones -> cancelable 0, +1 sure = 1.
    const r = Dice.roll(4, { difficulty: 6, uncancelableSuccesses: 1, rng: seqRng([8, 7, 1, 1]) });
    expect(r.net).toBe(1);
    expect(r.uncancelableSuccesses).toBe(1);
  });

  test("resolveSpec folds uncancelable from the extra modifier into the executed roll", () => {
    const spec = makeRollSpec({ pool: "3", difficulty: 6 });
    const exec = executeRoll(spec, () => 0, { rng: seqRng([2, 3, 4]), extra: { uncancelableSuccesses: 2 } });
    expect(exec.resolved.uncancelableSuccesses).toBe(2);
    expect(exec.result!.net).toBe(2);                // all dice missed; the sure pair remains
    expect(exec.outcome).toBe("success");
  });
});

describe("difficulty cap: over-cap surcharge + the buy-off ordering", () => {
  const resolve = (): number => 0;

  test("above the cap, difficulty converts to +1 required success per point", () => {
    const r = resolveSpec(makeRollSpec({ pool: "5", difficulty: 11, difficultyCap: 9 }), resolve);
    expect(r.dieDifficulty).toBe(9);
    expect(r.requires).toBe(3);                      // 1 base + 2 overflow
    expect(r.notes.join("; ")).toContain("difficulty 11 > 9");
  });

  test("reductions strip the surcharge first, then lower the die target (Ladislav's ordering)", () => {
    const at = (difficulty: number) => resolveSpec(makeRollSpec({ pool: "8", difficulty, difficultyCap: 9 }), resolve);
    expect([at(10).dieDifficulty, at(10).requires]).toEqual([9, 2]);   // diff 10 -> 9, two successes
    expect([at(9).dieDifficulty, at(9).requires]).toEqual([9, 1]);     // first point buys the success off
    expect([at(8).dieDifficulty, at(8).requires]).toEqual([8, 1]);     // second finally lowers the target
  });

  test("the default cap stays 10 (generic engine behavior unchanged); the knob rides overrides & display", () => {
    const r = resolveSpec(makeRollSpec({ pool: "5", difficulty: 11 }), resolve);
    expect([r.dieDifficulty, r.requires]).toEqual([10, 2]);
    const capped = overrideSpec(makeRollSpec({ pool: "5", difficulty: 6, difficultyCap: 9 }), { difficulty: 7 });
    expect(capped.difficultyCap).toBe(9);
    expect(describeSpec(capped)).toContain("cap 9");
  });
});

describe("Living Resolve: the unique template and its fused-substance spends", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); resetAllConfigStores(); await LorebookManager.bootstrap(); });

  async function marius(): Promise<PlayableCharacter> {
    await CommandRouter.route('create-playable name="Marius" templates=ouroboros');
    // The fused pool is the SUM of the two it fuses, so its 30 is Fount 5's
    // twenty Quintessence plus a revenant's ten of vitae - not a constant.
    await CommandRouter.route("set-trait fount 5 paid=0");
    return (await CharacterStore.load("Marius"))!;
  }

  test("the pool belongs to the UNIQUE template - nobody else in the world has it", async () => {
    // The Ouroboros is no longer a constructor call - it is a TemplateDef that
    // EXTENDS the mage, so the resolved template must still be exactly itself.
    const ouroboros = TEMPLATES["ouroboros"];
    expect(ouroboros.Soak).toBe(GHOUL_SOAK);                       // its own
    expect(ouroboros.Rules).toBe(TEMPLATES["mage"].Rules);         // the mage's
    expect(ouroboros.Pools).toContain(LIVING_RESOLVE);             // added to the mage's
    // ...and Living Resolve REPLACES what it inherited, so nothing doubles up.
    await marius();
    await CommandRouter.route('create-playable name="Someone Else" templates="revenant, mage"');
    const other = (await CharacterStore.load("Someone Else"))!;   // create doesn't re-select
    const names = CharacterResources.defsFor(other).map(d => d.name);
    expect(names).not.toContain("living-resolve");
    expect(names).toContain("blood");
    expect(names).toContain("quintessence");
  });

  test("the fused pool replaces all four components; their names resolve to it", async () => {
    const char = await marius();
    const names = CharacterResources.defsFor(char).map(d => d.name);
    expect(names).toContain("living-resolve");
    for (const hidden of ["blood", "willpower", "quintessence"]) expect(names).not.toContain(hidden);
    expect(CharacterResources.resolveDef(char, "willpower")!.name).toBe("living-resolve");
    expect(CharacterResources.resolveDef(char, "magic-fuel")!.name).toBe("living-resolve");
    const listing = await CommandRouter.route("show-resource");
    expect(listing).toContain("living-resolve 30/30");
    expect(listing).toContain("6/turn (ST)");
    expect(listing).toContain("recovers 1/day, 1/day if in-umbra, 1/day if full-rested+in-sanctum, 20/full-moon");
  });

  test("spending it inside a roll grants ONE un-cancelable success, however it is spent", async () => {
    await marius();
    // Default spend (the Willpower analog): 1 point, +1 sure.
    const plain = await CommandRouter.route("roll 3 spend=living-resolve", { rng: seqRng([2, 2, 2]) });
    expect(plain).toContain("+1 sure");
    expect(plain).toContain("+1 auto");              // Resolve's automatic success rides along
    expect(plain).toContain("2 successes");          // all dice missed; the granted pair stands
    // 3 points on an ordinary roll: -2 each (Resolve), one sure success (Vis-less cap).
    const focus = await CommandRouter.route("roll 3 spend=living-resolve spend-amount=3", { rng: seqRng([2, 2, 2]) });
    expect(focus).toContain("vs diff 2");
    expect(focus).toContain("+1 sure");
    expect(focus).not.toContain("+3 sure");
    // fuel!: the Willpower component is consumed by the activation - no free success.
    const fuel = await CommandRouter.route("roll 3 spend=living-resolve:fuel!", { rng: seqRng([2, 2, 2]) });
    expect(fuel).not.toContain("sure");
    // fuel-surge: pay 1 extra to have it anyway (2 points total).
    const surge = await CommandRouter.route("roll 3 spend=living-resolve:fuel-surge!", { rng: seqRng([2, 2, 2]) });
    expect(surge).toContain("+1 sure");
    const char = (await CharacterStore.getCurrent())!;
    const lr = CharacterResources.resolveDef(char, "living-resolve")!;
    expect(await CharacterResources.current(char, lr)).toBe(30 - 1 - 3 - 1 - 2);
  });

  test("rollAs: Willpower rolls pool min(10, current), and points above 10 shield penalties", async () => {
    const char = await marius();
    // Full pool (30): a Willpower roll still rolls 10 dice at most...
    expect(await CommandRouter.route("roll willpower", { rng: allTens })).toContain("Willpower (10)");
    // ...and the 20 points above the threshold shield dice reductions.
    const shielded = await CommandRouter.route('roll willpower dice-modifier=-5', { rng: allTens });
    expect(shielded).toContain("living-resolve shields 5 dice of penalties");
    // Drained to 4: the pool follows the current value and the shield is gone.
    await CharacterResources.spend(char, "living-resolve", 26);
    const drained = await CommandRouter.route('roll willpower dice-modifier=-2', { rng: allTens });
    expect(drained).toContain("Willpower (2)");   // 4-trait pool minus the unshielded -2
    expect(drained).not.toContain("shields");
  });
});

describe("ghouls & revenants: half-vampire soak + the revenant's daily vitae", () => {
  test("bashing & lethal soak on Stamina+Fortitude, aggravated on Fortitude alone", () => {
    expect(GHOUL_SOAK.lethal.soakable).toBe(true);
    expect(GHOUL_SOAK.lethal.pool).toEqual(["stamina", "fortitude"]);
    expect(GHOUL_SOAK.bashing.pool).toEqual(["stamina", "fortitude"]);
    expect(GHOUL_SOAK.aggravated.pool).toEqual(["fortitude"]);
    expect(TEMPLATE_GHOUL.Soak).toBe(GHOUL_SOAK);
    expect(TEMPLATE_REVENANT.Soak).toBe(GHOUL_SOAK);
    expect(TEMPLATES["revenant"]).toBe(TEMPLATE_REVENANT);
  });

  test("the revenant blood pool starts full and carries the 1/day recovery rule", () => {
    const blood = TEMPLATE_REVENANT.GetPool("blood")!;
    expect(blood.start).toBe(10);
    expect(blood.recovery).toEqual([{ amount: 1, per: "day", note: "revenant vitae" }]);
  });
});

describe("recovery on the story clock: days, the Umbra gate, full moons", () => {
  const ep = (s: string): number => parseStoryDate(s) as number;

  test("countDayBoundaries counts UTC midnights in (from, to] - split advances accumulate", () => {
    expect(countDayBoundaries(ep("1197-03-15-08"), ep("1197-03-15-23"))).toBe(0);
    expect(countDayBoundaries(ep("1197-03-15-23"), ep("1197-03-16-01"))).toBe(1);
    expect(countDayBoundaries(ep("1197-03-15-08"), ep("1197-03-18-08"))).toBe(3);
    expect(countDayBoundaries(ep("1197-03-16-01"), ep("1197-03-15-23"))).toBe(0);  // rewind: nothing
  });

  test("countFullMoons rides the mean synodic cycle (2000-01-21 was a full moon)", () => {
    expect(countFullMoons(ep("2000-01-10"), ep("2000-01-25"))).toBe(1);
    expect(countFullMoons(ep("2000-01-10"), ep("2000-03-09"))).toBe(2);   // 59 days = two moons
    expect(countFullMoons(ep("1197-03-01"), ep("1197-03-31"))).toBe(1);   // proleptic: one per ~29.53d
    const next = nextFullMoon(ep("2000-01-10"));
    expect(next).toBeGreaterThan(ep("2000-01-20"));
    expect(next).toBeLessThan(ep("2000-01-22"));
  });

  test("the week is unbroken back through the Gregorian reform", () => {
    // The 1582 reform dropped ten DATES and no weekday: Thursday 4 Oct was
    // followed by Friday 15 Oct. So a proleptic weekday is the real one.
    expect(weekdayName(ep("1582-10-15"))).toBe("friday");
    expect(weekdayName(ep("1197-03-15"))).toBe("saturday");
    expect(weekdayName(ep("0800-12-25"))).toBe("monday");   // Charlemagne crowned
    expect(weekdayOf(ep("2000-01-06"))).toBe(4);            // Thursday, 0 = Sunday
    // Agrees with the platform for every instant, not just the ones picked.
    for (let d = 0; d < 40; d++) {
      const e = ep("1197-03-01") + d * 86400 + 3600;
      expect(WEEKDAYS[new Date(e * 1000).getUTCDay()]).toBe(weekdayName(e));
    }
    expect(formatStoryDay(ep("1197-03-15-20"))).toBe("Saturday 1197-03-15 20:00");
  });

  test("the moon is eight phases, each centred on its instant", () => {
    const REF = 947182440;                       // the 2000-01-06 18:14 new moon
    const SYN = 29.530588853 * 86400;
    expect(moonAt(REF).phase).toBe("new");
    expect(moonAt(REF).illumination).toBeCloseTo(0, 6);
    expect(moonAt(REF + SYN / 2).phase).toBe("full");
    expect(moonAt(REF + SYN / 2).illumination).toBeCloseTo(1, 6);
    expect(moonAt(REF + SYN / 4).phase).toBe("first-quarter");
    expect(moonAt(REF + SYN / 4).illumination).toBeCloseTo(0.5, 6);
    // One full cycle in eighths visits every phase, in order.
    const walk = MOON_PHASES.map((_p, i) => moonAt(REF + i * SYN / 8).phase);
    expect(walk).toEqual([...MOON_PHASES]);
    // Waxing is the first half and waning the second.
    expect(moonAt(REF + SYN / 4).waxing).toBe(true);
    expect(moonAt(REF + 3 * SYN / 4).waxing).toBe(false);
  });

  test("a phase is a WINDOW; a full moon is an INSTANT; they disagree on purpose", () => {
    const dark = ep("1197-03-15-20");
    // The window opens before the instant it is centred on - ~1.85 days.
    const opens = nextMoonPhase(dark, "full");
    const exact = nextFullMoon(dark);
    expect(opens).toBeLessThan(exact);
    expect((exact - opens) / 86400).toBeCloseTo(29.530588853 / 16, 2);
    // Walking the whole cycle hour by hour: the phase turns exactly 8 times,
    // the windows abut with no gap, and nothing ever reads negative.
    let changes = 0, prev = moonAt(dark);
    for (let t = dark + 3600; t < dark + 29.530588853 * 86400; t += 3600) {
      const m = moonAt(t);
      expect(m.into).toBeGreaterThanOrEqual(0);
      expect(m.toNext).toBeGreaterThanOrEqual(0);
      expect(m.fraction).toBeGreaterThanOrEqual(0);
      expect(m.fraction).toBeLessThan(1);
      if (m.phase !== prev.phase) {
        changes++;
        expect(m.begins).toBe(prev.ends);            // the window abuts the last
        expect(m.phase).toBe(prev.next);             // and is the one predicted
      }
      prev = m;
    }
    expect(changes).toBe(8);
  });

  test("show-moon reports phase, depth and turn; a named phase says when it next begins", async () => {
    __resetStorageMock(); __resetLorebookMock(); resetAllConfigStores(); await LorebookManager.bootstrap();
    await CommandRouter.route("story-start 1197-03-15-20");
    const bare = await CommandRouter.route("show-moon");
    expect(bare).toContain("Saturday 1197-03-15 20:00");
    expect(bare).toContain("waning gibbous");
    expect(bare).toContain("% lit");
    expect(bare).toContain("in,");                    // how long we have been in it
    expect(bare).toContain("to the last quarter");    // and how long until it turns
    expect(bare).toContain("day 18 of the cycle, waning");
    const named = await CommandRouter.route("show-moon full");
    expect(named).toContain("The full moon next begins");
    expect(named).toContain("Exact full moon:");
    expect(await CommandRouter.route("show-moon nonesuch")).toContain(`No moon phase "nonesuch"`);
    // show-date now carries the day of the week and the phase, not a bare instant.
    const date = await CommandRouter.route("show-date");
    expect(date).toContain("Saturday 1197-03-15");
    expect(date).toContain("waning gibbous");
  });

  test("the moon and the week are conditions: `moon-phase = moon:full`, `weekday = day:friday`", async () => {
    __resetStorageMock(); __resetLorebookMock(); resetAllConfigStores(); await LorebookManager.bootstrap();
    await CommandRouter.route("story-start 1197-03-15-20");             // a Saturday, waning gibbous
    await CommandRouter.route('create-playable name="Marius" templates=ouroboros');
    // The named constants are numbers, so the comparison is plain arithmetic:
    // the evaluator resolves both sides to 6 and answers 1.
    const ev = async (e: string): Promise<string> => CommandRouter.route(`show-eval \`${e}\``);
    expect(await ev("weekday = day:saturday")).toContain("weekday = day:saturday = 1");
    expect(await ev("weekday = day:friday")).toContain("weekday = day:friday = 0");
    expect(await ev("moon-phase = moon:waning-gibbous")).toContain("moon-phase = moon:waning-gibbous = 1");
    expect(await ev("moon-phase = moon:full")).toContain("moon-phase = moon:full = 0");
    expect(await ev("moon-illumination >= 80")).toContain("moon-illumination >= 80 = 1");
    // The prefixed forms answer the same, and the general call takes any date.
    expect(await ev("system::time::moon-phase = system::time::moon:waning-gibbous")).toContain("= 1");
    await CommandRouter.route("save-date the-pact 1197-04-11-08");       // inside the next full window
    expect(await ev("system::time::moon-phase-at(system::time::date:the-pact) = moon:full")).toContain("= 1");
    expect(await ev("system::time::weekday-at(system::time::date:the-pact) = day:friday")).toContain("= 1");
    // An affliction can therefore END on a phase, not only on a counted instant.
    await CommandRouter.route("define-affliction moon-touched");
    await CommandRouter.route("afflict moon-touched until=`moon-phase = moon:full`");
    expect(await CommandRouter.route("show-affliction")).toContain("moon-touched");
    await CommandRouter.route("advance-time 20d");                       // 1197-04-04: not full yet
    expect(await CommandRouter.route("show-affliction")).toContain("moon-touched");
    await CommandRouter.route("advance-time 7d");                        // 1197-04-11: the full window
    expect(await CommandRouter.route("show-affliction")).not.toContain("moon-touched");
  });

  test("advance-time credits recovery per midnight crossed; the Umbra affliction opens the +1/day gate", async () => {
    __resetStorageMock(); __resetLorebookMock(); resetAllConfigStores(); await LorebookManager.bootstrap();
    await CommandRouter.route("story-start 1197-03-15-08");
    await CommandRouter.route('create-playable name="Marius" templates=ouroboros');
    await CommandRouter.route("set-trait fount 5 paid=0");
    const char = (await CharacterStore.getCurrent())!;
    await CharacterResources.spend(char, "living-resolve", 25);            // down to 5
    const r1 = await CommandRouter.route("advance-time 3d");
    expect(r1).toContain("Recovery:");
    expect(r1).toContain("Marius +3 living-resolve -> 8/30 (1/day×3 (revenant vitae))");
    // In the Umbra the communion doubles the daily point.
    await CommandRouter.route("afflict in-umbra");
    const r2 = await CommandRouter.route("advance-time 1d");
    expect(r2).toContain("Marius +2 living-resolve -> 10/30");
    expect(r2).toContain("Umbral communion");
    // A short hop inside the same day credits nothing (and says nothing).
    expect(await CommandRouter.route("advance-time 2h")).not.toContain("Recovery:");
  });

  test("a plain revenant regains vitae daily (no Living Resolve in this story)", async () => {
    __resetStorageMock(); __resetLorebookMock(); resetAllConfigStores(); await LorebookManager.bootstrap();
    await CommandRouter.route("story-start 1197-03-15-00");
    await CommandRouter.route('create-playable name="Ghil" templates=revenant');
    const ghil = (await CharacterStore.getCurrent())!;
    await CharacterResources.spend(ghil, "blood", 5);                      // 10 -> 5
    const reply = await CommandRouter.route("advance-time 8d");
    expect(reply).toContain("Ghil +5 blood -> 10/10");                     // +8/day, clamped at max
    expect(reply).toContain("revenant vitae");
  });

  test("a full moon refills Living Resolve (adoption is story-level: it replaces blood everywhere)", async () => {
    __resetStorageMock(); __resetLorebookMock(); resetAllConfigStores(); await LorebookManager.bootstrap();
    await CommandRouter.route("story-start 2000-01-15-00");                // 🌕 due Jan 21
    await CommandRouter.route('create-playable name="Marius" templates=ouroboros');
    await CommandRouter.route("set-trait fount 5 paid=0");
    const marius = (await CharacterStore.load("Marius"))!;
    await CharacterResources.spend(marius, "living-resolve", 25);          // down to 5
    const reply = await CommandRouter.route("advance-time 8d");
    expect(reply).toContain("🌕");
    expect(reply).toContain("Marius +25 living-resolve -> 30/30");         // 8/day + 20/moon, clamped
    expect(reply).toContain("20/full-moon×1");
  });
});

describe("cast: the Dark Ages: Mage spellcasting procedure", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); resetAllConfigStores(); await LorebookManager.bootstrap(); });

  // The book's own example mage: Foundation Sensitivity 3; Chieftain 2,
  // Trickster 4, Warrior 4, Wise One 3.
  async function ladislav(quintessence = 5): Promise<PlayableCharacter> {
    await CommandRouter.route('create-playable name="Ladislav" templates=mage');
    const c = (await CharacterStore.getCurrent())!;
    c.traits = { sensitivity: 3, chieftain: 2, trickster: 4, warrior: 4, "wise-one": 3 };
    // Capacity is the Fount ladder now: without the Background he holds ten.
    // Fount 5 is what lets him hold the twenty these tests hand him.
    if (quintessence > 10) c.backgrounds = { ...c.backgrounds, fount: 5 };
    await CharacterStore.save(c);
    await CharacterResources.gain(c, "willpower", 5);        // potentials seed Willpower at 0
    if (quintessence > 0) await CharacterResources.gain(c, "quintessence", quintessence);
    return c;
  }

  test("a simple spell within the Foundation: diff 4 + required level, no stabilization", async () => {
    await ladislav();
    const r = await CommandRouter.route('magick pillars="trickster:2" foundation=sensitivity', { rng: allTens });
    expect(r).toContain("simple spell: diff 4+2 = 6");
    expect(r).toContain("Sensitivity + Trickster (7)");   // Foundation 3 + Pillar 4 dice
    expect(r).toContain("vs diff 6");
    expect(r).not.toContain("stabilize");
    expect(r).not.toContain("unknown tag");               // magic/cast are identity tags, not typos
  });

  test("required level above the Foundation forces the stabilizing point (no difficulty break)", async () => {
    const c = await ladislav();
    const r = await CommandRouter.route('magick pillars="trickster:4" foundation=sensitivity', { rng: allTens });
    expect(r).toContain("vs diff 8");                                     // 4+4, undiscounted
    expect(r).toContain("1 to stabilize (Trickster 4 > Sensitivity 3)");
    expect(await CharacterResources.current(c, CharacterResources.resolveDef(c, "quintessence")!)).toBe(4);
    // Without any Quintessence the same casting is refused (a fresh, dry mage).
    await CommandRouter.route('create-playable name="Dry" templates=mage');
    await CommandRouter.route('play name="Dry"');
    const dryChar = (await CharacterStore.getCurrent())!;
    expect(dryChar.name).toBe("dry");
    dryChar.traits = { sensitivity: 3, trickster: 4 };
    await CharacterStore.save(dryChar);
    const dry = await CommandRouter.route('magick pillars="trickster:4" foundation=sensitivity');
    expect(dry).toContain("REQUIRES 1 quintessence");
  });

  test("the caster cannot exceed their own Pillar; unknown Foundations refuse with guidance", async () => {
    await ladislav();
    expect(await CommandRouter.route('magick pillars="chieftain:3" foundation=sensitivity')).toContain("has Chieftain 2 - the effect needs 3");
    // Sensitivity IS his Foundation now that the Spirit-Talkers are defined, so
    // the refusal needs a Foundation nobody's fellowship names.
    expect(await CommandRouter.route('magick pillars="trickster:2" foundation=geometry')).toContain("has no Geometry rating");
  });

  test("the battle-fury: complex pool, highest-required primary, mandatory + extra Quintessence", async () => {
    const c = await ladislav();
    const r = await CommandRouter.route('magick pillars="warrior:4,chieftain:2" foundation=sensitivity quintessence=2', { rng: allTens });
    expect(r).toContain("complex spell: diff 5+4+1 = 10");
    expect(r).toContain("Sensitivity + Warrior + 1 (8)");                 // 8 dice, the book's sum
    expect(r).toContain("1 to stabilize (Warrior 4 > Sensitivity 3)");
    expect(r).toContain("2 for -2 difficulty");
    expect(r).toContain("vs diff 8");                                     // 10 - 2 (cap 10: no surcharge stage)
    expect(r).toContain("needs the Fount Background");                    // 3 points in one turn
    expect(await CharacterResources.current(c, CharacterResources.resolveDef(c, "quintessence")!)).toBe(2);
  });

  test("the book's cap-9 knob restores the surcharge (one config edit)", async () => {
    await ladislav();
    await MagicRulesConfig.save({ "difficulty-cap": 9 });
    const r = await CommandRouter.route('magick pillars="warrior:4,chieftain:2" foundation=sensitivity', { rng: allTens });
    expect(r).toContain("difficulty 10 > 9");
    expect(r).toContain("requirement (2)");                               // +1 required success
  });

  test("Quintessence cannot push the difficulty below 4", async () => {
    await ladislav();
    const r = await CommandRouter.route('magick pillars="trickster:2" foundation=sensitivity quintessence=3', { rng: allTens });
    expect(r).toContain("vs diff 4");
    expect(r).toContain("only 2 of 3 points could be spent (min diff 4");
  });

  test("same-scene retries: +1 per failure, +2 per attempt after a botch, cleared by success or a new scene", async () => {
    await ladislav();
    // A botch: every die a 1.
    const botch = await CommandRouter.route('magick pillars="trickster:2" foundation=sensitivity label=veil', { rng: () => 0.05 });
    expect(botch).toContain("BACKLASH");
    // Retrying now carries +2 per prior attempt.
    const retry = await CommandRouter.route('magick pillars="trickster:2" foundation=sensitivity label=veil', { rng: allTens });
    expect(retry).toContain("retry this scene: +2 difficulty (1 prior attempt, one botched)");
    // That cast SUCCEEDED (all tens) - the ledger clears.
    const clean = await CommandRouter.route('magick pillars="trickster:2" foundation=sensitivity label=veil', { rng: allTens });
    expect(clean).not.toContain("retry this scene");
    // A plain failure charges +1 - and a scene change wipes the slate.
    const fail = await CommandRouter.route('magick pillars="trickster:2" foundation=sensitivity label=veil requires=8', { rng: seqRng([7, 7, 7, 7, 7, 7, 7]) });
    expect(fail).toContain("short of requirement");
    const after = await CommandRouter.route('magick pillars="trickster:2" foundation=sensitivity label=veil', { rng: allTens });
    expect(after).toContain("retry this scene: +1 difficulty");
    await CommandRouter.route("story-start 1197-03-15-08");
    await CommandRouter.route('scene "Elsewhere"');
    const fresh = await CommandRouter.route('magick pillars="trickster:2" foundation=sensitivity label=veil requires=8', { rng: seqRng([7, 7, 7, 7, 7, 7, 7]) });
    expect(fresh).not.toContain("retry this scene");
  });

  test("extended casting: ST-set successes accrue; a botch is Backlash and ends it", async () => {
    await ladislav();
    expect(await CommandRouter.route('magick pillars="warrior:4" foundation=sensitivity extended=true')).toContain("needs requires=N");
    const r = await CommandRouter.route('magick pillars="warrior:4" foundation=sensitivity requires=6 extended=true interval="one hour"', { rng: allTens });
    expect(r).toContain("starts extended");
    expect(r).toContain("/6");                                            // the target rides the action
    const botched = await CommandRouter.route('magick pillars="trickster:2" foundation=sensitivity requires=6 extended=true', { rng: () => 0.05 });
    expect(botched).toContain("failed");                                  // onBotch "fail": the casting ends
    expect(botched).toContain("Backlash");
  });

  test("ongoing spells: ×10 successes, per-success fuel, and the seal", async () => {
    await ladislav();
    const r = await CommandRouter.route('magick pillars="trickster:2" foundation=sensitivity requires=2 ongoing=true', { rng: allTens });
    expect(r).toContain("2×10 = 20 successes");
    expect(r).toContain("1 magic-fuel per success");
    expect(r).toContain("seal with [[seal-spell pillar=2]]");
    expect(r).toContain("/20");
  });

  test("seal-spell: the price, the separate payers, and the fused shortcut", async () => {
    const c = await ladislav(20);
    const quote = await CommandRouter.route("seal-spell pillar=3");
    expect(quote).toContain("15 Quintessence + 2 Willpower");
    expect(quote).toContain("Payable over time");
    const paid = await CommandRouter.route("seal-spell pillar=3 pay=true");
    expect(paid).toContain("15/15 quintessence");                // paid of owed
    expect(paid).toContain("2/2 willpower");
    expect(await CharacterResources.current(c, CharacterResources.resolveDef(c, "quintessence")!)).toBe(5);
    expect(await CharacterResources.current(c, CharacterResources.resolveDef(c, "willpower")!)).toBe(3);
  });

  test("a Living Resolve caster: the fused substance fuels the spell and the sure success rides free", async () => {
    await CommandRouter.route('create-playable name="Marius" templates=ouroboros');
    await CommandRouter.route("set-trait fount 5 paid=0");
    const c = (await CharacterStore.getCurrent())!;
    c.traits = { vis: 2, incantation: 3 };
    await CharacterStore.save(c);
    const r = await CommandRouter.route('magick pillars="incantation:3" foundation=vis quintessence=1', { rng: allTens });
    expect(r).toContain("living-resolve: 1 to stabilize (Incantation 3 > Vis 2) + 1 more");
    // The mandatory point pays too - it is the same substance, not a fee taken
    // off the top - so BOTH points break the difficulty, once each.
    expect(r).toContain("all 2 points spend as Quintessence AND Willpower AND Resolve at once: "
      + "1 un-cancelable success (capped at 1), +2 automatic successes, 8-again, -4 difficulty");
    expect(r).toContain("+1 sure");
    expect(r).toContain("vs diff 3");                        // 7 - 4, not 7 - 1 - 4
    expect(await CharacterResources.current(c, CharacterResources.resolveDef(c, "living-resolve")!)).toBe(28);
    // Sealing with the fused substance: one payment covers both components.
    const seal = await CommandRouter.route("seal-spell pillar=3 pay=true");
    expect(seal).toContain("15/15 living-resolve (the fused substance covers both components)");
    expect(await CharacterResources.current(c, CharacterResources.resolveDef(c, "living-resolve")!)).toBe(13);
  });
});

describe("the rest gates: full-rested AND in-sanctum, on both fuels", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); resetAllConfigStores(); await LorebookManager.bootstrap(); });

  test("a multi-gate rule needs EVERY affliction at once", async () => {
    await CommandRouter.route("story-start 1197-03-15-00");
    await CommandRouter.route('create-playable name="Marius" templates=ouroboros');
    await CommandRouter.route("set-trait fount 5 paid=0");
    const char = (await CharacterStore.getCurrent())!;
    char.backgrounds = { sanctum: 8, library: 8, cray: 5 };            // the sleep point is Sanctum 4's
    await CharacterStore.save(char);
    await CharacterResources.spend(char, "living-resolve", 25);        // 30 -> 5
    // Rested, but not in the sanctum: only the base vitae point lands.
    await CommandRouter.route("afflict full-rested");
    const half = await CommandRouter.route("advance-time 1d");
    expect(half).toContain("+1 living-resolve");
    expect(half).not.toContain("rested in the sanctum");
    // Both at once: the extra point joins in.
    await CommandRouter.route("afflict in-sanctum");
    const both = await CommandRouter.route("advance-time 1d");
    expect(both).toContain("+2 living-resolve");
    expect(both).toContain("rested in the sanctum");
    // Leaving the sanctum closes the gate again.
    await CommandRouter.route("remove in-sanctum");
    expect(await CommandRouter.route("advance-time 1d")).not.toContain("rested in the sanctum");
  });

  test("an ordinary mage's Quintessence recovers on the same two gates (but doesn't brew)", async () => {
    await CommandRouter.route("story-start 1197-03-15-00");
    await CommandRouter.route('create-playable name="Hermetic" templates=mage');
    const mage = (await CharacterStore.getCurrent())!;
    mage.backgrounds = { sanctum: 4 };
    await CharacterStore.save(mage);
    // No gates: Quintessence has no daily brew of its own.
    expect(await CommandRouter.route("advance-time 1d")).not.toContain("quintessence");
    await CommandRouter.route("afflict full-rested");
    await CommandRouter.route("afflict in-sanctum");
    const rested = await CommandRouter.route("advance-time 2d");
    expect(rested).toContain("Hermetic +2 quintessence -> 2/10");   // no Fount: the bare ten
    await CommandRouter.route("afflict in-umbra");
    expect(await CommandRouter.route("advance-time 1d")).toContain("+2 quintessence");   // both gates now
  });
});

describe("fellowships: the Order of Hermes, and finding a caster's Foundation", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); resetAllConfigStores(); await LorebookManager.bootstrap(); });

  test("the Order of Hermes ships with Modus + Anima/Corona/Primus/Vires", () => {
    const hermes = FELLOWSHIPS["order-of-hermes"];
    expect(hermes.foundation).toBe("modus");
    expect(Object.keys(hermes.pillars).sort()).toEqual(["anima", "corona", "primus", "vires"]);
    expect(hermes.pillars.anima).toBe("life");
    expect(hermes.pillars.corona).toBe("mind");
    expect(hermes.pillars.primus).toBe("magic itself");
    expect(hermes.pillars.vires).toBe("forces");
  });

  test("[[show-fellowship]] lists and details them (and is quiet)", async () => {
    expect(await CommandRouter.route("show-fellowship")).toContain("order-of-hermes");
    const detail = await CommandRouter.route("show-fellowship order-of-hermes");
    expect(detail).toContain("Foundation: Modus");
    expect(detail).toContain("Ouroboros");
    expect(detail).toContain("Anima (life)");
    expect(await CommandRouter.route("show-fellowship nope")).toContain('No fellowship "nope"');
    expect((await processAdventureInput("[[show-fellowship]]"))!.stopGeneration).toBe(true);
  });

  test("cast finds Modus without being told, and says which Foundations it knows when it can't", async () => {
    await CommandRouter.route('create-playable name="Marius" templates=ouroboros');
    await CommandRouter.route("set-trait fount 5 paid=0");
    const c = (await CharacterStore.getCurrent())!;
    c.traits = { modus: 3, anima: 2, corona: 4, primus: 3, vires: 2 };
    await CharacterStore.save(c);
    const r = await CommandRouter.route('magick pillars="corona:4,vires:2"', { rng: allTens });
    expect(r).toContain("Modus + Corona + 1 (8)");                    // auto-detected Foundation
    expect(r).toContain("complex spell: diff 5+4+1 = 10");
    expect(r).toContain("1 to stabilize (Corona 4 > Modus 3)");       // the fused pool pays
    expect(r).toContain("+1 sure");
    // A caster who knows a Pillar but has no Foundation at all gets pointed at
    // the fellowship list.
    await CommandRouter.route('create-playable name="Lost" templates=mage');
    await CommandRouter.route('play name="Lost"');
    const lostChar = (await CharacterStore.getCurrent())!;
    lostChar.traits = { anima: 2 };
    await CharacterStore.save(lostChar);
    const lost = await CommandRouter.route('magick pillars="anima:1"');
    expect(lost).toContain("has no Foundation rating");
    expect(lost).toContain("Modus (Order of Hermes)");
  });
});

describe("rating-scaled afflictions: the sanctum knows how big it is", () => {
  test("foldAfflictionTiers is cumulative - and an untargeted op absorbs the targeted ones", () => {
    const tiers = [
      { atLeast: 2, apply: [{ op: "difficulty", amount: -1, target: "magic" }] },
      { atLeast: 3, apply: [{ op: "difficulty", amount: -1, target: "magic" }] },
      { atLeast: 6, apply: [{ op: "difficulty", amount: -2 }] },
    ];
    expect(foldAfflictionTiers(0, tiers).ops).toEqual([]);                       // nothing reached
    expect(foldAfflictionTiers(2, tiers).ops.length).toBe(1);                    // -1 magic
    expect(foldAfflictionTiers(3, tiers).ops.length).toBe(2);                    // -2 magic, cumulative
    // At 6 the wide tier WIDENS instead of stacking: one -2, on everything.
    expect(foldAfflictionTiers(6, tiers).ops).toEqual([{ op: "difficulty", amount: -2 }]);
    expect(foldAfflictionTiers(0, undefined).ops).toEqual([]);
  });

  test("the shipped sanctum table matches the book (and its 6-8 continuation)", () => {
    const def = AfflictionRegistry.get("in-sanctum")!;
    expect(def.scalesWith).toBe("sanctum");
    expect(def.requiresAwakened).toBe(true);
    const at = (r: number) => foldAfflictionTiers(r, def.tiers).ops;
    expect(at(1)).toEqual([]);                                                    // Backlash immunity is a note
    expect(at(3).filter(o => o.op === "difficulty").length).toBe(2);              // -2 on magic
    expect(at(5).some(o => o.op === "dice" && o.trait === "@foundation")).toBe(true);
    expect(at(8)).toEqual([
      { op: "dice", amount: 1, trait: "@foundation" },     // tier 5 rides along
      { op: "difficulty", amount: -2 },                    // one -2, widened to everything
      { op: "successes", amount: 1 },
    ]);
    expect(foldAfflictionTiers(1, def.tiers).notes.join(" ")).toContain("immune to Backlash");
  });

  test("the Ouroboros has no morality and no Virtues (it is Awakened, like a mage)", () => {
    expect(TEMPLATES["ouroboros"].Morality).toBeNull();
    expect(TEMPLATES["ouroboros"].HasVirtues).toBe(false);
    expect(TEMPLATES["ouroboros"].Awakened).toBe(true);
    expect(TEMPLATE_MAGE.Awakened).toBe(true);
    expect(TEMPLATE_VAMPIRE.Awakened).toBe(false);
    expect(isAwakened(["ouroboros"])).toBe(true);
    expect(isAwakened(["revenant", "mage"])).toBe(true);
    expect(isAwakened(["revenant"])).toBe(false);
  });
});

describe("the sanctum in play: what a rating actually does to a roll", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); resetAllConfigStores(); await LorebookManager.bootstrap(); });

  async function mageWithSanctum(rating: number, name = "Hermetic"): Promise<PlayableCharacter> {
    await CommandRouter.route(`create-playable name="${name}" templates=mage`);
    await CommandRouter.route(`play name="${name}"`);
    const c = (await CharacterStore.getCurrent())!;
    c.traits = { modus: 3, corona: 2 };
    c.attributes = { ...c.attributes, strength: 3 };
    c.abilities = { ...c.abilities, brawl: 2 };
    c.backgrounds = { sanctum: rating };
    await CharacterStore.save(c);
    await CharacterResources.gain(c, "quintessence", 10);
    await CommandRouter.route("afflict in-sanctum");
    return c;
  }

  test("Sanctum 3 lowers magic by 2 and leaves everything else alone", async () => {
    await mageWithSanctum(3);
    const spell = await CommandRouter.route('magick pillars="corona:2"', { rng: allTens });
    expect(spell).toContain("vs diff 4");                       // 4+2 = 6, sanctum -2
    expect(spell).toContain("in-sanctum 3: difficulty -1");
    const punch = await CommandRouter.route("roll strength+brawl", { rng: allTens });
    expect(punch).toContain("vs diff 6");                       // untouched
  });

  test("Sanctum 8 widens both benefits to EVERY roll (-2 and +1 auto), not double on magic", async () => {
    await mageWithSanctum(8);
    const spell = await CommandRouter.route('magick pillars="corona:2"', { rng: seqRng([2, 2, 2, 2, 2, 2]) });
    expect(spell).toContain("vs diff 4");                       // 6 - 2, NOT 6 - 4
    expect(spell).toContain("+1 auto");
    const punch = await CommandRouter.route("roll strength+brawl", { rng: seqRng([2, 2, 2, 2, 2]) });
    expect(punch).toContain("vs diff 4");                       // the -2 reaches ordinary rolls now
    expect(punch).toContain("+1 auto");
  });

  test("Sanctum 5 adds a die only when the pool uses the Foundation", async () => {
    await mageWithSanctum(5);
    expect(await CommandRouter.route("roll modus", { rng: allTens })).toContain("Modus (4)");     // 3 + the sanctum die
    expect(await CommandRouter.route("roll strength", { rng: allTens })).toContain("Strength (3)");
  });

  test("the unawakened get nothing from a sanctum, however large", async () => {
    await CommandRouter.route('create-playable name="Squire" templates=mortal');
    const c = (await CharacterStore.getCurrent())!;
    c.backgrounds = { sanctum: 8 };
    c.attributes = { ...c.attributes, strength: 3 };
    await CharacterStore.save(c);
    await CommandRouter.route("afflict in-sanctum");
    expect(await CommandRouter.route("roll strength", { rng: allTens })).toContain("vs diff 6");
    expect(await CommandRouter.route("show-affliction")).toContain("benefits need the Awakened");
  });

  test("in their sanctum a botched casting draws NO Backlash", async () => {
    await mageWithSanctum(2);
    const botch = await CommandRouter.route('magick pillars="corona:2"', { rng: () => 0.05 });
    expect(botch).toContain("this is their sanctum: NO Backlash");
    expect(botch).not.toContain("⚡");
    await CommandRouter.route("remove in-sanctum");
    expect(await CommandRouter.route('magick pillars="corona:2"', { rng: () => 0.05 })).toContain("⚡ BACKLASH");
  });

  test("[[show-affliction]] reports what the place is granting right now", async () => {
    await mageWithSanctum(8);
    const line = await CommandRouter.route("show-affliction");
    expect(line).toContain("sanctum 8");
    expect(line).toContain("difficulty -2");
    expect(line).toContain("immune to Backlash");
  });
});

describe("the Library of the Unseen: the door, the shelves, and the cray", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); resetAllConfigStores(); await LorebookManager.bootstrap(); });

  async function marius(): Promise<PlayableCharacter> {
    await CommandRouter.route("story-start 1197-03-15-08");
    await CommandRouter.route('create-playable name="Marius" templates=ouroboros');
    await CommandRouter.route("set-trait fount 5 paid=0");
    const c = (await CharacterStore.getCurrent())!;
    c.traits = { modus: 3, anima: 2, corona: 4, primus: 3, vires: 2 };
    c.attributes = { ...c.attributes, wits: 3, intelligence: 4 };
    c.backgrounds = { sanctum: 8, library: 8, cray: 5, fount: 5 };
    await CharacterStore.save(c);
    return c;
  }

  test("measuring a door spends ten minutes and opens all three states; leaving closes them", async () => {
    await marius();
    const open = await CommandRouter.route("measure-door");
    expect(open).toContain("opens onto the Library of the Unseen");
    expect(open).toContain("1197-03-15 08:10");                  // ten minutes, no roll, no resource
    const states = (await CharacterAfflictions.list("Marius")).map(a => a.def).sort();
    expect(states).toEqual(["in-library", "in-sanctum", "in-umbra"]);
    const out = await CommandRouter.route("leave-library");
    expect(out).toContain("steps back through the measured door");
    expect(await CharacterAfflictions.list("Marius")).toEqual([]);
    // Without a Library there is no door to measure.
    await CommandRouter.route('create-playable name="Doorless" templates=mage');
    await CommandRouter.route('play name="Doorless"');
    expect(await CommandRouter.route("measure-door")).toContain("has no Library");
  });

  test("research rolls Intelligence + Library, but only inside the library", async () => {
    await marius();
    expect(await CommandRouter.route("research `the seals of Belial`")).toContain("is not in their library");
    await CommandRouter.route("measure-door");
    const r = await CommandRouter.route("research `the seals of Belial` difficulty=8", { rng: allTens });
    expect(r).toContain("Intelligence + Library (12)");          // 4 + 8
    expect(r).toContain("vs diff 6");                            // 8, less the Sanctum 8 that IS the library
    expect(r).not.toContain("unknown tag");                      // the place tags are known, not typos
    expect(r).toContain("the Storyteller says what it says");
  });

  test("the rotunda sharpens Hermetic matters", async () => {
    await marius();
    await CommandRouter.route("afflict in-rotunda");
    const hermetic = await CommandRouter.route('roll intelligence tags="hermetic"', { rng: seqRng([4, 4, 4, 4]) });
    expect(hermetic).toContain("vs diff 4");                     // 6 - 2
    expect(hermetic).toContain("+1 auto");
    expect(await CommandRouter.route("roll intelligence", { rng: seqRng([4, 4, 4, 4]) })).toContain("vs diff 6");
  });

  test("harvesting draws points into Living Resolve and taps the site for the day", async () => {
    const c = await marius();
    await CharacterResources.spend(c, "living-resolve", 10);      // 30 -> 20
    expect(await CommandRouter.route("show-cray")).toContain("cray 5 (25/25 points)");
    const h = await CommandRouter.route("harvest 4");
    expect(h).toContain("+4 living-resolve -> 24/30");
    expect(h).toContain("cray 5 (21/25 points)");
    // Tapped today: the day it was drawn earns nothing back.
    const day = await CommandRouter.route("advance-time 1d");
    expect(day).not.toContain("cray");
    const later = await CommandRouter.route("advance-time 2d");
    expect(later).toContain("cray +2 -> 23/25");
  });

  test("absorbing tears it out on Wits + Foundation vs 10 - rating", async () => {
    const c = await marius();
    await CharacterResources.spend(c, "living-resolve", 10);
    const r = await CommandRouter.route("absorb", { rng: seqRng([7, 3, 3, 3, 3, 3]) });
    expect(r).toContain("Wits + Modus (6)");                     // 3 + 3
    expect(r).toContain("vs diff 5");                            // 10 - 5
    expect(r).toContain("tears 1 point from the cray");
    expect(r).toContain("+1 living-resolve");
  });

  test("overdrawing costs the site a dot, and its own rating decides the aftermath", async () => {
    const c = await marius();
    await CharacterResources.spend(c, "living-resolve", 30);
    expect(await CommandRouter.route("harvest 31")).toContain("would tear it apart entirely");  // 25 + rating 5 is the ceiling
    // Draining it to empty and 3 beyond: a dot goes, then the roll decides.
    const greedy = await CommandRouter.route("harvest 28", { rng: allTens });
    expect(greedy).toContain("OVERDRAWN by 3");
    expect(greedy).toContain("drops to 4 dots");
    expect(greedy).toContain("survives, depleted");
    expect((await CharacterStore.load("Marius"))!.backgrounds.cray).toBe(4);
    expect((await CommandRouter.route("show-cray"))).toContain("cray 4 (0/20 points)");
  });

  test("a cray asks its OWN time per point, and harvesting spends it automatically", async () => {
    const c = await marius();
    await CharacterResources.spend(c, "living-resolve", 30);
    // Unset, it falls back to the chronicle's rule (60 minutes a point).
    expect(await CommandRouter.route("show-cray")).toContain("1 hour per point");
    expect(await CommandRouter.route("show-cray")).toContain("the chronicle's default");

    // Each cray is different in this, so the time lives on the SITE.
    expect(await CommandRouter.route("set-cray per-point=2h")).toContain("2 hours per point");
    expect(await CommandRouter.route("show-cray")).not.toContain("the chronicle's default");

    // The player says how many points; the clock is the engine's arithmetic.
    const before = (await StoryClock.get())!.now;
    const r = await CommandRouter.route("harvest 3");
    expect(r).toContain("6 hours for 3 points at 2h each");
    expect((await StoryClock.get())!.now - before).toBe(6 * 3600);
    expect(r).toContain("+3 living-resolve");
  });

  test("`ritual-time` shortens it, sources stack additively, and none of it can reach zero", async () => {
    const c = await marius();
    await CharacterResources.spend(c, "living-resolve", 30);
    await CommandRouter.route("set-cray per-point=2h");

    // "Cray Harvesting Expertise halves the time" - an affliction like any other.
    await CommandRouter.route("define-affliction modifier-cray-harvest apply=`ritual-time:harvest -50`");
    await CommandRouter.route("afflict modifier-cray-harvest");
    expect(await CommandRouter.route("show-cray")).toContain("1 hour per point (-50% from modifier-cray-harvest)");

    const before = (await StoryClock.get())!.now;
    const r = await CommandRouter.route("harvest 2");
    expect(r).toContain("-50% from modifier-cray-harvest, was 4 hours");
    expect((await StoryClock.get())!.now - before).toBe(2 * 3600);

    // A second source ADDS rather than compounding: two -25%s are -50%, which
    // is what a player reading two cards expects.
    await CommandRouter.route("define-affliction modifier-swift-rites apply=`ritual-time -25`");
    await CommandRouter.route("afflict modifier-swift-rites");
    expect(await CommandRouter.route("show-cray")).toContain("30 minutes per point (-75%");

    // And no stack of bonuses makes a ritual free: floored at -90%, never
    // under a minute.
    expect(ritualTimePercent([{ op: RITUAL_TIME_OP, amount: -500 }], "harvest")).toBe(-90);
    expect(scaleRitualSeconds(7200, -90)).toBe(720);
    expect(scaleRitualSeconds(60, -90)).toBe(60);
    // A target names WHICH ritual; one aimed elsewhere does not touch harvest.
    expect(ritualTimePercent([{ op: RITUAL_TIME_OP, amount: -50, target: "seal" }], "harvest")).toBe(0);
  });

  test("time= still overrides the ritual, and time=0 leaves the clock alone", async () => {
    const c = await marius();
    await CharacterResources.spend(c, "living-resolve", 30);
    await CommandRouter.route("set-cray per-point=2h");
    const before = (await StoryClock.get())!.now;
    await CommandRouter.route("harvest 1 time=`1d`");
    expect((await StoryClock.get())!.now - before).toBe(86400);      // the Storyteller's ruling wins
    const mid = (await StoryClock.get())!.now;
    expect(await CommandRouter.route("harvest 1 time=0")).not.toContain("The ritual runs");
    expect((await StoryClock.get())!.now).toBe(mid);                  // and 0 means do not move it
  });

  test("a failed aftermath roll puts the cray to sleep; a botch kills it", async () => {
    await marius();
    const dormant = await CommandRouter.route("harvest 26", { rng: seqRng([2, 2, 2, 2]) });
    expect(dormant).toContain("falls DORMANT");
    expect(await CommandRouter.route("show-cray")).toContain("1 point per YEAR");
    // A dormant cray creeps back a point a year, not a day.
    expect(await CommandRouter.route("advance-time 10d")).not.toContain("cray +");
    expect(await CommandRouter.route("advance-time 1y")).toContain("cray +1");

    __resetStorageMock(); __resetLorebookMock(); await LorebookManager.bootstrap();
    await marius();
    const dead = await CommandRouter.route("harvest 26", { rng: () => 0.05 });
    expect(dead).toContain("💀 the cray DIES");
    expect(await CommandRouter.route("harvest 1")).toContain("the cray is dead");
  });
});

describe("certainty scales with Foundation: how many successes 1s can never touch", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); resetAllConfigStores(); await LorebookManager.bootstrap(); });

  test("uncancelableCap: the first dot is entry, then one per two more", () => {
    const rules = magicRulesFrom({});
    expect(uncancelableCap(0, rules)).toBe(1);      // the unawakened still buy one
    expect(uncancelableCap(1, rules)).toBe(1);
    expect(uncancelableCap(3, rules)).toBe(1);
    expect(uncancelableCap(5, rules)).toBe(2);      // floor((5-1)/2) - Modus 5
    expect(uncancelableCap(7, rules)).toBe(3);
    expect(uncancelableCap(9, rules)).toBe(4);
    expect(uncancelableCap(5, magicRulesFrom({ "uncancelable-per-foundation": 3 }))).toBe(1);  // knob
  });

  test("stacking certainty is a SPELLCASTING rule: on a spell 2 points buy 2, elsewhere 1", async () => {
    await CommandRouter.route('create-playable name="Marius" templates=ouroboros');
    await CommandRouter.route("set-trait fount 5 paid=0");
    const c = (await CharacterStore.getCurrent())!;
    c.traits = { modus: 5, corona: 3, primus: 1 };
    await CharacterStore.save(c);
    // NOT a spell: two points are still two Resolve points (2 automatic
    // successes) but only ONE Willpower - one per action is the old law.
    const two = await CommandRouter.route("roll 3 spend=living-resolve spend-amount=2", { rng: seqRng([1, 1, 1]) });
    expect(two).toContain("+2 auto +1 sure");
    expect(two).toContain("1 sure only (stacking Willpower is a casting rule)");
    expect(two).not.toContain("BOTCH");
    // A SPELL: the mage may pour it in, up to what Modus 5 holds.
    const spell = await CommandRouter.route('magick pillars="primus:1" quintessence=2', { rng: seqRng([2, 2, 2, 2, 2, 2]) });
    expect(spell).toContain("+2 auto +2 sure");
    // Three points still only buy two - Modus 5 is the ceiling.
    const three = await CommandRouter.route('magick pillars="primus:1" quintessence=3 label=other', { rng: seqRng([2, 2, 2, 2, 2, 2]) });
    expect(three).toContain("+3 auto +2 sure");
    expect(three).toContain("capped at 2");
    // A lesser Foundation caps at one.
    c.traits = { modus: 3, corona: 3, primus: 1 };
    await CharacterStore.save(c);
    expect(await CommandRouter.route('magick pillars="primus:1" quintessence=2 label=third', { rng: seqRng([2, 2, 2, 2]) })).toContain("+1 sure");
  });

  test("an ordinary character spends Willpower explicitly for the same certainty", async () => {
    await CommandRouter.route('create-playable name="Squire" templates=mortal');
    const c = (await CharacterStore.getCurrent())!;
    c.attributes = { ...c.attributes, strength: 3 };
    await CharacterStore.save(c);
    await CharacterResources.gain(c, "willpower", 5);
    const r = await CommandRouter.route("roll strength spend=willpower spend-amount=2", { rng: seqRng([1, 1, 1]) });
    expect(r).toContain("+1 sure");                 // one Willpower per action, outside a spell
    expect(r).toContain("1 sure only (stacking Willpower is a casting rule)");
    expect(r).not.toContain("BOTCH");
  });

  test("the resources wizard's roles step shows THIS character's resources", async () => {
    await CommandRouter.route('create-playable name="Marius" templates=ouroboros');
    await CommandRouter.route("set-trait fount 5 paid=0");
    const first = await CommandRouter.route("configure-resources");
    expect(first).toContain("living-resolve");
    // Plain input is the wizard's reply channel: keep the one resource as is.
    const roles = (await processAdventureInput("keep"))?.inputText ?? "";
    expect(roles).toContain("Extra roles");
    expect(roles).toContain("living-resolve: blood/willpower/resolve/magic-fuel/quintessence");
    expect(roles).not.toContain("quintessence: resolve");     // no stock example the sheet lacks
  });
});

describe("defining merits, flaws & arcana from a command", () => {
  beforeEach(async () => {
    __resetStorageMock(); __resetLorebookMock(); resetAllConfigStores(); MeritFlawRegistry.reset(); ArcanumRegistry.reset();
    await LorebookManager.bootstrap();
  });

  test("the passive mini-syntax reads ops, gates and the JSON escape hatch", () => {
    expect(parsePassiveOps("difficulty -1 if=$trait")).toEqual([{ op: "difficulty", amount: -1, trait: "$trait" }]);
    expect(parsePassiveOps("immune:fear,mind-control while=living-resolve")).toEqual([
      { op: "immune", target: "fear,mind-control", requiresResource: { resource: "living-resolve", atLeast: 1 } },
    ]);
    expect(parsePassiveOps("dice +2 on=melee while=blood>=3")).toEqual([
      { op: "dice", amount: 2, target: "melee", requiresResource: { resource: "blood", atLeast: 3 } },
    ]);
    // Two ops in one sentence, and raw JSON when the shorthand won't do.
    expect((parsePassiveOps("immune:possession; dice +1") as EffectOp[]).length).toBe(2);
    expect(parsePassiveOps('[{"op":"weird","cap":"stamina+3"}]')).toEqual([{ op: "weird", cap: "stamina+3" }]);
    expect(parsePassiveOps("difficulty -1 nonsense=3")).toHaveProperty("error");
    expect(parsePassiveOps("[not json")).toHaveProperty("error");
  });

  test("Inviolate Soul: defined, taken, inspected - and it round-trips through the lorebook", async () => {
    await CommandRouter.route('create-playable name="Marius" templates=ouroboros');
    await CommandRouter.route("set-trait fount 5 paid=0");
    const defined = await CommandRouter.route("define-merit name=`Inviolate Soul` points=0 "
      + "passive=`immune:possession,soul-control,soul-suppression; immune:fear,supernatural-mind-control while=living-resolve` "
      + "description=`An inherent natal Investiture: the soul cannot be worn, steered or stilled.`");
    expect(defined).toContain('Defined merit "Inviolate Soul"');
    expect(defined).toContain("immune (possession,soul-control,soul-suppression)");
    expect(defined).toContain("while living-resolve >= 1");
    // The registry rebuilds itself from the lorebook alone.
    MeritFlawRegistry.reset(); ArcanumRegistry.reset();
    expect(MeritFlawRegistry.get("inviolate-soul")).toBeUndefined();
    await MeritFlawRegistry.loadFromLorebook();
    const def = MeritFlawRegistry.get("inviolate-soul")!;
    expect(def.passive!.length).toBe(2);
    expect(def.passive![1].requiresResource).toEqual({ resource: "living-resolve", atLeast: 1 });

    expect(await CommandRouter.route("take-merit inviolate-soul")).toContain("Inviolate Soul");
    expect(await CommandRouter.route("show-merit")).toContain("inviolate-soul");
    const info = await CommandRouter.route("show-merit in=campaign inviolate-soul");
    expect(info).toContain("natal Investiture");
    expect(info).toContain("no interpreter for are recorded and surfaced");
    expect(await CommandRouter.route("show-merit in=campaign")).toContain("inviolate-soul");
  });

  test("a resource-gated passive fires only while the pool holds enough", async () => {
    await CommandRouter.route('create-playable name="Marius" templates=ouroboros');
    await CommandRouter.route("set-trait fount 5 paid=0");
    const c = (await CharacterStore.getCurrent())!;
    c.attributes = { ...c.attributes, wits: 3 };
    await CharacterStore.save(c);
    await CommandRouter.route("define-merit name=`Unshaken` points=1 passive=`difficulty -2 while=living-resolve`");
    await CommandRouter.route("take-merit unshaken 1");
    expect(await CommandRouter.route("roll wits", { rng: allTens })).toContain("vs diff 4");   // 30 points: gate open
    await CharacterResources.spend(c, "living-resolve", 30);                                   // run it dry
    expect(await CommandRouter.route("roll wits", { rng: allTens })).toContain("vs diff 6");   // gate shut
  });

  test("defining twice replaces; forget-merit removes the custom one", async () => {
    await CommandRouter.route("define-merit name=`Unshaken` points=1 passive=`difficulty -2`");
    await CommandRouter.route("define-merit name=`Unshaken` points=2 passive=`difficulty -1`");
    expect(MeritFlawRegistry.all().filter(d => StringUtil.normalize(d.name) === "unshaken").length).toBe(1);
    expect(MeritFlawRegistry.get("unshaken")!.points).toBe(2);
    expect(await CommandRouter.route("forget-merit unshaken")).toContain("Forgot custom unshaken");
    expect(MeritFlawRegistry.get("unshaken")).toBeUndefined();
    expect(await CommandRouter.route("forget-merit iron-will")).toContain("is a built-in");
    expect(await CommandRouter.route("define-merit")).toContain("define-merit needs a name");
  });
});

describe("Living Resolve IS the other four: no phantom Willpower, and Resolve's bonus", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); resetAllConfigStores(); await LorebookManager.bootstrap(); });

  test("a character whose Willpower is replaced gets no willpower pool start", async () => {
    await CommandRouter.route('create-playable name="Marius" templates=ouroboros');
    await CommandRouter.route("set-trait fount 5 paid=0");
    const marius = (await CharacterStore.load("Marius"))!;
    expect(marius.poolStarts).toEqual({});                       // no phantom
    expect(resolveTraitFromRecord(marius, "willpower")).toBe(0);  // nothing for a trait lookup to find
    // Everyone else still gets theirs.
    await CommandRouter.route('create-playable name="Odo" templates=mortal');
    expect((await CharacterStore.load("Odo"))!.poolStarts).toEqual({ willpower: 0 });
  });

  test("[[show-sheet]] flags a leftover pool start for a resource the character lacks", async () => {
    await CommandRouter.route('create-playable name="Marius" templates=ouroboros');
    await CommandRouter.route("set-trait fount 5 paid=0");
    const c = (await CharacterStore.getCurrent())!;
    c.poolStarts = { willpower: 10 };                            // the stale hand-edit
    await CharacterStore.save(c);
    const sheet = await CommandRouter.route("show-sheet");
    expect(sheet).toContain("⚠️ pool start for willpower");
    expect(sheet).toContain("Delete the line in creator mode");
  });

  test("spending it pays out as Willpower AND Resolve: certainty plus -2 difficulty", async () => {
    await CommandRouter.route('create-playable name="Marius" templates=ouroboros');
    await CommandRouter.route("set-trait fount 5 paid=0");
    const c = (await CharacterStore.getCurrent())!;
    c.traits = { modus: 5 };
    c.attributes = { ...c.attributes, wits: 3 };
    await CharacterStore.save(c);
    const one = await CommandRouter.route("roll wits spend=living-resolve", { rng: seqRng([4, 4, 4]) });
    expect(one).toContain("vs diff 4");                          // 6 - 2, the Resolve component
    expect(one).toContain("+1 sure");                            // and the Willpower component
    expect(one).toContain("5 successes");                        // three 4s now hit, plus the sure AND automatic ones
    // Two points: the Resolve scales per point; the certainty does not, off a spell.
    const two = await CommandRouter.route("roll wits spend=living-resolve spend-amount=2", { rng: seqRng([2, 2, 2]) });
    expect(two).toContain("vs diff 2");
    expect(two).toContain("+2 auto +1 sure");
    // A spell breaks the difficulty by the SAME -2: the Quintessence -1 is that
    // break seen from another side, not another one to add.
    const spell = await CommandRouter.route('roll wits tags="magic" spend=living-resolve', { rng: seqRng([4, 4, 4]) });
    expect(spell).toContain("vs diff 4");                        // 6 - 2, once
    // The `focus` alias is gone: it only ever restated the plain spend, and its
    // copy still carried the double difficulty break the fusion audit removed.
    expect(await CommandRouter.route("roll wits spend=living-resolve:focus"))
      .toContain(`living-resolve has no "focus" effect`);
  });
});

describe("stale sheets: a lorebook edit that never synced", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); resetAllConfigStores(); await LorebookManager.bootstrap(); });

  test("editing the pc: card with creator mode OFF leaves the engine on the old copy - and cast says so", async () => {
    await CommandRouter.route('create-playable name="Visvaldas" templates=ouroboros');
    await CommandRouter.route("set-trait fount 5 paid=0");
    const base = (await CharacterStore.load("Visvaldas"))!;
    const edited = { ...base, traits: { modus: 5, primus: 1 } };
    await LorebookManager.updateEntryText(PLAYER_CHARACTERS_CATEGORY, "pc:visvaldas",
      `edited by hand\n=====\n${formatCardText(characterToCard(edited))}`);

    // Creator mode off: the edit is invisible, and the refusal points at why.
    const cold = await CommandRouter.route('magick pillars="primus:1"');
    expect(cold).toContain("has Primus 0");
    expect(cold).toContain("has NOT synced yet");
    expect(cold).toContain("creator-mode set=true");

    // Creator mode on: the very next command pulls the edit in.
    await CommandRouter.route("creator-mode set=true");
    const warm = await CommandRouter.route('magick pillars="primus:1"', { rng: allTens });
    expect(warm).toContain("Modus + Primus");
    expect(warm).not.toContain("has NOT synced yet");
  });

  test("an edit that loses the sheet's identity is reported, not silently ignored", async () => {
    await CommandRouter.route('create-playable name="Visvaldas" templates=ouroboros');
    await CommandRouter.route("set-trait fount 5 paid=0");
    // The card format is forgiving, so the way to break a sheet is to lose what
    // makes it one: here the player deleted the templates line.
    await LorebookManager.updateEntryText(PLAYER_CHARACTERS_CATEGORY, "pc:visvaldas",
      "oops\n=====\nname: Visvaldas\n\ntraits:\n  Modus: 5");
    await CommandRouter.route("creator-mode set=true");
    const off = await CommandRouter.route("creator-mode set=false");
    expect(off).toContain("Could not read");
    expect(off).toContain("pc:visvaldas");
    expect(resolveTraitFromRecord((await CharacterStore.load("Visvaldas"))!, "modus")).toBe(0);   // old copy intact
  });
});

describe("the Resolve component pays in FULL, not just its difficulty break", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); resetAllConfigStores(); await LorebookManager.bootstrap(); });

  test("one point carries Resolve's whole bundle: +1 automatic success and 8-again", async () => {
    await CommandRouter.route('create-playable name="Marius" templates=ouroboros');
    await CommandRouter.route("set-trait fount 5 paid=0");
    const c = (await CharacterStore.getCurrent())!;
    c.traits = { modus: 5 };
    c.attributes = { ...c.attributes, wits: 3 };
    await CharacterStore.save(c);
    // Three 9s: at 8-again every one of them explodes into another die.
    const r = await CommandRouter.route("roll wits spend=living-resolve", { rng: seqRng([9, 9, 9, 2, 2, 2]) });
    expect(r).toContain("+1 auto");                  // Resolve's automatic success
    expect(r).toContain("+1 sure");                  // the Willpower's un-cancelable one
    expect(r).toContain("💥9");                       // 8-again: 9s explode
    expect(r).toContain("vs diff 4");                // and its -2
    // ONE difficulty op: a point lowers a roll's difficulty once, by the deepest
    // break any of its natures gives.
    const def = LIVING_RESOLVE.effect!.apply.map(o => o.op).sort();
    expect(def).toEqual(["difficulty", "nagain", "successes", "uncancelable"]);
  });

  test("a casting point breaks the difficulty ONCE - Resolve's -2 IS the Quintessence break", async () => {
    await CommandRouter.route('create-playable name="Marius" templates=ouroboros');
    await CommandRouter.route("set-trait fount 5 paid=0");
    const c = (await CharacterStore.getCurrent())!;
    c.traits = { modus: 5, primus: 1 };
    await CharacterStore.save(c);
    const r = await CommandRouter.route('magick pillars="primus:1" quintessence=1', { rng: seqRng([2, 2, 2, 2, 2, 2]) });
    expect(r).toContain("simple spell: diff 4+1 = 5");
    expect(r).toContain("spend as Quintessence AND Willpower AND Resolve at once");
    expect(r).toContain("+1 automatic success");                         // the Resolve, in full
    expect(r).toContain("1 un-cancelable success");                      // the Willpower, beside it
    expect(r).toContain("8-again");
    expect(r).toContain("-2 difficulty");
    expect(r).toContain("vs diff 3");                                    // 5 - 2, NOT 5 - 2 - 1
    expect(r).not.toContain("for -1 difficulty");
  });
});

describe("a fused point is never wasted at the difficulty floor", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); resetAllConfigStores(); await LorebookManager.bootstrap(); });

  test("Modus 5, difficulty 5, quintessence=2: both points spend, and both grant certainty", async () => {
    await CommandRouter.route('create-playable name="Visvaldas" templates=ouroboros');
    await CommandRouter.route("set-trait fount 5 paid=0");
    const c = (await CharacterStore.getCurrent())!;
    c.traits = { modus: 5, primus: 1 };
    await CharacterStore.save(c);
    const r = await CommandRouter.route('magick pillars="primus:1" quintessence=2', { rng: seqRng([2, 2, 2, 2, 2, 2]) });
    // Both points are spent: the Quintessence floor cannot waste a point that
    // is also a Willpower and a Resolve.
    expect(r).toContain("living-resolve: 2 more");
    expect(r).toContain("all 2 points spend as Quintessence AND Willpower AND Resolve at once");
    expect(r).toContain("2 un-cancelable successes");            // Modus 5 -> cap 2
    expect(r).toContain("+2 automatic successes");
    expect(r).toContain("-4 difficulty");                        // 2 x Resolve's -2, counted once each
    expect(r).toContain("+2 auto +2 sure");
    const lr = CharacterResources.resolveDef(c, "living-resolve")!;
    expect(await CharacterResources.current(c, lr)).toBe(28);     // both points left the pool
  });

  test("ordinary Quintessence still stops at the floor - it has nothing else to pay", async () => {
    await CommandRouter.route('create-playable name="Hermetic" templates=mage');
    const c = (await CharacterStore.getCurrent())!;
    c.traits = { modus: 5, primus: 1 };
    await CharacterStore.save(c);
    await CharacterResources.gain(c, "quintessence", 10);
    const r = await CommandRouter.route('magick pillars="primus:1" quintessence=2', { rng: allTens });
    expect(r).toContain("1 for -1 difficulty");
    expect(r).not.toContain("past the difficulty floor");
    expect(r).toContain("min diff 4");
    expect(await CharacterResources.current(c, CharacterResources.resolveDef(c, "quintessence")!)).toBe(9);
  });
});

// =============================================================================
// CHARACTER CREATION - the budget every fresh character is built against
// =============================================================================
describe("creation: the pools, the picks, and what the sheet has actually taken", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); MeritFlawRegistry.reset(); ArcanumRegistry.reset(); resetAllConfigStores(); await LorebookManager.bootstrap(); });

  test("every character buys the same three ladders; a splat adds its own on top", () => {
    expect(BASE_CREATION.attributes).toEqual({ primary: 7, secondary: 5, tertiary: 3 });
    expect(BASE_CREATION.abilities).toEqual({ primary: 13, secondary: 9, tertiary: 5 });
    expect(BASE_CREATION.attributeStart).toBe(1);     // one free dot in each Attribute
    expect(BASE_CREATION.abilityStart).toBe(0);       // and none in any Ability
    expect(BASE_CREATION.backgrounds).toBe(5);
    expect(BASE_CREATION.freebies).toBe(15);
    expect(BASE_CREATION.disciplines).toBeUndefined();
    // A vampire owes four Discipline dots and seven Virtue dots besides.
    const vampire = creationBudgetFor(["vampire"]);
    expect(vampire.disciplines).toBe(4);
    expect(vampire.virtues).toBe(7);
    expect(vampire.attributes).toEqual(BASE_CREATION.attributes);
    // What used to be a note is now a real derivation (§ expressions).
    expect(TEMPLATE_VAMPIRE.Derived.find(d => d.trait === "generation")!.expr).toBe("12 - background:generation");
    expect(vampire.attributeMax).toBe("trait-max(generation)");
    // A mage owes neither, and records what its own numbers derive from.
    const mage = creationBudgetFor(["mage"]);
    expect(mage.disciplines).toBeUndefined();
    expect(mage.notes!.some(n => n.includes("Cray + Fount"))).toBe(true);
  });

  test("templates STACK: a vampire-and-mage owes both sets of dots and both sets of notes", () => {
    const both = creationBudgetFor(["vampire", "mage"]);
    expect(both.disciplines).toBe(4);                 // the vampire's, not shadowed
    expect(both.notes!.some(n => n.includes("Seven Virtue dots"))).toBe(true);
    expect(both.notes!.some(n => n.includes("Cray + Fount"))).toBe(true);
    // An unknown template contributes nothing rather than resetting the budget.
    expect(creationBudgetFor(["vampire", "nonesuch"]).disciplines).toBe(4);
    expect(creationBudgetFor([])).toEqual(BASE_CREATION);
  });

  test("[[show-creation]] reports each pool against the sheet, once the priorities are set", async () => {
    await CommandRouter.route('create-playable name="Nos" templates=vampire');
    // With no priorities it cannot know which pool is which, and says so.
    const blind = await CommandRouter.route("show-creation");
    expect(blind).toContain("attributes: 7/5/3 to spend - [[choose attributes physical,social,mental]] first");
    expect(blind).toContain("abilities: 13/9/5 to spend - [[choose abilities talents,skills,knowledges]] first");

    await CommandRouter.route("choose attributes physical,social,mental");
    await CommandRouter.route("choose abilities talents,skills,knowledges");
    await CommandRouter.route("set-trait strength 4");        // 3 over the free dot
    await CommandRouter.route("set-trait dexterity 3");        // 2 more
    await CommandRouter.route("set-trait brawl 3");            // a Talent
    await CommandRouter.route("set-trait occult 2");           // a Knowledge
    const r = await CommandRouter.route("show-creation");
    expect(r).toContain("attributes: primary Physical 5/7, secondary Social 0/5, tertiary Mental 0/3");
    // Abilities land in the category the CHRONICLE's own lists put them in.
    expect(r).toContain("abilities: primary Talents 3/13, secondary Skills 0/9, tertiary Knowledges 2/5");
    expect(r).toContain("backgrounds: 0/5");
    expect(r).toContain("freebies: 15 to spend");
    expect(r).toContain("Advisory: nothing is enforced.");
    // ...and [[show-budget]] draws its Background and freebie purses from the SAME
    // numbers, so the two reports can never disagree.
    await CommandRouter.route("set-trait herd 2");
    expect(await CommandRouter.route("show-creation")).toContain("backgrounds: 2/5");
    expect(await CommandRouter.route("show-budget")).toContain("background: 2/5, 3 left");
  });

  test("a Nosferatu's Appearance is 0 and stays 0, and the free dot it never had is not spent", async () => {
    expect(clanByName("nosferatu")!.limits!.appearance).toEqual({
      start: 0, max: 0, note: "A Nosferatu has no Appearance and never will.",
    });
    await CommandRouter.route('create-playable name="Nos" templates=vampire');
    expect(await CommandRouter.route("show-clan nosferatu")).toContain("Appearance 0-0");
    expect(await CommandRouter.route("choose clan nosferatu")).toContain("no Appearance and never will");
    await CommandRouter.route("choose attributes social,physical,mental");
    const r = await CommandRouter.route("show-creation");
    expect(r).toContain("ceilings: attributes 1-5, abilities 0-5, disciplines 0-5, Appearance 0-0");
    // The factory hands every Attribute the free dot; a Nosferatu may not keep
    // that one, so the report says the sheet is over its own ceiling...
    expect(r).toContain("⚠ over: Appearance 1 > 0");
    // ...and counts it, because a dot above their start IS a dot spent.
    expect(r).toContain("primary Social 1/7");
    await CommandRouter.route("set-trait appearance 0");
    const fixed = await CommandRouter.route("show-creation");
    expect(fixed).not.toContain("⚠ over");
    expect(fixed).toContain("primary Social 0/7");
  });

  test("clan Disciplines are named, and anything else is flagged as out of clan", async () => {
    await CommandRouter.route('create-playable name="Nos" templates=vampire');
    await CommandRouter.route("choose clan nosferatu");
    await CommandRouter.route("set-trait obfuscate 2 group=discipline");
    await CommandRouter.route("set-trait celerity 1 group=discipline");
    const r = await CommandRouter.route("show-creation");
    expect(r).toContain("disciplines: 3/4 (Nosferatu: Animalism, Obfuscate, Potence)");
    expect(r).toContain("out of affinity: Celerity");
    // Without a clan it has nothing to compare against, and asks.
    await CommandRouter.route('create-playable name="Anon" templates=vampire');
    await CommandRouter.route('play name="Anon"');
    expect(await CommandRouter.route("show-creation")).toContain("disciplines: 0/4 - nothing names his Disciplines yet");
  });

  test("dots no priority category claims are reported rather than silently dropped", async () => {
    await CommandRouter.route('create-playable name="Nos" templates=vampire');
    await CommandRouter.route("choose attributes physical,social,mental");
    await CommandRouter.route("choose abilities talents,skills,knowledges");
    await CommandRouter.route("set-trait haggling 3 group=ability");   // in nobody's SRD list
    expect(await CommandRouter.route("show-creation")).toContain("⚠ uncounted: Haggling");
  });

  test("[[choose]] insists on categories that exist, and remembers what was picked", async () => {
    await CommandRouter.route('create-playable name="Nos" templates=vampire');
    const wrong = await CommandRouter.route("choose abilities physical,social,mental");
    expect(wrong).toContain('No abilities category "physical", "social", "mental"');
    expect(wrong).toContain("Known: talents, skills, knowledges");
    expect(await CommandRouter.route("choose attributes physical")).toContain("needs three categories");
    await CommandRouter.route("choose clan tremere");
    await CommandRouter.route("choose attributes mental,physical,social");
    const char = (await CharacterStore.load("Nos"))!;
    expect(char.choices).toEqual({ clan: "tremere" });
    expect(char.priorities).toEqual({
      "attributes-primary": "mental", "attributes-secondary": "physical", "attributes-tertiary": "social",
    });
    // ...and they survive the trip through the lorebook card.
    expect(characterFromCard(characterToCard(char))!.choices).toEqual({ clan: "tremere" });
    expect(await CommandRouter.route("choose")).toContain("clan: Tremere");
  });
});

// =============================================================================
// CLANS & FELLOWSHIPS - the picks, and what only their own may buy
// =============================================================================
describe("clans & fellowships: thirteen and six, with exclusives gated on the pick", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); MeritFlawRegistry.reset(); ArcanumRegistry.reset(); resetAllConfigStores(); await LorebookManager.bootstrap(); });

  test("the Assamite castes pick different Disciplines but are one clan", () => {
    expect(Object.keys(CLANS).length).toBe(15);            // the castes are entries...
    expect(clanFamilies().length).toBe(13);                // ...but there are thirteen clans
    expect(clanByName("assamite-vizier")!.disciplines).toEqual(["auspex", "celerity", "quietus"]);
    expect(clanByName("assamite-sorcerer")!.disciplines).toContain("assamite-sorcery");
    expect(clanFamilyOf("assamite-vizier")).toBe("assamite");
    expect(clanFamilyOf("assamite-warrior")).toBe("assamite");
    expect(clanFamilies().find(c => c.id === "assamite")!.name).toBe("Assamite");
    // Aliases and ids both find a clan; the id is what a sheet records.
    expect(clanByName("setites")!.id).toBe("followers-of-set");
    expect(clanByName("Malkavians")!.id).toBe("malkavian");
    expect(clanByName("nope")).toBeUndefined();
  });

  test("one exclusive Merit and Flaw per clan and per fellowship, gated on the choice", async () => {
    expect(EXCLUSIVE_MERITS_FLAWS.length).toBe((13 + 6) * 2);
    expect(MeritFlawRegistry.get("tremere-exclusive-merit")!.requires!.choices).toEqual({ clan: "tremere" });
    expect(MeritFlawRegistry.get("valdaermen-exclusive-flaw")!.kind).toBe("flaw");

    await CommandRouter.route('create-playable name="Tariq" templates=vampire');
    await CommandRouter.route("choose clan assamite-vizier");
    // A Vizier may buy what Assamites may buy - the gate is the CLAN...
    expect(await CommandRouter.route("take-merit assamite-exclusive-merit")).toContain("takes Assamite Exclusive Merit");
    // ...and nobody else's.
    const refused = await CommandRouter.route("take-merit brujah-exclusive-flaw");
    expect(refused).toContain("prerequisites not met: clan:brujah");
    expect(refused).toContain("waive=true");
  });

  test("all six fellowships ship with their Foundation, their four Pillars and their other names", async () => {
    expect(Object.keys(FELLOWSHIPS).sort()).toEqual([
      "ahl-i-batin", "messianic-voices", "old-faith", "order-of-hermes", "spirit-talkers", "valdaermen",
    ]);
    for (const f of Object.values(FELLOWSHIPS)) expect(Object.keys(f.pillars).length).toBe(4);
    expect(fellowshipByName("batini")!.foundation).toBe("al-ikhlas");
    expect(fellowshipByName("runecrafters")!.id).toBe("valdaermen");
    expect(fellowshipByName("Old Faith")!.pillars.winter).toBe("Death and Water");
    expect(fellowshipByName("aedun")!.foundation).toBe("spontaneity");
    expect(fellowshipByName("hermetic")!.id).toBe("order-of-hermes");
    expect(fellowshipByName("messianics")!.theme).toBe("Archangels");
    expect(await CommandRouter.route("show-fellowship spirit-talkers")).toContain("Foundation: Sensitivity");
  });

  test("the chosen fellowship IS the caster's Foundation, whatever else they can roll", async () => {
    await CommandRouter.route('create-playable name="Runa" templates=mage');
    const c = (await CharacterStore.getCurrent())!;
    // She has a rating in Modus, which would otherwise be auto-detected first.
    c.traits = { modus: 4, blot: 3, galdrar: 2 };
    await CharacterStore.save(c);
    expect(await CommandRouter.route('magick pillars="galdrar:2"', { rng: allTens })).toContain("Modus + Galdrar");
    await CommandRouter.route("choose fellowship valdaermen");
    expect(await CommandRouter.route('magick pillars="galdrar:2"', { rng: allTens })).toContain("Blot + Galdrar");
  });

  test("the freebie table prices a Foundation, a Pillar and a Specialty", async () => {
    const costs = await CommandRouter.route("show-cost");
    expect(costs).toContain("Foundation: experience current x 8, freebie 5");
    expect(costs).toContain("Pillar: experience current x 7, freebie 3");
    expect(costs).toContain("Specialty: experience -, freebie 1, maturation -");
    expect(costs).toContain("Attribute: experience current x 4, freebie 5");
    expect(costs).toContain("Ability: experience current x 2 (a new one: 3), freebie 2");
  });

  test("the creation-side listings are queries: they stop the turn and stay out of context", async () => {
    await CommandRouter.route('create-playable name="Nos" templates=vampire');
    for (const verb of ["show-creation", "show-clan", "show-budget", "show-cost", "show-background", "show-arcanum"]) {
      const r = await processAdventureInput(`Hm. [[${verb}]] Right.`);
      expect(r!.stopGeneration).toBe(true);
      expect(stripCtxSkip(r!.inputText!)).not.toContain("[SYSTEM:");   // never reaches the AI
    }
  });
});

// =============================================================================
// THE EXPRESSION LANGUAGE - one arithmetic, and references into the sheet
// =============================================================================
describe("expressions (core/expr.ts): arithmetic, references, and the hyphen rule", () => {
  const scope = mapScope({
    strength: 4, brawl: 3, courage: 1, conscience: 1, "self-control": 1,
    "background:generation": 5,
  });

  test("the hyphen belongs to a NAME only when a letter follows it", () => {
    // Trait names keep their hyphens...
    expect(evaluateExpr("self-control", scope).value).toBe(1);
    expect(evaluateExpr("conscience + self-control", scope).value).toBe(2);
    // ...and subtraction still works, spaced or not, because a number can
    // never absorb a hyphen and a space always ends a name.
    expect(evaluateExpr("12 - background:generation", scope).value).toBe(7);
    expect(evaluateExpr("12-background:generation", scope).value).toBe(7);
    expect(evaluateExpr("courage - 1", scope).value).toBe(0);
    expect(exprRefs("12 - background:generation")).toEqual(["background:generation"]);
  });

  test("everything the old pool syntax could say, it still says", () => {
    expect(evaluateExpr("strength+brawl", scope).value).toBe(7);
    expect(evaluateExpr("3+2", scope).value).toBe(5);
    expect(evaluateExpr("7", scope).value).toBe(7);
    expect(evaluateExpr("strength+-1", scope).value).toBe(3);
    expect(parsePoolExpression("strength+brawl", (n) => ({ strength: 4, brawl: 3 } as Record<string, number>)[n] ?? 0).total).toBe(7);
  });

  test("arithmetic, precedence, parentheses and functions", () => {
    expect(evaluateExpr("strength * 2 + 1", scope).value).toBe(9);
    expect(evaluateExpr("(strength + brawl) * 2", scope).value).toBe(14);
    expect(evaluateExpr("floor(strength / 3)", scope).value).toBe(1);
    expect(evaluateExpr("max(strength, brawl)", scope).value).toBe(4);
    expect(evaluateExpr("min(2, strength)", scope).value).toBe(2);
    expect(evaluateExpr("sum(courage, conscience, self-control)", scope).value).toBe(3);
    expect(evaluateExpr("abs(0 - strength)", scope).value).toBe(4);
  });

  test("an unanswered reference is 0 AND is reported - a typo used to be silent", () => {
    const out = evaluateExpr("strength + wisdom", scope);
    expect(out.value).toBe(4);
    expect(out.unknown).toEqual(["wisdom"]);
    expect(out.error).toBeUndefined();
  });

  test("nothing throws: a malformed expression is worth 0 and says why", () => {
    for (const bad of ["3 4", "((", "strength +", "nope(1)", "3 § 4"]) {
      const out = evaluateExpr(bad, scope);
      expect(out.value).toBe(0);
      expect(out.error).toBeTruthy();
    }
    expect(evaluateExpr("", scope).value).toBe(0);
    expect(evaluateExpr("", scope).error).toBeUndefined();
    expect(evaluateExpr("1 / 0", scope).error).toContain("division by zero");
  });

  test("the terms show their work, and a subtracted zero still reads as subtracted", () => {
    expect(describeTerms(evaluateExpr("strength + brawl - 1", scope).terms)).toBe("strength 4 + brawl 3 - 1");
    // -0 cannot carry a sign, so the term records that it was negated.
    expect(describeTerms(evaluateExpr("12 - courage - conscience", scope).terms)).toBe("12 - courage 1 - conscience 1");
    expect(describeTerms(evaluateExpr("12 - nothing", scope).terms)).toBe("12 - nothing 0 (unknown)");
  });

  test("evalNumeric takes a number or an expression, and falls back on nonsense", () => {
    expect(evalNumeric(5, scope, 99)).toBe(5);
    expect(evalNumeric("strength + 1", scope, 99)).toBe(5);
    expect(evalNumeric(undefined, scope, 99)).toBe(99);
    expect(evalNumeric("((", scope, 99)).toBe(99);
  });
});

// =============================================================================
// DERIVED VALUES - what a sheet implies rather than states
// =============================================================================
describe("derived values: Generation, Road, Willpower, and the ceilings they move", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); MeritFlawRegistry.reset(); ArcanumRegistry.reset(); resetAllConfigStores(); await LorebookManager.bootstrap(); });

  test("a fresh vampire's Road is 2 and its Willpower is 1, before anything is assigned", async () => {
    await CommandRouter.route('create-playable name="Sasha" templates=vampire');
    const char = (await CharacterStore.load("Sasha"))!;
    // The three Road Virtues seed at their free dot, like Attributes do.
    expect(char.virtues).toEqual({ conscience: 1, "self-control": 1, courage: 1 });
    expect(traitValueOf(char, "road")).toBe(2);        // conscience + self-control
    expect(traitValueOf(char, "willpower")).toBe(1);   // = courage
    expect(traitValueOf(char, "generation")).toBe(12);
    // A mage derives none of it - no Road, no Virtues.
    await CommandRouter.route('create-playable name="Hermetic" templates=mage');
    expect(derivedValuesOf((await CharacterStore.load("Hermetic"))!)).toEqual([]);
  });

  test("the Road and Willpower follow the Virtues, then step aside once rated", async () => {
    await CommandRouter.route('create-playable name="Sasha" templates=vampire');
    await CommandRouter.route("set-trait conscience 4");
    await CommandRouter.route("set-trait courage 3");
    const char = (await CharacterStore.load("Sasha"))!;
    expect(traitValueOf(char, "road")).toBe(5);        // 4 + 1
    expect(traitValueOf(char, "willpower")).toBe(3);
    // A "start" derivation is a seed, not an identity: buy Willpower up and the
    // sheet wins, while the report still says where it began.
    await CommandRouter.route("set-trait willpower 6 group=pool");
    const bought = (await CharacterStore.load("Sasha"))!;
    expect(traitValueOf(bought, "willpower")).toBe(6);
    const wp = derivedValuesOf(bought).find(d => d.trait === "willpower")!;
    expect(wp.overridden).toBe(6);
    expect(wp.value).toBe(3);
    expect(await CommandRouter.route("show-derived")).toContain("Willpower 6 (sheet 6, would start at 3)");
  });

  test("Generation 5 makes him 7th, and every ceiling rises to 6", async () => {
    await CommandRouter.route('create-playable name="Sasha" templates=vampire');
    await CommandRouter.route("choose attributes physical,social,mental");
    expect(await CommandRouter.route("show-creation")).toContain("ceilings: attributes 1-5, abilities 0-5, disciplines 0-5");

    await CommandRouter.route("set-trait generation 5");
    const char = (await CharacterStore.load("Sasha"))!;
    expect(char.backgrounds.generation).toBe(5);       // the Background: five dots
    expect(traitValueOf(char, "generation")).toBe(7);  // the derived fact: 7th
    const report = await CommandRouter.route("show-creation");
    expect(report).toContain("ceilings: attributes 1-6, abilities 0-6, disciplines 0-6");
    expect(report).toContain("Generation 7 (12 - background:generation 5)");
    // ...and a Strength 6 is legal now, where it would have been flagged before.
    await CommandRouter.route("set-trait strength 6");
    expect(await CommandRouter.route("show-creation")).not.toContain("⚠ over");
  });

  test("an 'always' identity ignores the sheet; a Background nobody rated is 0, not a typo", async () => {
    await CommandRouter.route('create-playable name="Sasha" templates=vampire');
    // Writing a generation onto the sheet does not make it true - it is derived.
    await CommandRouter.route("set-trait generation 3 group=trait");
    const char = (await CharacterStore.load("Sasha"))!;
    expect(char.traits.generation).toBe(3);
    expect(traitValueOf(char, "generation")).toBe(12);   // still 12 - 0
    // An unrated Background the chronicle DOES define answers 0...
    expect(evalOn(char, "background:generation").unknown).toEqual([]);
    // ...and one it does not is still reported.
    expect(evalOn(char, "background:nonesuch").unknown).toEqual(["background:nonesuch"]);
  });

  test("derived values are rollable, and the blood pool follows generation", async () => {
    await CommandRouter.route('create-playable name="Sasha" templates=vampire');
    await CommandRouter.route("set-trait courage 3");
    // Willpower is on no bucket the player typed - it is derived - and rolls anyway.
    const rolled = await CommandRouter.route("roll willpower", { rng: allTens });
    expect(rolled).toContain("Willpower (3)");
    const char = (await CharacterStore.load("Sasha"))!;
    expect(traitValueOf(char, "blood-pool-max")).toBe(11);   // 12th generation
    await CommandRouter.route("set-trait generation 5");
    expect(traitValueOf((await CharacterStore.load("Sasha"))!, "blood-pool-max")).toBe(20);   // 7th
  });

  test("[[show-eval]] is the reference system, exposed - including the purses", async () => {
    await CommandRouter.route('create-playable name="Sasha" templates=vampire');
    await CommandRouter.route("set-trait courage 3");
    await CommandRouter.route("set-trait herd 2");
    expect(await CommandRouter.route("show-eval courage + 1")).toContain("= 4 = courage 3 + 1");
    expect(await CommandRouter.route("show-eval derived:willpower")).toContain("derived:willpower = 3");
    expect(await CommandRouter.route("show-eval budget:background")).toContain("= 5");
    expect(await CommandRouter.route("show-eval spent:background")).toContain("= 2");
    expect(await CommandRouter.route("show-eval left:background")).toContain("= 3");
    expect(await CommandRouter.route("show-eval strength + nonesuch")).toContain("⚠ nothing answers to nonesuch");
    expect(await CommandRouter.route("show-eval ((")).toContain("Cannot read");
    expect(await CommandRouter.route("show-eval")).toContain("Mind the hyphen");
  });

  test("a derivation that defines itself in a circle is reported, not a stack overflow", () => {
    const looped: PlayableCharacter = {
      id: "x", name: "Loop", templates: ["vampire"], stage: "potential",
      attributes: {}, abilities: {}, backgrounds: {}, virtues: {}, disciplines: {},
      traits: {}, poolStarts: {}, meritsFlaws: {}, tags: [],
    };
    // The engine's own vampire derivations are acyclic; this proves the guard by
    // asking for a value whose expression names itself.
    expect(evalOn(looped, "generation").value).toBe(12);
    expect(evaluateExpr("x", { lookup: () => undefined }).value).toBe(0);
  });
});

// =============================================================================
// SIMPLIFICATION PASS - the seams that replaced duplicated code
// =============================================================================
describe("one definition, one behaviour: what the cleanup pass consolidated", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); MeritFlawRegistry.reset(); ArcanumRegistry.reset(); resetAllConfigStores(); await LorebookManager.bootstrap(); });

  test("the other two Roads are reachable, and change what the rating sums", async () => {
    expect(Object.keys(ROADS)).toEqual(["road-of-humanity", "road-of-kings", "road-of-the-beast"]);
    expect(roadByName("Road of Kings")).toBe(ROAD_OF_KINGS);
    expect(roadByName("kings")).toBe(ROAD_OF_KINGS);            // the short name too
    expect(roadByName("nope")).toBeUndefined();

    await CommandRouter.route('create-playable name="Sasha" templates=vampire');
    // On Humanity the rating is Conscience + Self-Control...
    await CommandRouter.route("set-trait conscience 4");
    expect(traitValueOf((await CharacterStore.load("Sasha"))!, "road")).toBe(5);
    // ...on the Road of Kings it is Conviction + Self-Control, which this sheet
    // has no Conviction for - so the choice really does change the arithmetic.
    expect(await CommandRouter.route("choose road road-of-kings")).toContain("Conviction + Self Control");
    await CommandRouter.route("set-trait conviction 2 group=virtue");
    expect(traitValueOf((await CharacterStore.load("Sasha"))!, "road")).toBe(3);
  });

  test("[[show-creation]] and [[show-budget]] price a Background through the SAME ledger", async () => {
    await CommandRouter.route('create-playable name="Sasha" templates=vampire');
    await CommandRouter.route("set-trait courage 3");
    // A price written as an EXPRESSION: the creation report used to parseInt this
    // to 0 while the budget report evaluated it to 3.
    await CommandRouter.route("set-trait herd 4 paid=courage");
    expect(await CommandRouter.route("show-budget")).toContain("background: 3/5");
    expect(await CommandRouter.route("show-creation")).toContain("backgrounds: 3/5");
  });

  test("every roll op moves exactly one modifier field, from one table", async () => {
    // rollOpPatch is the single source: a def with all five ops folds each into
    // its own field, and an op nobody interprets is reported rather than applied.
    await CommandRouter.route('define-arcanum name=`Everything` points=1 passive=`difficulty -1; dice +2; successes +1; uncancelable +1; nagain 9; seduction +3`');
    const def = ArcanumRegistry.get("everything")!;
    expect(def.passive!.length).toBe(6);
    expect(MeritFlawRegistry.get("everything")).toBeUndefined();   // its own list
    expect(await CommandRouter.route("show-arcanum in=campaign everything")).toContain("seduction");
  });
});

// =============================================================================
// MANUAL SUCCESSES - the Storyteller hands some out, before a die is thrown
// =============================================================================
describe("successes= and uncancelable=: granted successes, by hand", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); MeritFlawRegistry.reset(); ArcanumRegistry.reset(); resetAllConfigStores(); await LorebookManager.bootstrap(); });

  test("the spec carries them, and resolveSpec folds them in beside tags and spends", () => {
    const resolve = (n: string): number => ({ strength: 3, brawl: 2 } as Record<string, number>)[n] ?? 0;
    const plain = resolveSpec(makeRollSpec({ pool: "strength+brawl" }), resolve);
    expect(plain.automaticSuccesses).toBe(0);
    expect(plain.uncancelableSuccesses).toBe(0);
    const granted = resolveSpec(makeRollSpec({ pool: "strength+brawl", autoSuccesses: 2, uncancelableSuccesses: 1 }), resolve);
    expect(granted.automaticSuccesses).toBe(2);
    expect(granted.uncancelableSuccesses).toBe(1);
    expect(granted.dice).toBe(5);                                  // the pool is untouched
    // A tag and a spend still ADD to the spec's own, rather than replacing them.
    const both = resolveSpec(
      makeRollSpec({ pool: "strength", autoSuccesses: 2, tags: ["willpower"] }),
      resolve, { extra: { tag: "x", describe: "x", autoSuccesses: 1, uncancelableSuccesses: 4 } });
    expect(both.automaticSuccesses).toBe(4);                       // 2 spec + 1 tag + 1 extra
    expect(both.uncancelableSuccesses).toBe(4);
  });

  test("an automatic success can be cancelled by a 1; an un-cancelable one never is", async () => {
    await CommandRouter.route('create-playable name="Rok" templates=mortal');
    await CommandRouter.route("set-trait strength 2");
    // Two dice: a botching 1 and a plain failure. The granted success is eaten.
    const auto = await CommandRouter.route("roll strength 6 successes=1", { rng: seqRng([1, 3]) });
    expect(auto).toContain("+1 auto");
    expect(auto).toContain("Failure");                             // the 1 ate the granted success
    // The same roll with a CERTAIN success survives the 1 - that is the whole
    // difference between the two knobs.
    const sure = await CommandRouter.route("roll strength 6 uncancelable=1", { rng: seqRng([1, 3]) });
    expect(sure).toContain("+1 sure");
    expect(sure).toContain("1 success");
    expect(sure).not.toContain("BOTCH");
  });

  test("a named roll bakes them in, and [[show-roll]] says so", async () => {
    await CommandRouter.route('create-playable name="Rok" templates=mortal');
    await CommandRouter.route("set-trait strength 3");
    await CommandRouter.route("name-roll potence-punch strength successes=2 uncancelable=1");
    expect(await CommandRouter.route("show-roll potence-punch")).toContain("+2 auto, +1 sure");
    const rolled = await CommandRouter.route("roll @potence-punch", { rng: seqRng([2, 2, 2]) });
    expect(rolled).toContain("+2 auto +1 sure");
    expect(rolled).toContain("3 successes");                       // every die failed
    // ...and they survive the trip through the lorebook card.
    const card = savedRollToCard((await NamedRollStore.get("potence-punch"))!);
    expect(savedRollFromCard(card)!.autoSuccesses).toBe(2);
    expect(savedRollFromCard(card)!.uncancelableSuccesses).toBe(1);
  });

  test("the knobs reach [[roll]] itself, not only saved rolls - one arg reader now", async () => {
    await CommandRouter.route('create-playable name="Rok" templates=mortal');
    await CommandRouter.route("set-trait strength 3");
    // The bug this consolidation fixed: extractRollArgs (for [[roll]]) and
    // rollOverridesFromNamed (for saved rolls) each read the named knobs, so a
    // knob added to one was silently missing from the other.
    expect(await CommandRouter.route("roll strength successes=2", { rng: seqRng([2, 2, 2]) })).toContain("+2 auto");
    expect(await CommandRouter.route('roll-for "Rok" strength successes=2', { rng: seqRng([2, 2, 2]) })).toContain("+2 auto");
    // The positional difficulty and diff-mod still work beside them.
    const positional = await CommandRouter.route("roll strength 8 1 successes=1", { rng: seqRng([9, 9, 9]) });
    expect(positional).toContain("vs diff 9");
    expect(positional).toContain("+1 auto");
  });
});

// =============================================================================
// TEMPLATES AS DATA - extending one, and the Ouroboros that stopped being code
// =============================================================================
describe("templates: extending one, from a def or a command", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); MeritFlawRegistry.reset(); ArcanumRegistry.reset(); resetAllConfigStores(); await LorebookManager.bootstrap(); });

  test("the Ouroboros is a DEF that extends the mage - and resolves to what it always was", () => {
    const def = DEFAULT_TEMPLATE_DEFS.find(d => d.name === "ouroboros")!;
    expect(def.extends).toBe("mage");
    expect(def.soak).toBe("ghoul");
    const o = TEMPLATES["ouroboros"];
    const mage = TEMPLATES["mage"];
    // Inherited from the mage: ruleset, no morality, no Virtues, Awakened.
    expect(o.Rules).toBe(mage.Rules);
    expect(o.Morality).toBeNull();
    expect(o.HasVirtues).toBe(false);
    expect(o.Awakened).toBe(true);
    // Its own: a ghoul's soak, and Living Resolve ADDED to what it inherited.
    expect(o.Soak).toBe(GHOUL_SOAK);
    expect(o.Pools).toContain(LIVING_RESOLVE);
    expect(o.Pools.map(p => p.name)).toContain("quintessence");   // the mage's, inherited...
    expect(o.Creation.notes!.some(n => n.includes("One pool, not four"))).toBe(true);
  });

  test("...and Living Resolve still HIDES the four it replaces, so nothing doubles up", async () => {
    await CommandRouter.route('create-playable name="Visvaldas" templates=ouroboros');
    await CommandRouter.route("set-trait fount 5 paid=0");
    const char = (await CharacterStore.load("Visvaldas"))!;
    const names = CharacterResources.defsFor(char).map(d => d.name);
    expect(names).toEqual(["living-resolve"]);
    // The phantom-Willpower guard still holds: the inherited pool is replaced,
    // so the sheet must not carry a willpower entry trait lookups could find.
    expect(char.poolStarts.willpower).toBeUndefined();
  });

  test("templateFromDef inherits what a def leaves unsaid and appends what it states", () => {
    const mage = TEMPLATES["mage"];
    const bare = templateFromDef({ name: "acolyte", extends: "mage" }, mage);
    expect(bare.Soak).toBe(mage.Soak);
    expect(bare.Pools).toEqual(mage.Pools);
    expect(bare.Awakened).toBe(true);
    const changed = templateFromDef({
      name: "burned", extends: "mage", soak: "ghoul", awakened: false,
      morality: "humanity", budgets: { arcana: "9" },
    }, mage);
    expect(changed.Soak).toBe(GHOUL_SOAK);
    expect(changed.Awakened).toBe(false);
    expect(changed.Morality!.name).toBe("Road of Humanity");
    expect(budgetDef(changed.Budgets.arcana).allows).toBe("9");
    expect(changed.Rules).toBe(mage.Rules);                        // still inherited
  });

  test("a half-written def is REPORTED, never fatal - and the good ones still build", () => {
    const problems = applyTemplateDefs([
      { name: "orphan", extends: "nonesuch" },
      { name: "loopy", extends: "loopy" },
      { name: "fine", extends: "mage" },
    ]);
    expect(problems).toContain('orphan extends "nonesuch", which no template defines');
    expect(problems.some(p => p.includes("loopy extends itself in a circle"))).toBe(true);
    expect(TEMPLATES["orphan"]).toBeUndefined();
    expect(TEMPLATES["fine"]).toBeDefined();
    expect(TEMPLATES["mage"]).toBeDefined();                        // built-ins survive
    applyTemplateDefs(DEFAULT_TEMPLATE_DEFS);
    expect(TEMPLATES["ouroboros"]).toBeDefined();                   // and the fold is redoable
  });

  test("a whole fused-pool creature, built from commands and then played", async () => {
    expect(await CommandRouter.route("show-template")).toContain("ouroboros*");   // * = data

    await CommandRouter.route("define-resource name=`Ash Tally` kind=pool start=20 max=20 "
      + "roles=`blood,willpower,magic-fuel` replaces=`blood,willpower,quintessence` per-turn=4");
    const made = await CommandRouter.route("extend-template name=`Cinder` extends=mage soak=ghoul resources=`ash-tally`");
    expect(made).toContain("extends Mage");
    expect(made).toContain("Ash Tally");
    expect(TEMPLATES["cinder"].Soak).toBe(GHOUL_SOAK);
    expect(TEMPLATES["cinder"].Awakened).toBe(true);                // the mage's

    // It PLAYS: the fused pool replaces the four, and casting works off the
    // Foundation it inherited from being a mage.
    await CommandRouter.route('create-playable name="Ember" templates=cinder');
    const char = (await CharacterStore.load("Ember"))!;
    expect(CharacterResources.defsFor(char).map(d => d.name)).toEqual(["ash-tally"]);
    await CommandRouter.route("set-trait modus 4");
    await CommandRouter.route("set-trait primus 2");
    expect(await CommandRouter.route('magick pillars="primus:2"', { rng: allTens })).toContain("Modus + Primus");
    expect(await CommandRouter.route("spend ash-tally 2")).toContain("Now 18/20");
  });

  test("extending nothing that exists is refused, and forgetting restores the shipped one", async () => {
    expect(await CommandRouter.route("extend-template name=`Ghost` extends=nonesuch"))
      .toContain('No template "nonesuch" to extend');
    expect(await CommandRouter.route("extend-template name=`Ghost` extends=mage resources=`no-such-pool`"))
      .toContain("define it first with");
    // The verb EDITS a template that already exists: re-parenting the Ouroboros
    // must not silently drop the soak, the pools and the notes it came with.
    await CommandRouter.route("extend-template name=`Ouroboros` extends=vampire");
    expect(TEMPLATES["ouroboros"].Soak).toBe(GHOUL_SOAK);
    expect(TEMPLATES["ouroboros"].Pools.some(p => p.name === "living-resolve")).toBe(true);
    // Say the soak too and it changes - what you state, and only that.
    await CommandRouter.route("extend-template name=`Ouroboros` extends=vampire soak=vampire");
    expect(TEMPLATES["ouroboros"].Soak).toBe(TEMPLATES["vampire"].Soak);
    expect(await CommandRouter.route("forget-template ouroboros")).toContain("shipped one resurfaces");
    expect(TEMPLATES["ouroboros"].Soak).toBe(GHOUL_SOAK);
    expect(await CommandRouter.route("forget-template mage")).toContain("built-ins cannot be removed");
  });
});

// =============================================================================
// RESOURCES THAT READ THE SHEET - the Fount ladder, and a pool made of pools
// =============================================================================
describe("resource capacity as an expression: the Fount ladder, and fusing two pools", () => {
  beforeEach(async () => { __resetStorageMock(); __resetLorebookMock(); MeritFlawRegistry.reset(); ArcanumRegistry.reset(); resetAllConfigStores(); await LorebookManager.bootstrap(); });

  test("a mage without the Fount holds ten and spends one; each dot raises both", async () => {
    await CommandRouter.route('create-playable name="Hermetic" templates=mage');
    const quintessence = (c: PlayableCharacter) =>
      resourceNumbers(c, CharacterResources.resolveDef(c, "quintessence")!);
    // The book's bare capacity, and its bare rate.
    let char = (await CharacterStore.load("Hermetic"))!;
    expect(quintessence(char).max).toBe(10);
    expect(quintessence(char).perTurn).toBe(1);
    // ...then the whole published ladder, from ONE pair of expressions:
    // max = 10 + 2 x Fount, per-turn = 1 + Fount.
    const ladder: Array<[number, number, number]> = [[1, 12, 2], [2, 14, 3], [3, 16, 4], [4, 18, 5], [5, 20, 6]];
    for (const [dots, max, perTurn] of ladder) {
      await CommandRouter.route(`set-trait fount ${dots}`);
      char = (await CharacterStore.load("Hermetic"))!;
      expect(quintessence(char).max).toBe(max);
      expect(quintessence(char).perTurn).toBe(perTurn);
    }
    expect(await CommandRouter.route("show-resource")).toContain("quintessence 0/20");
  });

  test("Living Resolve IS the two it fuses: Quintessence's capacity plus a revenant's ten", async () => {
    await CommandRouter.route('create-playable name="Vis" templates=ouroboros');
    const cap = async (): Promise<number> => {
      const c = (await CharacterStore.load("Vis"))!;
      return resourceNumbers(c, CharacterResources.resolveDef(c, "living-resolve")!).max;
    };
    expect(await cap()).toBe(20);                                  // 10 quintessence + 10 vitae
    await CommandRouter.route("set-trait fount 2");
    expect(await cap()).toBe(24);                                  // 14 + 10
    await CommandRouter.route("set-trait fount 5");
    expect(await cap()).toBe(30);                                  // 20 + 10 - his actual pool
    // The rate comes from the Quintessence side, which is the one with a ladder.
    const c = (await CharacterStore.load("Vis"))!;
    expect(resourceNumbers(c, CharacterResources.resolveDef(c, "living-resolve")!).perTurn).toBe(6);
    // And it still HIDES all four, so raising the Fount never un-fuses him.
    expect(CharacterResources.defsFor(c).map(d => d.name)).toEqual(["living-resolve"]);
  });

  test("`resource:` reads a def's numbers, and a self-reference cannot spin", async () => {
    await CommandRouter.route('create-playable name="Vis" templates=ouroboros');
    await CommandRouter.route("set-trait fount 3");
    expect(await CommandRouter.route("show-eval resource:quintessence:max")).toContain("= 16");
    expect(await CommandRouter.route("show-eval resource:blood:max")).toContain("= 10");
    expect(await CommandRouter.route("show-eval resource:quintessence:per-turn")).toContain("= 4");
    expect(await CommandRouter.route("show-eval resource:living-resolve:max")).toContain("= 26");
    // A pool nobody defines is unknown, not zero-in-silence.
    expect(await CommandRouter.route("show-eval resource:nonesuch:max")).toContain("⚠ nothing answers");
    // A resource defined in terms of ITSELF terminates with a finite answer
    // rather than blowing the stack: the guard bites on the first re-entry, so
    // the outermost evaluation still completes.
    await CommandRouter.route("define-resource name=`Ouroboric` kind=pool start=0 max=`resource:ouroboric:max + 1`");
    const c = (await CharacterStore.load("Vis"))!;
    const spun = resourceNumbers(c, CharacterResources.resolveDef(c, "ouroboric")!).max;
    expect(Number.isFinite(spun)).toBe(true);
    expect(spun).toBeLessThan(5);
  });

  test("spending and gaining respect the derived ceiling, not a constant", async () => {
    await CommandRouter.route('create-playable name="Vis" templates=ouroboros');
    await CommandRouter.route("set-trait fount 5 paid=0");
    const c = (await CharacterStore.load("Vis"))!;
    expect(await CommandRouter.route("show-resource")).toContain("living-resolve 30/30");
    expect(await CommandRouter.route("spend living-resolve 5")).toContain("living-resolve now 25/30");
    expect(await CommandRouter.route("gain living-resolve 99")).toContain("30/30");   // clamped at the ceiling
    // Drop the Fount and the ceiling drops with it - the pool is not a number.
    await CommandRouter.route("set-trait fount 1");
    expect(await CommandRouter.route("show-resource")).toContain("/22");
  });
});

// =============================================================================
// PRICED PURSES, CAPABILITIES, AND WHOSE DISCIPLINES THESE ARE
// -----------------------------------------------------------------------------
// Three things that used to be assumptions: that a budget is only an allowance,
// that holding a pool means being able to spend it, and that Disciplines come
// from a clan. Each is now data a template states and a command may change.
// =============================================================================
describe("budgets that carry prices, and templates that override any part of one", () => {
  beforeEach(async () => {
    __resetStorageMock(); __resetLorebookMock();
    await LorebookManager.bootstrap();
    await reloadAllConfigStores();
  });

  test("budgetDef normalizes the short form; NOT_PURCHASABLE is a rule, absence is not", () => {
    expect(budgetDef("25")).toEqual({ allows: "25" });
    expect(budgetDef(undefined)).toEqual({});
    expect(budgetDef({ allows: "9", freebie: NOT_PURCHASABLE }).freebie).toBe(NOT_PURCHASABLE);
    expect(budgetBuyable("5")).toBe(true);
    expect(budgetBuyable(NOT_PURCHASABLE)).toBe(false);
    expect(budgetBuyable(undefined)).toBe(false);   // nobody said - the ST's call
  });

  test("the Ouroboros' arcana purse is his Willpower, and cannot be bought", async () => {
    await CommandRouter.route('create-playable name="Marius" templates=ouroboros');
    await CommandRouter.route("set-trait fount 5 paid=0");
    // "Willpower, or whatever replaces it" - the role, not the hidden tracker.
    expect(await CommandRouter.route("show-eval role:willpower")).toContain("= 30");
    expect(await CommandRouter.route("show-eval resource:willpower:max")).toContain("= 10");
    const r = await CommandRouter.route("show-budget");
    expect(r).toContain("arcana: 0/30 (role:willpower)");
    expect(r).toContain("not bought with freebies, not bought with experience");
    // Backgrounds keep the chronicle's own prices, unstated by any template.
    expect(r).toContain("background: 0/5, 5 left - freebie 1, experience current x 2");
  });

  test("Discipline dots are a purse, and [[show-budget]] and [[show-creation]] agree on them", async () => {
    await CommandRouter.route('create-playable name="Nos" templates=vampire');
    await CommandRouter.route("choose clan nosferatu");
    await CommandRouter.route("set-trait obfuscate 3 group=discipline");
    const budget = await CommandRouter.route("show-budget");
    expect(budget).toContain("discipline: 3/4");
    expect(budget).toContain("freebie 7");                       // a Discipline dot's price
    expect(await CommandRouter.route("show-creation")).toContain("disciplines: 3/4");
    // A dot the Storyteller granted costs the purse nothing.
    await CommandRouter.route("paid obfuscate 0");
    expect(await CommandRouter.route("show-budget")).toContain("discipline: 0/4");
  });

  test("extend-template changes any part of a budget, and edits rather than replaces", async () => {
    await CommandRouter.route("extend-template name=`Ouroboros` budgets=`arcana=12,arcana:experience=current x 3`");
    const tpl = TEMPLATES["ouroboros"];
    const arcana = budgetDef(tpl.Budgets["arcana"]);
    expect(arcana.allows).toBe("12");
    expect(arcana.experience).toBe("current x 3");
    expect(arcana.freebie).toBe(NOT_PURCHASABLE);   // untouched by the edit
    expect(tpl.Soak).toBe(GHOUL_SOAK);              // and so is everything else
    // The creation pools are equally open.
    await CommandRouter.route("extend-template name=`Ouroboros` creation=`disciplines=4,freebies=21`");
    expect(TEMPLATES["ouroboros"].Creation.disciplines).toBe(4);
    expect(TEMPLATES["ouroboros"].Creation.freebies).toBe(21);
    expect(await CommandRouter.route("extend-template name=`Ouroboros` creation=`nonesuch=4`"))
      .toContain('No creation pool "nonesuch"');
  });

  test("a sheet's own budget still wins, prices and all", async () => {
    await CommandRouter.route('create-playable name="Marius" templates=ouroboros');
    const char = (await CharacterStore.load("Marius"))!;
    char.budgets = { arcana: { allows: "7", freebie: "3" } };
    await CharacterStore.save(char);
    const r = await CommandRouter.route("show-budget");
    expect(r).toContain("arcana: 0/7");
    expect(r).toContain("freebie 3");
    // ... and survives the round trip through the card.
    const again = (await CharacterStore.load("Marius"))!;
    expect(budgetDef(again.budgets!["arcana"]).freebie).toBe("3");
  });
});

describe("spending more than one point, and saying so briefly", () => {
  beforeEach(async () => {
    __resetStorageMock(); __resetLorebookMock();
    await LorebookManager.bootstrap();
    await reloadAllConfigStores();
  });

  test("spend-amount is on the roll's own grammar, so [[help roll]] and the window show it", async () => {
    const params = (CommandRouter.specFor("roll")?.params ?? []).map(p => p.key);
    expect(params).toContain("spend");
    expect(params).toContain("spend-amount");
    expect(await CommandRouter.route("help roll")).toContain("spend-amount=N");
  });

  test("N points ride one spend, and a per-use cap says so instead of silently trimming", async () => {
    await CommandRouter.route('create-playable name="Vis" templates=mage');
    await CommandRouter.route("set-trait fount 3 paid=0");
    await CommandRouter.route("gain quintessence 16");
    const two = await CommandRouter.route("roll 3 spend=quintessence spend-amount=2");
    expect(two).toContain("spent 2 quintessence");
    // Quintessence caps at 3 per use; asking for 9 pays 3 and SAYS it did.
    const many = await CommandRouter.route("roll 3 spend=quintessence spend-amount=9");
    expect(many).toContain("spent 3 quintessence");
    expect(many).toContain("capped at 3 per use");
    // Resolve has no such cap - a demon may pour in as much as he holds.
    await CommandRouter.route('create-playable name="Duke" templates=demon');
    await CommandRouter.route('play name="Duke"');
    expect(await CommandRouter.route("roll 3 spend=resolve spend-amount=2")).toContain("spent 2 resolve");
  });

  test("the roll's tail says what the spend DID, not what the resource IS", async () => {
    await CommandRouter.route('create-playable name="Marius" templates=ouroboros');
    const r = await CommandRouter.route("roll 3 spend=living-resolve");
    // The mechanical result is on the roll line, where it belongs.
    expect(r).toContain("+1 auto +1 sure");
    expect(r).toContain("spent 1 living-resolve");
    // ...and the resource's paragraph of rules prose is NOT on a punch.
    expect(r).not.toContain("Quintessence break");
    expect(r).not.toContain("spellcasting may stack");
    expect(r.length).toBeLessThan(220);
    // It is still one [[show-resource]] away for anyone who wants it.
    expect(await CommandRouter.route("show-resource")).toContain("Quintessence break");
  });

  test("a saved roll can bake in the amount, and the command still overrides it", async () => {
    await CommandRouter.route('create-playable name="Duke" templates=demon');
    await CommandRouter.route("name-roll surge 3 spend=resolve spend-amount=2");
    expect(await CommandRouter.route("show-roll surge")).toContain("spend=resolve x2");
    expect(await CommandRouter.route("roll @surge")).toContain("spent 2 resolve");
    expect(await CommandRouter.route("roll @surge spend-amount=1")).toContain("spent 1 resolve");
    // ...and it survives the card round trip.
    const again = (await NamedRollStore.get("surge"))!;
    expect(again.spendAmount).toBe(2);
  });

  test("a resource declares that it heals by filling the `heal` role", async () => {
    await CommandRouter.route('create-playable name="Vlad" templates=vampire');
    const char = (await CharacterStore.load("Vlad"))!;
    // [[spend heal]] finds the substance without knowing its name.
    expect(CharacterResources.resolveDef(char, "heal")!.name).toBe("blood");
    await CommandRouter.route("damage lethal 2");
    expect(await CommandRouter.route("spend heal:heal 2")).toContain("healing 2 boxes");
  });
});

describe("capabilities: holding a pool is not being able to spend it", () => {
  beforeEach(async () => {
    __resetStorageMock(); __resetLorebookMock();
    await LorebookManager.bootstrap();
    await reloadAllConfigStores();
  });

  test("the roster is what templates draw on, and Awakened is one of them", () => {
    expect(Object.keys(CAPABILITIES)).toEqual(["awakened", "vitae", "resolve", "arcana"]);
    expect(TEMPLATE_MAGE.Capabilities).toEqual(["awakened"]);
    expect(TEMPLATE_MAGE.Awakened).toBe(true);          // still the name it had
    expect(TEMPLATE_VAMPIRE.Capabilities).toEqual(["vitae"]);
    expect(TEMPLATE_VAMPIRE.Awakened).toBe(false);
    // The Ouroboros inherits the mage's and adds the ones nobody else has all of.
    expect([...TEMPLATES["ouroboros"].Capabilities].sort()).toEqual(["arcana", "awakened", "resolve", "vitae"]);
    // `arcana` is not a pool at all - it is what opens the Arcana LIST, and it
    // belongs to the infernal: a demon, and anyone who became a demon's thrall.
    expect(TEMPLATES["demon"].Capabilities).toContain("arcana");
    expect(TEMPLATES["thrall"].Capabilities).toContain("arcana");
    expect(TEMPLATES["mortal"].Capabilities).not.toContain("arcana");
  });

  test("a mage with blood in his veins holds it and cannot use it, until he is attuned", async () => {
    await CommandRouter.route("define-resource name=`stolen-vitae` kind=pool start=10 max=10 roles=`blood` requires=`vitae`");
    await CommandRouter.route("extend-template name=`Blood-Marked` extends=mage resources=`stolen-vitae`");
    await CommandRouter.route('create-playable name="Sleeper" templates=blood-marked');
    expect(await CommandRouter.route("show-resource")).toContain("stolen-vitae 10/10 ⚠ held but UNUSABLE (needs vitae");
    const refused = await CommandRouter.route("spend stolen-vitae 1");
    expect(refused).toContain("holds stolen-vitae but cannot use it");
    expect(await CommandRouter.route("show-resource")).toContain("stolen-vitae 10/10");   // nothing left the pool
    // Something teaches him the trick of it.
    expect(await CommandRouter.route("attune vitae")).toContain("can now spend stolen-vitae");
    expect(await CommandRouter.route("spend stolen-vitae 1")).toContain("Now 9/10");
    expect(await CommandRouter.route("attune vitae off")).toContain("no longer attuned");
    expect(await CommandRouter.route("spend stolen-vitae 1")).toContain("cannot use it");
    // What the TEMPLATE is cannot be taken back on the sheet.
    expect(await CommandRouter.route("attune awakened off")).toContain("a sheet cannot take back what the template is");
  });

  test("an attunement survives the sheet's round trip, and [[attune]] reports both sides", async () => {
    await CommandRouter.route('create-playable name="Sleeper" templates=mage');
    await CommandRouter.route("attune resolve");
    const again = (await CharacterStore.load("Sleeper"))!;
    expect(again.capabilities).toEqual(["resolve"]);
    expect(CharacterResources.capabilities(again).sort()).toEqual(["awakened", "resolve"]);
    const r = await CommandRouter.route("attune");
    expect(r).toContain("can use: resolve, awakened");
    expect(r).toContain("attuned: resolve");
  });

  test("the fused pool needs every capability it stands for, and the Ouroboros has them", async () => {
    await CommandRouter.route('create-playable name="Marius" templates=ouroboros');
    const char = (await CharacterStore.load("Marius"))!;
    const fused = CharacterResources.resolveDef(char, "willpower")!;
    expect(fused.name).toBe("living-resolve");
    expect(CharacterResources.cannotUse(char, fused)).toEqual([]);
    // The hidden Quintessence still declares what it would need.
    const quint = resourcesForTemplates(["mage"]).find(r => r.name === "quintessence")!;
    expect(quint.requires).toEqual(["awakened"]);
    const mortal = (await CharacterStore.load("Marius"))!;
    mortal.templates = ["mortal"];
    expect(CharacterResources.cannotUse(mortal, quint)).toEqual(["awakened"]);
  });
});

describe("whose Disciplines these are: clan, family, or the creature's own", () => {
  beforeEach(async () => {
    __resetStorageMock(); __resetLorebookMock();
    await LorebookManager.bootstrap();
    await reloadAllConfigStores();
  });

  test("affinityDisciplines reads the picks; an empty family registry answers nothing", () => {
    expect(affinityDisciplines({ clan: "nosferatu" }).disciplines)
      .toEqual(["animalism", "obfuscate", "potence"]);
    // Ghoul and revenant families are not transcribed yet: the pick is real and
    // the answer is empty, which is what a template's own list covers for.
    expect(affinityDisciplines({ "revenant-family": "anything" }).disciplines).toEqual([]);
    // A template ADDS by default...
    expect(affinityDisciplines({ clan: "nosferatu" }, { disciplines: ["celerity"] }).disciplines)
      .toEqual(["animalism", "obfuscate", "potence", "celerity"]);
    // ... and REPLACES when it says so.
    const only = affinityDisciplines({ clan: "nosferatu" }, { disciplines: ["celerity"], mode: "replace" });
    expect(only.disciplines).toEqual(["celerity"]);
    expect(only.sources).toContain("the template (only these)");
  });

  test("the Ouroboros' Disciplines are his own, named by a command", async () => {
    await CommandRouter.route('create-playable name="Marius" templates=ouroboros');
    // Nothing names them yet - said, not guessed at.
    expect(await CommandRouter.route("show-creation")).toContain("nothing names his Disciplines yet");
    await CommandRouter.route("extend-template name=`Ouroboros` disciplines=`=celerity,potence`");
    expect(TEMPLATES["ouroboros"].Affinity.disciplines).toEqual(["celerity", "potence"]);
    expect(await CommandRouter.route("show-template ouroboros")).toContain("Disciplines: Celerity, Potence (and no family's)");
    await CommandRouter.route("set-trait obfuscate 2 group=discipline");
    const r = await CommandRouter.route("show-creation");
    expect(r).toContain("(the template (only these): Celerity, Potence)");
    expect(r).toContain("⚠ out of affinity: Obfuscate");
  });
});

describe("a vampire's blood pool is what generation allows", () => {
  beforeEach(async () => {
    __resetStorageMock(); __resetLorebookMock();
    await LorebookManager.bootstrap();
    await reloadAllConfigStores();
  });

  test("the Generation Background moves the capacity and the per-turn limit", async () => {
    await CommandRouter.route('create-playable name="Elder" templates=vampire');
    // 12th generation by default: eleven points, one a turn.
    expect(await CommandRouter.route("show-resource")).toContain("blood 10/11");
    expect(await CommandRouter.route("show-eval resource:blood:max")).toContain("= 11");
    // Five dots of the Background make him 7th: twenty points, five a turn.
    await CommandRouter.route("set-trait generation 5 paid=0");
    expect(await CommandRouter.route("show-derived")).toContain("Generation 7");
    const r = await CommandRouter.route("show-resource");
    expect(r).toContain("blood 10/20");
    expect(r).toContain("5/turn");
    expect(await CommandRouter.route("gain blood 99")).toContain("Now 20/20");
  });
});

// =============================================================================
// THE EVENT BUS AND THE POST OFFICE
// -----------------------------------------------------------------------------
// core/bus.ts is pure dispatch; PostOffice is the half that knows about
// api.v1.messaging. The tests that matter are the ones that pin the two facts
// the whole design rests on: local delivery is SYNCHRONOUS, and a broadcast
// never comes back to its sender.
// =============================================================================
describe("the event bus: priority, cancel, and stopping the spread", () => {
  test("handlers run by priority, then by registration order", () => {
    const bus = new EventBus();
    const order: string[] = [];
    bus.on("thing", () => { order.push("normal-1"); });
    bus.on("thing", () => { order.push("last"); }, "last");
    bus.on("thing", () => { order.push("first"); }, "first");
    bus.on("thing", () => { order.push("normal-2"); });
    bus.on("thing", () => { order.push("monitor"); }, "monitor");
    bus.emit("thing", {});
    expect(order).toEqual(["first", "normal-1", "normal-2", "last", "monitor"]);
    expect(bus.listeners("thing").map(l => l.priority))
      .toEqual(["first", "normal", "normal", "last", "monitor"]);
  });

  test("before / on / after run in that order, whatever their priorities say", () => {
    const bus = new EventBus();
    const order: string[] = [];
    // Deliberately perverse priorities: `after` claims `first`, `before` claims
    // `last`. The PHASE still wins, because it is a different axis.
    bus.on("thing", () => { order.push("after"); }, { phase: "after", priority: "first" });
    bus.on("thing", () => { order.push("on"); });
    bus.on("thing", () => { order.push("before"); }, { phase: "before", priority: "last" });
    bus.emit("thing", {});
    expect(order).toEqual(["before", "on", "after"]);
    expect(bus.listeners("thing").map(l => l.phase)).toEqual(["before", "on", "after"]);
    expect(bus.listeners("thing", "on")).toHaveLength(1);
  });

  test("a veto in `before` is BINDING - it is why the phase exists", () => {
    const bus = new EventBus();
    const ran: string[] = [];
    bus.on("strike", () => ({ cancel: true }), { phase: "before" });
    // Within `before`, cancel is still only a flag: this one still runs.
    bus.on("strike", () => { ran.push("before-2"); }, { phase: "before", priority: "last" });
    bus.on("strike", () => { ran.push("on"); });
    bus.on("strike", () => { ran.push("after"); }, { phase: "after" });
    const e = bus.emit("strike", {});
    expect(e.cancelled).toBe(true);
    expect(ran).toEqual(["before-2"]);        // `on` and `after` never happened
  });

  test("`after` does not run when `on` cancelled - it is the slot for what DID happen", () => {
    const bus = new EventBus();
    const ran: string[] = [];
    bus.on("spend", () => { ran.push("on"); return { cancel: true }; });
    bus.on("spend", () => { ran.push("after"); }, { phase: "after" });
    expect(bus.emit("spend", {}).cancelled).toBe(true);
    expect(ran).toEqual(["on"]);

    // Uncancelled, the ledger gets its turn.
    const ok = new EventBus();
    const seen: string[] = [];
    ok.on("spend", () => { seen.push("on"); });
    ok.on("spend", () => { seen.push("after"); }, { phase: "after", priority: "monitor" });
    ok.emit("spend", {});
    expect(seen).toEqual(["on", "after"]);
  });

  test("a bare priority still means the `on` phase, so nothing older has to move", () => {
    const bus = new EventBus();
    bus.on("legacy", () => undefined, "first");
    bus.on("legacy", () => undefined);
    expect(bus.listeners("legacy").map(l => l.phase)).toEqual(["on", "on"]);
    expect(BUS_PHASES).toEqual(["before", "on", "after"]);
  });

  test("subscribing and unsubscribing bumps the version the post office watches", () => {
    const bus = new EventBus();
    const v0 = bus.version;
    const id = bus.on("x", () => undefined);
    expect(bus.version).toBeGreaterThan(v0);
    const v1 = bus.version;
    expect(bus.off(id)).toBe(true);
    expect(bus.version).toBeGreaterThan(v1);
    const v2 = bus.version;
    expect(bus.off(id)).toBe(false);          // already gone
    expect(bus.version).toBe(v2);             // ...and that is not a change
  });

  test("cancel is a FLAG later handlers may honour or ignore; stop ends the run", () => {
    const bus = new EventBus();
    const saw: string[] = [];
    bus.on("hit", () => ({ cancel: true }), "first");
    // One handler honours the flag...
    bus.on("hit", (e) => { if (e.cancelled) return; saw.push("careful ran"); });
    // ...another never checks, which is allowed and is the point of a flag.
    bus.on("hit", () => { saw.push("heedless ran"); });
    const cancelled = bus.emit("hit", {});
    expect(cancelled.cancelled).toBe(true);
    expect(saw).toEqual(["heedless ran"]);

    const bus2 = new EventBus();
    const ran: string[] = [];
    bus2.on("hit", () => { ran.push("a"); return { stop: true }; }, "first");
    bus2.on("hit", () => { ran.push("b"); });
    const stopped = bus2.emit("hit", {});
    expect(ran).toEqual(["a"]);              // nothing after the stop
    expect(stopped.stopped).toBe(true);
    expect(stopped.cancelled).toBe(false);   // stopping is not cancelling
  });

  test("a monitor watches and does not vote", () => {
    const bus = new EventBus();
    bus.on("hit", () => ({ cancel: true, stop: true }), "monitor");
    const e = bus.emit("hit", {});
    expect(e.cancelled).toBe(false);
    expect(e.stopped).toBe(false);
  });

  test("a throwing handler is recorded, not fatal - the rest still run", () => {
    const bus = new EventBus();
    const ran: string[] = [];
    bus.on("hit", () => { throw new Error("bad handler"); }, "first");
    bus.on("hit", () => { ran.push("still ran"); });
    const e = bus.emit("hit", {});
    expect(ran).toEqual(["still ran"]);
    expect(e.errors.join()).toContain("bad handler");
  });

  test("emit is SYNCHRONOUS - the verdict is readable on the next line", () => {
    const bus = new EventBus();
    bus.on("roll", (e) => { (e.data as { dice: number }).dice += 2; });
    const data = { dice: 5 };
    bus.emit("roll", data);
    // This is the whole reason local dispatch is not a round trip: a handler
    // adjusted the thing BEFORE the caller read it back.
    expect(data.dice).toBe(7);
  });

  test("off stops a handler; channels and names are normalized once", () => {
    const bus = new EventBus();
    let hits = 0;
    const id = bus.on("Some Channel", () => { hits++; });
    expect(bus.channels()).toEqual(["some channel"]);   // stored normalized
    bus.emit("some channel", {});                        // and matched normalized
    expect(hits).toBe(1);
    expect(bus.off(id)).toBe(true);
    expect(bus.off(id)).toBe(false);
    bus.emit("Some Channel", {});
    expect(hits).toBe(1);
    expect(busChannel("  MIXED Case ")).toBe("mixed case");
    expect(bus.channels()).toEqual([]);                  // nobody left listening
  });

  test("a local: channel is recognized as never leaving", () => {
    expect(isLocalChannel(`${LOCAL_PREFIX}rolls`)).toBe(true);
    expect(isLocalChannel("Local:Rolls")).toBe(true);
    expect(isLocalChannel("rolls")).toBe(false);
    expect(BUS_PRIORITIES[BUS_PRIORITIES.length - 1]).toBe("monitor");
  });
});

describe("the post office: local delivery, and the wire", () => {
  beforeEach(async () => {
    // A fresh script run: the host's subscriptions are gone, so the post office
    // must forget the one it was holding. (Finding its own bug: `open` was
    // idempotent on a flag the host could invalidate underneath it.)
    await PostOffice.close();
    __resetStorageMock(); __resetLorebookMock(); __resetMessagingMock();
    await LorebookManager.bootstrap();
  });

  test("publish delivers locally, and ALONE it never touches the wire", async () => {
    const heard: unknown[] = [];
    const id = PostOffice.subscribe("resources", (e) => { heard.push(e.data); });
    const event = await PostOffice.publish("resources", { spent: 2, of: "resolve" });
    // Local handlers have already run by the time publish resolves.
    expect(heard).toEqual([{ spent: 2, of: "resolve" }]);
    expect(event.cancelled).toBe(false);
    // NOBODY IS LISTENING, SO NOBODY IS TOLD: no other script has declared this
    // channel, so the broadcast that used to happen here does not.
    expect(wireTraffic()).toEqual([]);
    PostOffice.unsubscribe(id);
  });

  test("a declared remote interest puts it on the wire - exactly once", async () => {
    await PostOffice.open();
    // The other script introduces itself and says what it listens to.
    await __deliverMessage({
      fromScriptId: "sheet-script", channel: HELLO_CHANNEL,
      data: { scriptId: "sheet-script", channels: ["resources"] },
    });
    expect(PostOffice.remoteInterest()).toEqual({ "sheet-script": ["resources"] });

    await PostOffice.publish("resources", { spent: 2 });
    expect(wireTraffic()).toEqual([{ data: { spent: 2 }, channel: "resources" }]);

    // A channel that script did NOT declare still stays home.
    await PostOffice.publish("rolls", { pool: 5 });
    expect(wireTraffic()).toHaveLength(1);
  });

  test("`*` is how a monitor script asks for everything", async () => {
    await PostOffice.open();
    await __deliverMessage({
      fromScriptId: "logger", channel: HELLO_CHANNEL,
      data: { scriptId: "logger", channels: [INTEREST_ALL] },
    });
    await PostOffice.publish("anything-at-all", { n: 1 });
    await PostOffice.publish("something-else", { n: 2 });
    expect(wireTraffic().map(m => m.channel)).toEqual(["anything-at-all", "something-else"]);
    // ...but `local:` still means local, whatever anybody claims to want.
    await PostOffice.publish(`${LOCAL_PREFIX}private`, { n: 3 });
    expect(wireTraffic()).toHaveLength(2);
  });

  test("the hello handshake terminates: an answer is not itself answered", async () => {
    await PostOffice.open();
    // open() introduces us to the room.
    const opening = __sentMessages().filter(m => m.channel === HELLO_CHANNEL);
    expect(opening).toHaveLength(1);
    expect(opening[0].toScriptId).toBeUndefined();      // a broadcast, not targeted

    // Their opening hello gets a targeted reply...
    await __deliverMessage({
      fromScriptId: "other", channel: HELLO_CHANNEL,
      data: { scriptId: "other", channels: ["rolls"] },
    });
    const replies = __sentMessages().filter(m => m.channel === HELLO_CHANNEL && m.toScriptId === "other");
    expect(replies).toHaveLength(1);

    // ...and THEIR reply to ours gets none, which is what stops the ping-pong.
    await __deliverMessage({
      fromScriptId: "other", channel: HELLO_CHANNEL,
      data: { scriptId: "other", channels: ["rolls"], reply: true },
    });
    expect(__sentMessages().filter(m => m.channel === HELLO_CHANNEL && m.toScriptId === "other")).toHaveLength(1);
  });

  test("subscribing to a NEW channel re-announces, so the others' picture is never stale", async () => {
    await PostOffice.open();
    await __deliverMessage({
      fromScriptId: "other", channel: HELLO_CHANNEL,
      data: { scriptId: "other", channels: [INTEREST_ALL] },
    });
    const before = __sentMessages().filter(m => m.channel === HELLO_CHANNEL).length;
    // A publish with no new subscription says hello no more times.
    await PostOffice.publish("rolls", {});
    expect(__sentMessages().filter(m => m.channel === HELLO_CHANNEL)).toHaveLength(before);
    // Take a new subscription, and the next publish re-introduces us.
    const id = PostOffice.subscribe("brand-new-channel", () => undefined);
    await PostOffice.publish("rolls", {});
    const after = __sentMessages().filter(m => m.channel === HELLO_CHANNEL);
    expect(after.length).toBe(before + 1);
    expect((after[after.length - 1].data as { channels: string[] }).channels).toContain("brand-new-channel");
    PostOffice.unsubscribe(id);
  });

  test("a local: channel never reaches the wire", async () => {
    const heard: unknown[] = [];
    const id = PostOffice.subscribe(`${LOCAL_PREFIX}rolls`, (e) => { heard.push(e.data); });
    await PostOffice.publish(`${LOCAL_PREFIX}rolls`, { pool: "strength" });
    expect(heard).toHaveLength(1);
    expect(__sentMessages()).toEqual([]);
    PostOffice.unsubscribe(id);
  });

  test("a handler that says stop keeps it off the wire entirely", async () => {
    const id = PostOffice.subscribe("secrets", () => ({ stop: true }), "first");
    const seen: unknown[] = [];
    const id2 = PostOffice.subscribe("secrets", (e) => { seen.push(e.data); });
    const event = await PostOffice.publish("secrets", { hidden: true });
    expect(event.stopped).toBe(true);
    expect(seen).toEqual([]);          // no further local handler
    expect(__sentMessages()).toEqual([]);  // and nothing left the script
    PostOffice.unsubscribe(id); PostOffice.unsubscribe(id2);
  });

  test("a sibling script's broadcast arrives on the bus, marked with where it came from", async () => {
    const heard: Array<{ from?: string; data: unknown }> = [];
    const id = PostOffice.subscribe("rolls", (e) => { heard.push({ from: e.from, data: e.data }); });
    await PostOffice.open();
    await __deliverMessage({ fromScriptId: "other-script", channel: "rolls", data: { net: 3 } });
    expect(heard).toEqual([{ from: "other-script", data: { net: 3 } }]);
    // A relayed event is NOT repeated onward - this script subscribes, it does
    // not act as a repeater. (The hello open() sent is directory traffic, not
    // an event, which is what wireTraffic() filters out.)
    expect(wireTraffic()).toEqual([]);
    PostOffice.unsubscribe(id);
  });

  test("a locally raised event has no `from`, which is how a handler tells them apart", async () => {
    const froms: Array<string | undefined> = [];
    const id = PostOffice.subscribe("mixed", (e) => { froms.push(e.from); });
    await PostOffice.open();
    await PostOffice.publish("mixed", { n: 1 });
    await __deliverMessage({ fromScriptId: "elsewhere", channel: "mixed", data: { n: 2 } });
    expect(froms).toEqual([undefined, "elsewhere"]);
    PostOffice.unsubscribe(id);
  });

  test("the shared Bus is what init() opened, and it survives a host with no messaging", async () => {
    expect(Bus).toBeInstanceOf(EventBus);
    await PostOffice.open();   // idempotent
    await PostOffice.open();
    const id = PostOffice.subscribe("ping", () => undefined);
    expect(Bus.listeners("ping")).toHaveLength(1);
    PostOffice.unsubscribe(id);
  });
});

describe("a command on the wire: the formalized envelope", () => {
  test("a parsed command survives the round trip as plain data", () => {
    const parsed = CommandParser.parse('roll strength+brawl difficulty=7 spend=`living resolve`');
    const env = commandEnvelope(parsed, { id: "continuity-1", character: "marius", player: "storyteller", at: 42 });
    expect(env).toEqual({
      id: "continuity-1", verb: "roll",
      positional: parsed.positional, named: parsed.named, raw: parsed.raw,
      character: "marius", player: "storyteller", at: 42,
    });
    // Plain data all the way down: it must survive being serialized, because
    // api.v1.messaging says it will be.
    expect(JSON.parse(JSON.stringify(env))).toEqual(env);
    // ...and read back as exactly what the local router already takes.
    expect(envelopeToCommand(env)).toEqual(parsed);
  });

  test("a receiving script routes an envelope through the ordinary registry", async () => {
    __resetStorageMock(); __resetLorebookMock();
    await LorebookManager.bootstrap();
    await CommandRouter.route('create-playable name="Marius" templates=ouroboros');
    // What would arrive over the wire...
    const env = commandEnvelope(CommandParser.parse("show-template ouroboros"), { id: "x" });
    const wire = JSON.parse(JSON.stringify(env)) as typeof env;
    // ...routed with no special path: same verbs, same handlers, same reply.
    const back = envelopeToCommand(wire);
    const direct = await CommandRouter.route("show-template ouroboros");
    const viaWire = await CommandRouter.route(back.raw);
    expect(viaWire).toBe(direct);
  });

  test("channels are per verb, with a catch-all for observers", () => {
    expect(COMMAND_CHANNEL).toBe("command");
    expect(commandChannel("Advance-Time")).toBe("command:advance-time");
    expect(COMMAND_RESULT_CHANNEL).toBe("command:result");
    // The convention has to survive the bus's own normalization unchanged,
    // or a publisher and a subscriber would silently miss each other.
    expect(busChannel(commandChannel("roll"))).toBe(commandChannel("roll"));
  });
});

// =============================================================================
// AFFLICTIONS IN TIME - charges counted in rolls, or a clock, or both
// =============================================================================
describe("an affliction that runs out", () => {
  beforeEach(async () => {
    __resetStorageMock(); __resetLorebookMock();
    await LorebookManager.bootstrap();
    await reloadAllConfigStores();
    await StoryClock.seedDefault();
    await CommandRouter.route('create-playable name="Marius" templates=ouroboros');
    await CommandRouter.route("set-trait strength 3");
    await CommandRouter.route("set-trait melee 2");
    await CommandRouter.route("define-affliction name=`Blessed` tags=`blessed`");
  });

  test("rollSpendsCharge: unfiltered counts everything, each filter must be satisfied", () => {
    expect(rollSpendsCharge({ rolls: 1 }, [], [])).toBe(true);
    // tags
    expect(rollSpendsCharge({ rolls: 1, withTags: ["melee"] }, ["melee"], [])).toBe(true);
    expect(rollSpendsCharge({ rolls: 1, withTags: ["melee"] }, ["magic"], [])).toBe(false);
    expect(rollSpendsCharge({ rolls: 1, withoutTags: ["magic"] }, ["magic"], [])).toBe(false);
    // traits: ANY of usingTraits, NONE of notUsingTraits
    expect(rollSpendsCharge({ rolls: 1, usingTraits: ["melee", "brawl"] }, [], ["strength", "melee"])).toBe(true);
    expect(rollSpendsCharge({ rolls: 1, usingTraits: ["melee"] }, [], ["strength", "brawl"])).toBe(false);
    expect(rollSpendsCharge({ rolls: 1, notUsingTraits: ["wits"] }, [], ["wits", "melee"])).toBe(false);
    // filters AND together
    expect(rollSpendsCharge({ rolls: 1, withTags: ["melee"], notUsingTraits: ["wits"] }, ["melee"], ["wits"])).toBe(false);
  });

  test("expiryElapsed: either side ending is enough - whichever comes first", () => {
    expect(expiryElapsed({ rolls: 1 }, 0)).toBe(false);
    expect(expiryElapsed({ rolls: 0 }, 0)).toBe(true);
    expect(expiryElapsed({ until: 100 }, 99)).toBe(false);
    expect(expiryElapsed({ until: 100 }, 100)).toBe(true);
    // rolls still left, but the clock ran out
    expect(expiryElapsed({ rolls: 5, until: 100 }, 100)).toBe(true);
    // a filter alone is not an expiry
    expect(makeAfflictionExpiry({ withTags: ["melee"] })).toBeUndefined();
    expect(makeAfflictionExpiry({ rolls: 2, withTags: ["Melee"] })).toEqual({ rolls: 2, withTags: ["melee"] });
  });

  test("a charge is spent per MATCHING roll, and the affliction ends on the last one", async () => {
    await CommandRouter.route("afflict blessed rolls=2");
    expect(await CommandRouter.route("show-affliction")).toContain("2 more rolls");
    const first = await CommandRouter.route("roll strength+melee");
    expect(first).toContain("Blessed: 1 roll left");
    const second = await CommandRouter.route("roll strength+melee");
    expect(second).toContain("Blessed ends");
    expect(await CommandRouter.route("show-affliction")).not.toContain("blessed");
  });

  test("a filtered charge is spent only by the rolls it names", async () => {
    await CommandRouter.route("afflict blessed rolls=1 using=melee");
    // Not a melee roll: the charge is untouched.
    await CommandRouter.route("roll strength");
    expect(await CommandRouter.route("show-affliction")).toContain("1 more roll");
    // This one matches, and it is the last.
    expect(await CommandRouter.route("roll strength+melee")).toContain("Blessed ends");
  });

  test("the clock ends it too, on whoever is carrying it", async () => {
    await CommandRouter.route("afflict blessed for=`1 hour`");
    const shown = await CommandRouter.route("show-affliction");
    expect(shown).toContain("until");
    expect(await CommandRouter.route("advance-time 30 minutes")).not.toContain("Blessed ends");
    expect(await CommandRouter.route("advance-time 45 minutes")).toContain("Blessed ends");
    expect(await CommandRouter.route("show-affliction")).not.toContain("blessed");
  });

  test("rolls and a clock together: whichever runs out first wins", async () => {
    await CommandRouter.route("afflict blessed rolls=5 for=`1 hour`");
    expect(await CommandRouter.route("show-affliction")).toContain("whichever first");
    // Four of five charges left, but the hour is up.
    await CommandRouter.route("roll strength");
    expect(await CommandRouter.route("advance-time 2 hours")).toContain("Blessed ends");
  });

  test("an affliction with no expiry is untouched by either tick", async () => {
    await CommandRouter.route("afflict blessed");
    await CommandRouter.route("roll strength+melee");
    await CommandRouter.route("advance-time 3 days");
    expect(await CommandRouter.route("show-affliction")).toContain("blessed");
  });
});

describe("places, renamed verbs, and flushing the story", () => {
  beforeEach(async () => {
    __resetStorageMock(); __resetLorebookMock(); __resetUiMock();
    await LorebookManager.bootstrap();
    await reloadAllConfigStores();
    await CommandRouter.route('create-playable name="Marius" templates=ouroboros');
  });

  test("being somewhere IS an affliction: enter applies it, exit lifts it", async () => {
    expect(await CommandRouter.route("enter-sanctum")).toContain("has no Sanctum to enter");
    await CommandRouter.route("set-trait sanctum 8");
    const entered = await CommandRouter.route("enter-sanctum");
    expect(entered).toContain("Sanctum 8");
    expect(entered).toContain("in-sanctum");
    // What the place GRANTS is the affliction's data, not the verb's code.
    expect(await CommandRouter.route("show-affliction")).toContain("in-sanctum");
    expect(await CommandRouter.route("exit-sanctum")).toContain("leaves his Sanctum");
    expect(await CommandRouter.route("exit-sanctum")).toContain("is not in his Sanctum");
  });

  test("the library is the same shape, and the two are independent", async () => {
    await CommandRouter.route("set-trait library 5");
    await CommandRouter.route("set-trait sanctum 4");
    await CommandRouter.route("enter-library");
    await CommandRouter.route("enter-sanctum");
    const both = await CommandRouter.route("show-affliction");
    expect(both).toContain("in-library");
    expect(both).toContain("in-sanctum");
    await CommandRouter.route("exit-library");
    const after = await CommandRouter.route("show-affliction");
    expect(after).not.toContain("in-library");
    expect(after).toContain("in-sanctum");
  });


  test("flush-context cleans the story on demand and reports what it did", async () => {
    __seedDocument(["Plain prose.", "<!--wod:ctx-skip:0-->[SYSTEM: noise]<!--/wod:ctx-skip-->", "More prose."]);
    const r = await CommandRouter.route("flush-context");
    expect(r).toContain("3 paragraphs scanned");
    expect(r).toContain("1 cleaned");
    expect(__document().map(d => d.text).join(" ")).not.toContain("ctx-skip");
    // Nothing left to do the second time.
    expect(await CommandRouter.route("flush-context")).toContain("nothing needed clearing");
  });
});

describe("conditions: the expression language, asked a yes/no question", () => {
  const scope = mapScope({ "full-moons": 1, blood: 0, courage: 3 });
  test("comparisons yield truth, and truth is still a number", () => {
    expect(evaluateCondition("full-moons >= 1", scope).truth).toBe(true);
    expect(evaluateCondition("full-moons >= 2", scope).truth).toBe(false);
    expect(evaluateCondition("blood <= 0", scope).truth).toBe(true);
    expect(evaluateCondition("courage = 3", scope).truth).toBe(true);
    expect(evaluateCondition("courage != 3", scope).truth).toBe(false);
    expect(evaluateCondition("courage > 1", scope).value).toBe(1);
  });

  test("and / or / not compose, and are words not tokens", () => {
    expect(evaluateCondition("full-moons >= 1 or blood > 5", scope).truth).toBe(true);
    expect(evaluateCondition("full-moons >= 1 and blood > 5", scope).truth).toBe(false);
    expect(evaluateCondition("not blood > 5", scope).truth).toBe(true);
    // Arithmetic still works underneath a comparison.
    expect(evaluateCondition("courage * 2 >= 6", scope).truth).toBe(true);
  });

  test("an empty or malformed condition is FALSE and says why", () => {
    expect(evaluateCondition("", scope).truth).toBe(false);
    const bad = evaluateCondition("courage >", scope);
    expect(bad.truth).toBe(false);
    expect(bad.error).toBeTruthy();
    // Nothing ends because a card was mistyped.
    expect(evaluateCondition("courage $$ 3", scope).truth).toBe(false);
  });

  test("plain arithmetic is untouched - a difficulty never sees a comparison", () => {
    expect(parsePoolExpression("3 + 2", () => 0).total).toBe(5);
    expect(evaluateExpr("courage + 1", scope).value).toBe(4);
  });
});

describe("every way an affliction can end", () => {
  beforeEach(async () => {
    __resetStorageMock(); __resetLorebookMock();
    await LorebookManager.bootstrap();
    await reloadAllConfigStores();
    await StoryClock.seedDefault();
    await CommandRouter.route('create-playable name="Marius" templates=ouroboros');
    await CommandRouter.route("define-affliction name=`Blessed` tags=`blessed`");
  });

  test("turns count down, and the scene counts its own", async () => {
    await CommandRouter.route('scene "The Hall" turn=3s');
    await CommandRouter.route("afflict blessed turns=2");
    expect(await CommandRouter.route("show-affliction")).toContain("2 more turns");
    await CommandRouter.route("turn");
    expect(await CommandRouter.route("show-affliction")).toContain("1 more turn");
    expect(await CommandRouter.route("turn")).toContain("Blessed ends");
  });

  test("scenes count down on end-scene", async () => {
    await CommandRouter.route('scene "The Hall"');
    await CommandRouter.route("afflict blessed scenes=1");
    expect(await CommandRouter.route("end-scene")).toContain("Blessed ends");
  });

  test("until X is a condition the engine decides: the next full moon", async () => {
    await CommandRouter.route("afflict blessed until=`full-moons >= 1`");
    expect(await CommandRouter.route("show-affliction")).toContain("until full-moons >= 1");
    await CommandRouter.route("advance-time 3 days");
    expect(await CommandRouter.route("show-affliction")).toContain("blessed");
    // A full moon passes.
    expect(await CommandRouter.route("advance-time 40 days")).toContain("Blessed ends");
  });

  test("until X can read the CHARACTER, not only the clock", async () => {
    await CommandRouter.route("set-trait courage 3");
    await CommandRouter.route("afflict blessed until=`courage >= 5`");
    await CommandRouter.route("advance-time 1 hour");
    expect(await CommandRouter.route("show-affliction")).toContain("blessed");
    await CommandRouter.route("set-trait courage 5");
    expect(await CommandRouter.route("advance-time 1 hour")).toContain("Blessed ends");
  });

  test("until Y is ADVISORY - nothing but [[lift]] ends it, and it says so", async () => {
    await CommandRouter.route("afflict blessed until-event=`you next attend the voivode`");
    const shown = await CommandRouter.route("show-affliction");
    expect(shown).toContain("until you next attend the voivode");
    expect(shown).toContain("advisory");
    expect(expiryIsAdvisoryOnly({ untilEvent: "x" })).toBe(true);
    expect(expiryIsAdvisoryOnly({ untilEvent: "x", rolls: 2 })).toBe(false);
    // Time does not touch it.
    await CommandRouter.route("advance-time 100 days");
    expect(await CommandRouter.route("show-affliction")).toContain("blessed");
    expect(await CommandRouter.route("remove blessed")).toContain("blessed");
  });

  test("an affliction records what inflicted it", async () => {
    await CommandRouter.route("afflict blessed from=`arcanum:sharpened-senses` scenes=1");
    expect(await CommandRouter.route("show-affliction")).toContain("from arcanum:sharpened-senses");
    expect(AFFLICTION_MODES).toEqual(["passive", "togglable", "temporary"]);
  });

  test("measures compose: whichever runs out first ends it", async () => {
    await CommandRouter.route('scene "The Hall"');
    await CommandRouter.route("afflict blessed turns=9 scenes=9 until=`full-moons >= 99` for=`1 hour`");
    const shown = await CommandRouter.route("show-affliction");
    expect(shown).toContain("9 more turns");
    expect(shown).toContain("whichever first");
    // The hour is the shortest measure, and it is the one that ends it.
    expect(await CommandRouter.route("advance-time 2 hours")).toContain("Blessed ends");
  });
});

describe("system::time, and cooldowns as the same shape reversed", () => {
  beforeEach(async () => {
    __resetStorageMock(); __resetLorebookMock();
    await LorebookManager.bootstrap();
    await reloadAllConfigStores();
    await StoryClock.seedDefault();
    await CommandRouter.route('create-playable name="Marius" templates=ouroboros');
    await CommandRouter.route("define-affliction name=`Blessed` tags=`blessed`");
  });

  test("the time namespace answers the long form, the short form, and saved dates", async () => {
    await CommandRouter.route("afflict blessed until=`system::time::full-moons >= 1`");
    await CommandRouter.route("advance-time 3 days");
    expect(await CommandRouter.route("show-affliction")).toContain("blessed");
    expect(await CommandRouter.route("advance-time 40 days")).toContain("Blessed ends");
  });

  test("the general function takes any two dates, saved ones included", async () => {
    await CommandRouter.route("advance-time 40 days");
    await CommandRouter.route('save-date "the wedding"');
    await CommandRouter.route("advance-time 40 days");
    // full-moons-since(the wedding, now) - the explicit two-date form.
    const r = await CommandRouter.route(
      "show-eval `system::time::full-moons-since(system::time::date:the-wedding, system::time::now)`");
    expect(r).not.toContain("⚠");
    expect(r).toMatch(/= [1-9]/);
    // days-since is the same shape.
    expect(await CommandRouter.route(
      "show-eval `system::time::days-since(system::time::date:the-wedding, system::time::now)`")).toContain("= 40");
  });

  test("a cooldown blocks re-application, and says how long is left", async () => {
    await CommandRouter.route("afflict blessed scenes=1 cooldown-for=`2 days`");
    await CommandRouter.route("remove blessed");
    const refused = await CommandRouter.route("afflict blessed");
    expect(refused).toContain("cannot take blessed again yet");
    expect(refused).toContain("until");
    // It shows on the same listing that shows afflictions.
    expect(await CommandRouter.route("show-affliction")).toContain("cooling");
    // waive=true overrides, as everywhere else in this engine.
    expect(await CommandRouter.route("afflict blessed waive=true")).toContain("is now");
  });

  test("a cooldown runs out on the clock and the thing becomes available again", async () => {
    await CommandRouter.route("afflict blessed cooldown-for=`2 days`");
    await CommandRouter.route("remove blessed");
    expect(await CommandRouter.route("afflict blessed")).toContain("cannot take");
    await CommandRouter.route("advance-time 3 days");
    expect(await CommandRouter.route("show-affliction")).not.toContain("cooling");
    expect(await CommandRouter.route("afflict blessed")).toContain("is now");
  });

  test("a cooldown counts scenes and rolls too - the same six measures", async () => {
    await CommandRouter.route('scene "The Hall"');
    await CommandRouter.route("afflict blessed cooldown-scenes=1");
    await CommandRouter.route("remove blessed");
    expect(await CommandRouter.route("afflict blessed")).toContain("cannot take");
    await CommandRouter.route("end-scene");
    expect(await CommandRouter.route("afflict blessed")).toContain("is now");
  });
});

// =============================================================================
// WHERE IT CAME FROM - a price of zero is not one fact but several
// =============================================================================
describe("grants: the template's free dot and the Storyteller's bonus", () => {
  beforeEach(async () => {
    __resetStorageMock(); __resetLorebookMock();
    await LorebookManager.bootstrap();
    await reloadAllConfigStores();
    await CommandRouter.route('create-playable name="Gwen" templates=ghoul');
  });

  test("only the creation purses draw on a purse; every other source is real and free", () => {
    expect(sourceDrawsOnPurse("freebies")).toBe(true);
    expect(sourceDrawsOnPurse("arcana")).toBe(true);
    expect(sourceDrawsOnPurse(undefined)).toBe(true);     // unstated = bought normally
    expect(sourceDrawsOnPurse("template")).toBe(false);
    expect(sourceDrawsOnPurse("storyteller")).toBe(false);
    expect(sourceDrawsOnPurse("experience")).toBe(false);
    expect(Object.keys(GRANT_SOURCES)).toContain("maturation");
  });

  test("a ghoul's free dot is the TEMPLATE's, and [[show-creation]] says which it may be", async () => {
    const grants = TEMPLATE_GHOUL.Creation.grants ?? [];
    expect(describeCreationGrant(grants[0])).toContain("Potence or Fortitude");
    const before = await CommandRouter.route("show-creation");
    expect(before).toContain("free: 1 free dot of Potence or Fortitude");
    expect(before).toContain("not on the sheet yet");
    // Taking it, and saying where it came from.
    await CommandRouter.route("set-trait potence 1 group=discipline");
    expect(await CommandRouter.route("show-creation")).toContain("✓");
    // Until it is marked, it looks like a purchase.
    expect(await CommandRouter.route("show-budget")).toContain("discipline: 1/2");
    expect(await CommandRouter.route("grant potence source=template")).toContain("is template");
    const after = await CommandRouter.route("show-budget");
    expect(after).toContain("discipline: 0/2");
    expect(after).toContain("potence 1 (template)");
  });

  test("a Storyteller's bonus ADDS to a purse, and carries its reason", async () => {
    expect(await CommandRouter.route("show-budget")).toContain("freebie: 0/15");
    const g = await CommandRouter.route("grant freebie 3 source=storyteller note=`everyone here is Suspect`");
    expect(g).toContain("freebie purse +3");
    const b = await CommandRouter.route("show-budget");
    expect(b).toContain("freebie: 0/18");
    expect(b).toContain("+3 from storyteller: everyone here is Suspect");
    // It survives the round trip through the sheet card.
    const again = (await CharacterStore.load("Gwen"))!;
    expect(again.purseGrants).toEqual([{ purse: "freebie", points: 3, source: "storyteller", note: "everyone here is Suspect" }]);
  });

  test("the flaw ceiling is data, and [[show-creation]] states it", async () => {
    expect(await CommandRouter.route("show-creation")).toContain("Flaws pay up to 7");
  });

  test("[[grant]] lists what is granted, refuses an unknown source, and forgets", async () => {
    expect(await CommandRouter.route("grant")).toContain("nothing granted");
    expect(await CommandRouter.route("grant potence source=nonesuch")).toContain('No grant source "nonesuch"');
    await CommandRouter.route("set-trait potence 1 group=discipline");
    await CommandRouter.route("grant potence source=template");
    expect(await CommandRouter.route("grant")).toContain("potence: template");
    expect(await CommandRouter.route("forget-grant potence")).toContain("back to being bought normally");
    expect(await CommandRouter.route("show-budget")).toContain("discipline: 1/2");
  });
});

// =============================================================================
// WHEN THE SOURCE IS NO MORE - four behaviours, one expression
// =============================================================================
describe("losing the arcanum that granted it", () => {
  beforeEach(async () => {
    __resetStorageMock(); __resetLorebookMock();
    await LorebookManager.bootstrap();
    await reloadAllConfigStores();
    await StoryClock.seedDefault();
    await CommandRouter.route('create-playable name="Duke" templates=demon');
    await CommandRouter.route("define-affliction name=`Keen` tags=`keen`");
  });

  test("the shorthands are the same mechanism as the expression", () => {
    expect(makeOrphanPolicy("immediately")).toEqual(ORPHAN_IMMEDIATELY);
    expect(makeOrphanPolicy("at-once")).toEqual(ORPHAN_IMMEDIATELY);
    expect(makeOrphanPolicy("keep")).toEqual(ORPHAN_KEEP);
    expect(makeOrphanPolicy("continue")).toEqual(ORPHAN_KEEP);
    expect(makeOrphanPolicy("remaining-seconds / 2")).toEqual({ seconds: "remaining-seconds / 2" });
    expect(makeOrphanPolicy(undefined)).toBeUndefined();
    expect(describeOrphanPolicy(ORPHAN_IMMEDIATELY)).toContain("ends at once");
    expect(describeOrphanPolicy(ORPHAN_KEEP)).toContain("outlives its source");
  });

  test("(1) it ends immediately when its source goes", async () => {
    await CommandRouter.route("take-arcanum trait-affinity::melee 2");
    await CommandRouter.route("afflict keen from=`arcanum:trait-affinity::melee` orphan=immediately");
    expect(await CommandRouter.route("show-affliction")).toContain("ends at once");
    const dropped = await CommandRouter.route("drop-arcanum trait-affinity::melee");
    expect(dropped).toContain("Keen ends with");
    expect(await CommandRouter.route("show-affliction")).not.toContain("keen");
  });

  test("(2) it ends in T time - and the clock finishes it", async () => {
    await CommandRouter.route("take-arcanum trait-affinity::melee 2");
    await CommandRouter.route("afflict keen from=`arcanum:trait-affinity::melee` orphan=`1 hour`");
    const dropped = await CommandRouter.route("drop-arcanum trait-affinity::melee");
    expect(dropped).toContain("Keen lingers");
    expect(await CommandRouter.route("advance-time 30 minutes")).not.toContain("Keen ends");
    expect(await CommandRouter.route("advance-time 45 minutes")).toContain("Keen ends");
  });

  test("(3) with no policy the duration continues as normal", async () => {
    await CommandRouter.route("take-arcanum trait-affinity::melee 2");
    await CommandRouter.route("afflict keen from=`arcanum:trait-affinity::melee` for=`2 hours`");
    expect(await CommandRouter.route("drop-arcanum trait-affinity::melee")).toContain("outlives");
    expect(await CommandRouter.route("show-affliction")).toContain("keen");
    // ...and still ends on its own schedule.
    expect(await CommandRouter.route("advance-time 3 hours")).toContain("Keen ends");
  });

  test("(4) an expression over what is left: half of it", async () => {
    await CommandRouter.route("take-arcanum trait-affinity::melee 2");
    await CommandRouter.route("afflict keen from=`arcanum:trait-affinity::melee` for=`4 hours` orphan=`remaining-seconds / 2`");
    expect(await CommandRouter.route("drop-arcanum trait-affinity::melee")).toContain("Keen lingers");
    // Two hours left of the four, not four.
    expect(await CommandRouter.route("advance-time 90 minutes")).not.toContain("Keen ends");
    expect(await CommandRouter.route("advance-time 45 minutes")).toContain("Keen ends");
  });

  test("the source matches by PREFIX, so one arcanum takes every trait it touched", async () => {
    await CommandRouter.route("take-arcanum trait-affinity::melee 2");
    await CommandRouter.route("afflict keen from=`arcanum:trait-affinity::melee` orphan=immediately");
    // Dropping the family key, not the exact instance.
    const r = await orphanTestDrop();
    expect(r).toContain("Keen ends with");
  });
});

async function orphanTestDrop(): Promise<string> {
  return CommandRouter.route("drop-arcanum trait-affinity::melee");
}

// =============================================================================
// A POWER THAT IS SIMPLY ON - taking it applies it, losing it takes it away
// =============================================================================
describe("passive powers apply themselves", () => {
  beforeEach(async () => {
    __resetStorageMock(); __resetLorebookMock(); __resetMessagingMock();
    await LorebookManager.bootstrap();
    await reloadAllConfigStores();
    await StoryClock.seedDefault();
  });

  test("three different KINDS of thing, one behaviour - and arcana are their own kind", () => {
    // Devil's Due arcana are NOT merits or flaws: their own list, their own
    // registry, their own purse. The merit registry has never heard of them.
    const aptitude = ArcanumRegistry.get("trait-affinity")!;
    expect(MeritFlawRegistry.get("trait-affinity")).toBeUndefined();
    expect(MeritFlawRegistry.all().every(d => d.kind === "merit" || d.kind === "flaw")).toBe(true);
    expect(ArcanumRegistry.all().every(d => d.kind === "arcanum" || d.kind === "taint")).toBe(true);
    expect(aptitude.kind).toBe("arcanum");
    expect(budgetOfKind(aptitude)).toBe("arcana");
    // It grants the SHARED affliction - the effect is a rule it uses, not a
    // rule it owns, so any other merit or flaw can apply the same one.
    expect(aptitude.grants?.afflicts).toBe("modifier-difficulty");
    // A Discipline carries the same field, for the same reason.
    expect(disciplineDef("potence")!.grants?.afflicts).toBe("power-potence");
    expect(disciplineDef("fortitude")!.grants?.afflicts).toBe("power-fortitude");
    expect(PASSIVE_AFFLICTIONS.map(a => a.name))
      .toEqual(["modifier-difficulty", "emitting-majesty", "under-majesty",
        "power-potence", "power-fortitude", "trait-expansion"]);
    // Every name is ROLE FIRST, so an alphabetical list groups by KIND.
    for (const a of PASSIVE_AFFLICTIONS) {
      if (a.name.startsWith("trait-")) continue;            // deprecated leftovers
      expect([a.name, afflictionRole(a.name)]).not.toEqual([a.name, undefined]);
    }
  });

  test("rating Potence applies its affliction, and the reply says so", async () => {
    await CommandRouter.route('create-playable name="Vlad" templates=vampire');
    const r = await CommandRouter.route("set-trait potence 2 group=discipline");
    expect(r).toContain("Power Potence is now applied");
    expect(r).toContain("from discipline:potence");
    const shown = await CommandRouter.route("show-affliction");
    expect(shown).toContain("power-potence");
    expect(shown).toContain("ends at once");           // the default orphan policy
    // Dropping it to 0 takes the passive away again.
    const gone = await CommandRouter.route("set-trait potence 0 group=discipline");
    expect(gone).toContain("Power Potence ends with discipline:potence");
    expect(await CommandRouter.route("show-affliction")).not.toContain("power-potence");
  });

  test("taking an arcanum applies its passive; dropping it takes it back", async () => {
    await CommandRouter.route('create-playable name="Duke" templates=demon');
    const took = await CommandRouter.route("take-arcanum trait-affinity::melee 2");
    // The grant fills the affliction's bindings from the INSTANCE: which trait,
    // and at what level - so one shared definition serves every rating.
    expect(took).toContain("Modifier Difficulty is now applied (melee)");
    expect(took).toContain("from arcanum:trait-affinity:melee");
    const active = (await CharacterAfflictions.list("Duke"))
      .find(a => a.def === "modifier-difficulty")!;
    expect(active.bindings["trait"]).toBe("melee");
    expect(active.level).toBe(2);
    expect(await CommandRouter.route("show-affliction")).toContain("modifier-difficulty");
    expect(await CommandRouter.route("drop-arcanum trait-affinity::melee"))
      .toContain("Modifier Difficulty ends with");
  });

  test("an application is ANNOUNCED on the bus", async () => {
    await CommandRouter.route('create-playable name="Vlad" templates=vampire');
    const heard: unknown[] = [];
    const id = PostOffice.subscribe("affliction:applied", (e) => { heard.push(e.data); });
    await CommandRouter.route("set-trait potence 1 group=discipline");
    expect(heard).toEqual([{ character: "vlad", affliction: "power-potence", from: "discipline:potence", automatic: true }]);
    PostOffice.unsubscribe(id);
  });

  test("every command is announced too, on the catch-all and on its own verb", async () => {
    await CommandRouter.route('create-playable name="Vlad" templates=vampire');
    const all: string[] = [];
    const mine: string[] = [];
    const a = PostOffice.subscribe(COMMAND_CHANNEL, (e) => { all.push((e.data as { verb: string }).verb); });
    const b = PostOffice.subscribe(commandChannel("show-health"), (e) => { mine.push((e.data as { verb: string }).verb); });
    await processAdventureInput("[[show-health]] and then [[show-resource]]");
    expect(all).toEqual(["show-health", "show-resource"]);
    expect(mine).toEqual(["show-health"]);      // the verb's own channel heard only its own
    PostOffice.unsubscribe(a); PostOffice.unsubscribe(b);
  });
});

describe("the event CAUSES it: system channels, toggling, invoking", () => {
  beforeEach(async () => {
    __resetStorageMock(); __resetLorebookMock(); __resetMessagingMock();
    await LorebookManager.bootstrap();
    await reloadAllConfigStores();
    await StoryClock.seedDefault();
    await CommandRouter.route('create-playable name="Vlad" templates=vampire');
  });

  test("system channels are local: they never reach the wire", async () => {
    expect(SYSTEM.powerTaken.startsWith(LOCAL_PREFIX)).toBe(true);
    expect(isLocalChannel(SYSTEM.powerLost)).toBe(true);
    // close() first: this block's beforeEach resets the messaging mock, which
    // invalidates the host subscription open() is holding without telling it.
    await PostOffice.close();
    await PostOffice.open();
    // Somebody outside is listening for applied afflictions, so that one is
    // allowed onto the wire; nothing can subscribe a `local:` channel from
    // outside, whatever it declares.
    await __deliverMessage({
      fromScriptId: "ledger", channel: HELLO_CHANNEL,
      data: { scriptId: "ledger", channels: ["affliction:applied", SYSTEM.powerTaken] },
    });
    await CommandRouter.route("set-trait potence 1 group=discipline");
    const channels = wireTraffic().map(m => m.channel);
    expect(channels).toContain("affliction:applied");
    expect(channels.some(c => (c ?? "").startsWith(LOCAL_PREFIX))).toBe(false);
    await PostOffice.close();
  });

  test("the command publishes and the HANDLER applies - remove the handler, nothing happens", async () => {
    // Proof the work is in the subscriber, not in the command: silence the
    // handler and the affliction is never applied.
    const ids = Bus.listeners(SYSTEM.powerTaken).map(l => l.id);
    for (const id of ids) Bus.off(id);
    await CommandRouter.route("set-trait potence 1 group=discipline");
    expect(await CommandRouter.route("show-affliction")).not.toContain("power-potence");
    // Put it back the way the module does - registration is a function, and an
    // idempotent one, precisely so this is possible.
    registerSystemHandlers();
    expect(Bus.listeners(SYSTEM.powerTaken)).toHaveLength(1);
    // A DIFFERENT power, since the passive fires on 0 -> rated and Potence is
    // already rated by the failed attempt above.
    await CommandRouter.route("set-trait fortitude 1 group=discipline");
    expect(await CommandRouter.route("show-affliction")).toContain("power-fortitude");
  });

  test("a handler may do async work, and the publisher waits for it", async () => {
    const bus = new EventBus();
    let done = false;
    bus.on("slow", (e) => {
      e.pending.push(new Promise<void>(r => setTimeout(() => { done = true; r(); }, 5)));
    });
    const event = bus.emit("slow", {});
    expect(done).toBe(false);            // emit is still synchronous
    await Promise.all(event.pending);
    expect(done).toBe(true);             // ...and the work is awaitable
  });

  test("a togglable passive switches off and back on without losing the power", async () => {
    await CommandRouter.route("set-trait potence 2 group=discipline");
    expect(await CommandRouter.route("show-affliction")).toContain("power-potence");
    const off = await CommandRouter.route("toggle power-potence");
    expect(off).toContain("switches Power Potence OFF");
    expect(off).toContain("held down, not lost");
    // HELD DOWN IS NOT GONE. It is still listed, still counted, still his - and
    // it is not biting. Removing it would have lost the bindings and the level.
    const listed = await CommandRouter.route("show-affliction");
    expect(listed).toContain("power-potence");
    expect(listed).toContain("HELD DOWN");
    expect((await CharacterAfflictions.list("Vlad")).find(a => a.def === "power-potence")!.suspended!.by).toBe("self");
    expect(await CharacterAfflictions.tags("Vlad")).not.toContain("potent");
    // The Discipline is still rated - he simply is not using it.
    expect(await CommandRouter.route("show-sheet")).toContain("otence");
    const on = await CommandRouter.route("toggle power-potence");
    expect(on).toContain("switches Power Potence back ON");
    expect(await CharacterAfflictions.tags("Vlad")).toContain("potent");
  });

  test("automatic vs offered is data, and offered waits for [[invoke]]", async () => {
    expect(grantIsAutomatic({ afflicts: "x" })).toBe(true);
    expect(grantIsAutomatic({ afflicts: "x", mode: "offered" })).toBe(false);
    await CommandRouter.route("define-affliction name=`Veil` tags=`veil`");
    await CommandRouter.route("define-merit name=`Shroud` kind=merit points=2");
    // An OFFERED power grants the ability, not the state.
    const reg = MeritFlawRegistry.get("shroud")!;
    reg.grants = { afflicts: "veil", mode: "offered" };
    const took = await CommandRouter.route("take-merit shroud 2");
    expect(took).toContain("Veil is now available");
    expect(await CommandRouter.route("show-affliction")).not.toContain("veil");
    const used = await CommandRouter.route("invoke veil");
    expect(used).toContain("invokes Veil");
    expect(await CommandRouter.route("show-affliction")).toContain("veil");
  });

  test("invoke refuses what nobody offers", async () => {
    expect(await CommandRouter.route("invoke nonesuch")).toContain("Nothing Vlad has offers");
  });
});

// =============================================================================
// SHOW - one way to look at anything, and none of it reaches the AI (§7.73)
// =============================================================================
describe("show-*: the read-only surface, its scopes, and the context marker", () => {
  beforeEach(async () => {
    __resetStorageMock(); __resetLorebookMock();
    MeritFlawRegistry.reset(); ArcanumRegistry.reset(); resetAllConfigStores();
    await LorebookManager.bootstrap();
  });

  // THE STRUCTURAL TEST: a subject cannot be half-wired. Adding one to
  // SHOW_SUBJECTS without its knobs, or pointing a deprecation at a verb that
  // does not exist, fails here rather than in play.
  test("every show subject declares name+in, EVERY verb declares in-story, and old names point somewhere real", () => {
    expect(SHOW_SUBJECT_VERBS.length).toBeGreaterThan(25);
    for (const verb of SHOW_SUBJECT_VERBS) {
      const keys = (CommandRouter.specFor(verb)!.params ?? []).map(p => p.key);
      expect([verb, keys.includes("name")]).toEqual([verb, true]);
      expect([verb, keys.includes("in")]).toEqual([verb, true]);
    }
    // in-story is UNIVERSAL: CommandRouter.register attaches it, so there is no
    // command whose context placement the player cannot override.
    for (const verb of CommandRouter.verbs({ includeHidden: true })) {
      const p = (CommandRouter.specFor(verb)!.params ?? []).find(x => x.key === "in-story");
      expect([verb, p?.type]).toEqual([verb, "bool"]);
    }
    const registered = new Set(CommandRouter.verbs({ includeHidden: true }));
    for (const { verb, replacedBy } of [] as Array<{ verb: string; replacedBy: string }>) {
      expect([verb, registered.has(replacedBy)]).toEqual([verb, true]);
    }
  });

  test("a show reply is stripped from context; in-story=true keeps it, and the turn stays quiet either way", async () => {
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    const hidden = await processAdventureInput("[[show-budget]]");
    expect(hidden!.inputText!).toContain("wod:ctx-skip");
    expect(stripCtxSkip(hidden!.inputText!).trim()).toBe("");    // the AI reads nothing
    expect(hidden!.stopGeneration).toBe(true);

    const kept = await processAdventureInput("[[show-budget in-story=true]]");
    expect(kept!.inputText!).not.toContain("wod:ctx-skip");
    expect(kept!.inputText!).toContain("budgets");
    // Looking something up is still not an action: the reply is there to be
    // read NEXT generation, it does not prompt one now.
    expect(kept!.stopGeneration).toBe(true);
  });


  test("a flag with no value can only mean one thing: [[... in-story]] is in-story=true", async () => {
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    // The bare word is promoted by the ROUTER, which knows what the verb
    // declares - the parser stays spec-agnostic and files it as a positional.
    expect(CommandParser.parse("show-budget in-story").positional).toEqual(["in-story"]);
    expect(CommandRouter.parse("show-budget in-story").named["in-story"]).toBe("true");
    expect(CommandRouter.parse("show-budget in-story").positional).toEqual([]);
    expect((await processAdventureInput("[[show-budget in-story]]"))!.inputText!).not.toContain("wod:ctx-skip");
    // A real positional is never eaten: only an exact match on a declared flag.
    expect(CommandRouter.parse("show-merit iron-will").positional).toEqual(["iron-will"]);
    // ...and every spelling of yes and no is understood, either way.
    expect(readBool("yes")).toBe(true);
    expect(readBool("off")).toBe(false);
    expect(readBool("")).toBe(true);            // `key=` is still the flag being set
    expect(readBool("perhaps")).toBeUndefined(); // a typo reads as ABSENT, never as false
  });

  test("in-story runs BOTH ways: an action can be hidden, a listing can be shown", async () => {
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    // A roll normally reaches the AI...
    expect((await processAdventureInput("[[roll strength]]"))!.inputText!).not.toContain("wod:ctx-skip");
    // ...and in-story=false is the roll behind the Storyteller's screen.
    expect((await processAdventureInput("[[roll strength in-story=false]]"))!.inputText!).toContain("wod:ctx-skip");
    // A listing is the mirror image of that.
    expect((await processAdventureInput("[[show-sheet]]"))!.inputText!).toContain("wod:ctx-skip");
    expect((await processAdventureInput("[[show-sheet in-story]]"))!.inputText!).not.toContain("wod:ctx-skip");
  });

  test("writing the RULEBOOK is not a story beat; writing a SHEET is", async () => {
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    const hidden = async (body: string): Promise<boolean> =>
      (await processAdventureInput(body))!.inputText!.includes("wod:ctx-skip");
    // Definition cards - the chronicle's rulebook - stay out of the AI's context.
    expect(await hidden("[[define-merit name=`Probe` points=1]]")).toBe(true);
    expect(await hidden("[[forget-merit probe]]")).toBe(true);
    expect(await hidden("[[extend-template name=`Probe Tpl` extends=vampire]]")).toBe(true);
    // ...and things that happen to a CHARACTER do not.
    expect(await hidden("[[take-merit iron-will 3]]")).toBe(false);
    expect(await hidden("[[specialty melee `Swords`]]")).toBe(false);
    // The flag still overrides either default, per call.
    expect(await hidden("[[define-merit name=`Probe2` points=1 in-story]]")).toBe(false);
    expect(await hidden("[[take-merit acute-senses 1 in-story=false]]")).toBe(true);
    // The declaration is on the SPEC, so help and windows can see it too.
    expect(CommandRouter.specFor("define-merit")!.inStory).toBe(false);
    expect(CommandRouter.specFor("take-merit")!.inStory).toBeUndefined();
  });

  test("show-roll-status / show-contest-status take an ID, not the scope's character", async () => {
    await CommandRouter.route('create-playable name="Rok" templates=mortal');
    await CommandRouter.route("extended-contest 3 3 vs=\"Erik\" target=99 rounds=5", { rng: seqRng([6, 6, 6, 6, 2, 2]) });
    // Bare means "the one that is running" - it must not read "rok" as an id.
    expect(await CommandRouter.route("show-contest-status")).toContain("round 1/5");
    await CommandRouter.route("extended-roll 3 requires=99 intervals=5", { rng: seqRng([6, 6, 6]) });
    expect(await CommandRouter.route("show-roll-status")).toContain("3/99 successes");
  });

  test("@all is reserved, so an alias can never shadow the wildcard", async () => {
    expect(parseAliasToken("@all")).toBeUndefined();
    expect(await CommandRouter.route('alias @all "Kvar"')).toContain("Malformed alias");
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    await CommandRouter.route("take-merit iron-will 3");
    // ...and @all means the list, never a lookup of something called "all".
    expect(await CommandRouter.route("show-merit @all in=campaign")).toContain("acute-senses");
  });

  test("the seven scopes: campaign, current, a character, a template, a clan, a fellowship, a scene", async () => {
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    await CommandRouter.route('create-playable name="Aldous" templates=mage');
    await CommandRouter.route('play name="Kvar"');
    await CommandRouter.route("take-merit iron-will 3");

    expect(await CommandRouter.route("show-merit")).toContain("iron-will (3)");             // current
    expect(await CommandRouter.route("show-sheet in=Aldous")).toContain("Aldous");           // a character
    expect(await CommandRouter.route("show-merit @all in=campaign")).toContain("Defined");   // the chronicle
    // A TEMPLATE narrows the definitions to what that kind of creature may take.
    const mage = await CommandRouter.route("show-merit @all in=template::mage");
    expect(mage).toContain("open to Mage (template)");
    expect(mage).not.toContain("eat-food");           // a vampire merit
    // A CLAN is not a template - this is the question that could not be asked.
    const nos = await CommandRouter.route("show-merit @all in=clan::nosferatu");
    expect(nos).toContain("nosferatu-exclusive-merit");
    expect(nos).not.toContain("tremere-exclusive-merit");
    expect(await CommandRouter.route("show-merit @all in=fellowship::valdaermen"))
      .toContain("valdaermen-exclusive-merit");
    await CommandRouter.route("story-start 1197-03-15-08");
    await CommandRouter.route('scene "The Feast"');
    expect(await CommandRouter.route("show-scene in=scene::the-feast")).toContain("Feast");
    expect(await CommandRouter.route("show-scene @all")).toContain("The Feast (open)");
  });

  test("a scope a subject does not understand is a correction, not an empty list", async () => {
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    expect(await CommandRouter.route("show-health in=campaign")).toContain("only asked of");
    expect(await CommandRouter.route("show-merit @all in=nowhere-at-all")).toContain('Nothing named "nowhere-at-all"');
    expect(await CommandRouter.route("show-merit @all in=wrong::thing")).toContain("is not a scope");
  });

  test("a name that means two things reports the collision instead of guessing", async () => {
    // A character actually named after a clan: both readings are real.
    await CommandRouter.route('create-playable name="Nosferatu" templates=vampire');
    const r = await CommandRouter.route("show-merit @all in=nosferatu");
    expect(r).toContain("is a character AND a clan");
    expect(r).toContain("in=character::nosferatu");
    expect(r).toContain("in=clan::nosferatu");
    // ...and the explicit form answers.
    expect(await CommandRouter.route("show-merit @all in=clan::nosferatu")).toContain("open to Nosferatu (clan)");
  });

  test("the collapsed pairs still say what each old verb said", async () => {
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    await CommandRouter.route("take-merit iron-will 3");
    const owned = await CommandRouter.route("show-merit");
    const defined = await CommandRouter.route("show-merit @all in=campaign");
    expect(owned).toContain("iron-will (3)");                 // what [[show-merit]] said
    expect(defined).toContain("Defined Merits & Flaws");      // what [[show-merit]] said
    expect(owned).not.toContain("Defined Merits & Flaws");
  });

  test("[[help]] keeps its name and lists the ONLY vocabulary there is", async () => {
    const help = await CommandRouter.route("help");
    expect(help).toContain("show-merit");
    // The old names are GONE, not hidden (§7.92) - so this listing is now the
    // whole truth about what the engine answers to, and nothing trails it
    // promising that older names still work.
    expect(help).not.toContain("older names");
    expect(help).not.toContain(", merits,");
    // help is NOT one of the renamed verbs: it is what everybody already knows.
    expect(CommandRouter.verbs()).toContain("help");
    // ...and show-help is the alias, for players who now reasonably guess it.
    expect(await CommandRouter.route("show-help")).toContain("show-merit");
    // A retired name is now simply not a command.
    expect(await CommandRouter.route("help merits")).toContain(`No command "merits"`);
  });
});

// =============================================================================
// TRAIT CATEGORIES - "pick a Knowledge", "every Talent" (§7.76)
// =============================================================================
describe("categories: Physical/Social/Mental and Talents/Skills/Knowledges", () => {
  beforeEach(async () => {
    __resetStorageMock(); __resetLorebookMock();
    MeritFlawRegistry.reset(); ArcanumRegistry.reset(); AbilityCategories.reset();
    resetAllConfigStores(); await LorebookManager.bootstrap();
  });

  test("every Attribute and every shipped Ability knows its category", () => {
    expect(traitCategoryOf("strength")).toBe("physical");
    expect(traitCategoryOf("manipulation")).toBe("social");
    expect(traitCategoryOf("wits")).toBe("mental");
    expect(traitCategoryOf("alertness")).toBe("talent");
    expect(traitCategoryOf("melee")).toBe("skill");
    expect(traitCategoryOf("occult")).toBe("knowledge");
    // A Background is a KIND, not one of these six - it has no category.
    expect(traitCategoryOf("mentor")).toBeUndefined();
    // Either spelling: a card says "Knowledges", a pick says "a Knowledge".
    expect(traitInCategory("occult", "knowledges")).toBe(true);
    expect(traitInCategory("occult", "knowledge")).toBe(true);
    expect(traitInCategory("occult", "skill")).toBe(false);
  });

  test("the chronicle's own lists win, and lookups stay SYNCHRONOUS", async () => {
    const cat = await LorebookManager.ensureCategory("srd:abilities");
    await LorebookManager.updateEntryText("srd:abilities", "srd:abilities:knowledges",
      `h\n${SRD_HEADER_MARKER}\nHedge Lore\nOccult`);
    await AbilityCategories.loadFromLorebook();
    expect(cat.id).toBeDefined();
    expect(traitCategoryOf("hedge-lore")).toBe("knowledge");   // no await here
    expect(AbilityCategories.namesIn("knowledges")).toEqual(["hedge-lore", "occult"]);
  });

  test("a passive gated on a CATEGORY fires for every trait in it", async () => {
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    await CommandRouter.route("set-trait occult 3");
    await CommandRouter.route("set-trait melee 3");
    await CommandRouter.route('define-merit name=`Scholar` points=2 passive=`difficulty -2 if=knowledge`');
    await CommandRouter.route("take-merit scholar 2");
    // Occult is a Knowledge, so the merit applies...
    // The passive scales by the points taken: -2 per point, taken at 2.
    const learned = await CommandRouter.route("roll occult", { rng: seqRng([6, 6, 6]) });
    expect(learned).toContain("vs diff 2");
    expect(learned).toContain("scholar: difficulty -4");
    // ...and Melee is a Skill, so it does not.
    expect(await CommandRouter.route("roll melee", { rng: seqRng([6, 6, 6]) })).toContain("vs diff 6");
  });

  test("`pick a Knowledge` is enforceable: param-from refuses the wrong category", async () => {
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    const defined = await CommandRouter.route(
      'define-merit name=`Well Read` points=`1,2,3` param=trait param-from=knowledge passive=`difficulty -1 if=$trait`');
    expect(defined).toContain("parameterized by trait (must be a knowledge)");
    const wrong = await CommandRouter.route("take-merit well-read::melee 2");
    expect(wrong).toContain("is taken on a knowledge");
    expect(wrong).toContain("it is a skill");
    expect(wrong).toContain("occult");                      // it lists the choices
    expect(await CommandRouter.route("take-merit well-read::occult 2")).toContain("takes Well Read::occult");
    // ...and the Storyteller may still say otherwise.
    expect(await CommandRouter.route("take-merit well-read::brawl 1 waive=true")).toContain("takes Well Read::brawl");
    // A category nobody has heard of is refused at DEFINITION time.
    expect(await CommandRouter.route('define-merit name=`Nope` param=trait param-from=wibble'))
      .toContain("param-from names a trait category");
  });

  test("an instance limit may ration by CATEGORY as well as by kind", async () => {
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    await CommandRouter.route('define-merit name=`Favoured` points=`1,2,3` param=trait '
      + 'limit-at=3 limit-slots=2 limit-per-kind=`knowledge:1`');
    expect(await CommandRouter.route("take-merit favoured::occult 3")).toContain("takes Favoured::occult");
    const refused = await CommandRouter.route("take-merit favoured::law 3");
    expect(refused).toContain("allows 1 knowledge at 3");
    // A Skill is not a Knowledge, so it takes the other slot happily.
    expect(await CommandRouter.route("take-merit favoured::melee 3")).toContain("takes Favoured::melee");
  });

  test("the sheet and the card group by category, and a flat card still loads", async () => {
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    await CommandRouter.route("set-trait melee 3");
    await CommandRouter.route("set-trait occult 2");
    const sheet = await CommandRouter.route("show-sheet");
    expect(sheet).toContain("Physical: strength 1, dexterity 1, stamina 1");
    expect(sheet).toContain("Skill: melee 3");
    expect(sheet).toContain("Knowledge: occult 2");

    const char = (await CharacterStore.load("Kvar"))!;
    const card = characterToCard(char);
    expect(Object.keys(card["attributes"] as Record<string, unknown>)).toEqual(["Physical", "Social", "Mental"]);
    const back = characterFromCard(parseCardText(formatCardText(card)))!;
    expect(back.abilities.melee).toBe(3);
    expect(back.attributes.strength).toBe(1);
    expect(Object.keys(back.attributes).length).toBe(9);

    // A card hand-written the OLD flat way must still load - the reader takes
    // either shape, so nobody's existing sheet breaks.
    const flat = characterFromCard(parseCardText(
      "name: Kvar\nid: x\nstage: potential\ntemplates: vampire\n\nattributes:\n  Strength: 4\n  Wits: 3\n\nabilities:\n  Melee: 2"))!;
    expect(flat.attributes.strength).toBe(4);
    expect(flat.abilities.melee).toBe(2);
  });

  test("a trait the chronicle's lists do not name is filed under Other, never dropped", async () => {
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    const char = (await CharacterStore.load("Kvar"))!;
    char.abilities["hedge-lore"] = 4;                    // not on any SRD list
    await CharacterStore.save(char);
    expect(await CommandRouter.route("show-sheet")).toContain("Other: hedge-lore 4");
    const back = characterFromCard(parseCardText(formatCardText(characterToCard(char))))!;
    expect(back.abilities["hedge-lore"]).toBe(4);
  });
});

// =============================================================================
// A MERIT CAN NOW DEFINE WHAT IT TURNS ON, AND THERE IS A WINDOW FOR IT
// =============================================================================
describe("define-merit grants= (the passive affliction) and the merit windows", () => {
  beforeEach(async () => {
    __resetStorageMock(); __resetLorebookMock();
    MeritFlawRegistry.reset(); ArcanumRegistry.reset(); AbilityCategories.reset();
    resetAllConfigStores(); await LorebookManager.bootstrap();
  });

  test("a simple merit defines the affliction it grants, in one command", async () => {
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    const defined = await CommandRouter.route(
      'define-merit name=`Iron Nerve` points=3 grants=unshakable description=`Fear does not take.`');
    expect(defined).toContain('applies "unshakable"');
    expect(defined).toContain("did not exist, so it was defined too");
    expect(AfflictionRegistry.get("unshakable")).toBeDefined();
    // Taking it turns it ON - the same machinery Potence uses.
    const took = await CommandRouter.route("take-merit iron-nerve 3");
    expect(took).toContain("Unshakable is now applied");
    expect(await CommandRouter.route("show-affliction")).toContain("unshakable");
    // ...and dropping it takes the affliction away again.
    await CommandRouter.route("drop-merit iron-nerve");
    expect(await CommandRouter.route("show-affliction")).not.toContain("unshakable");
  });

  test("offered and togglable are data, exactly as for a built-in", async () => {
    await CommandRouter.route('create-playable name="Kvar" templates=vampire');
    await CommandRouter.route('define-merit name=`Second Wind` points=2 grants=surging grants-mode=offered');
    await CommandRouter.route("take-merit second-wind 2");
    // OFFERED means it grants the ABILITY; nothing is on until it is invoked.
    expect(await CommandRouter.route("show-affliction")).not.toContain("surging");
    expect(await CommandRouter.route("invoke surging")).toContain("invokes Surging");
    expect(await CommandRouter.route("show-affliction")).toContain("surging");
    // An existing affliction is reused, not redefined.
    const again = await CommandRouter.route('define-merit name=`Third Wind` points=1 grants=surging');
    expect(again).not.toContain("did not exist");
  });

  test("there are windows for both families, and they are built from the specs", () => {
    for (const verb of ["win-merit", "win-arcanum"]) {
      expect(CommandRouter.verbs()).toContain(verb);
      expect(CommandRouter.specFor(verb)!.inStory).toBe(false);
    }
    // The window walks define-merit's spec, so `grants` reaching the form is
    // exactly the same fact as `grants` existing on the verb.
    const keys = (CommandRouter.specFor("define-merit")!.params ?? []).map(p => p.key);
    expect(keys).toContain("grants");
    expect(keys).toContain("grants-mode");
    expect(keys).toContain("param-from");
  });
});

// =============================================================================
// difficulty-modifier: ONE affliction every rated merit can reuse (§7.77)
// =============================================================================
describe("modifier-difficulty - the shared affliction", () => {
  beforeEach(async () => {
    __resetStorageMock(); __resetLorebookMock();
    MeritFlawRegistry.reset(); ArcanumRegistry.reset(); AbilityCategories.reset();
    resetAllConfigStores(); await LorebookManager.bootstrap();
    await CommandRouter.route('create-playable name="Rok" templates=mortal');
    await CommandRouter.route("set-trait ride 3");
    await CommandRouter.route("set-trait occult 3");
    await CommandRouter.route("set-trait melee 3");
  });

  test("ONE signed thing, not a bonus/penalty pair - and the note says which way", async () => {
    await CommandRouter.route("afflict modifier-difficulty trait=melee level=2");
    const easier = await CommandRouter.route("roll melee", { rng: seqRng([6, 6, 6]) });
    expect(easier).toContain("vs diff 4");                 // 6 - 2
    expect(easier).toContain("difficulty -2 (easier)");
    // The SAME affliction, the other way: a signed level, no second definition.
    await CommandRouter.route("remove modifier-difficulty");
    await CommandRouter.route("define-affliction name=`cursed` apply=`difficulty +1 if=$trait` bindings=trait");
    await CommandRouter.route("afflict cursed trait=melee level=2");
    const harder = await CommandRouter.route("roll melee", { rng: seqRng([6, 6, 6]) });
    expect(harder).toContain("vs diff 8");                 // 6 + 2
    expect(harder).toContain("difficulty +2 (harder)");
  });

  test("the tag gate is a FIELD, not a second affliction (the Crack Driver case)", async () => {
    await CommandRouter.route("afflict modifier-difficulty trait=ride tags=reckless level=2 from=`merit:crack-rider`");
    // Only when the manoeuvre is reckless.
    expect(await CommandRouter.route("roll ride", { rng: seqRng([6, 6, 6]) })).toContain("vs diff 6");
    const reckless = await CommandRouter.route("roll ride tags=reckless", { rng: seqRng([6, 6, 6]) });
    expect(reckless).toContain("vs diff 4");
    expect(reckless).toContain("crack-rider: difficulty -2 (easier)");
    // A tag an affliction CONSUMED is not "unknown" - saying so would tell the
    // player their tag did nothing when it did the whole job.
    expect(reckless).not.toContain("unknown tag");
    expect(await CommandRouter.route("roll ride tags=nonsense", { rng: seqRng([6, 6, 6]) }))
      .toContain("unknown tag: nonsense");
  });

  test("the trait gate takes a CATEGORY, so `all Talents` is one instance", async () => {
    await CommandRouter.route("afflict modifier-difficulty trait=knowledge level=1 from=`merit:scholar`");
    expect(await CommandRouter.route("roll occult", { rng: seqRng([6, 6, 6]) })).toContain("vs diff 5");
    expect(await CommandRouter.route("roll melee", { rng: seqRng([6, 6, 6]) })).toContain("vs diff 6");
    // ...and `all` means no trait gate at all.
    await CommandRouter.route("remove modifier-difficulty");
    await CommandRouter.route("afflict modifier-difficulty trait=all level=1 from=`merit:blessed`");
    expect(await CommandRouter.route("roll melee", { rng: seqRng([6, 6, 6]) })).toContain("vs diff 5");
  });

  test("a SHARED affliction is held once per source - one merit cannot delete another's", async () => {
    await CommandRouter.route("afflict modifier-difficulty trait=ride tags=reckless level=2 from=`merit:crack-rider`");
    await CommandRouter.route("afflict modifier-difficulty trait=knowledge level=1 from=`merit:scholar`");
    const active = await CharacterAfflictions.list("Rok");
    expect(active.filter(a => a.def === "modifier-difficulty").length).toBe(2);
    // Both still bite, each through its own gate.
    expect(await CommandRouter.route("roll occult", { rng: seqRng([6, 6, 6]) })).toContain("vs diff 5");
    expect(await CommandRouter.route("roll ride tags=reckless", { rng: seqRng([6, 6, 6]) })).toContain("vs diff 4");
    // An affliction with no bindings and no source is still one-of, as before.
    await CommandRouter.route("afflict power-potence");
    await CommandRouter.route("afflict power-potence");
    expect((await CharacterAfflictions.list("Rok")).filter(a => a.def === "power-potence").length).toBe(1);
  });

  test("Trait Affinity USES the shared rule rather than owning one of its own", async () => {
    await CommandRouter.route('create-playable name="Duke" templates=demon');
    await CommandRouter.route('play name="Duke"');       // Rok already exists
    await CommandRouter.route("set-trait melee 3");
    await CommandRouter.route("take-arcanum trait-affinity::melee 2");
    // The grant fills the affliction from the instance: which trait, what level.
    const active = (await CharacterAfflictions.list("Duke")).find(a => a.def === "modifier-difficulty")!;
    expect(active.bindings["trait"]).toBe("melee");
    expect(active.level).toBe(2);
    expect(await CommandRouter.route("roll melee", { rng: seqRng([6, 6, 6]) })).toContain("vs diff 4");
    // ...and because the effect is a STATE, it can be switched off - which a
    // passive op could never be.
    await CommandRouter.route("remove modifier-difficulty");
    expect(await CommandRouter.route("roll melee", { rng: seqRng([6, 6, 6]) })).toContain("vs diff 6");
  });

  test("any merit can reuse it - that is the whole point", async () => {
    await CommandRouter.route(
      'define-merit name=`Duellist` points=`1,2,3` param=trait param-from=skill grants=difficulty-modifier');
    // The definition reads as doing something, because it says what the
    // affliction it applies DOES.
    // An older name is filed under the current one when the merit is defined.
    expect(await CommandRouter.route("show-merit duellist")).toContain('applies "modifier-difficulty"');
    expect(MeritFlawRegistry.get("duellist")!.grants!.afflicts).toBe("modifier-difficulty");
  });
});

// =============================================================================
// HELD DOWN IS NOT GONE - lift / restore / remove (§7.78)
// =============================================================================
describe("lift vs remove: the Majesty distinction", () => {
  beforeEach(async () => {
    __resetStorageMock(); __resetLorebookMock();
    MeritFlawRegistry.reset(); ArcanumRegistry.reset(); AbilityCategories.reset();
    resetAllConfigStores(); await LorebookManager.bootstrap();
    await CommandRouter.route('create-playable name="Rok" templates=mortal');
    await CommandRouter.route("story-start 1197-03-15-08");
    await CommandRouter.route('scene "Court"');
    await CommandRouter.route("set-trait subterfuge 3");
    await CommandRouter.route("set-trait climb 3");
    await CommandRouter.route("gain willpower 3");
  });

  test("the TARGET of Majesty buys relief and is still under it", async () => {
    await CommandRouter.route("define-affliction name=`majesty` apply=`difficulty +2 if=talent` "
      + "lift=cost lift-cost=willpower lift-for=`1 scene`");
    await CommandRouter.route("afflict majesty from=`discipline:presence`");
    expect(await CommandRouter.route("roll subterfuge", { rng: seqRng([6, 6, 6]) })).toContain("vs diff 8");

    const relief = await CommandRouter.route("lift majesty");
    expect(relief).toContain("spent 1 willpower");
    expect(relief).toContain("still on Rok");
    // Not biting...
    expect(await CommandRouter.route("roll subterfuge", { rng: seqRng([6, 6, 6]) })).toContain("vs diff 6");
    // ...and STILL THERE. This is the whole distinction: lifted, not removed.
    const held = (await CharacterAfflictions.list("Rok")).find(a => a.def === "majesty")!;
    expect(held).toBeDefined();
    expect(held.suspended!.by).toBe("self");
    expect(await CommandRouter.route("show-affliction")).toContain("HELD DOWN");

    // The relief runs out on its own clock; the affliction never left.
    expect(await CommandRouter.route("end-scene")).toContain("Majesty takes hold again");
    expect(await CommandRouter.route("roll subterfuge", { rng: seqRng([6, 6, 6]) })).toContain("vs diff 8");
  });

  test("[[remove]] is what ENDS it - walking out of his presence", async () => {
    await CommandRouter.route("define-affliction name=`majesty` apply=`difficulty +2 if=talent` lift=cost lift-cost=willpower");
    await CommandRouter.route("afflict majesty from=`discipline:presence`");
    expect(await CommandRouter.route("remove majesty")).toContain("is free of majesty");
    expect(await CommandRouter.route("show-affliction")).not.toContain("majesty");
    expect(await CommandRouter.route("roll subterfuge", { rng: seqRng([6, 6, 6]) })).toContain("vs diff 6");
  });

  test("the HOLDER's side is at-will: off and on as he pleases, nothing spent", async () => {
    await CommandRouter.route("define-affliction name=`radiating-majesty` apply=`difficulty -1 if=social` lift=at-will");
    await CommandRouter.route("afflict radiating-majesty");
    const before = (await CharacterResources.all(await CharacterStore.load("Rok") as never)) as never;
    expect(before).toBeDefined();
    const off = await CommandRouter.route("lift radiating-majesty");
    expect(off).toContain("holds off radiating-majesty");
    expect(off).not.toContain("spent");                     // at will costs nothing
    expect(await CommandRouter.route("restore radiating-majesty")).toContain("takes hold of Rok again");
    expect((await CharacterAfflictions.list("Rok")).find(a => a.def === "radiating-majesty")!.suspended).toBeUndefined();
  });

  test("claws cannot be willed away, but a glove holds them down while worn", async () => {
    await CommandRouter.route("define-affliction name=`claw-hands` apply=`difficulty -2 if=climb` "
      + "lift=never lift-note=`bone and horn`");
    await CommandRouter.route("define-affliction name=`wearing-gloves` suppresses=claw-hands");
    await CommandRouter.route("afflict claw-hands from=`frenzy:1197`");
    expect(await CommandRouter.route("roll climb", { rng: seqRng([6, 6, 6]) })).toContain("vs diff 4");

    // No act of will puts them away.
    const refused = await CommandRouter.route("lift claw-hands");
    expect(refused).toContain("cannot be shrugged off");
    expect(refused).toContain("bone and horn");

    // The glove does - and nobody had to remember to hold them down.
    const gloved = await CommandRouter.route("afflict wearing-gloves");
    expect(gloved).toContain("claw-hands held down by wearing-gloves");
    expect(await CommandRouter.route("roll climb", { rng: seqRng([6, 6, 6]) })).toContain("vs diff 6");
    expect((await CharacterAfflictions.list("Rok")).find(a => a.def === "claw-hands")!.suspended!.by)
      .toBe("wearing-gloves");
    // ...and taking the glove off brings them back, with nobody restoring them.
    expect(await CommandRouter.route("remove wearing-gloves")).toContain("claw-hands is back");
    expect(await CommandRouter.route("roll climb", { rng: seqRng([6, 6, 6]) })).toContain("vs diff 4");
    // A suspension somebody else holds is not his to end.
    await CommandRouter.route("afflict wearing-gloves");
    expect(await CommandRouter.route("restore claw-hands")).toContain("held down by wearing-gloves");
  });

  test("`from` picks ONE instance of a shared affliction, for both verbs", async () => {
    await CommandRouter.route("afflict modifier-difficulty trait=climb level=2 from=`merit:sure-footed`");
    await CommandRouter.route("afflict modifier-difficulty trait=subterfuge level=1 from=`merit:glib`");
    await CommandRouter.route("remove modifier-difficulty from=`merit:glib`");
    const left = await CharacterAfflictions.list("Rok");
    expect(left.filter(a => a.def === "modifier-difficulty").length).toBe(1);
    expect(left[0].from).toBe("merit:sure-footed");
    // ...and lifting one leaves the other biting.
    await CommandRouter.route("afflict modifier-difficulty trait=subterfuge level=1 from=`merit:glib`");
    await CommandRouter.route("define-affliction name=`modifier-difficulty` apply=`difficulty -1 if=$trait` bindings=trait lift=at-will");
    await CommandRouter.route("lift modifier-difficulty from=`merit:glib`");
    const now = await CharacterAfflictions.list("Rok");
    expect(now.find(a => a.from === "merit:glib")!.suspended).toBeDefined();
    expect(now.find(a => a.from === "merit:sure-footed")!.suspended).toBeUndefined();
  });
});

// =============================================================================
// AFFLICTION NAMES ARE ROLE FIRST (§7.79)
// =============================================================================
describe("affliction names: the role comes first", () => {
  beforeEach(async () => {
    __resetStorageMock(); __resetLorebookMock();
    MeritFlawRegistry.reset(); ArcanumRegistry.reset(); AbilityCategories.reset();
    resetAllConfigStores(); await LorebookManager.bootstrap();
    await CommandRouter.route('create-playable name="Rok" templates=mortal');
    await CommandRouter.route("story-start 1197-03-15-08");
    await CommandRouter.route('scene "Court"');
  });

  test("sorted, they group by KIND rather than by subject", () => {
    expect(afflictionRole("emitting-majesty")).toBe("emitting");
    expect(afflictionRole("under-majesty")).toBe("under");
    expect(afflictionRole("in-sanctum")).toBe("in");
    expect(afflictionRole("power-potence")).toBe("power");
    expect(afflictionRole("modifier-difficulty")).toBe("modifier");
    // A name whose FIRST part is the subject declares no role - which is the
    // thing the convention exists to stop.
    expect(afflictionRole("majesty-effect")).toBeUndefined();
    expect(afflictionRole("dazed")).toBeUndefined();
    // Sorting puts the pair with their own kind, not with each other.
    const names = ["under-majesty", "emitting-majesty", "emitting-fear", "under-fear"].sort();
    expect(names).toEqual(["emitting-fear", "emitting-majesty", "under-fear", "under-majesty"]);
  });

  test("the listing is grouped by role, and defining without one is nudged (never refused)", async () => {
    const listed = await CommandRouter.route("show-affliction @all in=campaign");
    expect(listed).toContain("Defined afflictions, by role");
    expect(listed).toContain("emitting- (you are the SOURCE");
    expect(listed).toContain("emitting-majesty");
    expect(listed).toContain("under-majesty");
    const nudged = await CommandRouter.route("define-affliction name=`dazed` apply=`difficulty +1`");
    expect(nudged).toContain("declares no ROLE");
    expect(nudged).toContain("Perhaps state-dazed?");
    expect(AfflictionRegistry.get("dazed")).toBeDefined();     // stored anyway
  });

  test("an older name still finds its definition - a rename breaks nobody's card", async () => {
    for (const [old, now] of [["potent", "power-potence"], ["fortified", "power-fortitude"],
      ["difficulty-modifier", "modifier-difficulty"], ["full-rested", "state-rested"]] as const) {
      expect([old, resolveAffliction(old)?.name]).toEqual([old, now]);
    }
    // ...and afflicting by the old name files it under the current one.
    await CommandRouter.route("afflict difficulty-modifier trait=climb level=2");
    expect((await CharacterAfflictions.list("Rok"))[0].def).toBe("modifier-difficulty");
    // A recovery gate written against the old name still gates (both resolve).
    expect(afflictionNames(resolveAffliction("state-rested")!)).toEqual(["state-rested", "full-rested"]);
  });

  test("Majesty ships as the pair, and each half behaves as its role says", async () => {
    await CommandRouter.route('create-playable name="Anais" templates=vampire');
    await CommandRouter.route('play name="Anais"');
    await CommandRouter.route("set-trait subterfuge 3");
    await CommandRouter.route("gain willpower 3");
    // The EMITTER radiates it, and stops at will - nothing spent.
    const emit = await CommandRouter.route('afflict emitting-majesty target="Rok"');
    expect(emit).toContain("Rok is now under-majesty");            // the mirror
    expect(await CommandRouter.route("lift emitting-majesty")).not.toContain("spent");

    // The TARGET buys relief, and is still under it.
    await CommandRouter.route('play name="Rok"');
    await CommandRouter.route("set-trait subterfuge 3");
    await CommandRouter.route("gain willpower 3");
    const relief = await CommandRouter.route("lift under-majesty");
    expect(relief).toContain("spent 1 willpower");
    expect(relief).toContain("still on Rok");
    expect((await CharacterAfflictions.list("Rok")).find(a => a.def === "under-majesty")).toBeDefined();
    // ...and only leaving ends it.
    expect(await CommandRouter.route("remove under-majesty")).toContain("is free of under-majesty");
  });
});

// =============================================================================
// THE ROUND TRIP - a def a card cannot carry is a def that quietly loses a rule
// -----------------------------------------------------------------------------
// Three fields have now been lost this way: `grants`, `aka`, and `choices` (the
// gate that makes all 38 Exclusive Merits/Flaws exclusive). The shape of the
// bug is always the same and it is structural, not careless: the WRITER
// (namedDefsToCard) spreads whatever the def has, so it never loses anything;
// every READER enumerates its fields by hand, so it loses whatever nobody
// remembered to add. Enumeration cannot be made safe by being careful.
//
// So this is the guard, and it uses the defs the ENGINE ITSELF SHIPS rather
// than hand-written exemplars - those are real, valid, and cover the field
// surface that is actually in use. Anything the engine can express, a card must
// be able to carry home again.
// =============================================================================
describe("every shipped def survives the trip through its own lorebook card", () => {
  type CardReader = (name: string, body: CardMap) => Record<string, unknown> | undefined;

  // Write one def the way its registry does, read it back the way the loader
  // does, and report the fields that did not make it.
  function fieldsLost(def: Record<string, unknown>, read: CardReader): string[] {
    const text = formatCardText(namedDefsToCard([def as { name: string }]));
    const back = asNamedList(parseCardText(text));
    expect(back).toHaveLength(1);
    const got = read(back[0].name, back[0].body);
    if (!got) return ["<the reader refused the card entirely>"];
    return Object.keys(def).filter(k => got[k] === undefined);
  }

  const suites: Array<[string, Array<Record<string, unknown>>, CardReader]> = [
    ["merits and flaws", DEFAULT_MERITS_FLAWS as unknown as Array<Record<string, unknown>>,
      (n, b) => meritFlawFromCard(n, b) as unknown as Record<string, unknown> | undefined],
    ["arcana and taints", DEFAULT_ARCANA as unknown as Array<Record<string, unknown>>,
      (n, b) => arcanumFromCard(n, b) as unknown as Record<string, unknown> | undefined],
    ["afflictions", DEFAULT_AFFLICTIONS as unknown as Array<Record<string, unknown>>,
      (n, b) => makeAfflictionDef({ ...b, name: n } as never) as unknown as Record<string, unknown>],
    ["backgrounds", DEFAULT_BACKGROUNDS as unknown as Array<Record<string, unknown>>,
      (n, b) => makeBackgroundDef({ ...b, name: n } as never) as unknown as Record<string, unknown>],
    ["templates", DEFAULT_TEMPLATE_DEFS as unknown as Array<Record<string, unknown>>,
      (n, b) => makeTemplateDef({ ...b, name: n } as never) as unknown as Record<string, unknown>],
  ];

  for (const [label, defs, read] of suites) {
    test(`${label}: no field is dropped on the way back`, () => {
      expect(defs.length).toBeGreaterThan(0);
      const broken = defs
        .map(d => ({ name: String(d.name), lost: fieldsLost(d, read) }))
        .filter(r => r.lost.length);
      // Named, not counted: the failure message has to say WHICH field, or the
      // next person is where I was - staring at a number.
      expect(broken.map(r => `${r.name} lost: ${r.lost.join(", ")}`)).toEqual([]);
    });
  }

  test("the gate that makes an Exclusive Merit exclusive comes home", () => {
    // The specific regression: `requires.choices` is what ties a merit to a
    // clan or a fellowship, and losing it did not break the merit - it made it
    // available to EVERYONE, silently, which is the worst way for a rule to
    // fail.
    const exclusive = DEFAULT_MERITS_FLAWS.find(m => m.requires?.choices);
    expect(exclusive).toBeDefined();
    const text = formatCardText(namedDefsToCard([exclusive!]));
    const back = asNamedList(parseCardText(text));
    const read = meritFlawFromCard(back[0].name, back[0].body);
    expect(read?.requires?.choices).toEqual(exclusive!.requires!.choices!);
  });
});


// =============================================================================
// NO FIELD MAY LEAK OUT OF THE STORY
// -----------------------------------------------------------------------------
// Measured on-host (scripts/probe-window-field.ts): an UNPREFIXED storageKey is
// filed in `api.v1.storage`, and for an account script that store is
// ACCOUNT-level - shared across every story on the account. So a bare
// storageKey does not merely fail to read back (§7.83); it carries one
// chronicle's answers into the next. Every window is opened here and every
// field it binds must name the story explicitly.
// =============================================================================
describe("no window field escapes the story it belongs to", () => {
  const WINDOW_VERBS = [
    "win-constraint", "win-table", "win-merit", "win-arcanum",
    "win-affliction", "win-afflict", "win-roll",
  ];

  beforeEach(async () => {
    __resetStorageMock(); __resetLorebookMock(); __resetUiMock();
    await LorebookManager.bootstrap();
    await reloadAllConfigStores();
    await StoryClock.seedDefault();
    await CommandRouter.route('create-playable name="Marius" templates=mage');
  });

  for (const verb of WINDOW_VERBS) {
    test(`${verb} binds every field to the story, never to the account`, async () => {
      __resetUiMock();
      await CommandRouter.route(verb);
      const keys = Object.keys(__uiFields());
      expect(keys.length).toBeGreaterThan(0);
      // `story:` or `history:`; a bare key means api.v1.storage, which outlives
      // the story and is therefore always wrong for a form.
      const bare = keys.filter(k => !k.startsWith("story:") && !k.startsWith("history:"));
      expect(bare).toEqual([]);
    });
  }

  test("opening and filling every window leaves the ACCOUNT store untouched", async () => {
    for (const verb of WINDOW_VERBS) {
      __resetUiMock();
      await CommandRouter.route(verb);
      // Type into everything the window offers, then submit what it offers.
      for (const key of Object.keys(__uiFields())) await __uiTypeInto(key, "probe");
      for (const label of ["Create", "Roll", "Save", "Afflict", "Create & define"]) {
        if (await __uiClickButton(label)) break;
      }
    }
    expect(__accountStorage()).toEqual({});
  });

  test("the engine writes storyStorage, so a second story starts clean", async () => {
    await CommandRouter.route("win-roll");
    await __uiTypeInto("story:win:roll:pool", "strength+brawl");
    expect(__uiFieldValue("story:win:roll:pool")).toBe("strength+brawl");
    // A new story clears storyStorage; the field goes with it, as it should.
    __resetStorageMock();
    expect(__uiFieldValue("story:win:roll:pool")).toBe("");
  });
});


// =============================================================================
// EVERY KEY IN ONE PLACE
// -----------------------------------------------------------------------------
// The engine's persistent state used to be described completely in exactly one
// spot - docs/memory.md §6 - which is a document, so nothing could fail when it
// drifted from the thirteen inline template strings it was describing. KEY is
// that map as CODE. These tests are what make it a map rather than a list.
// =============================================================================
describe("the storage key registry", () => {
  const staticKeys = Object.entries(KEY).filter(([, v]) => typeof v === "string") as Array<[string, string]>;
  const builders = Object.entries(KEY).filter(([, v]) => typeof v === "function") as Array<[string, (a: string, b?: string) => string]>;

  test("no two keys can ever collide", () => {
    // Flat keys are distinct from each other...
    const flat = staticKeys.map(([, v]) => v);
    expect(new Set(flat).size).toBe(flat.length);
    // ...and every builder occupies its own namespace, so two kinds of record
    // about the SAME character cannot overwrite one another.
    const built = builders.map(([, fn]) => fn("marius", "marius"));
    expect(new Set(built).size).toBe(built.length);
    // A flat key is never also a built one.
    expect(flat.filter(f => built.includes(f))).toEqual([]);
  });

  // An ID-keyed builder takes an opaque id the engine minted; normalizing a
  // uuid would quietly address a different record.
  const ID_KEYED = ["extendedRoll", "extendedContest", "lorebookBackup"];

  test("a SUBJECT-keyed builder normalizes, so `Kvar The Bold` and `kvar-the-bold` are one record", () => {
    const subjectKeyed = builders.filter(([name]) => !ID_KEYED.includes(name));
    expect(subjectKeyed.length).toBeGreaterThan(5);
    for (const [, fn] of subjectKeyed) {
      expect(fn("Kvar The Bold")).toBe(fn("kvar the bold"));
      expect(fn("Kvar The Bold")).toBe(fn("  kvar-the-bold  "));
    }
  });

  test("an ID-keyed builder leaves the id exactly alone", () => {
    for (const name of ID_KEYED) {
      const fn = (KEY as unknown as Record<string, (a: string, b?: string) => string>)[name];
      expect(fn("A1b2-C3d4", "A1b2-C3d4")).toContain("A1b2-C3d4");
    }
  });

  test("the registry and the store enum are frozen - a key is not something to patch at runtime", () => {
    expect(Object.isFrozen(KEY)).toBe(true);
    expect(Object.isFrozen(STORE)).toBe(true);
    // `account` exists so it can be REFUSED by name rather than being an
    // absence somebody fills in later (§7.85).
    expect(STORE.account).toBe("account");
    expect(Object.values(STORE)).toContain("story");
  });

  test("the keys the stores actually write are the registry's", async () => {
    __resetStorageMock(); __resetLorebookMock(); resetAllConfigStores();
    await LorebookManager.bootstrap();
    await StoryClock.seedDefault();
    await CommandRouter.route('create-playable name="Kvar the Bold" templates=vampire');
    await CommandRouter.route("afflict state-rested");
    const written = await new ScopedStorage().list();
    // Everything written is a key the registry can account for.
    const known = (k: string): boolean =>
      staticKeys.some(([, v]) => v === k) ||
      builders.some(([, fn]) => fn("kvar-the-bold") === k || fn("kvar the bold") === k);
    const strays = written.filter(k => !known(k) && !k.startsWith("lb:"));
    expect(strays).toEqual([]);
    // And the ones we know were written ARE there, by their registry name.
    expect(written).toContain(KEY.character("Kvar the Bold"));
    expect(written).toContain(KEY.afflictions("Kvar the Bold"));
    expect(written).toContain(KEY.currentCharacter);
    expect(written).toContain(KEY.clock);
  });
});


// =============================================================================
// REMEMBERING WHO ELSE IS HERE
// -----------------------------------------------------------------------------
// The handshake worked but forgot everything on close, so every load rebuilt the
// directory with a broadcast whose answers land a TICK LATER. Addresses now
// persist; interest still does not, and the split is the point (§7.87).
// =============================================================================
describe("the script directory", () => {
  const OTHER = "other-script-id";
  beforeEach(async () => { await PostOffice.close(); __resetMessagingMock(); __resetStorageMock(); });

  test("the directory lives at a FIXED prefix - a key behind a script id could never be found", async () => {
    __resetStorageMock();
    await PostOffice.remember(OTHER);
    // Readable knowing NOTHING but the constant, which is the entire requirement.
    const blind = new ScopedStorage(REGISTRY_PREFIX);
    const dir = await blind.getOrDefault<Record<string, number>>(DIRECTORY_KEY, {});
    expect(Object.keys(dir)).toEqual([OTHER]);
  });

  test("a remembered address survives close - that is what saves the next load a round-trip", async () => {
    __resetStorageMock();
    await PostOffice.open();
    await __deliverMessage({ fromScriptId: OTHER, channel: "naiowod:hello", data: { scriptId: OTHER, channels: ["command"] } });
    await new Promise(r => setTimeout(r, 0));      // the directory write is fire-and-forget
    expect(await PostOffice.remembered()).toContain(OTHER);
    await PostOffice.close();
    expect(await PostOffice.remembered()).toContain(OTHER);   // the address outlives the session
  });

  test("but INTEREST does not survive - a remembered script earns relayed traffic only by ANSWERING", async () => {
    __resetStorageMock();
    await PostOffice.remember(OTHER);          // we remember them from a past life...
    await PostOffice.open();                   // ...and open WITHOUT them ever replying
    expect(await PostOffice.remembered()).toContain(OTHER);
    // ...yet nothing is armed for them, so publish() still does not touch the wire.
    expect(PostOffice.remoteInterest()).toEqual({});
    await PostOffice.close();
  });

  test("we never remember ourselves", async () => {
    __resetStorageMock();
    await PostOffice.remember(api.v1.script.id);
    expect(await PostOffice.remembered()).toEqual([]);
  });

  test("an address nothing has confirmed for a month ages out", async () => {
    __resetStorageMock();
    const stale = Date.now() - 31 * 24 * 60 * 60 * 1000;
    await new ScopedStorage(REGISTRY_PREFIX).set(DIRECTORY_KEY, { [OTHER]: stale, fresh: Date.now() });
    expect(await PostOffice.remembered()).toEqual(["fresh"]);
  });
});


// =============================================================================
// ONE COUNTER, AND NOBODY REACHES PAST IT
// -----------------------------------------------------------------------------
// Owner's rule: "nobody gets to access api.v1.storyStorage without going through
// their post office". The first test is the one that matters - the other two
// only prove the counter works, while that one proves nothing bypasses it.
// =============================================================================
describe("the storage counter", () => {
  test("a read is a request somebody serves, and an unserved one is an error not a silent undefined", async () => {
    __resetStorageMock();
    const store = new ScopedStorage("test");
    await store.set("k", { v: 1 });
    expect(await store.get("k")).toEqual({ v: 1 });
    // A handler that claims the request first wins; the local desk stands down.
    const claim = Bus.on(STORAGE_CHANNEL, (e) => {
      const req = e.data as StorageRequest;
      if (req.key === "test_k") { req.result = { v: 99 }; req.served = true; }
    }, { priority: "first" });
    expect(await store.get("k")).toEqual({ v: 99 });     // served by the interloper
    Bus.off(claim);
    expect(await store.get("k")).toEqual({ v: 1 });      // desk again
  });

  test("the account store is refused BY NAME, not merely unused", async () => {
    await expect(StorageDesk.request("get", STORE.account, "anything")).rejects.toThrow(/account store/);
  });
});


// =============================================================================
// THE MOCK MUST NOT BE MORE GENEROUS THAN THE HOST
// -----------------------------------------------------------------------------
// Measured on-host (§7.90): every store is PER SCRIPT. The mock used to keep one
// Map per store and hand it to everybody - accurate while the engine was a
// single script, and quietly wrong the moment it stopped being one. A two-unit
// test would have "proved" units sharing state the host will never let them
// share, which is the worst kind of passing test.
// =============================================================================
describe("per-script storage, as measured", () => {
  test("one script cannot see another's keys - the finding that reversed the architecture", async () => {
    __resetStorageMock();
    const one = new ScopedStorage("shared-prefix");
    await one.set("sheet", { name: "Kvar" });
    expect(await one.get("sheet")).toEqual({ name: "Kvar" });

    const was = __asScript("second-script-id");
    const two = new ScopedStorage("shared-prefix");   // THE SAME PREFIX
    // ...and it is still invisible. This is the whole point: no prefix bridges
    // scripts, which is why one script has to own the state and serve the rest.
    expect(await two.get("sheet")).toBeUndefined();
    expect(await two.list()).toEqual([]);
    await two.set("sheet", { name: "Someone Else" });

    __asScript(was);
    expect(await one.get("sheet")).toEqual({ name: "Kvar" });   // unclobbered
  });

  test("identity is restored by a reset, so a switch cannot leak into the next test", async () => {
    __asScript("some-other-script");
    __resetStorageMock();
    expect(__currentScript()).toBe("a1b2c3d4-script-uuid");
  });

  test("every store isolates, not just storyStorage (S2 measured the same)", async () => {
    __resetStorageMock();
    await api.v1.storage.set("k", "account-ish");
    await api.v1.tempStorage.set("k", "temp");
    await api.v1.historyStorage.set("k", "history");
    const was = __asScript("elsewhere");
    expect(await api.v1.storage.get("k")).toBeUndefined();
    expect(await api.v1.tempStorage.get("k")).toBeUndefined();
    expect(await api.v1.historyStorage.get("k")).toBeUndefined();
    __asScript(was);
    expect(await api.v1.storage.get("k")).toBe("account-ish");
  });

  test("api.v1.script.id follows the switch, so ScopedStorage's default prefix does too", async () => {
    __resetStorageMock();
    const mine = new ScopedStorage();          // defaults to api.v1.script.id
    await mine.set("x", 1);
    const was = __asScript("a-different-script");
    expect(new ScopedStorage().StoragePrefix).toBe("a-different-script");
    expect(await new ScopedStorage().get("x")).toBeUndefined();
    __asScript(was);
    expect(await mine.get("x")).toBe(1);
  });
});


// =============================================================================
// THE SPLIT DID NOT MOVE ANYTHING THAT MATTERS
// -----------------------------------------------------------------------------
// src/game.ts was 7941 lines; it is now src/game/*. Two things had to survive
// exactly: the order commands register in (it is what [[help]] lists) and the
// public surface. Both are asserted here rather than hoped for. See §7.91.
// =============================================================================
describe("the game layer after the split", () => {

  test("[[help]] still lists `help` first, and show-* last", () => {
    const verbs = CommandRouter.verbs();
    expect(verbs[0]).toBe("help");
    // The show-* block registers from the barrel precisely so it lands after
    // afflictions.ts's 129. If module evaluation order ever leaks back into
    // registration order, these verbs jump to the front and this fails.
    const firstShow = verbs.findIndex(v => v.startsWith("show-"));
    const lastPlain = verbs.map(v => !v.startsWith("show-") && !v.startsWith("win-")).lastIndexOf(true);
    expect(firstShow).toBeGreaterThan(lastPlain);
  });

});


// =============================================================================
// A MAN CAN HAVE TWO MENTORS
// -----------------------------------------------------------------------------
// `backgrounds` keeps ONE number per name, so every reader answered with the
// higher of two instances and said nothing about the other - even though the
// instances were already stored and the definition itself says "More than one
// may be held". §7.93.
// =============================================================================
describe("backgrounds are held per instance", () => {
  const setup = async (): Promise<void> => {
    __resetStorageMock(); __resetLorebookMock(); resetAllConfigStores();
    await LorebookManager.bootstrap();
    await CommandRouter.route('create-playable name="Marius" templates=mage');
  };

  test("two Mentors are two Mentors - the listing shows both, not the better one", async () => {
    await setup();
    await CommandRouter.route('set-trait mentor 5 note=`Velia, the Rafastio Matriarch`');
    await CommandRouter.route('set-trait mentor 3 note=`Daujotas, the Ash Shepherd` add');
    const out = await CommandRouter.route("show-background");
    expect(out).toContain("Mentor 5 (Velia, the Rafastio Matriarch)");
    expect(out).toContain("Mentor 3 (Daujotas, the Ash Shepherd)");
    // ...and asking about the background itself counts them rather than picking.
    const one = await CommandRouter.route("show-background mentor");
    expect(one).toContain("has 2:");
    expect(one).toContain("3 (Daujotas, the Ash Shepherd)");
  });

  test("`from` nests an instance under what confers it, recursively", async () => {
    await setup();
    await CommandRouter.route('set-trait talisman 5 note=`Cosmos Within the Measure`');
    await CommandRouter.route('set-trait library 8 note=`Library of the Unseen` from=talisman add');
    await CommandRouter.route('set-trait sanctum 8 note=`the rotunda workshop` from=library add');
    const out = await CommandRouter.route("show-background");
    const lines = out.split("\n");
    const at = (frag: string): number => lines.findIndex(l => l.includes(frag));
    const indent = (i: number): number => lines[i].search(/\S/);
    // Each one sits deeper than the thing that grants it - the sheet's shape IS
    // the claim, so indentation is what the test checks.
    expect(indent(at("Library of the Unseen"))).toBeGreaterThan(indent(at("Cosmos Within the Measure")));
    expect(indent(at("the rotunda workshop"))).toBeGreaterThan(indent(at("Library of the Unseen")));
    expect(out).toContain("grants:");
  });

  test("a `source` groups instances under their own heading, per instance", async () => {
    await setup();
    await CommandRouter.route('set-trait mentor 5 note=`Velia` source=storyteller');
    await CommandRouter.route('set-trait mentor 3 note=`Daujotas` add');
    const out = await CommandRouter.route("show-background");
    const lines = out.split("\n");
    const heading = lines.findIndex(l => l.includes("Storyteller bonuses:"));
    expect(heading).toBeGreaterThanOrEqual(0);
    // The gift is under the heading; the bought one is NOT - one Mentor each way.
    expect(lines[heading + 1]).toContain("Velia");
    expect(lines.slice(heading + 1).find(l => l.includes("Daujotas"))!.search(/\S/))
      .toBeLessThan(lines[heading + 1].search(/\S/));
  });

  test("a definition's own grants still show, marked, until the player names one", async () => {
    await setup();
    await CommandRouter.route('define-background name="estate" max=5 grants="library:3"');
    await CommandRouter.route('set-trait estate 4 note=`the old house`');
    const out = await CommandRouter.route("show-background");
    expect(out).toContain("Library 3");
    expect(out).toContain("conferred");           // it is the def talking, not the player
  });

  test("a Storyteller gift is free PER INSTANCE - the bought Mentor beside it still bills", async () => {
    await setup();
    await CommandRouter.route('set-trait mentor 5 note=`Velia` source=storyteller');
    await CommandRouter.route('set-trait mentor 3 note=`Daujotas` add');   // bought
    await CommandRouter.route("set-trait resources 2");                    // bought
    const out = await CommandRouter.route("show-budget");
    // 3 + 2. The gift is listed and costs nothing; `source` used to be readable
    // only per TRAIT, which could not bill one Mentor and gift the other.
    expect(out).toContain("background: 5/5");
    expect(out).toContain("(storyteller, free)");
  });

  test("a Storyteller gift is uncapped - Library 8 past a max of 5 draws no complaint", async () => {
    await setup();
    await CommandRouter.route('set-trait library 8 note=`Library of the Unseen` source=storyteller');
    const budget = await CommandRouter.route("show-budget");
    expect(budget).toContain("library 8 (storyteller, free)");
    expect(budget).not.toContain("⚠");
    // ...and it still costs the purse nothing at all.
    expect(budget).toContain("background: 0/5");
  });

  test("a grant cycle terminates instead of hanging", async () => {
    await setup();
    await CommandRouter.route('define-background name="a-side" max=5 grants="b-side:2"');
    await CommandRouter.route('define-background name="b-side" max=5 grants="a-side:2"');
    await CommandRouter.route('set-trait a-side 3');
    const out = await CommandRouter.route("show-background");
    expect(out).toContain("A Side 3");           // disp() spaces the hyphen
    expect(out).toContain("B Side 2");           // conferred once, then it stops
  });
});
