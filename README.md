# NAIoWoD

Attempting to implement **World of Darkness** (Storyteller system, _Dark Ages_
flavour) for NovelAI — a foundation for single-player games run by the AI as
Storyteller. This repository is the rules engine: characters, dice, health,
damage, soak, resource pools and morality. UI and game loop come later.

## Layout

| Path | What |
| --- | --- |
| `src/wod.ts` | The whole engine in one file (so it can be pasted into NovelAI). |
| `test/*.test.ts` | Bun test suites (`baseline` = original code, `system` = new mechanics). |
| `types/bun-test.d.ts` | Ambient shim so `tsc` can check tests without installing `bun-types`. |

### Why one file

NovelAI's scripting runtime is a single, import-free context that injects a
global `api` object. `src/wod.ts` keeps everything in one module and the `api`
mock at the top **yields to a host-provided `api`** when one exists:

```ts
const api = __host.api ?? { /* local/test mock */ };
```

So the same file runs locally, under test, and in NovelAI. When you want to
split it into modules for the eventual UI work, the test suite makes that
refactor safe.

## Commands

```bash
bun test          # run all tests
bun run typecheck # tsc --noEmit
bun run build     # bundle to dist/wod.novelai.js (one file, for NovelAI)
```

No `npm install` is required — Bun runs the TypeScript directly and its test
runner is built in.

## Core concepts

- **`Stat`** — a dotted trait backed by an auditable ledger (`AuditLog`), with
  creation-phase vs. absolute caps and `StatModifier`s (buffs/debuffs that can
  optionally bypass the cap). `EffectiveValue` is the pool you roll.
- **`Tracker`** (extends `Stat`) — permanent rating + a spendable temporary
  value: Willpower, Resolve, Torment.
- **`Pool`** — a free-floating counter with a max and an optional per-turn spend
  limit: Blood, Quintessence, Paradox.
- **`Dice`** — auditable d10 roller (see below).
- **`DamagePacket`** — an immutable hit: `Severity` (harmless…fatal) ×
  `Intensity` (the number) × `Kind`s (descriptors) × `Source`. Its mutators
  return copies (see below).
- **`DamageReaction`** — a character's say over an incoming packet
  (`UndeadPhysiology`, `SilverVulnerability`, `ArmorReaction`).
- **`HealthTrack`** — 7-level damage track with wound penalties.
- **`MoralityTrait`** — a Road/Humanity rating (0–10) with degeneration/penance.
- **`TemplateConfig`** + **`CharacterFactory`** — per-splat configuration
  (starting values, soak rules, innate reactions, which sub-systems exist) and a
  builder that enforces those rules.
- **`LiveCharacter`** — the assembled sheet, with `TakePacket`/`TakeDamage`,
  `RollSoak`, `SpendWillpower`, pool helpers, XP/downtime spending and
  `SaveToStory`.

### Dice (`Dice.roll`)

d10 pools, difficulty 6 by default. Successes are dice ≥ difficulty; **1s
subtract** a success; **n-again** explosions re-roll high dice (10-again by
default; `nAgain: 11` disables it, `nAgain: 9` explodes 9s and 10s). Every die
is recorded with a symbol (💣 1, 💥 explode, ✅ hit, ❌ miss) for an auditable
log.

Rules decisions worth knowing:
- A **botch** is judged on the *initial* roll only (zero successes **and** ≥1
  one). A success cancelled by a 1 is a plain failure, never a botch.
- All 1s (including re-rolls) subtract; botch ignores re-rolls.
- Explosion chains are capped at 200 dice as a safety valve.
- An injectable `rng` makes every roll deterministic for tests.

### Damage: packets, and who decides severity

