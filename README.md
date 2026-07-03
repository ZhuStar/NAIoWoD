# NAIoWoD

Attempting to implement **World of Darkness** (Storyteller system, _Dark Ages_
flavour) for NovelAI — a foundation for single-player games run by the AI as
Storyteller. This repository is the rules engine: characters, dice, health,
damage, soak, resource pools and morality. UI and game loop come later.

## Layout

| Path | What |
| --- | --- |
| `src/host.ts` | NovelAI API contract + the off-host mock — the only module that touches `globalThis`. |
| `src/core/` | Pure mechanics (`traits`, `dice`, `damage`) — no host imports. |
| `src/rules.ts` | The Dark Ages **data**: templates, soak tables, disciplines, merits, the SRD lorebook seed. |
| `src/services.ts` | Storage/Lorebook managers, merit registry, lorebook parser. |
| `src/game.ts` | `LiveCharacter`, factory, character store, `[[…]]` command router. |
| `src/index.ts` | Re-exports everything + `init()` — the one entry point with side effects. |
| `src/main.ts` → `dist/wod.naiscript` | Bundle entry → **the deployment artifact** (see below). |
| `docs/novelai-api.md` | **Working reference for the NovelAI scripting API** (plus the full official docs mirrored as `docs/*.html`). |
| `test/system.test.ts` | The Bun test suite. |
| `types/bun-test.d.ts` | Ambient shim so `tsc` can check tests without installing `bun-types`. |

### One artifact, many modules

NovelAI's runtime is a single, import-free context that injects a global
`api`. That's a **deployment** constraint, not a source one: the code is
ordinary ES modules with a strict layering (`core` → `rules` → `services` →
`game`), and `bun run build` bundles them into one IIFE with the `.naiscript`
frontmatter prepended. **To deploy, paste the contents of
`dist/wod.naiscript` into NovelAI.** Off-host (tests, local runs) the mock in
`src/host.ts` yields to a real host-provided `api` when one exists, and
importing the engine has **no side effects** — everything host-facing happens
in `init()`, which the built artifact calls.

## Commands

```bash
bun test          # run all tests
bun run typecheck # tsc --noEmit
bun run build     # build dist/wod.naiscript (the paste-into-NovelAI artifact)
```

No `npm install` is required — Bun runs the TypeScript directly and its test
runner is built in.

## Core concepts

- **`Stat`** — a dotted trait backed by an auditable ledger (`AuditLog`), with
  creation-phase vs. absolute caps and `StatModifier`s (buffs/debuffs that can
  optionally bypass the cap). `EffectiveValue` is the pool you roll.
- **`Tracker`** (extends `Stat`) — permanent rating + a spendable temporary
  value: Willpower, Resolve.
- **`Pool`** — a free-floating counter with a max and an optional per-turn spend
  limit: Blood, Quintessence.
- **`Dice`** — auditable d10 roller (see below).
- **`DamagePacket`** — an immutable hit: `Severity` (harmless…fatal) ×
  `Intensity` (the number) × `Kind`s (descriptors) × `Source`. Its mutators
  return copies (see below).
- **`DamageReaction`** — a character's say over an incoming packet
  (`UndeadPhysiology`, `SilverVulnerability`, `ArmorReaction`).
- **`HealthTrack`** — square-based damage track: per-square wound penalties,
  condition-linked boxes (poisoned…), heal policies (`never`/`special`) and
  per-box heal costs (`HealWithPoints`). Simple use is unchanged.
- **`MoralityTrait`** — a 0–10 rating with a **polarity**: *descending*
  (Humanity, lost at 0) or *ascending* (Torment, unplayable at 10);
  `Degenerate()` always moves toward the bad extreme.
- **`DISCIPLINES`** — the registry of vampiric powers (Potence, Fortitude,
  Celerity, Auspex …) as rated traits; Potence & Fortitude are wired (see below).
- **`TemplateConfig`** + **`CharacterFactory`** — per-splat configuration
  (starting values, soak rules, innate reactions, which sub-systems exist) and a
  builder that enforces those rules.
