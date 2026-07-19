# NAIoWoD

Attempting to implement **World of Darkness** (Storyteller system, _Dark Ages_
flavour) for NovelAI — a foundation for single-player games run by the AI as
Storyteller. This repository is the rules engine: characters, dice, health,
damage, soak, resource pools and morality. UI and game loop come later.

## Layout

| Path | What |
| --- | --- |
| `CLAUDE.md` + `docs/memory.md` | **The project's externalized memory** — session bootstrap + the fine-grained map of everything (files/classes/functions, state, decisions & rationale, roadmap). Updated in the same commit as any change it describes. |
| `src/host.ts` | NovelAI API contract (storage, lorebook, hooks, **`ui`**) + the off-host mock — the only module that touches `globalThis`. |
| `src/core/` | Pure mechanics (`traits`, `dice`, `damage`) — no host imports. |
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
| `test/` | The Bun test suite (`system.test.ts`; `build.test.ts` keeps `dist/naiowod.ts` in sync with `src/`). |
| `types/` | Ambient shims so `tsc` can check tests and scripts without installing `bun-types`. |

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
exporting/importing scripts; pasting doesn't use it.) Off-host (tests, local
runs) the mock in `src/host.ts` yields to a real host-provided `api` when one
exists, and importing the engine has **no side effects** — everything
host-facing happens in `init()`, which the built artifact calls last.

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
  spend=willpower]]`), **`specialty=`**, and **`table=`** (the success table
  read against the outcome whenever the roll is invoked). The pool must be a
  real expression — a `@name` reference can't be saved.
- **`@name`** in any `roll` / `roll-for` loads that saved spec; supplied args
  **override** its difficulty, modifier, `requires`, `dice-modifier` or `tags`
  for that one use (the pool itself is fixed). Saved sidecars apply
  automatically — the spend is **paid**, the specialty adds its die, the table
  reads the outcome — unless the command supplies its own `spend=` /
  `specialty=` / `table=`. This override-merge is the same primitive extended
  rolls reuse for helpers and continuations.
- **`list-rolls`** shows the library (with any saved sidecars); **`forget-roll
  <name>`** removes one (or just edit the JSON map in the lorebook directly).
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
  **`soak`** (1 per success).
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
  `nagain` (roll modifiers — an optional `target` names an **action tag** the
  roll must carry, e.g. only `tags=melee` rolls); `increase` (raise a trait via
  the boost layer — `target` is a constraint: a group like `physical`, a bucket
  like `abilities`, or a specific trait; supports `fillToCap` and caps as **pool
  expressions** like `"stamina+3"`); `heal` (`target` = `"bashing,lethal"` or
  `"all"`, worst first). Anything else is preserved and noted for the ST.
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
  rolls are chronicle-global).

The host UI contract + off-host mock (`src/host.ts`, `src/window.ts`) are the
shared foundation; the full UI reference lives in `docs/ui-*.md`.

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