A hit is a **`DamagePacket`** — four *independent* facts, deliberately kept
apart (think D&D's damage typing):

- **`Severity`** — `harmless` / `bashing` / `lethal` / `aggravated` / `fatal`:
  how hard it is to soak and heal. `harmless` deals nothing and `fatal` sits
  above aggravated; the health track marks bashing/lethal/aggravated. (`Severity`
  carries a numeric `Rank` for ordering, plus `IsAtLeast` / `Max` helpers.)
- **`Intensity`** — the plain *number* of health levels the hit threatens.
- **`Kind`(s)** — open-ended descriptors: `piercing`, `slashing`, `silver`,
  `fire`, `sunlight`, … A packet may carry several (a silver bullet is
  `piercing` + `silver`). Any normalized string works; `Kind`/`Source` export
  the common ones as constants.
- **`Source`** — where it came from (`gunshot`, `claw`, `fangs`, `fall`).

The key idea: **severity is not intrinsic to the attack — the target decides.**
Every character owns an ordered list of **`DamageReaction`s** that are folded
over an incoming packet *before* soak, each free to rewrite or ignore parts of
it. `character.TakePacket(packet)` runs that pipeline, then soaks (if the
resolved packet still allows it), then marks the health track; the returned
`DamageReport` includes a `trace` of every reaction that changed the packet.
`character.TakeDamage(severity, intensity, { kinds, source })` is a convenience
wrapper that builds a bare packet for you.

Built-in reactions:

- **`UndeadPhysiology`** (vampires) — piercing/ballistic **lethal → bashing**
  (no organs to destroy, no blood to lose); `fire`/`sunlight` stay aggravated.
- **`SilverVulnerability`** (werewolves) — `silver`/`fire` become **aggravated
  and *unsoakable*** (regeneration can't touch them).
- **`ArmorReaction`** — flat intensity reduction against the kinds it covers
  (a vest eating the first few levels of a gunshot). Add per-character via
  `CharacterFactory.create(…, { reactions: [new ArmorReaction("Vest", 3, ["piercing"]) ] })`.

The same gunshot (`4 lethal {piercing} from gunshot`), four ways:

| Target | Resolves to | Why |
| --- | --- | --- |
| Mortal | 4 **lethal**, unsoakable → 4 land | no downgrade; mortals can't soak lethal (armour is the only out) |
| Vampire | 4 **bashing**, then soak | `UndeadPhysiology` talks the bullet down |
| Werewolf | **soaked away** | alive, so still lethal — but Stamina soaks all of it |
| Werewolf + silver | 4 **aggravated**, unsoakable → 4 land | `SilverVulnerability`: good luck |

The health track itself is a standard 7-level track (Bruised → Incapacitated).
On a full track the **wrap-around upgrade** rule applies: a more-severe hit
replaces the least-severe wound, otherwise the least-severe wound is upgraded a
step (bashing → lethal → aggravated); damage past a full aggravated track is
`Overkill`.

Soak rules are per-template data (`SoakSpec`): for each severity, whether it's
soakable and which traits form the dice pool. Out of the box:

| Template | Bashing | Lethal | Aggravated |
| --- | --- | --- | --- |
| Mortal / Thrall / Mage | Stamina | — | — |
| Vampire | Stamina + Fortitude | Stamina + Fortitude | Fortitude only |
| Demon / Werewolf | Stamina | Stamina | Stamina |

> The **Werewolf** template is a modern-WoD illustration (not Dark Ages canon),
> included so the kind/severity system has a regenerator — and a silver
> weakness — to show off.

### Templates & starting values

`CharacterFactory.create(template, name, options)` validates the
per-template starting-value constraints. Examples baked in:

- **Thrall** — Resolve is locked to **1** (`startMin == startMax == 1`).
- **Demon** — Resolve starts in the **3–5** band, plus a **Torment** tracker.
- **Vampire** — Blood pool max/turn derived from **Generation**; Road rating
  derived from Virtues; Willpower derived from Courage.
- **Mage** — **no** Road/Humanity and **no** Virtues; has Quintessence + Paradox.

```ts
import { CharacterFactory, TEMPLATE_VAMPIRE, DamagePacket, Kind, Source } from "./src/wod";

const dracula = CharacterFactory.create(TEMPLATE_VAMPIRE, "Dracula", {
  generation: 8,
  attributes: { stamina: 3 },
  traits: { fortitude: 2 },
  virtues: { conscience: 2, "self-control": 3, courage: 4 },
});

// A bullet: lethal + piercing. Dracula's UndeadPhysiology talks it down to
// bashing, then he soaks it with Stamina + Fortitude.
const bullet = DamagePacket.of({
  intensity: 5, severity: "lethal", kinds: [Kind.PIERCING], source: Source.GUNSHOT,
});
const report = dracula.TakePacket(bullet);
report.severity; // "bashing"
report.trace;    // [{ reaction: "Undead physiology", from: "5 lethal …", to: "5 bashing …" }]

dracula.TakeDamage("lethal", 5); // bare packet: rolls Stamina + Fortitude to soak
dracula.SpendWillpower(1);
dracula.SaveToStory();
```

## Status / notes

- Starting values, soak tables and the generation→blood table are **data** —
  tweak the `TEMPLATE_*` / `*_SOAK` constants to match your table's house rules.
- Disciplines/Spheres/Lores and the magic systems are not modelled yet; soak
  reads "Fortitude" (and any trait) from a generic `Traits` map so they can be
  layered in later.