- **`LiveCharacter`** — the assembled sheet, with `TakePacket`/`TakeDamage`,
  `Roll` (folds in Potence/bonus-dice), `RollSoak`, `SpendWillpower`, pool
  helpers, XP/downtime spending and `SaveToStory`.

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
| Mortal / Thrall / Mage / Ghoul | Stamina | — | — |
| Vampire | Stamina + Fortitude | Stamina + Fortitude | Fortitude only |
| Demon / Werewolf | Stamina | Stamina | Stamina |

> The **Werewolf** template is a modern-WoD illustration (not Dark Ages canon),
> included so the kind/severity system has a regenerator — and a silver
> weakness — to show off.

### Templates & starting values

`CharacterFactory.create(template, name, options)` validates the
per-template starting-value constraints. Examples baked in:

- **Thrall** — Resolve is locked to **1** (`startMin == startMax == 1`).
- **Demon** (_Dark Ages: Devil's Due_) — Resolve starts in the **3–5** band,
  plus an **ascending Torment morality** (climbs toward an unplayable 10).
- **Vampire** — Blood pool max/turn derived from **Generation**; Road rating
  derived from Virtues; Willpower derived from Courage.
- **Mage** — **no** Road/Humanity and **no** Virtues; has Quintessence (no
  Paradox in this line). Magic is **Foundation & Pillars** — traits, modelled
  with the other powers later.
- **Ghoul** — a mortal (Road/Humanity + Virtues, mortal soak) plus a **Blood**
  pool it doesn't generate (fed by a domitor, starts empty). Also 2 Discipline
  dots incl. Potence at creation — pending the powers system, seed via `traits`.

```ts
import { CharacterFactory, TEMPLATE_VAMPIRE, DamagePacket, Kind, Source } from "./src";

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

## Disciplines

Disciplines are rated traits (0–5) on a character (`character.Disciplines`),
seeded at creation via `disciplines: { potence: 1, fortitude: 2 }`. The
`DISCIPLINES` registry is metadata — each entry's `arena` and the Dark Ages
clans that hold it **in-clan** (for the future advancement-cost engine).

Two have real mechanics today:

- **Potence** → `character.Roll(pool, { potence: true })` adds its rating as
  **automatic successes** (see `Dice.roll`'s `automaticSuccesses`, which also
  averts botches — the same hook a spent Willpower would use).
- **Fortitude** → lets a character **soak a severity their template can't**
  (e.g. a ghoul soaking lethal), adding its rating in dice. It's never
  double-counted for a vampire that already soaks lethal.

Everything else (Celerity, Auspex, Dominate, …) is a rated dot plus the generic
`character.Roll(pool, { bonusDiceFrom: ["celerity"] })` bonus-dice hook, until
per-power effects and a turn system exist.

## Storage & Lorebook — the editable database

The engine talks to NovelAI through two managers (both mirroring the real
scripting API, which is async and — for lorebook entries — filtered by
category *id*):

- **`StorageManager`** — namespaced storage. Every key is prefixed with a uuid
  (the script id by default): `get`, `getOrDefault`, `set`, `setIfAbsent`,
  `has`, `delete` — all async, written into the story via `api.v1.storyStorage`
  — plus `tempGet`/`tempSet`/`tempGetOrDefault`/`tempSetIfAbsent`/`tempHas`/
  `tempDelete`, the same async API against **`api.v1.tempStorage`**:
  session-scoped scratch, cleared when the story closes — for UI sync or state
  you don't want kept. (`api.v1.historyStorage` — story-scoped **and**
  history-aware, reverting on undo — is in the contract and earmarked for
  mechanical state like damage and pool spends.) `SaveToStory()` writes
  through it.
- **`LorebookManager`** — reads lorebook entries as *data*, so the user can
  edit game rules like database tables in the NovelAI lorebook UI. It resolves
  category **names** to ids via `categories()`, then filters entries.

### Self-seeding: the lorebook *is* the tutorial

A fresh NovelAI story has none of these categories. On load the script calls
**`LorebookManager.bootstrap()`**, which **creates any missing SRD category and
seeds it** (`createCategory`/`createEntry`) with starter data. Each entry opens
with **instructions written into the card itself**, then a marker line, then the
data — so the game teaches itself in-app instead of sending you to this README.
Categories that already exist are left untouched (your edits are safe), and
`bootstrap()` is idempotent; when it creates anything it returns a player-facing
`((OOC — Storyteller setup))` note.

**Entry format.** On read, everything **above a `=====` marker line** (≥3 `=`)
is a human header and is ignored; the data is what follows. In list entries,
`#`/`//` start line comments and `/* */` are block comments — so players can
annotate freely. `LorebookManager.parseList()` / `contentBelowHeader()` handle
this; entries with no marker are read whole (backward compatible).

Conventions (defined in `SRD_CATEGORIES`, installed by `bootstrap()`):

| Category | Entry | Data below the marker |
| --- | --- | --- |
| `srd:abilities` | `srd:abilities:talents` / `:skills` / `:knowledges` | one ability per line |
| `srd:backgrounds` | `srd:backgrounds:all` | one background per line |
| `srd:merits-flaws` | `srd:merits-flaws:custom` | JSON array of merit/flaw definitions |

`LorebookManager.allTalents()` etc. return those lists;
`LorebookParser.ParseFromApi()` (async) builds zero-dot `Stat` maps from them.

## Player commands & character creation

In adventure mode, `[[…]]` blocks in the input box are commands. The
`onTextAdventureInput` hook extracts each one, dispatches it through
`CommandRouter`, and replaces it with a single-line `((OOC-Storyteller: …))`
note; if the input contained *only* commands, generation is suppressed (you're
operating the system, not the story).

```
[[creator-mode set=true]]
[[create-playable name="Erik the Red" templates="vampire,werewolf,mage"]]
[[creator-mode set=false]]
```

- **`create-playable`** makes a *potential* character: a name, one or **more**
  templates (hybrids are stored as-is; how they merge is resolved later at
  build time), and every allocation bucket empty. Unknown templates are
  rejected with the valid list; duplicate names are refused.
- The character is written to **both** a lorebook entry
  (`pc:<name>` in the `wod:player-characters` category — instructions above a
  `=====` marker, the sheet as JSON below it) and `storyStorage`. **The
  lorebook entry is the source of truth.**
- **`creator-mode set=true`** lets the player edit those entries directly;
  edits are synced **lorebook → storage** whenever a command runs and when
  creator mode is turned off. Unparseable edits are reported and skipped, never
  synced. The script's own writes (`CharacterStore.save`) go lorebook-first.

🚧 Next for creation: allocation commands (attributes/abilities/etc.),
multi-template resolution, and turning a finished sheet into a `LiveCharacter`.

## Merits & Flaws

Defaults live in `DEFAULT_MERITS_FLAWS` (an in-code list served by
`MeritFlawRegistry`); the lorebook overlays it —
`MeritFlawRegistry.loadFromLorebook()` merges any JSON definitions found in
`srd:merits-flaws`, so custom content needs no code change.

```ts
const sasha = CharacterFactory.create(TEMPLATE_GHOUL, "Sasha", {
  tags: ["revenant", "zantosa"],          // free-form prerequisite tags
  meritsFlaws: ["Acute Senses", { name: "Hunted" }],
});
sasha.AddMeritFlaw("Sturdy Stock");        // ok: requires the "revenant" tag
sasha.AddMeritFlaw("Eat Food", { waivePrerequisites: true }); // ST override
sasha.MeritPointsSpent; sasha.FlawPointsGained; // for the future freebie engine
```

- **Prerequisites** (`requires`) may name `templates` (any-of, matched against
  the template name or a tag), `tags` (all-of — `toreador`, `revenant`,
  `inconnu`, …) and other `meritsFlaws` (all-of). `MeetsRequirements` reports
  every unmet item; `waivePrerequisites: true` skips the check case-by-case.
- **Points** are a number or an array of allowed ratings (variable-cost
  merits/flaws validate the chosen value). Merits total into
  `MeritPointsSpent`, flaws into `FlawPointsGained`.
- 🚧 Mechanical *effects* of merits/flaws (dice/difficulty tweaks) aren't wired
  yet — that's the effects layer, coming with the cost engine.

## Status / notes

- Starting values, soak tables and the generation→blood table are **data** —
  tweak the `TEMPLATE_*` / `*_SOAK` / `DISCIPLINES` constants for house rules.
- 🚧 Per-power Discipline effects, Mage's Foundation & Pillars, and Lores are
  not modelled yet — only the rated traits and the two hooks above. Character
  creation doesn't yet *enforce* Discipline-dot rules (e.g. a ghoul's free
  Potence).
