# NAIoWoD

Attempting to implement **World of Darkness** (Storyteller system, _Dark Ages_
flavour) for NovelAI — a foundation for single-player games run by the AI as
Storyteller. This repository is the rules engine: characters, dice, health,
damage, soak, resource pools and morality. UI and game loop come later.

## Layout

| Path | What |
| --- | --- |
| `CLAUDE.md` + `docs/memory.md` | **The project's externalized memory** — session bootstrap + the fine-grained map of everything (files/classes/functions, state, decisions & rationale, roadmap). Updated in the same commit as any change it describes. |
| `src/host.ts` | Release-safe glue over the host API: the project logger + two aliases over ambient types. Declares **no** NovelAI types (those are ambient, below). |
| `src/host-mock.ts` | The off-host in-memory `api` + test hooks (`__reset*`/`__ui*`). Installs `globalThis.api` when no real host exists. **Test-only — never in the release.** |
| `src/core/` | Pure mechanics (`traits`, `dice`, `damage`, `time`) — no host imports. |
| `src/wizard.ts` | Medium-agnostic wizard engine (structured prompts; text renderer now, modals later). |
| `src/rolls.ts` | Pure roll machinery: specs, pool expressions, tag modifiers, extended-roll state machine. |
| `src/rules.ts` | The Dark Ages **data**: templates, resources + the effect grammar, roads, disciplines, merits, SRD seeds. |
| `src/command.ts` | The command bus: parser, **CommandSpec** (each verb's declarative grammar — help text is derived from it, windows compose from it), `composeCommand`, and the hook-extensible router. |
| `src/services.ts` | Storage/Lorebook managers, merit registry, lorebook parser, and the **generic config stores** every `wod:config` registry instantiates. |
| `src/state.ts` | The character model and every persistent store: playable characters, named/extended rolls, contests, players & aliases, config registries, live per-character state (resources, health, boosts, uses, afflictions). |
| `src/game.ts` | The verbs: effect interpreter, wizards, every `[[…]]` command handler + its spec registration. |
| `src/window.ts` | `api.v1.ui` windows that **emit commands** (no second path) — forms are rendered *from the CommandSpec*; the first is `[[win-constraint]]`. |
| `src/index.ts` | Re-exports everything + `init()` — the one entry point with side effects. |
| `src/main.ts` | Runtime entry — boots the engine by calling `init()` (runs last in the built artifact). |
| `scripts/build-single.ts` → `dist/naiowod.ts` | Concatenates `src/*` into one readable, editable TS file — **the deployment artifact** (see below). |
| `docs/novelai-api.md` | **Working reference for the NovelAI scripting API** (plus the full official docs mirrored as `docs/*.html`). |
| `test/` | The Bun test suite (`system.test.ts`; `build.test.ts` keeps `dist/naiowod.ts` in sync with `src/` and guards that the release redefines no NovelAI type). |
| `types/novelai/script-types.d.ts` | **NovelAI's own type declarations, vendored** — the ambient source of truth (`api`, `UIPart*`, `WindowOptions`, `LorebookEntry`, …). Our code checks against these; the release redefines none of them. |
| `types/` | Also holds ambient shims so `tsc` can check tests and scripts without installing `bun-types`. |

### One artifact, many modules

NovelAI's runtime is a single, import-free context that injects a global
`api`. That's a **deployment** constraint, not a source one: the code is
ordinary ES modules with a strict layering (`core` → `rules` → `command` →
`services` → `state` → `game` → `window`), and `bun run build` concatenates them **in dependency order** into one
readable, editable TypeScript file — `dist/naiowod.ts` — stripping the
inter-module `import`/`export` wiring. It is **not** minified or bundled: every
declaration keeps its original source, so the single file reads like the modules
laid end to end (with `//#region` markers per module). The file is committed and
kept honest by `test/build.test.ts`, which fails the suite if it ever drifts
from `src/`. **To deploy, paste the contents of `dist/naiowod.ts` into NovelAI's
script editor — it's plain TypeScript, nothing else needed.** (A `.naiscript`
YAML frontmatter header, with an embedded script id, is only for
exporting/importing scripts; pasting doesn't use it.)

**The release redefines no NovelAI type.** The host injects a global `api` and
all of its types; we vendor NovelAI's own declarations at
`types/novelai/script-types.d.ts` and treat them as ambient, so `src/` uses the
real `UIPart`/`WindowOptions`/`LorebookEntry`/… (checked by `tsc` against
reality) and the concatenated artifact declares **none** of them — pasting it
into an editor that already knows those types can't collide. The off-host mock
(`src/host-mock.ts`) is **not** part of the artifact; on-host the real `api` is
already global. Importing the engine has **no side effects** — everything
host-facing happens in `init()`, which the built artifact calls last. (Tests and
local scripts `import "../src/host-mock"` first to install an in-memory `api`.)

## Commands

```bash
bun test          # run all tests
bun run typecheck # tsc --noEmit
bun run build     # regenerate dist/naiowod.ts (the paste-into-NovelAI artifact)
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
  affliction-linked boxes (poisoned…), heal policies (`never`/`special`) and
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
| Mortal / Thrall / Mage | Stamina | — | — |
| Vampire | Stamina + Fortitude | Stamina + Fortitude | Fortitude only |
| Ghoul / Revenant / Ouroboros | Stamina + Fortitude | Stamina + Fortitude | Fortitude only |
| Demon / Werewolf | Stamina | Stamina | Stamina |

> Ghouls and revenants, though alive, **soak lethal with Stamina + Fortitude** —
> the rules just say so; the vitae in their veins does the knitting.

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
- **Ghoul** — a mortal (Road/Humanity + Virtues) with ghoul soak plus a
  **Blood** pool it doesn't generate (fed by a domitor, starts empty). Also 2
  Discipline dots incl. Potence at creation — pending the powers system, seed
  via `traits`.
- **Revenant** — born ghouled: same soak and Disciplines, but the Blood pool
  starts **full** and **brews itself back — 1/day on the story clock** (a
  `recovery` rule; see *Recovery and the moon*).
- **Ouroboros** — a **unique** template (one creature in the world): revenant +
  *laham* + Awakened Hermetic, whose four fuels are fused into **Living
  Resolve**. Like a mage he has **no Road/Humanity and no Virtues**. See *The
  Ouroboros & Living Resolve*.

Templates also carry an **`Awakened`** flag (Mage, Ouroboros). Places of power —
sanctum, library, cray — answer only to the Awakened.

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

- **`ScopedStorage`** — namespaced storage. Every key is prefixed with a uuid
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

### Tracked cards, backups & reconciliation

Every card the engine writes is **tracked**: its category/entry uuids live in
a storyStorage id map, and its full text is **backed up** on every write and
every healthy sighting. Virtual paths (`config`, `config::success-tables`,
`config::success-tables::<sub>`) map to flat real categories (`wod:config`,
`wod:config:success-tables`, …), each with a default **`general`** card —
NovelAI has no nested categories, so the Lorebook module maintains the
illusion. If you delete a tracked card and recreate it with the **same
structure** (the hash ignores the tutorial header), the engine silently adopts
your new card. If the content **differs**, or the card is simply **gone**, a
**modal** asks what to do: keep the new card / combine both (your newer
definitions win) / restore the old one — or restore-from-backup / forget it.
Reconciliation runs at `init()` and on every creator-mode sync, and each
distinct drift asks at most once per session.

### Self-seeding: the lorebook *is* the tutorial

A fresh NovelAI story has none of these categories. On load the script calls
**`LorebookManager.bootstrap()`**, which **creates any missing SRD category and
seeds it** (`createCategory`/`createEntry`) with starter data. Each entry opens
with **instructions written into the card itself**, then a marker line, then the
data — so the game teaches itself in-app instead of sending you to this README.
Categories that already exist are left untouched (your edits are safe), and
`bootstrap()` is idempotent; when it creates anything it returns a player-facing
`[SYSTEM: Storyteller setup]` note.

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
| `srd:merits-flaws` | `srd:merits-flaws:custom` | merit/flaw definitions in card text |

`LorebookManager.allTalents()` etc. return those lists;
`LorebookParser.ParseFromApi()` (async) builds zero-dot `Stat` maps from them.

### Card text — the language every card is written in

Structured cards (sheets, config registries, merits, saved rolls, success
tables) are **not JSON**. They are written in a small format meant to be typed
and read by a person — `src/core/cardtext.ts`, hand-rolled because the artifact
ships with zero dependencies:

```
# who he is
name: Visvaldas
templates: ouroboros
tags: revenant, awakened

attributes:
  Strength: 3
  Wits: 5

abilities:
  Occult: 5
    specialty: Hermetic Theory      # indented under the skill it is on

backgrounds:
  Sanctum: 8
  Mentor: 4
    note: Velia, the Rafastio Matriarch
  Mentor: 2                          # the SAME key again = two Mentors
    note: Belial
```

The whole grammar:

- **`key: value`** — the key ends at the first `": "` (or a trailing `:`), so
  `he said: hello` is a value with a colon in it, and `trait-affinity:melee: 3`
  keys on the whole instance name.
- **Indentation nests.** A key with nothing after the colon takes whatever is
  indented below it. A key *with* a value that also has an indented block keeps
  its value and gains annotations (internally the value sits under `value`) —
  which is why nothing needs a separate `name:` field: **the key is the key**.
- **A repeated key is a list.** Two `Mentor:` lines are two Mentors. This is
  the thing JSON could not express at all.
- **Commas make a list** (`tags: revenant, awakened`), **except** in a handful
  of text keys (`description`, `note`, `label`, `name`, …) where a comma is
  just punctuation. Conversely a handful of list keys (`tags`, `roles`,
  `templates`, `passive`, …) are always a list, so one item needs no syntax.
- **`- ` starts a list item**, and lines indented under it belong to it:
  ```
  passive:
    - op: immune
      target: possession, soul-control
    - op: difficulty
      amount: -2
  ```
- **Scalars type themselves**: `3` is a number, `yes`/`no` are booleans, `none`
  is null, everything else is text **with its case preserved**. Quote (`"…"`)
  to force text; the writer quotes for you whenever it would be misread.
- **`#` starts a comment** at the start of a line or after a space.
- The engine's camelCase fields are written with hyphens — `difficulty-expr`,
  `at-most-one-at`, `requires-resource` — and either spelling is accepted.

Names are yours: write `Animal Ken`, not `animal-ken`. The engine normalizes on
the way in and title-cases on the way out. One caveat worth knowing: when the
engine rewrites a card (any command that changes the character), it writes the
**data** — your `#` comments are not preserved, so put anything you want kept
in a `note:` instead.

**Coming from an older story?** Cards written before this format hold JSON, and
nothing reads that any more. Run **`[[convert-cards]]`** once: it rewrites every
`wod:`/`srd:` card that still holds JSON, keeps your header text, and re-syncs.
It is idempotent and leaves anything already converted alone.

### What a dot costs — `[[costs]]`

Prices are **chronicle rules, not character data** — the same for every sheet —
so they are not on the sheet. `[[costs]]` lists them per purse (`experience`,
`freebie`, `maturation`), `[[costs <kind>]]` shows one, and the
`wod:config:costs` card overrides one price at a time:

```
attribute:
  experience: current x 5
```

Values are **text**: there is no advancement engine yet, so the engine records
and surfaces them and the Storyteller applies them — the standing rule for a
subsystem that doesn't exist.

## Player commands & character creation

In adventure mode, `[[…]]` blocks in the input box are commands. The
`onTextAdventureInput` hook extracts each one, dispatches it through
`CommandRouter`, and replaces it with a single-line **`[SYSTEM: …]`** note (the
engine's mechanical voice — distinct from the in-fiction ST/character voices).
Generation is then suppressed for the turn (`stopGeneration`) when the input was
*only* commands, **or** when any command was a **read-only query** (`help`,
`characters`, `sheet`, `resources`, `health`, `merits`, `tables`, … — the
`QUIET_VERBS` in `game.ts`): querying the system never makes the AI narrate,
even with prose around it. An in-fiction action (`roll`, `spend`, `damage`, …)
wrapped in prose still generates.

```
[[create-playable name="Erik the Red" templates="vampire,werewolf,mage"]]
[[play name="Erik the Red"]]
[[roll dexterity+stealth 6 requires=2 tags="off-hand"]]
```

Parsing and dispatch are separate: **`CommandParser`** turns a body into
`{ name, positional[], named{} }` (positional and named args), and
**`CommandRouter`** is a verb→handler registry — so adding a command is one
`register()` call (and could be lorebook-defined later).

- **`create-playable`** makes a *potential* character: a name and one or
  **more** templates (hybrids are stored as-is; how they merge is resolved later
  at build time). The sheet is seeded — all nine **Attributes at 1**, every
  **Ability at 0**, **Willpower at 0**, empty Merits/Flaws & Backgrounds — the
  rest is allocation space. Unknown templates are rejected with the valid list;
  duplicate names are refused. The **first** character created becomes your
  **default** (and current) automatically.
- The character is written to **both** a lorebook entry (`pc:<name>` in the
  `wod:player-characters` category — instructions above a `=====` marker, the
  sheet as JSON below it) and `storyStorage`; its `id` is a UUID that stays its
  identity for good. **The lorebook entry is the source of truth.**
- **`creator-mode set=true`** lets the player edit those entries directly; edits
  sync **lorebook → storage** whenever a command runs and when creator mode is
  turned off. Unparseable edits are reported and skipped, never synced.
  > ⚠️ **Edits made while creator mode is OFF are not picked up.** The router
  > deliberately doesn't re-read the lorebook on every command, so a hand-edited
  > sheet stays invisible until you turn creator mode on (the next command syncs
  > it) or off again. That — and a stray **trailing comma**, which makes the JSON
  > unparseable — are the two reasons a trait you *can see in the card* reads as
  > 0. `[[sheet]]` always shows what the engine actually has, and `[[cast]]`
  > says so when it refuses.
  **Manual fill works today**: with creator mode on, open the `pc:<name>`
  entry and edit the JSON below the `=====` line — set attribute/ability dots,
  add keys to any numeric bucket (anything there is rollable by name), set
  `poolStarts` (e.g. `"willpower": 5` — resources start there), add
  `specialties`/`meritsFlaws`. Keep the header and marker line intact, and
  don't touch `id`/`name` (they're the identity).
- **`sheet [name]`** shows a character's record **as the engine reads it** —
  every numeric bucket, merits, specialties — with the *effective* value
  marked wherever enhancements or boosts change what a roll will use
  (`strength 1 (3 eff)`). It's the verification half of the manual-fill loop:
  edit the JSON, run `[[sheet]]`, see exactly what synced.
- **`play name="…"`** selects who to act as; **`play`** with no name hands
  control back to the default. **`roll <pool> …`** rolls for the current
  character; **`roll-for "Name" <pool> …`** rolls on another character's behalf
  without changing the selection.
- **`characters`** lists your playable characters (marking current and default);
  **`set-default name="…"`** changes which one `play` returns to. **`help`**
  lists every command, and **`help <verb>`** shows one command's usage.

### Normalization — one internal form for every string

Every string that enters the engine — command arguments and lorebook data alike
— is normalized at the boundary. `"Alice and Bob"`, `"alice and bob"` and
`"ALIcE and BoB"` are all the same string to the engine: `alice-and-bob`;
`"  Animal     Ken"` is `animal-ken`. The rules:

- **lowercase**, trimmed;
- spaces immediately after **`@`** are removed (`@ sire` → `@sire`);
- **`::`** is the **path separator** — spaces around it are removed and it
  normalizes to `:` internally (`blood :: heal` → `blood:heal`). Write paths as
  `spend=blood::heal`, `@char::erik::sire`; a plain unspaced `:` still works
  since both forms meet at the same internal `:`;
- spaces next to **`,`** and **`+`** are removed (`"a, b"` → `a,b`,
  `"strength + brawl"` → `strength+brawl`);
- any remaining run of whitespace becomes a single **`-`**.

Strings in **backticks are literals** and skip normalization entirely — use
them for display text that must keep its case and spacing:
``label=`Force the Door` ``. Replies render normalized names in Title Case
(`erik-the-red` shows as "Erik The Red").

### Aliases & players — @names for characters

An **alias** is an `@`-prefixed name for a character (character names can never
start with `@`, so aliases can't shadow them). Aliases live in **three scopes**,
resolved most-specific-first: **per-character** (in-character knowledge —
`@sire` means someone different to each childe; owners may be NPCs with no
sheet), **per-player** (incl. the storyteller), and **global**. The registry
persists in story storage.

```
[[alias @kat "Katarina"]]                      # bare token = global
[[alias @player::storyteller::boss "Sela"]]    # pin a scope explicitly
[[alias @char::erik::sire "Katarina"]]         # @char:: or @character::
[[play @kat]]  [[roll-for @sire 3]]  [[resist 4 3 vs="@boss"]]
[[aliases]]  [[forget-alias @kat]]
```

- A bare `@alias` walks the chain: the **current character's** aliases, then the
  **current player's**, then global. Explicit-scope owners accept `default`
  (`@char::default::…` = the default character; `@player::default::…` = the
  default player) and `storyteller` is always a valid player.
- **`player`** shows the current/default player; **`player name="…"`** switches
  (add `default=true` to also make it the default). Players are plain ids — the
  engine's first identity concept, defaulting to `storyteller`.
- Position decides what `@` means: in a **pool** slot it's a saved roll
  (`[[roll @dodge]]`); in a **character** slot it's an alias (`[[play @kat]]`).

### The roll command

`[[roll <pool> [difficulty] [difficulty-mod] requires=N dice-modifier=±N tags="a,b"]]`

- **pool** — one token summed on `+`: a number, `number+number`, a trait
  (`brawl`), `trait+trait` (`strength+brawl`), or a tracker (`willpower`). Traits
  resolve against the selected character (0 if absent).
- **difficulty** (default 6) and its **modifier** may be positional *or* named
  (`difficulty=`, `difficulty-modifier=`; named wins). Difficulty can be a plain
  number **or an expression** — a trait or calculation evaluated against the
  roller (`difficulty=stamina+3`, `difficulty=6+2`); a bare integer stays a
  number. A final difficulty above 10 isn't clamped away — each point over 10
  costs one extra required success.
- **`requires`** (default 1) is the successes needed; **`dice-modifier`** adds or
  removes dice; **`tags`** are contextual keys matched against the
  `RollModifierRegistry` (e.g. `acute-senses` → −2 difficulty, `willpower` → +1
  automatic success) — the hook for rules-driven modifiers like Merits & Flaws.

### Minimum difficulty — a floor per roll, and one for the chronicle

Reductions stack, and a well-fuelled character can talk a difficulty down to
nothing. Two floors stop that, and **neither exists until you ask for one**:

- **Per roll** — `min-difficulty=N` on `[[roll]]`, `[[roll-for]]`,
  `[[extended-roll]]` or `[[name-roll]]` (saved with the roll, so `@name`
  carries it).
- **Chronicle-wide** — `min-difficulty` in the **`wod:config:rolls`** card.
  Leave it out and rolls have no floor at all; set it and *every* roll respects
  it. A roll that names its own floor overrides the chronicle's, in either
  direction.

The floor binds **after** every modifier, and the reply says so:
`difficulty 3 raised to the minimum 6`. (The engine's own hard minimum of 2
always applies — a target of 1 would make every die a success.)

> Not the same as `min-difficulty` in `wod:config:magic`, which is how far
> **Quintessence** may talk a *spell's* difficulty down. That one bounds a
> spend; this one is the die target's floor.

### Named rolls

Save a roll once, then fire it by name — tweaking pieces on the spot. Saved
rolls are a single **chronicle-wide library**, stored as an editable JSON map in
the `wod:named-rolls` lorebook entry.

```
[[name-roll dodge dexterity+dodge 6]]
[[roll @dodge]]
[[roll @dodge difficulty=8 dice-modifier=+1]]
[[roll-for "Sela" @dodge]]
```

- **`name-roll <name> <pool> …`** saves a roll (same grammar as `roll`), and can
  bake in sidecars: **`spend=`** (e.g. `[[name-roll gutcheck stamina+courage 8
  spend=willpower]]`), **`specialty=`**, **`table=`** (the success table
  read against the outcome whenever the roll is invoked), a **`description=`**
  (verbatim rules text, shown by `roll-info`), and the **extended** knobs
  (`extended=true`, `intervals=`, `interval=`, `on-botch=`) that turn it into a
  *named procedure* — see below. The pool must be a real expression — a `@name`
  reference can't be saved.
- **`@name`** in any `roll` / `roll-for` loads that saved spec; supplied args
  **override** its difficulty, modifier, `requires`, `dice-modifier` or `tags`
  for that one use (the pool itself is fixed). Saved sidecars apply
  automatically — the spend is **paid**, the specialty adds its die, the table
  reads the outcome — unless the command supplies its own `spend=` /
  `specialty=` / `table=`. This override-merge is the same primitive extended
  rolls reuse for helpers and continuations.
- **`list-rolls`** shows the library (with any saved sidecars, marking any that
  are `[extended]`); **`roll-info <name>`** prints one roll in full — spec, tags,
  table, extended shape, and its description; **`forget-roll <name>`** removes one
  (or just edit the JSON map in the lorebook directly).
- **`[[win-roll]]`** opens the roll **builder window** — see *Windows* below.

### Extended rolls

Some actions take several rolls to finish — you accumulate successes toward a
**target** across up to **N** rolls (intervals), which may be far apart in time.

```
[[extended-roll strength+stamina requires=8 intervals=4 interval="per scene" label="Force the door"]]
[[continue-roll]]
[[continue-roll dice-modifier=+2]]   # helpers arrive
[[roll-status]]
```

- **`extended-roll <pool> requires=<target> intervals=<max> …`** starts the
  action and rolls the first interval as the current character. `requires` is the
  **total** target; `intervals` is the max number of rolls; `interval="…"` is an
  advisory spacing label (shown in status — the Storyteller decides when the next
  roll is allowed); `label`, `on-botch` and the usual roll knobs are optional.
- **`continue-roll [id] …`** rolls the next interval as whoever is current — so
  one character can start and **others continue**. Named overrides
  (`dice-modifier=+2`, `difficulty=`, `tags=`) apply to that one interval, e.g. to
  reflect helpers joining or leaving.
- Each interval adds its net successes; reaching the target **succeeds**, running
  out of intervals **fails**. A **botch** normally fails the whole action —
  `on-botch=lose-successes` (reset progress, keep going) or `on-botch=ignore`
  (waste the interval) change that.
- **`roll-status [id]`** shows progress; **`cancel-roll [id]`** abandons it. State
  persists across turns (story storage) and defaults to the action in progress,
  so you rarely need the id.

### Named procedures — a saved roll that *extends*

A **named procedure** is just a saved roll that has been marked **extended** (and
usually carries a `table` and a `description`). Invoking it launches an extended
action instead of a single roll — the shape (pool, difficulty, tags, table,
default intervals) lives in the save; the **target is supplied at play time**,
because it depends on the fiction (how tall is the wall?).

The engine ships one to start with — **`climbing`**, the first of Dark Ages:
Vampire's *Drama* rolls — seeded into your library on first run (create-if-missing,
so your edits and deletions stick):

```
[[roll-info climbing]]                 # the full Drama text + shape
[[roll @climbing requires=3]]          # wall height / ft-per-success = 3 successes
[[continue-roll]]                      # each interval reads the climbing table
[[continue-roll]]                      # "= 30 so far", then "succeeded"
```

- **Invoke** with **`[[roll @<name> requires=<target>]]`** (`target=` also works).
  `requires` is the *whole* action — for `climbing` it's wall height ÷ ft-per-
  success (the Storyteller's call). Without a target the roll refuses and tells
  you how to give one. `intervals=` overrides the saved max-rolls default;
  `interval=` / `on-botch=` and the usual roll knobs override for that launch.
- Each interval rolls through the **same live modifiers a single roll gets** —
  affliction tags, Trait Enhancement, boosts, the wound penalty, and any owned
  passive gated on the pool's traits **or the roll's tags**. That last part is the
  point of the `climb` tag: a grip-improving power (Protean's Talons, Vicissitude
  bone spurs) can carry a passive `difficulty −2 target:climb` and it will reach
  every climbing interval. Saved rolls are hand-editable JSON, so you can add more
  tags later as new powers need them.
- A **value table** (like `climbing`, 10 ft per success) reads the **accumulated
  distance** so far — *the climb ends when you've climbed the whole distance* —
  while a qualitative table (degrees) reads each interval's own result.
- Author your own with `[[name-roll <name> <pool> … extended=true intervals=<n>
  description=\`…\`]]`, or hand-edit the `wod:named-rolls` entry.

### Contested saved rolls — two-party actions you can name

Resisted and contested rolls (`[[resist]]` / `[[contest]]` / `[[extended-contest]]`)
can be **saved**, so a two-party action like Shadowing, Intimidation or Haggling
becomes a named roll. The save holds *your* side and the opposition's shape; the
**opponent is play-time input** (`vs=`), exactly like an extended roll's target.

```
[[name-roll shadowing dexterity+stealth 6 opposed=resisted vs-pool=perception+alertness]]
[[roll @shadowing vs="the guard"]]        # launches the resisted contest
[[name-roll pursuit dexterity+athletics opposed=contested extended=true intervals=6]]
[[roll @pursuit requires=4 vs="Adolphus"]]  # an extended contest (a race)
```

- **`opposed=resisted`** (your winning margin over theirs counts; a tie fails) or
  **`opposed=contested`** (higher total wins; a tie draws). **`vs-pool=`** is the
  opposition's pool — omit it for a *symmetric* contest where they roll your pool
  (e.g. Strength + Intimidation both sides). **`vs-difficulty=`** sets their
  default difficulty.
- Invoking runs the contest as the current character against **`vs=`** (a
  character, an `@alias`, or a bare label that rolls only literal numbers). Add
  **`opposed=… extended=true`** and the extended knobs to make it an **extended
  contest** — both sides race to a play-time `requires=<target>` (Pursuit's
  head-start-and-chase). Any `table=` reads what your winning margin *means*.

### Multi-stage procedures — one roll, then another

Some activities are a *sequence*: Bribery (identify the official → convince him),
Jumping (jump → on a failure, grab a ledge), Lifting (a Willpower push → consult
Feats of Strength). A saved roll's own spec is **step 1** (the entry); **steps**
are follow-ups that compose *other* named rolls, each firing on a branch of the
entry's outcome.

```
[[name-roll bribery-identify intelligence+politics 5]]
[[name-roll bribery-convince manipulation+commerce 6 opposed=contested vs-pool=willpower]]
[[name-roll bribery intelligence+politics 5]]
[[add-step bribery when=on-success roll=@bribery-convince note=`convince the official`]]
[[roll @bribery]]     # runs step 1, then surfaces: "Next: on-success -> [[roll @bribery-convince]]"
```

- **`add-step <procedure> roll=@<follow-up> when=<always|on-success|on-fail|on-botch>
  note=\`…\`]]`** appends a step; **`clear-steps <procedure>`** drops them (the
  entry roll stays). Steps compose **named rolls** — a follow-up can itself be
  contested or extended.
- Invoking the entry rolls it, then **hands you the exact next command(s)** for
  the branch that fired — the Storyteller or player chooses and runs it. This is
  **advisory** by design (no auto-branching engine yet); `[[roll-info <name>]]`
  lists the whole sequence.

### Success tables — what a number of successes *means*

A roll never interprets its own result. It produces a **count** and hands it to
a **success table** — pure data that says what that count means. The same
machinery covers the classic degrees of success, a discipline's per-success
ladder, and the "direct function" cases (damage and soak are just tables whose
output is a **number**, one level per success).

```
[[roll dexterity+melee table=degrees]]     # 3 successes -> "Complete"
[[roll strength+potence table=damage]]     # 4 successes -> = 4 (levels)
[[tables]]                                  # list them; [[tables damage]] lays one out
```

- A `SuccessTable` (`src/rolls.ts`) has any of: **`rows`** (a `{ at, label, value? }`
  ladder — the highest `at` ≤ the count applies), **`valuePerSuccess`** (the direct
  numeric function), **`cap`** (extras beyond it are *wasted*), **`overflow`** (a
  rule-specified bonus per batch of extras past the last row), and **`botch`** /
  **`failure`** lines.
- Built-ins always present: **`degrees`** (Marginal → Phenomenal), **`damage`** and
  **`soak`** (1 per success), and **`climbing`** (~10 ft per success — the
  `climbing` named procedure reads it).
- **Tables live in their own lorebook category tree** (they outgrew one card):
  the category `wod:config:success-tables` holds bare-named tables, and each
  **virtual subcategory** `<sub>` is the real category
  `wod:config:success-tables:<sub>` whose tables are addressed
  **`<sub>::name`** (NovelAI can't nest categories, so the nesting is
  conceptual — the Lorebook module owns the illusion). Every category has a
  **`general`** card (the default write target); **every card in a category is
  read** — split a big set across extra cards freely, a later card's table
  shadows an earlier one with the same name.
- Authoring, three equivalent ways (all write the addressed category's
  `general` card, JSON array *or* `name → table` map below the `=====` marker):
  - **`[[define-table]]`** — rows use a mini-grammar, backtick-quoted so labels
    keep their case:
    ``[[define-table name="combat::quick-kill" rows=`1:Wounded, 3:Dead` cap=6]]``
    Rows separate on **`;`** when the text contains one, on `,` when it doesn't
    — so a prose label may hold commas:
    ``rows=`1:Authorship present; 4:age, family, and whether he resisted` ``
    (also `value-per-success=`, `overflow-per=`/`overflow-value=`/`overflow-label=`,
    `botch=`, `failure=`, `description=`). A missing subcategory pops a
    **modal** asking to create it; `[[define-table-category name="combat"]]`
    creates one outright. Naming a built-in **shadows** it;
    `[[forget-table <name>]]` removes your general-card entry and the built-in
    (or the shadowing card) resurfaces.
  - **`[[win-table]]`** — the same thing as a window (the form is derived from
    `define-table`'s spec).
  - **Hand-edit the cards** in creator mode.
- **Table aliases**: `[[table-alias @qk "combat::quick-kill"]]` — then
  `table=@qk` anywhere; `[[table-alias]]` lists, `[[forget-table-alias @qk]]`
  removes. Position disambiguates `@` (table slot = table alias), and an alias
  may point at a table that doesn't exist yet (advisory).
- **`table=<key|@alias>`** on any `roll` / `roll-for` / `resist` / `contest`
  reads the result through that table (an unknown key is reported, never applied).

### Resisted & contested rolls

Two rolls, one adjudication. The active character is one side; the opposition is
either **another character** (`vs="Erik"`, who rolls their own pool against their
own traits) or an **ad-hoc** obstacle (`vs="the sturdy lock"`, or no `vs=` at all
— its pool is rolled with only literal numbers counting).

```
[[resist dexterity+stealth 6 perception+alertness vs="Erik"]]
[[contest wits+brawl strength+brawl vs="Rival" table=degrees]]
```

- **`resist <your-pool> <their-pool> [vs="Name"] …`** — *oWoD classic*: only your
  **margin over the resister** counts. A tie, or the resister edging you, means the
  action is simply **resisted** (you fail). Your `difficulty=`, their
  `vs-difficulty=`; `spend=` and `table=` work as on `roll` (the table reads your
  winning margin).
- **`contest <your-pool> <their-pool> …`** — symmetric: the **higher total wins**,
  a tie is a **draw**. A **botched** side counts 0 and is flagged; both botching is
  a mutual disaster.

### Extended contests — first to the goal wins

Both sides **accumulate** toward a shared target across rounds; whoever reaches it
**first** wins (a dead heat in the same round stays open — nobody got there first).

```
[[extended-contest wits+melee wits+melee vs="Erik" target=5 rounds=5 label="Duel of wills"]]
[[continue-contest]]                 # each round re-rolls both sides live
[[continue-contest vs-difficulty=8]] # per-round knobs; yours are difficulty=, tags=, …
[[contest-status]]
```

- **`extended-contest <your-pool> <their-pool> target=<n> rounds=<max> …`** opens it
  and rolls round 1. Each named character re-rolls **live** every round (traits,
  boosts, wound penalty); an ad-hoc side rolls its literal pool. `on-botch` is per
  round: `fail` (default — a botch loses outright), `lose-successes`, or `ignore`.
- **`continue-contest [id] …`**, **`contest-status [id]`**, **`cancel-contest [id]`**
  mirror the extended-roll family; state persists across turns and defaults to the
  contest in progress.

### Time — the story clock

The chronicle runs on a **real Gregorian clock**, so historical Dark Ages dates
work and durations roll over months and years correctly. Dates are written
**`yyyy-mm-dd-hh`** (the hour is optional); the clock is second-granular under the
hood, so the future combat system's 3-second turns will fit. It lives in story
storage (so a later UNDO-rewind migration reaches it) and is seeded with a
default start (`1197-01-01-00`) you override once.

```
[[story-start 1197-03-15-08]]     # when the chronicle begins
[[advance-time 2d 6h]]            # move the clock forward
[[advance-time 1mo]]              # calendar months/years roll over correctly
[[story-date]]                    # "1197-04-17 14:00 — 1 month, 2 days, 6 hours since it began"
[[save-date siege-began]]         # bookmark the current moment...
[[save-date yuletide 1197-12-25-00]]   # ...or an explicit date
[[dates]]                         # list the bookmarks
[[time-between start now]]        # measure any two dates
[[time-between siege-began 1197-12-25-00]]
```

- **`story-start <yyyy-mm-dd-hh>`** sets (or resets) when the story begins; the
  current moment snaps to it.
- **`advance-time <duration>`** moves the clock forward (or back, with a negative).
  Durations are `s`/`m`/`h`/`d`/`w`/`mo`/`y` tokens, combinable: `2w 4h`, `1mo`,
  `90s`, `3 days`. Months and years are calendar-relative (Jan 31 + 1 month =
  Feb 28); the rest are fixed-length. *(The affliction stepper is a separate
  `[[advance]]`; the two will merge once the turn system lands.)*
- **`story-date`** shows the current date and how long since the story began.
- **`save-date <name> [<yyyy-mm-dd-hh>]`** bookmarks the current moment (or a given
  date) under a name; **`forget-date <name>`** drops it; **`dates`** lists them.
- **`time-between <a> <b>`** reports the span between two dates — each a saved
  bookmark, **`now`**, **`start`**, or an ad-hoc `yyyy-mm-dd-hh` — as a natural
  breakdown plus a day total, and says "before" when `b` precedes `a`.

Scenes (below) build on this clock; combat's 3-second turns march it in beats.

### Recovery and the moon

Resources can carry **`recovery` rules** (`RecoveryRule` in `src/rules.ts`):
so-much **per day**, or **per full moon**, optionally gated on an active
affliction — or on **several at once** (`requires: ["full-rested",
"in-sanctum"]` fires only while *both* are on the character). When
`[[advance-time]]` crosses **UTC midnights** or **full-moon instants**, it
credits every character's recovery-bearing resources and reports exactly what it
granted — split advances accumulate correctly (each midnight is counted once,
whichever hop crossed it), and rewinds recover nothing.

```
[[advance-time 3d]]
→ Time advances: … Recovery: Marius +3 living-resolve -> 8/30 (1/day×3).
[[advance-time 8d]]          # crossing a full moon
→ … Recovery: Marius +25 living-resolve -> 30/30 (1/day×8, 🌕 20/full-moon×1).
```

- The **moon is real**: full moons ride the mean synodic cycle (29.530588853
  days, anchored to the 2000-01-06 new moon), which works proleptically in 1197
  and stays within hours of the true phase. `[[story-date]]` shows the next one.
- A rule with **`requires`** fires only while the matching **affliction(s)** are
  active. Three ship as exactly these encoded flags: **`in-umbra`** (nothing
  grants passage to the spirit world *yet* — the gate is ready for when it
  does), **`full-rested`** (eight hours of sleep) and **`in-sanctum`**. Both
  Living Resolve and a mage's Quintessence gain +1/day in the Umbra, and +1/day
  for `full-rested` **and** `in-sanctum` together.
- `[[afflict in-sanctum]]` when he settles in, `[[lift in-sanctum]]` when he
  leaves. The revenant's `1/day` vitae uses the same machinery.

### Scenes — the named unit of play

A **scene** is the book's basic unit: one location, and as many turns as it
needs. Each is **named**, opens at the current story time, and can declare **how
long a Turn is** here — `3s` for combat, or nothing for a freeform dialogue scene
that doesn't move the clock. This makes the six time units concrete on top of the
clock: a **Turn** is `turnLength`, a **Scene** is a clocked span, and **downtime**
glosses the clock forward between them.

```
[[scene "The Parapet" location=`Buda ramparts` turn=3s]]   # open a combat scene
[[turn]]        [[turn 3]]        # march the clock 3s per turn
[[scene "Council of Ashes" location=`the crypt-court`]]    # freeform; auto-closes the parapet
[[turn]]                          # freeform turn — counts, but doesn't move the clock
[[scenes]]      [[scene-info]]    # list / detail (defaults to the open scene)
[[downtime 2d]]                   # close the scene and gloss 2 days forward
```

- **`scene "<name>" [location=\`…\`] [turn=<len>] [chapter=\`…\`]`** opens a named
  scene at the current story instant (it needs the clock set first). A new scene
  **auto-closes** the previous open one. `turn=` takes any duration (`3s`, `1m`);
  omit it for a freeform scene.
- **`turn [n]`** advances the open scene by one turn (or `n`), moving the clock by
  its turn length; a freeform scene just counts the turn.
- **`end-scene`** closes the open scene; **`downtime <duration>`** closes it *and*
  advances the clock (the Storyteller's "you wait three days…").
- **`scenes`** lists them (the open one marked); **`scene-info [name]`** shows one
  in full; **`forget-scene <name>`** deletes a record.

### The Storyteller's hidden plans

Each scene carries a private **`plan`** — the AI's outline for what's *really*
going on. The Storyteller writes it inline while narrating, wrapped in a **`<hide>`**
directive, and the engine (via NovelAI's `onResponse` generation hook) **strips
it out of the story** and folds it into the current scene's plan, then **mirrors
that plan into the Author's Note** — semi-hidden: the AI re-reads it every turn,
you can peek at the Author's Note panel, but it never lands in the prose.

```
ST: The baron eyes you across the parapet.
<hide op="append">The baron is a Tremere spy; he betrays the prince at dawn.</hide>
Baron: "You are late, childe."
```

- `<hide op="append">…</hide>` adds to the plan; `<hide op="overwrite">…</hide>`
  replaces it; a bare `<hide>…</hide>` appends. The block is removed from what the
  player sees.
- **`[[hide text=\`…\` op=append|overwrite]]`** is the manual counterpart — you (not
  the AI) can edit the current scene's plan directly.
- Opening a new scene clears the previous plan from the Author's Note; ending a
  scene clears it entirely. `[[scene-info]]` always shows the current plan.
- The Author's Note write needs the script's **`storyEdit`** permission; without
  it the plan still lives in the scene record (best-effort, never errors).

### Keeping the AI's context clean

A **query** reply (help, `[[scenes]]`, `[[list-rolls]]`, `[[sheet]]`, …) is for
*you*, not the AI — it's noise in the model's context. Those replies are wrapped
in a `ctx-skip` marker, and the engine's **`onContextBuilt`** hook strips the
marked spans out of the messages before every generation, so the AI never reads
your bookkeeping. The engine **counts real generations** there (using the hook's
`dryRun` flag to tell an actual generation from a context *inspection*), and a
few generations later the **`onGenerationEnd`** hook **age-deletes** those noise
blocks from the story document itself (via the Document API). That same
post-generation pass is the **streaming backstop** for `<hide>`: if a hidden
block ever gets split across generation chunks and lands in the story, it's
found there, routed to the scene plan, and removed. (Document edits need the
script's **`documentEdit`** permission; best-effort, never errors.)

### Resources

Resources (Willpower, Blood, Resolve, Quintessence, …) are **abstract and
configurable** (`ResourceDef` in `src/rules.ts`): each carries optional **roles**
(abstract capabilities like `resolve` or `magic-fuel`), can **replace** other
resources outright (`replaces: ["willpower"]` hides Willpower and answers to its
name), and defines spend effects in **one declarative grammar**. A character's
resources are the **union of its templates'**, so hybrids compose them — and
because a resource resolves *by role*, one resource can do another's job.

**The effect grammar** (`EffectSpec`): every effect is the same sentence —
*spend [cost] → apply [op] to [target] at [amount] per unit, lasting [duration],
at most [limits]*. `op` and `target` are **open vocabularies**: words the engine
doesn't know yet (`"arcana"`, `"seduction"`, `"majesty"`) are stored, shown, and
Storyteller-adjudicated until their interpreter lands — nothing is hardcoded.

```jsonc
{ "label": "Resolve fuels the spell: +1 success, 8-again, -2 difficulty",
  "apply": [ { "op": "successes", "amount": 1 },
             { "op": "nagain", "amount": 8 },
             { "op": "difficulty", "amount": -2 } ],
  "cost": { "units": 1, "reducedBy": { "pool": "willpower", "perSuccess": 1 } },
  "duration": { "kind": "st", "n": 1, "unit": "scene" },
  "limits": { "maxPerUse": 1, "uses": { "n": 3, "per": "scene" } } }
```

- **Ops with interpreters today**: `difficulty` / `dice` / `successes` /
  `nagain` / `uncancelable` (roll modifiers — an optional `target` names an
  **action tag** the roll must carry, e.g. only `tags=melee` rolls;
  `uncancelable` grants successes **rolled 1s can never cancel** — the roll
  always nets at least that many, a botch is impossible, and the dice line
  shows `+N sure`); `increase` (raise a trait via the boost layer — `target`
  is a constraint: a group like `physical`, a bucket like `abilities`, or a
  specific trait; supports `fillToCap` and caps as **pool expressions** like
  `"stamina+3"`); `heal` (`target` = `"bashing,lethal"` or `"all"`, worst
  first). Anything else is preserved and noted for the ST. An op marked
  **`once: true`** fires once per spend no matter how many points rode it
  ("3 points of focus = −3 difficulty but still ONE sure success").
- **Costs**: `units` per application, `buys` (one resource unit → several effect
  units), and `reducedBy` — a roll whose net successes cut the price, possibly
  to zero (Iron Will-style).
- **Durations & limits**: `maxPerUse` is enforced now; `uses` per scene/turn and
  `cooldown` are **counted in a real usage ledger** and shown (`used 2/3 per
  scene — ST-enforced`); `[[reset-uses]]` clears the counters at a scene change.
  The future turn system inherits this data and starts enforcing it.
- **`spend=<resource|role>[:effect][!]`** on any `roll`/`roll-for` pays and folds
  roll-op effects in; trailing `!` = **mandatory** (can't pay → nothing rolls —
  spell fuel). `[[spend <resource[::effect]> [target] [n]]]` runs standalone
  effects (heal, increase, advisory ops); `gain`, `resources`, `damage`,
  `health`, `clear-boosts` as before. The wound penalty still auto-applies to
  rolls, and boosted traits resolve higher until cleared.
- Current values persist per character (story storage) and default to the
  template start until changed — nothing needs allocating to start playing.

### The Ouroboros & Living Resolve — a unique template

A resource that exactly one creature in the world possesses belongs to a
**unique template**, not to the story-wide overrides layer. **Ouroboros** is
that template: revenant + *laham* + Awakened mage of the **Order of Hermes**,
made by a powerful witch in a ritual involving Belial, the Great Beast. Still
alive and human-souled (Road/Humanity + Virtues), ghoul soak, and exactly one
pool — the fusion itself.

```
[[create-playable name="..." templates=ouroboros]]
```

**Living Resolve** is that pool: revenant vitae, *laham* Resolve, Awakened
Quintessence and Willpower as one metaphysical substance — 30 points, starting
full, spend up to 6/turn (ST-enforced). Spending 1 point spends 1 of *each*
component:

- It **replaces** blood/willpower/resolve/quintessence and answers to their
  names and roles — every vitae trick (heal, `boost` a Physical), every power
  that burns Resolve or Willpower, all spell fuel.
- **He has exactly one pool.** `[[resources]]` shows a single line —
  `living-resolve 30/30 (replaces: blood/willpower/resolve/quintessence)`. The
  other four names are not pools he also has; they *resolve to* this one, so
  `spend=willpower` spends Living Resolve and `[[spend willpower 1]]` reports
  "spent 1 living-resolve".
- **One point pays out as all four, at once** — it is never spent *as* one
  component. Per point: **+1 un-cancelable success** (the Willpower) and
  Resolve's **whole** payout — **+1 automatic success, 8-again, −2 difficulty**.
  Two rules keep that from double-paying:
  - **A point lowers the difficulty once**, by the **deepest** break any of its
    natures gives. Resolve's −2 *is* the Quintessence break seen from another
    side, not another −1 to add on top. (A fused resource therefore carries
    exactly **one** `difficulty` op; retune Resolve to give none and the
    Quintessence −1 goes there instead, reducing like it does for any mage.)
  - **Successes are not the same thing**: Resolve's automatic success and the
    Willpower's un-cancelable one are different currencies and **both** land.
    Two points on a spell = **+2 auto and +2 sure**.
  Inside `[[cast]]` the same point pays everything, including the **mandatory**
  stabilizing point — it is the same substance, not a fee taken off the top —
  and a point the Quintessence floor won't let *reduce* is still spent, because
  its other three components have work to do (ordinary Quintessence stops at
  the floor, having nothing else to give). The vitae is that same point aimed at
  flesh — `heal`, `boost` — not a different way of spending it. **It is meant to
  be overwhelming.**
- When a power *consumes* the Willpower as its activation cost, use `fuel` (no
  free success) — or `fuel-surge` (an extra point buys it anyway).
- He has **no Willpower entry at all**: it is replaced, so a character created
  on this template gets no `poolStarts.willpower`, and `[[sheet]]` flags a
  leftover one if an older sheet still carries it.
- **Rolls that pool it** (Willpower/Resolve rolls) roll **min(10, current)** —
  and every point above 10 **shields a die of penalties** (wound penalties,
  negative dice mods) on that roll (`rollAs` in the def).
- **Recovery**: 1/day (the revenant vitae brewing), +1/day in the Umbra, +1/day
  **rested in the sanctum** (`full-rested` *and* `in-sanctum` together), **20
  every full moon** — all on the story clock; drinking vampiric vitae
  (bond-immune) and consuming Tass are `[[gain living-resolve N]]` moments.

An ordinary mage's **Quintessence** recovers on those same two gates (Umbra,
and rested-in-sanctum) — it just has no daily brew of its own.

**Certainty: one Willpower per action — unless you are casting.** Spent
Willpower buys successes that rolled 1s can *never* cancel, one per point. The
old law allows **one Willpower per action**, and pouring in *more* for more
certainty is a **spellcasting** rule: on a spell the total is capped by the
Foundation instead, at **`max(1, (Foundation − 1) ÷ 2)`** — the first dot is
the price of entry, then every two more buy another (the divisor is the
`uncancelable-per-foundation` knob). At Modus 5 that's **2**, at 7 it's **3**;
a caster with no Foundation still gets 1.

So two points of Living Resolve spent on a **spell** buy 2 sure successes,
while the same two spent on a **Discipline** buy 2 of that Discipline's fuel
and exactly **1** — the Resolve half still scales (2 automatic successes,
−4 difficulty), only the Willpower half is once per action. An ordinary
character hits the same wall with `[[roll strength spend=willpower
spend-amount=2]]`: one sure success, and the reply says why.

### Casting magic — Dark Ages: Mage

The whole *How Magic Works* chapter is executable. Foundation and Pillar
**ratings** live on the character (the free `traits` bucket — e.g.
`"modus": 3, "corona": 4`); the **required levels** are what the desired effect
needs — play-time input, per pillar, never baked anywhere. Every number is a
knob (`DEFAULT_MAGIC_RULES`, overridable per-knob in the `wod:config:magic`
lorebook entry).

**Fellowships** name a society's Foundation and Pillars as data (`FELLOWSHIPS`
in `src/rules.ts`). Shipped: the **Order of Hermes** — Foundation **Modus** (the
Ouroboros: knowledge begets discipline and focus, which begets more knowledge),
Pillars **Anima** (life), **Corona** (mind), **Primus** (magic itself) and
**Vires** (forces). `[[fellowships]]` lists them; `[[cast]]` **finds the
Foundation on its own** — an explicit `foundation=` wins, then a literal
`foundation` trait, then the first fellowship whose Foundation the caster
actually has.

```
[[fellowships order-of-hermes]]                       # Foundation & Pillars
[[cast pillars="corona:2"]]                           # simple: diff 4+2, Modus found for you
[[cast pillars="corona:4,vires:2" quintessence=2]]    # complex: diff 5+4+1, −2
[[cast pillars="vires:4" requires=6 extended=true interval="one hour"]]
[[cast pillars="corona:2" requires=2 ongoing=true]]
[[seal-spell pillar=3]]            [[seal-spell pillar=3 pay=true]]
```

- **Simple spell** (one pillar): roll Foundation + Pillar vs **4 + required
  level**. **Complex** (several): Foundation + the highest-required Pillar + 1
  die per extra, vs **5 + highest required + 1 per extra** (ties: your best
  score rolls).
- You must **know each Pillar at the required level**, and when the required
  level **outstrips your Foundation** the casting *requires* a stabilizing
  point of Quintessence (spent via the `magic-fuel` role — Living Resolve
  qualifies, and being the fused substance, **grants its un-cancelable success
  automatically** on any casting it fuels).
- **`quintessence=N`** spends *extra* points at **−1 difficulty each** — max 3
  per turn including the stabilizer (>2 flags the **Fount Background**), never
  below **difficulty 4**. A **fused** payer instead takes its own (deeper)
  break once per point, and the floor doesn't bind: a point that is also a
  Willpower and a Resolve is never wasted, so only the per-turn cap and the
  pool limit how many may be spent.
- **Over the cap** (default **10** — this chronicle's ruling; set
  `difficulty-cap` to 9 for the book's rule), difficulty converts to **+1
  required success per excess point**, and reductions **buy those off first**
  before lowering the die target — the book's ordering, by arithmetic.
- **Same-scene retries**: +1 difficulty per prior unsuccessful casting of the
  same spell (keyed by `label=`, else the pillar signature) — or **+2 per prior
  attempt once one botched**. A success clears the slate; so does a new scene.
- **A botch is Backlash**: the spell fails utterly (extended castings end,
  successes lost — `on-botch=` can soften it) and the Storyteller describes
  the price (Backlash systems not yet modelled).
- **Extended** spells accrue ST-set successes over intervals (`requires=N`,
  `interval=…`) through the extended-roll machinery (`[[continue-roll]]`).
  **Ongoing** spells need **×10 successes**, burn **1 magic-fuel per success**
  as they land (ST-enforced), and end with **`[[seal-spell]]`**: 5 Quintessence
  per dot of the highest Pillar + 1 Willpower per 10 of that (rounded up) —
  quoted as a debt, `pay=true` to spend now, and a **fused payer covers both
  components with the same points**.

### Configuration wizards & house rules

House-ruling is **changing data through some UI** — a lorebook entry, a wizard,
or (later) modal windows. All of them edit the same thing:

- **`wod:config:resources`** is the story's resource override entry: a JSON map
  `name → partial definition` merged over the template defaults (change `start`/
  `max`/`roles`/effect numbers, or add a whole custom resource). Hand-edit it in
  creator mode, or let the wizard write it.
- **`[[configure-resources]]`** starts a guided setup for the current
  character's resources. It's a text **prompt → reply** conversation: while the
  wizard runs, your plain messages answer it (numbered options, `keep` accepts
  the default, `cancel` exits; `[[commands]]` still work mid-wizard). It walks
  each resource (keep or customize start/max/effect), offers **extra roles**
  ("quintessence: resolve" spends Quintessence as Resolve), shows a change
  summary, and saves to the entry above.
- The wizard core (`src/wizard.ts`) is **medium-agnostic**: definitions emit
  structured prompts and consume replies, so the same wizard can later render
  as `api.v1.ui` modals/windows without changing its logic.

### Constraint groups (exclusive / restricted / forbidden)

A **constraint group** is a reusable allow/deny rule over Backgrounds or
Merits/Flaws — the raw material clans and templates will use to say what a
character may take. Groups are **data** (a `wod:config:constraints` lorebook
entry), stored and surfaced now, enforced at creation later.

```
[[define-constraint name="statuses" relation=exclusive domain=background members="status, anonymity" max=1]]
[[define-constraint name="clan-secrets" relation=forbidden domain=flaw members="dark-secret" scope="vampire"]]
[[constraints]]              # list them; [[constraint <name>]] lays one out
[[check-constraints]]        # flag the current character's conflicts
```

- **`relation`** — `exclusive` (hold at most `max`, default 1, of the members —
  mutual exclusion), `restricted` (members available **only** to characters in
  `scope`), or `forbidden` (members **disallowed** for characters in `scope`).
  Both senses of "exclusive" are covered: mutually-exclusive members vs reserved
  access.
- **`domain`** — which bucket the members live in: `background`, `merit`,
  `flaw`, `meritflaw`, or `any`.
- **`scope`** — the templates/choices it applies to (comma-separated; empty =
  everyone). A group's `scope` is how a future clan/template will own its rules.
- **`[[check-constraints]]`** validates the current character's owned Backgrounds
  and Merits/Flaws against every group and reports violations (ST-enforced until
  the creation engine consumes them). **`[[forget-constraint <name>]]`** removes
  one; defining an existing name replaces it.

### Afflictions — parameterized states, not flat flags

> **On the name:** an *affliction* is any parameterized state attached to
> someone — it can be **good, bad, neutral, or outside such categorization**
> (Feral Whispers is a gift, not a curse). The word does *not* imply harm. We
> reserve the word **condition** for future *conditional* things — predicates
> the engine will someday evaluate.

An **affliction** can need **bindings** (a target), can **chain** into a successor,
can **mirror** onto the bound target, and can grant **tags** that join the
afflicted character's rolls — so registered `RollModifier`s fire *today*.
Durations are advisory (ST-enforced) until the turn system; `[[advance]]` is the
manual chain trigger. Definitions are data: shipped defaults overlaid by a
`wod:config:afflictions` lorebook entry (`[[define-affliction]]` writes it).

The shipped exemplar is Animalism's **Feral Speech**: lock eyes for a turn, then
converse in the animal's tongue — and the animal (an NPC with no sheet) is in
the conversation too:

```
[[alias @prey "Grey Wolf"]]
[[afflict concentrating-on target=@prey]]   # Kvar: concentrating-on (target: Grey Wolf) - 1 turn
[[advance concentrating-on]]                # -> Kvar: feral-whispers (target: Grey Wolf)
                                            #    Grey Wolf: feral-whispers (target: Kvar)   (the mirror)
[[afflictions "Grey Wolf"]]                  # NPCs carry afflictions - no sheet needed
[[lift feral-whispers spend=willpower]]     # the shrug-off; the mirror lifts too
```

- **`define-affliction name=".." [bindings="target"] [duration="1 turn|until x|instant"]
  [then=".."] [mirror=".."] [tags="a,b"]`** — an overlay definition may *shadow*
  a built-in (forgetting it resurfaces the built-in).
- **`afflict <affliction> [on=<name|@alias>] [<slot>=<name|@alias>]`** — validates
  the def's binding slots (values resolve `@aliases`); `mirror` defs also afflict
  the bound target, bound back the other way.
- **`advance <affliction>`** — ends it and begins `then`, carrying bindings
  forward (the successor's mirror fires — that's how the wolf joins the
  conversation). **`lift <affliction> [spend=…]`** removes it *and its mirror*;
  the spend is the classic pay-Willpower-to-shake-it-off.
- **`afflictions [<name|@alias>]`** lists anyone's active afflictions;
  **`affliction [name]`** lists/inspects definitions.
- A def's **tags** merge into every roll (and contest side) the afflicted
  character makes — e.g. a house-ruled `dazed` affliction with tag `off-hand`
  is a real +1 difficulty right now.

### Rating-scaled afflictions — a state that consults the sheet

Some states aren't flat: *being in your sanctum* is worth wildly different things
at Sanctum 2 and Sanctum 8. Such a def names the Background it **`scalesWith`**
and lists **`tiers`**; every tier at or below the character's rating applies (the
book: "these benefits are cumulative"), and `requiresAwakened` keeps them from
the sleeping world.

```jsonc
{ "name": "in-sanctum", "scalesWith": "sanctum", "requiresAwakened": true,
  "tiers": [ { "atLeast": 2, "apply": [{ "op": "difficulty", "amount": -1, "target": "magic" }] },
             { "atLeast": 6, "apply": [{ "op": "difficulty", "amount": -2 }] } ] }
```

**One resolution rule** decides how a wider tier meets a narrower one: within an
op kind, an **untargeted op supersedes targeted ops of the same kind**. So a
Sanctum 8's "−2 on *all* rolls" **absorbs** the "−1 on magic" of tiers 2 and 3
rather than adding to it — the caster ends at −2, not −4. Tier ops honor the
usual gates (`target` = an action tag the roll must carry, `trait` = a trait the
pool must have used), plus **`@foundation`** — "whatever this caster's Foundation
trait is". `[[afflictions]]` prints what a place is granting right now.

**The Sanctum** ships with the full table: 2 → −1 magic, 3 → −2 magic, 4 →
regain a point by sleeping eight hours there, 5 → +1 die on Foundation pools and
you know of any incursion, 6 → the −2 widens to *every* roll, 7 → +1 automatic
success on magic, 8 → that widens to every roll too. At **any** rating a mage is
**immune to Backlash** in their own sanctum — a botched casting still fails, but
the power doesn't turn on them. **The Library** ships as prose tiers plus the
`[[research]]` roll; **`in-rotunda`** sharpens Hermetic matters (−2 difficulty,
+1 automatic success on rolls tagged `hermetic`).

### The Library of the Unseen — a place you walk into

The protagonist's sanctum *is* an Umbral realm, so being there means `in-sanctum`
+ `in-umbra` + `in-library` at once, and the Talisman **Cosmos Within the
Measure** is the door: measure any door's jamb, lintel and threshold — ten
minutes, no roll, no resource — and it opens.

```
[[measure-door]]      # 10 minutes; you are now in-sanctum + in-umbra + in-library
[[research `the seals of Belial` difficulty=8]]   # Intelligence + Library
[[cray]]  [[harvest 4 time=`2h`]]  [[absorb]]     # the cray within
[[leave-library]]
```

- **`measure-door`** needs a Library Background (you open the way to *your*
  library) and advances the story clock ten minutes.
- **`research <topic> [difficulty=] [tags=]`** rolls **Intelligence + Library**
  and reports how much material surfaced — what it *says* stays the
  Storyteller's. You must be in the library. (The Library's other benefit —
  a roll vs 8 cutting a Pillar's experience cost by 1 per success — waits on the
  experience system.)
- **A cray** is a real site, not a number: it holds **rating × 5** points and
  refills **1/day on days it goes untapped** (`[[advance-time]]` credits it).
  **`harvest N`** is the ritual method — no roll, you choose the amount, and
  `time=` advances the clock with it. **`absorb`** is the dangerous one: **Wits +
  Foundation vs 10 − rating**, one point per success.
- **Overdrawing** past empty (by up to its rating) **costs the site a dot**, then
  its reduced rating rolls vs 8: success → depleted but recovering, failure →
  **dormant** (a point a *year*), botch → **dead**, forever. The engine applies
  all of it and says so.
- Everything credits the **`magic-fuel`** role — which for the Ouroboros is
  Living Resolve: every rule that says "Quintessence" means his fused substance.

### Defining merits, flaws & arcana

Merits, flaws and arcana are the same shape (`MeritFlawDef`) — arcana are simply
merits with **passive** ops. Definitions live in the `srd:merits-flaws` lorebook
category, merged over the built-ins, and **`[[define-merit]]` writes that card
for you** (hand-editing stays equally valid).

```
[[define-merit name=`Inviolate Soul` points=0
   passive=`immune:possession,soul-control; immune:fear,mind-control while=living-resolve`
   description=`An inherent natal Investiture.`]]
[[take-merit inviolate-soul]]     [[merit inviolate-soul]]     [[forget-merit …]]
```

- **Passives** read `<op>[:<target>] [+N|-N] [if=<trait>] [while=<resource>[>=N]]
  [once]`, `;`-separated — or raw JSON (`[{…}]`) when the shorthand won't do.
  **Use backticks**: a quoted value goes through the boundary normalizer and its
  spaces become hyphens (the command says so if it detects that).
- **`while=<resource>[>=N]`** is a live gate: the op applies only while the
  character still *holds* that much (by name, role, or a name it replaced), so
  it lapses the moment the pool runs dry.
- Numeric ops scale by the points the instance was taken at; a **flag op** (an
  immunity — no amount) doesn't scale. Ops the engine has no interpreter for are
  **recorded and surfaced** for the Storyteller rather than rejected: there is no
  possession or fear system to enforce an immunity against *yet*.
- `[[merit]]` lists every definition; `[[merit <name>]]` shows one in full.

### Windows are just command emitters

`[[win-constraint]]` opens an **`api.v1.ui` window** — a form (name; relation and
domain button-rows; members, max, scope, note) with a **Create** button. Create
does nothing special: it composes a `define-constraint …` string and routes it
through the **same `CommandRouter`** every command uses. **A window is an
abstraction over the command layer, not a second execution path** — anything a
window can do, a typed command can do, and vice-versa.

Since the architecture pass, the form itself is **derived, not hand-built**:
every verb registers a `CommandSpec` (its parameters — kind, type, enum
options, defaults, labels), and `openCommandWindow(verb)` renders that spec as
a window (enums become button-rows, ints number inputs, the rest text inputs)
and submits through `composeCommand` — the one place that quotes and sanitizes
values (backtick literals for display text; characters that would break
tokenization are stripped, since the command grammar deliberately has no escape
syntax). `[[help]]` derives from the same specs, so a verb's grammar lives in
exactly one place.

For choice fields too long to inline as button rows there's the **picker**:
each such field is a text input (type the value directly) next to a
**Choose…** button that opens a modal with one button per option, the current
value marked ✅ — picking writes the field and re-renders. The affliction
windows use it:

- **`[[win-affliction]]`** — `define-affliction` as a form; the `then` and
  `mirror` fields get pickers over the existing afflictions.
- **`[[win-afflict]]`** — the first *domain-driven* window: pick an affliction
  and its def's **binding slots appear as fields** (the def drives the form,
  not a spec); Afflict composes and routes the real `[[afflict]]`, so mirrors
  and validation behave exactly as if you'd typed it.
- **`[[win-roll]]`** — the roll **builder**: one window that multiplexes three
  verbs. Fill the pool (its picker offers `@saved` rolls) and any knobs — the
  knob fields are *walked from `roll`'s own spec*, with pickers for `spend`
  (the character's resources), `specialty` (their specialties), and `table`
  (tables + `@aliases`). **Roll** fires it — as `[[roll]]`, or `[[roll-for]]`
  when the **For** field names someone else (its picker lists characters; the
  resource/specialty pickers follow it). **Save** stores it under the *Save
  as* name via `[[name-roll]]`, sidecars included (For is ignored — saved
  rolls are chronicle-global). The **Opposed** knob (none / resisted /
  contested) turns Save into a **contest** save — picking a mode reveals
  *vs-pool* and *vs-difficulty* fields, so `[[win-roll]]` can bake a Shadowing
  or Intimidation as easily as a plain roll (the opponent stays play-time `vs=`).

The ambient host types (`types/novelai/script-types.d.ts`), the off-host mock
(`src/host-mock.ts`), and the spec-driven forms (`src/window.ts`) are the shared
foundation; the full UI reference lives in `docs/ui-*.md`.

🚧 Next: allocation commands (attributes/abilities/…), multi-template
resolution, and turning a finished sheet into a `LiveCharacter`.

## Merits & Flaws

Defaults live in `DEFAULT_MERITS_FLAWS` (an in-code list served by
`MeritFlawRegistry`); the lorebook overlays it —
`MeritFlawRegistry.loadFromLorebook()` merges any JSON definitions found in
`srd:merits-flaws`, so custom content needs no code change.

### Owned powers: parameterized merits with passive effects

A def may declare a **`param`** slot and **`passive`** ops — always-on effects
while owned, whose amounts scale with the points taken and whose `"$param"`
fields substitute the instance's value. You own such a def as a
**`name::param` instance**: `[[take-merit trait-affinity::melee 2]]`
(`[[drop-merit …]]`, `[[merits]]` to list). Roll ops on passives are gated:
`trait` fires only when the roll's **pool** actually used that trait (a trait
appearing only in the difficulty expression doesn't count), `target` on the
roll carrying that action tag.

The shipped Devil's Due arcana:

- **Trait Affinity** — `-1 difficulty` per point on rolls whose pool uses the
  trait. One favoured trait may reach 3 points; every other caps at 2 —
  advisory, flagged by `[[check-constraints]]`.
- **Trait Enhancement** — permanently raises the trait's **effective** value
  by the points taken *and* its advancement ceiling, while XP still prices
  from the un-enhanced base: Strength 3 with +2 rolls 5 dice today, can be
  raised to base 7 later, for an eventual effective 9. `[[merits]]` shows
  `base → effective` and the advisory ceiling.

### Trait-bounded ceilings — when the cap is a rating, not a number

Some arcana cap their own purchases against a trait: *Sharpened Senses* "may
not be purchased more times than his Resolve". `maxFromTrait` says so, and the
name resolves the way every trait name does — a rated trait first, else **the
resource that fills or replaced that name**.

Which fuel a character has is per-splat, and that is the whole gate: a **mage**
has Quintessence + Willpower, an **infernal being** (demon, thrall) has Resolve
+ Willpower, a **vampire/ghoul/revenant** has a Blood pool + Willpower, and the
**Ouroboros** has Living Resolve, one point of which *is* one Quintessence and
one Resolve and one blood point and one Willpower. So an arcanum measured
against Resolve is open to a demon up to his rating, capped for the Ouroboros
by Living Resolve, and **not open to a mage at all** — no template gate needed,
because his Resolve is 0:

```
[[take-merit sharpened-senses 5]]        # a demon, Resolve 3
→ Sharpened Senses may not be taken more times than Resolve (3) — asked for 5.
  Raise Resolve first, or add waive=true to override.

[[take-merit sharpened-senses 1]]        # a mage
→ Aldous has no Resolve, and Sharpened Senses is measured against it — none of
  Aldous's templates (mage) grant one. Add waive=true if the chronicle says otherwise.
```

Always the **permanent** rating, never the spent-down current. A ceiling can
*move* — a Resolve that drops leaves purchases stranded above it — and that is
reported by `[[check-constraints]]`, never silently trimmed:
`sharpened-senses is at 5 but resolve is only 3`. The same check flags a pool
your templates don't grant (`pool "resolve" is not granted by mage`), so a
hand-edited card can't quietly give a character a fuel his kind never has.

Author one with `max-from-trait=`:

```
[[define-merit name=`Sharpened Senses` points=`1,2,3,4,5` max-from-trait=resolve
  passive=`difficulty -1 if=perception` description=`…`]]
```

### Specialties

`[[specialty melee `Swords`]]` (backticks keep the label's case) adds one;
`[[specialties]]` lists, `[[forget-specialty]]` removes. On a roll,
**`specialty=<trait|label>`** applies exactly **one** specialty for **+1
die** — the pool must use its trait (otherwise an advisory note, no die), and
a trait with several specialties needs the label. Named rolls can bake one in
(`[[name-roll slash dexterity+melee specialty=melee]]`). Whether a specialty
*fits the fiction* is the Storyteller's call today; asking the AI Storyteller
via the Generation API is the planned automation.

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
