# NAIoWoD — Project Memory

> **Purpose of this file.** This is the project's externalized memory: enough
> for a fresh Claude session (or any developer) to rebuild full context without
> the original conversation. It maps everything implemented to its files,
> classes and functions; records every design decision **and its reason**; and
> lists everything not yet built. **Keep it current: any commit that changes
> behavior, architecture, commands, data shapes, or the roadmap must update
> this file in the same commit.** Docs-only commits don't require a re-sync.
> **Last synced with the code as of commit `25c6a9a`** ("scenes: the named
> unit of play on the story clock — scene/turn/end-scene/downtime"). Prior:
> `65c67f8` (time: the story clock — real Gregorian calendar); `c20d0df`
> (win-roll bakes contests: the Opposed knob); `23917a9` (contested saved rolls +
> multi-stage advisory procedures); `cb5b4c3` (vendor NovelAI's
> script-types.d.ts as ambient truth).

---

## 1. What this project is

**NAIoWoD** implements **World of Darkness** (classic Storyteller system,
**Dark Ages** flavour) as a **NovelAI script** — a rules engine for characters,
dice, health, damage, soak, resources and morality. The end goal is a
single-player game where **the AI is the Storyteller** (via `api.v1.generate`,
not yet built). The player operates the system through `[[bracketed]]`
commands typed into NovelAI's text-adventure input, and edits game data
directly in the **Lorebook**, which the engine treats as its editable database.

- Repo: `ZhuStar/NAIoWoD`. All work goes to **`main`** via ordinary
  fast-forward pushes (the owner authorized pushing straight to main; extra
  branches kept appearing from other tools and were deleted).
- Runtime target: NovelAI's scripting host — a single, import-free TS context
  that injects a global `api` (`api.v1.*`). Everything is data-driven and
  player-editable because **house-ruling = changing data through some UI**
  (lorebook entry, wizard, future modal windows — all edit the same data).

## 2. How to work on it

```bash
bun test            # 271 tests across test/system.test.ts + test/build.test.ts
bun run typecheck   # tsc --noEmit (strict; no npm install needed, Bun runs TS)
bun run build       # regenerate dist/naiowod.ts (scripts/build-single.ts)
```

**The full verification battery used before every push** (all must pass):
1. `bun run build` then `bun test` (includes the dist-sync test + the
   release-purity guards in build.test.ts) — 0 fail.
2. `bun x tsc --noEmit` clean. This now checks src AGAINST NovelAI's real
   ambient types (`types/novelai/script-types.d.ts`), not our old mirror.
3. Standalone type-check of the artifact — SIMULATES THE NOVELAI EDITOR: copy
   BOTH `dist/naiowod.ts` and `types/novelai/script-types.d.ts` to a temp dir
   and run tsc on them together (`--strict --skipLibCheck --target ES2021
   --lib ES2021`). Zero errors proves the release is collision-free AND
   type-correct against reality (no DOM/console assumed — the artifact needs
   only the ambient `api` + ES built-ins). (History: the DOM-lib flags were for
   the old self-typed artifact; that era once caught `StorageManager` shadowing
   the DOM global → renamed `ScopedStorage`.)
4. Import purity: `bun -e 'await import("./src/host-mock.ts"); await
   import("./src/index.ts")'` must print nothing (side effects live only in
   `init()`). host-mock is imported FIRST so `globalThis.api` exists before any
   top-level `new ScopedStorage()` reads `api.v1.script.id`.
5. A live e2e: `import "./src/host-mock"`, then `init()` and drive commands
   (create → win-roll → roll, etc.).

**Commit conventions**: descriptive body; end with the `Co-Authored-By:
Claude <model> <noreply@anthropic.com>` and `Claude-Session:` trailers exactly
as in the recent git log. Push with retries/backoff.
Stop-hook warnings about "Unverified commits" are non-actionable (unsigned
commits; ignore). **Do not create PRs** unless asked; do not rewrite history.

**Deprecation convention** (user rule): anything kept only for backwards
compatibility is tagged `@deprecated` with a pointer to its replacement, so a
later pass can delete it. Current deprecated surface: **none** (`PoolDef` and
`CommandRouter.parse` were removed in the low-hanging-fruit pass).

## 3. Architecture & deployment

Real ES modules with strict layering, enforced by imports (a module may only
import from layers above it in this list):

```
types/novelai/script-types.d.ts  VENDORED NovelAI declarations - ambient truth (not a module)
src/host.ts          release-safe glue: log() + UiPartHelpers/UIHandle aliases (NO NovelAI types)
src/host-mock.ts     off-host mock + __reset*/__ui* hooks; installs globalThis.api. TEST-ONLY (NOT in the build)
src/core/traits.ts   pure: names, Stat/Tracker/Pool, morality
src/core/dice.ts     pure: the d10 roller
src/core/damage.ts   pure: Severity/Kind, packets, reactions, HealthTrack, soak
src/wizard.ts        pure: medium-agnostic wizard engine
src/rolls.ts         pure: roll specs, modifiers, extended-roll state machine
src/rules.ts         DATA: templates, resources, effect grammar, roads, SRD seeds
src/command.ts       the command bus: parser, CommandSpec/describe/compose, router+hooks
src/services.ts      ScopedStorage, LorebookManager, MeritFlawRegistry, generic config stores
src/state.ts         the character model + EVERY persistent store (config registries, live state)
src/game.ts          the verbs: effect interpreter, wizards, handlers + spec registrations
src/window.ts        api.v1.ui windows that EMIT commands - forms DERIVED from CommandSpecs
src/index.ts         re-exports * + init()  (importing = zero side effects)
src/main.ts          runtime entry: init().catch(...)
```

**Deployment artifact**: `bun run build` **concatenates** the modules in the
order above (see `MODULES` in `scripts/build-single.ts`), strips only the
inter-module `import`/`export` wiring, and writes **`dist/naiowod.ts`** — a
single **readable, editable, paste-ready TypeScript file** with `//#region`
markers per module. It is **committed**, and `test/build.test.ts` fails the
suite if it drifts from `src/` (so it can never go stale). It is **not** a
bundle: nothing is minified or transpiled.
- **The release redefines NO NovelAI type and no `api`** (§7.24). NovelAI's own
  declarations are vendored at `types/novelai/script-types.d.ts` and treated as
  ambient (it has no import/export, so every `type`/`interface`/`declare
  namespace api` is global; `tsconfig.include` already globs `types/`). So
  `src/` uses the REAL `api`/`UIPart`/`WindowOptions`/`LorebookEntry`/… and the
  artifact declares none of them — pasted into an editor that knows those types,
  it can't collide. `src/host-mock.ts` (the off-host `api`) is NOT in MODULES,
  so it never enters dist. build.test.ts guards this (no `declare namespace
  api`, no top-level `const api`, no redeclared NovelAI type, no `__mock*`).
- **Why no `.naiscript` frontmatter**: NovelAI's script editor takes plain TS;
  the YAML `/*--- ---*/` header (with an embedded script id) only matters for
  the export/import flow, which the user avoids because baked-in ids cause
  confusion. So the file starts with a `//` comment note, never `/*---`
  (guardrails + tests enforce this).
- **Why readable concatenation, not an IIFE bundle**: the user wants the single
  file to be hand-readable/editable ("naiscript is just TS with a metadata
  header above"). An earlier IIFE build was replaced.

**Host, mock, ambient types** (§7.24): `api` is the AMBIENT global (types from
the vendored d.ts). `src/host.ts` is release-safe glue: `export function log`
(routes through `api.v1.log`) + two OUR-OWNED aliases over ambient types —
`UiPartHelpers = typeof api.v1.ui.part`, `UIHandle =
Awaited<ReturnType<typeof api.v1.ui.window.open>>`. `src/host-mock.ts` (TEST-
ONLY, not in the build) installs `globalThis.api = {...}` when no real host
exists — 3 storage stores as Maps, an empty lorebook, uuid fallback,
hooks.register that just logs, the UI recorder — typed loosely (assigned
through `any`; only the runtime surface we call). Test/off-host hooks live
there: `__resetLorebookMock/__resetStorageMock/__resetUiMock/__uiWindows/
__uiClickButton`. **Ordering**: any off-host consumer imports host-mock BEFORE
the engine, so `globalThis.api` exists before a top-level `new ScopedStorage()`
reads `api.v1.script.id`. On-host, NovelAI's `api` is already global and the
mock's install is skipped. `main.ts` errors via `api.v1.error` (not `console`),
so the release depends only on the documented API.

**`init()`** (`src/index.ts`): registers the `onTextAdventureInput` hook →
`processAdventureInput(rawInputText)`, then `LorebookManager.bootstrap()`,
`MeritFlawRegistry.loadFromLorebook()`, `reloadAllConfigStores()` (every
config registry in one sweep), logs a summary with per-entry counts, returns
`{ setupMessage }` (the OOC note when SRD categories were created).

## 4. NovelAI host facts (FULL machine-readable truth now vendored at
`types/novelai/script-types.d.ts`; prose in `docs/novelai-api.md` + `docs/*.html`)

- Four storage stores share `get/set/remove/list/has/getOrDefault/setIfAbsent`
  (all async): `api.v1.storage` (per script), `storyStorage` (per story — **we
  use this**, via `ScopedStorage`), `historyStorage` (story + undo-aware —
  planned home for mechanical state), `tempStorage` (session, self-clearing).
  NOTE: the real host DOES expose `setIfAbsent`/`has`/`getOrDefault` (the d.ts
  confirms) — an earlier memory said otherwise. `ScopedStorage` predates that
  and still emulates `setIfAbsent` over `get/set`; harmless, not worth reworking.
- Lorebook: `entries(categoryId?)/categories()/category(id)/entry/createCategory/
  createEntry/updateCategory/updateEntry/removeCategory/removeEntry` (create*
  resolve to the **new id**; pass `api.v1.uuid()` to control ids). Entries
  filter by category **id**, not name. Real names: `LorebookEntry`,
  `LorebookCategory` (we adopted these, retiring our `*Data` aliases).
- `onTextAdventureInput` handler gets `{continuityId, inputText, rawInputText,
  mode}` and may return `{inputText?, mode?, stopGeneration?,
  stopFurtherScripts?}`. **The host strips newlines from returned inputText**
  → all engine replies are single-line **`[SYSTEM: ...]`** (the mechanical
  voice; the player is planning a speaker scheme — Player/OOC-Player/ST/OOC-ST/
  <character-name> — where the engine is SYSTEM). Format lives ONLY in `sys()`
  (command.ts): `((OOC-Storyteller: ...))` → `[SYSTEM]: ...` (§7.25) →
  centralized (§7.26) → `[SYSTEM: ...]` (§7.27). The init setup banner is
  `[SYSTEM: Storyteller setup]` (multi-line — not through the hook).
  `stopGeneration` is set when the input was command-ONLY OR any command was a
  read-only query (`QUIET_VERBS`, §7.27) — the hook's cancel-the-turn lever.
- `api.v1.uuid()`, `api.v1.generate` (future Storyteller loop), UI extension
  API (`api.v1.ui.*` — future wizard renderer), permissions for document edit.

## 5. Fine-grained module map

### types/novelai/script-types.d.ts (vendored, ~4.3k lines) — the ambient truth
NovelAI's own declarations, verbatim. No import/export, so every `type`/
`interface`/`declare namespace api` is GLOBAL; `tsconfig.include` globs
`types/`, so it's ambient for all of src/test. This is the ONE definition of
`api`, `UIPart[Registry]`/`UIPart*`, `WindowOptions`, `ModalOptions`,
`LorebookEntry`, `LorebookCategory`, `LorebookCondition`,
`OnTextAdventureInput[ReturnValue]`, `Section`, `Message`, `HookCallbacks`, …
Our code redefines none of these. (It also reveals unused-yet capabilities:
`generate`/`generateWithStory`, decorations, theme, story mode, richer hooks.)

### src/host.ts (25 lines) — release-safe glue only
- `export function log(...)` → `api.v1.log` (ambient).
- Two OUR aliases over ambient types (not NovelAI redefinitions):
  `UiPartHelpers = typeof api.v1.ui.part` (window.ts params),
  `UIHandle = Awaited<ReturnType<typeof api.v1.ui.window.open>>`.
- Declares NO NovelAI type and NO `const api`. This is all of host.ts that
  reaches the release.

### src/host-mock.ts (139 lines) — off-host mock + test hooks, TEST-ONLY
- NOT in `MODULES`, so it never enters dist. Installs `globalThis.api = {...}`
  when absent (3 Map-backed storages, empty lorebook, uuid fallback,
  `hooks.register` that logs, `log`/`error`→console). Typed loosely (assigned
  through `any`; only the runtime surface the engine calls).
- **UI mock**: `window.open`/`modal.open` record `{options}`; the handle's
  `update` merges + re-records; `__mockPart` adds `type`. Test hooks:
  `__resetLorebookMock/__resetStorageMock/__resetUiMock/__uiWindows/
  __uiClickButton(text)` (fires a button's callback → drives the whole
  window→command path off-host). Imported first by the test suite + e2e scratch
  so `globalThis.api` exists before any top-level store construction.

### src/core/traits.ts (300)
- `StringUtil.normalize` (lowercase, trim, spaces→hyphens — **every key in the
  system goes through this**) and `toTitleCase`.
- **`StringUtil.normalizeInput`** — the BOUNDARY normalizer (every string
  entering via commands or lorebook lists): lowercase; strip spaces after `@`;
  strip spaces around `::` and collapse `::`→`:` (the space-tolerant path
  separator — single `:` untouched); strip spaces adjacent to `,`/`+`
  (list/pool separators); whitespace runs → `-`. Idempotent. Backtick literals
  bypass it (the parser's escape hatch). `normalize` stays the lookup backstop.
- `Category` / `PointSource` — frozen value objects (PHYSICAL/…/DISCIPLINE;
  BASE/FREEBIE/EXPERIENCE/DOWNTIME).
- `LedgerEntry`, `StatModifier` (buffs; may bypass cap), `Stat` (dotted trait
  with audit ledger `AuditLog`, creation vs absolute caps, `EffectiveValue`),
  `Tracker` (Stat + spendable temporary: Willpower, Resolve),
  `Pool` (counter with max + per-turn limit: Blood, Quintessence;
  `Spend/Gain/Refill`, per-turn limit **not enforced** — no turn system yet).
- `MoralityPolarity` = "ascending"|"descending"; `MoralityTrait` (value 0–10,
  `Degenerate/Improve` move WITH the polarity, `IsUnplayable` at 10-ascending /
  0-descending).

### src/core/dice.ts (116)
- `Rng` = () => number in [0,1); `Random(min,max,rng)`.
- `Dice.roll(input: number | RollTrait[], options)` → `RollResult`: difficulty
  (default 6), `nAgain` (default 10; 11 disables), `automaticSuccesses` (free
  successes — kept separate from their source by design), explosion chain
  (MAX_DICE 200), botch = initial roll has ≥1 one, 0 successes AND 0 auto
  (a cancelled success is a failure, not a botch). `message` is a full audit
  line with emoji faces (💣 one, 💥 explode, ✅ hit, ❌ miss).

### src/core/damage.ts (401)
- `Severity` — **class** with singletons HARMLESS(0)/BASHING(1)/LETHAL(2)/
  AGGRAVATED(3)/FATAL(4), `ORDER`, `atRank`, `fromName`, `coerce`, `IsAtLeast`,
  `Max`, `Promote()/Demote()` (rank shift, clamped). HARMLESS never marks
  boxes; FATAL = instant dead. **Why a class**: user wanted promote/demote
  mechanics with a hidden numeric rank.
- `DamageKind`/`DamageSource` — **plain strings** (open sets) with `Kind` /
  `Source` constant bags. **Why separate from Severity**: "kind" (fire,
  piercing, silver) is orthogonal to "severity" (bashing/lethal/agg) — a
  packet carries both.
- `DamagePacket` — immutable `{Intensity, Severity, Kinds:Set, Source,
  Soakable}` with `with()`-style copies and `describe()`.
- `ReactionTarget { TraitValue(name) }` — how reactions read a character
  without importing game (keeps core pure).
- `DamageReaction` (interface: `Label`, `Apply(packet, target)`) +
  `UndeadPhysiology` (bullets/blades → bashing; fire/sunlight stay agg),
  `SilverVulnerability` (silver/fire → aggravated AND unsoakable),
  `ArmorReaction` (rating eats intensity for covered kinds).
- **Square-based `HealthTrack`**: per-square `HealthSquareDef {name, penalty,
  heal: "normal"|"never"|"special", healCost, state?}`, `HealthStateDef`
  (a named health state whose label derives from damaged/total linked boxes —
  e.g. poison; config field `states`, summary field `states`, method
  `States()`, runtime pairing `HealthStateSlot`), wrap-around
  upgrade (bashing past capacity upgrades existing), `Overkill`, `Penalty`
  (deepest filled square, values are NEGATIVE: -1, -2, -5), `Level`,
  `IsIncapacitated/IsDead`, `ApplyDamage/Heal/HealWithPoints`, `Summary()` →
  `HealthSummary {bashing, lethal, aggravated, filled, capacity, overkill,
  penalty, level, isIncapacitated, isDead, afflictions}`.
  `STANDARD_HEALTH_LEVELS` = classic 7 (Bruised 0 … Incapacitated -5).
  **Why squares**: afflictions, unhealable/costed boxes; was regressed by a
  fork once and deliberately restored — keep the simple API working on top.
- `SoakTypeRule {soakable, pool: traitNames[]}`, `SoakSpec {bashing, lethal,
  aggravated, difficulty}`.

### src/core/time.ts (151) — pure calendar/clock math (§7.30)
- Real (proleptic Gregorian) time, epoch-SECONDS in/out, no host. Surface syntax
  is `yyyy-mm-dd-hh` (hour optional, `:mm:ss` allowed); durations are
  `s/m/h/d/w/mo/y` tokens ("2w 4h", "1mo"). `daysInMonth`/date construction use
  `setUTCFullYear` so historical years < 100 don't hit Date's 1900 remap.
- `parseStoryDate` (→ epoch | {error}, range-checked), `formatStoryDate`
  (`yyyy-mm-dd hh:mm`, `:ss` only when nonzero). `Duration {months, seconds}` —
  months/years kept apart (calendar-relative) from fixed units; `parseDuration`,
  `addDuration` (month part clamps the day: Jan 31 + 1mo = Feb 28, then adds
  seconds). `diffCalendar(a,b)` → `CalendarSpan` (years/months/days/h:m:s +
  `negative` + `totalSeconds`), computed by counting whole months from the
  earlier endpoint then a fixed remainder (exact + reversible; handles the
  Jan 31→Mar 01 = 1mo 1d borrow case); `formatCalendarSpan` → prose.

### src/wizard.ts (83) — medium-agnostic wizard engine
- `WizardPrompt {step, title, body, kind: choice|number|text|confirm,
  options?, default?, progress?}` — **structured** so a future `api.v1.ui`
  modal renderer can map options to buttons and call the same `answer()`.
- `WizardDefinition {id, title, start(ctx), answer(state, reply)}` over
  **plain-JSON `WizardStateData`** (state persists across turns in storage).
- `resolveReply(prompt, raw)` — option number/value/label, ints, yes/no,
  `keep`/empty → default. ("cancel" is the session layer's job.)
- `renderPromptText(prompt)` — the text medium: one single-line prompt with
  numbered options + hints.
- **Why medium-agnostic**: user wants text prompt→reply now, modals/windows
  later, same wizard logic.

### src/rolls.ts (578) — pure roll machinery
- `RollSpec {pool, difficulty(6), difficultyExpr?, difficultyMod, requires(≥1),
  diceMod, tags[]}` — serializable (that's what enables named rolls);
  `makeRollSpec`. **`difficultyExpr`** (optional) is the difficulty as a pool
  expression — a trait/calculation like `"stamina+3"`; `resolveSpec` evaluates it
  via `parsePoolExpression` against the SAME resolver as the pool, in place of the
  numeric `difficulty`. `describeSpec` shows the expression; `overrideSpec` swaps
  numeric ↔ expression (a numeric override clears any expression).
- `parsePoolExpression(expr, resolve)` — `+`-separated integer literals or
  trait names via a `TraitResolver`; also reused for **expression caps**
  (`"stamina+3"`) and now **difficulty expressions**. Pool source is one token.
- `RollModifier {tag, difficultyMod?, diceMod?, autoSuccesses?, nAgain?}` +
  `RollModifierRegistry` — **tag-driven contextual modifiers**: a roll's
  `tags=` are matched against registered modifiers. Defaults: `acute-senses`
  (-2 diff), `off-hand` (+1), `ambidextrous` (-1), `willpower` (+1 auto),
  `specialty` (9-again). This is how merits/flaws will hook rolls.
- `resolveSpec(spec, resolve, {overDifficulty, extra})` → `ResolvedRoll`:
  applies tag modifiers + an optional ad-hoc `extra` modifier (used by
  resource spends), then **over-10 rule**: die difficulty clamps to [2,10] but
  every point above 10 adds **+1 required success** (`overflow` →
  `effectiveRequires`); policy `"impossible"` refuses instead. **Why**: user
  explicitly rejected silent clamping.
- `executeRoll(...)` → `RollExecution {resolved, result, met, outcome:
  success|failure|botch|impossible}`; `formatExecution` one-liner.
- `overrideSpec(base, overrides)` — partial override, **pool is never
  overridden** (that would be a different roll). The shared primitive behind
  named-roll per-use overrides AND extended-roll continuations (helpers).
- `describeSpec` — one-line spec summary.
- **Extended rolls (pure state machine)**: `ExtendedRoll {id, label, base,
  target, maxRolls, interval(advisory string), onBotch, accumulated,
  rollsUsed, status: open|succeeded|failed, log: ExtendedInterval[]}`;
  `parseBotchPolicy` ("fail" default | "lose-successes"/"lose"/"reset" |
  "ignore"/"continue"); `applyInterval(action, exec, by)` — pure, returns new
  action + note: non-botch adds `max(0, net)`; **botch normally fails the
  whole action** (user rule), lose-successes zeroes progress, ignore wastes
  the interval; then target reached → succeeded, out of rolls → failed.
  `describeExtended` status line. Interval spacing is **advisory** (stored +
  shown; ST decides when the next roll happens — no clock yet).
- **Success tables (the "table-thing")**: a roll never interprets its own count
  — it hands the number to a table. `SuccessTable {name, description?, rows?:
  {at,label,value?}[], valuePerSuccess?, cap?, overflow?:{per,label?,value?},
  botch?, failure?}`; `readSuccessTable(table, outcome, successes)` →
  `SuccessReading {table, outcome, successes(counted after cap), wasted, label,
  value?, extra?}`. Rules: botch/failure/≤0 read their own lines; else counted =
  `min(successes, cap)`, `valuePerSuccess` gives the direct numeric output
  (damage/soak = 1/success), `rows` pick the highest `at ≤ counted` (below the
  lowest row = failure), `overflow` adds a bonus per batch past the last row.
  `describeTableReading` (compact) + `describeTable` (full layout).
  `parseTableRows(raw)` — the [[define-table]] rows mini-grammar
  (comma-separated `<at>:<label>[=<value>]`, verbatim from a backtick literal;
  bad item → `{error}` citing the grammar).
  `DEFAULT_SUCCESS_TABLES` = **degrees** (Marginal→Phenomenal), **damage**,
  **soak**; `SuccessTableRegistry` (static Map seeded from defaults; normalized
  keys; `register`/`get`/`all`/`reset`). **Why**: the user's key insight — one
  mechanism generalizes degrees-of-success ladders, discipline per-success
  effects, AND damage/soak (a table whose output is just a number).
- **Resisted & contested (single comparison)**: `type ContestMode =
  "resisted"|"contested"`; `compareRolls(mode, aExec, bExec)` → `ContestOutcome
  {mode, aNet, bNet, aBotch, bBotch, winner: a|b|none, margin, note}`. **oWoD
  classic** (user choice): a botched side counts 0 (flagged); both botch = mutual
  disaster; RESISTED = only the actor's margin over the resister counts (tie /
  resister-wins → actor fails); CONTESTED = higher total wins, tie = draw.
- **Extended contests (pure state machine)**: `ContestSide {name, base,
  accumulated, char?}` (`char` = opaque game-layer key — a character name, or
  undefined for ad-hoc; rolls.ts never reads it, the interpreter re-resolves the
  pool each round); `ExtendedContest {id, label, a, b, target, maxRounds,
  interval, onBotch, rounds, status: open|a|b|draw, log[]}`; `applyContestRound(c,
  aExec, bExec)` — pure: per-side botch under `fail` loses that side outright
  (both = draw), `lose-successes` zeroes, `ignore` wastes; else accumulate net;
  **first to `target` wins** (a same-round dead heat stays open — nobody got there
  first); `rounds ≥ maxRounds` → draw. `describeContest` status line.

### src/rules.ts (891) — all game DATA
- `ATTRIBUTES {physical, social, mental}` + `ALL_ATTRIBUTES` (the fixed nine).
- `RulesetConfig` (freebie/XP/downtime costs — placeholder until the real cost
  engine; `VAMPIRE`, `MAGE` presets).
- Soak specs: `MORTAL_SOAK` (bashing only, Stamina), `VAMPIRE_SOAK`
  (b/l Stamina+Fortitude, agg Fortitude only), `MAGE_SOAK` (=mortal),
  `DEMON_SOAK` (all three, Stamina), `WEREWOLF_SOAK` (all three; silver/fire
  handled by reaction instead).
- `bloodForGeneration(gen)` — classic table gen 3–15 → `{max, perTurn}`.
- Roads: `RoadDefinition {name, virtues[3], ratingVirtues[2]}` —
  `ROAD_OF_HUMANITY` (conscience/self-control/courage), `ROAD_OF_KINGS`
  (conviction/self-control), `ROAD_OF_THE_BEAST` (conviction/instinct).
  `MoralityConfig {name, polarity, road?, deriveFromVirtues?, start?}`;
  `HUMANITY_MORALITY` (descending, derive from virtues).
- **THE EFFECT GRAMMAR** (the "complete abstraction" — every resource effect
  is one sentence: *spend [cost] → apply [op] to [target] at [amount] per
  unit, lasting [duration], at most [limits]*):
  - `EffectOp {op, target?, amount?, fillToCap?, cap?: number|string}` —
    **`op` and `target` are OPEN string vocabularies**; unknown words are
    stored/shown/ST-adjudicated until an interpreter lands (user requirement:
    abilities/powers that don't exist yet can't be hardcoded). Interpreted
    ops today: `difficulty|dice|successes|nagain` (roll modifiers; `target` =
    optional action tag the roll must carry), `increase` (trait raise;
    `target` = constraint: group/bucket/specific trait), `heal`
    (`target` = "bashing,lethal" or "all").
  - `EffectCost {units?, buys?, reducedBy?: {pool, difficulty?, perSuccess?}}`
    — multi-unit pricing + Iron-Will-style cost-reduction roll (can hit 0).
  - `EffectDuration {kind: instant|real|st|until, n?, unit?, until?}` —
    stored + shown "(ST-enforced)" until the turn system.
  - `EffectLimits {maxPerUse? (enforced), uses? {n, per} (ledger-counted,
    ST-enforced), cooldown? (stored)}`.
  - `EffectSpec {label, apply: EffectOp[], cost?, duration?, limits?,
    targetMustBe?}` — one cost buys a bundle of ops; `apply: []` = pure cost
    (static spell fuel). `targetMustBe` awaits targeting-others.
- `ResourceDef` — tracker/pool numbers (`start/startMin/startMax/startOptions/
  max/perTurnLimit/fromGeneration`) + `roles?: string[]` (abstract
  capabilities: a resource with role "resolve" answers to `spend=resolve` —
  "use Quintessence as Resolve" is pure data) + `replaces?: string[]` (this
  resource HIDES the named ones and answers to their names) + `effect?`
  (default) / `effects?` (named contexts: cast/heal/boost/fuel…).
- `resourceEffect(def, name?)`, `describeEffect(spec)`.
- Resource factories: `willpowerResource(start)` (+1 auto success; named
  `fuel` = pure cost — Sorcerers/Thaumaturgy pay Willpower as spell fuel),
  `resolveResource(over)` (default -2 difficulty; named `cast` = +1 success +
  8-again + -2 diff bundle, 3/scene ledger demo), `bloodResource(over)`
  (named `heal` = 1 bashing/lethal per point; named `boost` = +1 Physical
  attribute per point, 1-scene duration demo).
- `TemplateConfig(Name, Rules, Pools, Soak, Morality|null, HasVirtues,
  HealthLevels?, Reactions?)`; `get Resources()` alias; `GetPool(name)`.
- Templates (`TEMPLATES` registry keys): `mortal`, `thrall` (Resolve locked
  to start 1 — a thrall's flicker of power), `vampire` ("Vampire (Dark
  Ages)": blood `fromGeneration`, UndeadPhysiology), `mage` ("Mage (Dark
  Ages)": **Foundation & Pillars, NOT Spheres; no Paradox**; Quintessence
  only pool; no morality/virtues), `demon` ("Demon (Dark Ages: Devil's
  Due)": Resolve 1–10 start 3–5; **Torment = ASCENDING morality start 3,
  unplayable at 10**; has **Arcana not Lores** — Lores may come later as a
  DtF-style option), `werewolf` (modern-WoD illustration for
  SilverVulnerability; Rage/Gnosis), `ghoul` (mortal + blood pool they do
  NOT generate, starts 0; 2 discipline dots incl. Potence is documented but
  **unenforced** until creation is modelled), `sorcerer` (**static/linear
  magic**; mechanically mortal until Paths land).
- `resourcesForTemplates(keys, overrides?)` — union across templates deduped
  by name (first wins numbers, roles merged), then **overrides** (the
  house-rule layer) patch by name or append custom resources (need
  kind+start+max). Zero/unknown templates → mortal baseline.
- `healthLevelsForTemplates(keys)` — first template's track wins.
- Disciplines: `DISCIPLINES` registry (name, arena, in-clan Dark Ages clans).
  Wired mechanics: **Potence** (rating = auto successes via
  `LiveCharacter.Roll {potence:true}`), **Fortitude** (soak dice; lets you
  soak what your template can't); the rest are dots + generic
  `bonusDiceFrom` until per-power effects exist.
- Merits & Flaws: `MeritFlawDef {name, kind, points: n|n[], requires?
  {templates any-of, tags all-of, meritsFlaws all-of}, description}`;
  `DEFAULT_MERITS_FLAWS` (15 defs incl. Iron Will, Acute Senses… and the
  Devil's Due arcana). **Owned-power pattern (§7.23)**: `MeritFlawDef` gains
  `param?` (instance-parameter slot — owned as `name:<value>` instances,
  typed `name::value`), `passive?: EffectOp[]` (always-on ops; amounts SCALE
  by points taken; `"$<param>"` fields substitute the instance value) and
  `atMostOneAt?` (advisory cross-instance cap). `EffectOp` gains the
  **`trait` gate** (twin of the actionTag `target` gate): the op applies only
  when the roll's POOL used that trait. Helpers: `resolveMeritInstance(key,
  lookup)` (splits `base:param` only when the base def declares `param`;
  param defs owned bare are malformed) and `passiveOpsOf(def, param, points)`
  (substituted, scaled). Shipped arcana: **trait-affinity** {param: trait,
  atMostOneAt: 3, passive difficulty −1/point} and **trait-enhancement**
  {param: trait, passive enhance +1/point}.
- SRD lorebook seeds: `SRD_HEADER_MARKER = "====="` — **every data entry is
  human instructions ABOVE the marker, data BELOW it** (user design: the
  tutorial lives in the entry card itself, no separate readme). `srdEntryText`
  helper; `SRD_CATEGORIES`: `srd:abilities` (entries `srd:abilities:talents`
  /`:skills`/`:knowledges` — one name per line, `#`//`//` comments),
  `srd:backgrounds` (`srd:backgrounds:all`), `srd:merits-flaws`
  (`srd:merits-flaws:custom` — JSON array merged over defaults).
- **Constraint groups (pure)**: `ConstraintGroup {name, relation:
  exclusive|restricted|forbidden, domain: background|merit|flaw|meritflaw|any,
  members[], max?, scope?[], note?}`; `ConstraintViolation {group, relation,
  detail}`; `makeConstraintGroup` (normalize + default: bad relation→exclusive,
  bad domain→any, exclusive max≥1), `describeConstraint`, and
  `checkConstraints(groups, owned: OwnedTraits{backgrounds,merits,flaws,templates})`
  → violations: **exclusive** owns > max; **forbidden** owns a member in scope;
  **restricted** owns a member OUTSIDE its reserved scope (empty scope =
  universal). Both senses of "exclusive" covered (mutual-exclusion vs reserved
  access). Enforced at creation later; surfaced now via `[[check-constraints]]`.
- **Afflictions (pure data)**: `AfflictionDef {name, description?, bindings?[]
  (required slots like "target"), duration?: EffectDuration (advisory), then?
  (successor for [[advance]]), mirror? (affliction the bound target gains, bound
  back), tags? (join the afflicted character's rolls), note?}` +
  `makeAfflictionDef` (normalize), `describeAfflictionDef`,
  `parseAfflictionDuration("1 turn"|"2 scenes"|"until x"|"instant")` →
  EffectDuration, `describeDuration`. `DEFAULT_AFFLICTIONS` = the **Feral
  Speech** exemplar: `concentrating-on {target, 1 turn, then feral-whispers}`
  and `feral-whispers {target, 1 scene, mirror feral-whispers}`. The NAMING
  reservation (§7.22) lives as a comment above `AfflictionDef`: an affliction
  is any parameterized state — good, bad, neutral, or uncategorizable — and
  the word "condition" is reserved for future predicates. (Health-box states
  are the separate `HealthStateDef` in core/damage.ts.)

### src/command.ts (185) — the command bus (pure; depends on core/traits only)
- **`sys(body)`** (§7.26–7.27) — THE engine output formatter: `sys(body) =
  \`[SYSTEM: ${body}]\``. Every command reply routes through it (game.ts,
  window.ts) AND the init setup banner (services.ts imports it — the one
  services→command dependency, allowed by layering). The output format (bracket
  style, label) lives HERE and nowhere else: re-tagging the engine voice (or a
  future general `speak(speaker, body)`) is a one-line change, never a sweep.
  Re-exported via index.
- `ParsedCommand {name, positional[], named{}, raw}` + `CommandParser.parse` —
  quote-aware tokenizer; body-level gluing BEFORE tokenization (`@`-space and
  `::`-space stripped, backtick spans protected), then **every token/value
  passes `StringUtil.normalizeInput`** EXCEPT backtick literals (verbatim —
  the display-text escape hatch). `raw` stays raw.
- **`CommandSpec`** — the ONE declarative description of a verb's grammar:
  `{summary, params?: ParamSpec[], openNamed? (arbitrary extra named args -
  afflict's slots), note?}`; `ParamSpec {key, kind: positional|named,
  type?: string|int|enum|literal, required?, options? (enum vocabulary -
  reference the exported rules arrays), default? (window pre-seed AND compose
  fallback), hint? (help display), desc? (window label), example? (window
  placeholder)}`. Specs DESCRIBE, handlers VALIDATE - a spec never rejects.
- `describeCommandSpec(verb, spec)` — derives the one-line usage `[[help]]`
  shows (`<pos>`, `[optional]`, `key=a|b|c` enums, `key=N` ints, hint wins,
  `(summary; note)` tail, `[<key>=<value> ...]` when openNamed).
- `composeCommand(verb, values, spec)` — THE one quoting/sanitizing composer
  (windows submit through it): declared params in order then openNamed extras;
  empty values omitted; values with whitespace quoted; embedded `"` stripped
  (the grammar deliberately has NO escape syntax — players type these);
  `literal` params composed in backticks (embedded backticks stripped).
- `CommandRouter` — verb → `{handler, spec}` registry:
  `register(verb, handler, spec)`, `verbs`, `specFor`, `helpFor`/`help`
  (DERIVED via describeCommandSpec), `route(body, ctx)`; `CommandContext
  {rng?}`. **`beforeRoute(hook)`**: game-registered async hooks run before
  every dispatch (dependency inversion — the router knows NOTHING about
  stores; game.ts registers the creator-mode sync). Unknown verb lists all.

### src/services.ts (634)
- `ScopedStorage(prefix = api.v1.script.id)` — story-scoped KV where every key
  is `<prefix>_<key>`: `get/getOrDefault/set/setIfAbsent/has/delete/list`
  (list strips the prefix back off) + `temp*` variants on tempStorage.
- `LorebookManager` — name→id resolution (`categoryIdByName`), reads
  (`entriesInCategory`, `entryText`), the marker convention
  (`contentBelowHeader` — everything above a `={3,}` line is ignored;
  `parseList` — line list with comment stripping, items **boundary-normalized**
  via `normalizeInput`; `listFrom`), writes
  (`updateEntryText`, `ensureCategory`, `ensureEntry` — create-if-missing
  keeping `api.v1.uuid()` ids), ability list accessors (`allTalents/allSkills/
  allKnowledges/allBackgrounds`), and `bootstrap(specs=SRD_CATEGORIES)` —
  creates missing categories + seeds tutorial entries, returns the OOC setup
  message. **Existing player categories are never touched.**
- **Tracked cards (the virtual-subcategory machinery, §7.21)**:
  `GENERAL_ENTRY = "general"`; `CONFIG_GENERAL_HEADER`/`TABLE_GENERAL_HEADER`
  seed texts. `structuralHash(text)` — content-below-marker only (header edits
  never conflict), canonical-JSON (recursively sorted keys) djb2, text
  fallback. **`TrackedLorebook`** — storyStorage `lb:ids` (`cat:<name>` /
  `ent:<category>/<entry>` → uuid) + `lb:backup:<category>/<entry>` (full
  text); `remember/idFor/backupOf/refreshBackup/forget/trackedEntries`;
  **`reconcile()`** → `ReconcileFinding[]`: alive-by-id → backup refresh;
  recreated + hash-equal → ADOPT the new uuid silently (never recreate a card
  to keep an old id — ids only mean anything through the map); hash-differ →
  `conflict {foundId, foundText, backupText}`; gone → `missing {backupText}`.
  Pure detection — game.ts owns the modals. `adopt(category, entry, id, text)`.
  `writeTrackedEntry(category, entry, text)` — write-through + ids + backup
  (all config stores inherit via `writeConfigEntry`). `ensurePath(virtualPath,
  header?)` — real category `wod:<path>` + tracked `general` (never touches an
  existing card's text). `combineConfigTexts(backup, found)` — array
  (name-keyed) or map union, the FOUND (player's newer) defs win, found's
  header kept; unparseable → undefined (modal hides Combine).
- **Generic config stores** — THE `wod:config` pattern as two classes (a
  concrete registry is an instance, not a re-implementation):
  `ListConfigStore<T extends {name}>` (JSON array or name→def map; overlay
  SHADOWS optional shipped `defaults`; `get/all/reset/loadFromLorebook/save/
  put/remove` — remove is overlay-only so defaults resurface; `onChanged`
  hook fires on EVERY cache change, the seam for stores projecting into a
  separate registry) and `MapConfigStore<V>` (name→value map;
  `current/reset/loadFromLorebook/save`). Shared internals: tutorial-header
  entry text, array-or-map parse, ensureCategory/ensureEntry/update write.
  `CONFIG_CATEGORY = "wod:config"`. **Instances self-register into
  `ALL_CONFIG_STORES`** → `reloadAllConfigStores()` (returns per-entry counts;
  used by init + the creator-mode hook) and `resetAllConfigStores()` (tests).
  Adding a registry never touches a sync point again.
- `MeritFlawRegistry` — in-code defaults + `loadFromLorebook()` merging any
  JSON arrays found in `srd:merits-flaws`; `get/all/register/reset` (kept
  OUT of the config-store family: different shape — multi-entry category merge).
- `LorebookParser.ParseFromApi()` — zero-dot Stat maps from the lorebook
  ability/background lists.

### src/state.ts (1614) — the character model + every persistent store
**Legacy-but-working sheet objects** (predate PlayableCharacter; used by tests
and the future "ready character" path):
- `LiveCharacter` — full sheet: Attributes/Abilities/Backgrounds (Stat maps),
  Trackers, Pools, Virtues, Traits, Disciplines, Tags, MeritsFlaws, Morality?,
  Soak, Reactions, Health (`HealthTrack`), XP/downtime awarding + spending;
  `TraitValue(name)` across buckets; `MeetsRequirements` (template/tags/
  merits prereqs with waive); `AddMeritFlaw`; `Roll(input, {potence,
  bonusDiceFrom, automaticSuccesses…})`; soak pipeline: `_soakRule` (+
  Fortitude fallback), `SoakPoolFor`, `RollSoak`, `ResolveIncoming` (folds
  `Reactions` over a packet with trace), `TakePacket`/`TakeDamage` →
  `DamageReport`; `SaveToStory()` (serializes to `char_<name>` via
  ScopedStorage — legacy path, marked for unification).
- `CharacterFactory.create(template, name, opts: CharacterCreationOptions)` —
  builds a LiveCharacter honoring `ResourceDef` start constraints
  (`_resolveStart`), virtues (default 1), Willpower=Courage derivation when
  virtues were engaged, generation-sized blood, morality (derived from the
  road's two rating virtues when `deriveFromVirtues`), tags→merits ordering.

**Playable characters (the current creation path)**:
- `PlayableCharacter` record: `{id: uuid (the FOREVER identity — recoverable
  from storyStorage even if the lorebook entry is deleted), name, templates[]
  (1+, hybrids legal, merge resolved later), stage: "potential"|"ready",
  attributes, abilities, backgrounds, virtues, disciplines, traits,
  poolStarts, meritsFlaws, tags[]}`.
- `CharacterStore` — `newPotential(name, templates)` seeds **all nine
  attributes at 1, every lorebook ability at 0, willpower poolStart 0, empty
  meritsFlaws/backgrounds** ("play before allocating anything" principle);
  write-through `save()` (lorebook entry FIRST — it is the source of truth —
  then storage), `load`, `syncFromLorebook()` (lorebook→storage, player edits
  win, unparseable reported not synced), selection: `setCurrent/getCurrent`
  (current → default → the single existing character), `setDefault/
  getDefaultName`, `listNames`. Keys `pc:<name>`; pointers
  `current-character`, `default-character`. First created character becomes
  default+current automatically.
- Lorebook: category `wod:player-characters`, entry `pc:<normalized-name>`,
  instructions above `=====`, character JSON below.

**Named rolls**: `NamedRollStore` — ONE lorebook entry
(`wod:named-rolls` / `wod:named-rolls:library`) holding a JSON map
`{name: SavedRoll}` where **`SavedRoll = RollSpec & { spend?; specialty?;
table? }`** (game-layer sidecars kept OUT of the pure RollSpec, stored raw and
resolved at invoke time); **read fresh every call** (no cache) so hand edits
are always live; `all/get/names/save/remove`. On `[[roll @name]]` the sidecars
apply automatically — spend auto-paid (via `applySpend`'s `spendOverride`),
specialty applied, table read against the outcome — each unless the command
supplies its own `spend=`/`specialty=`/`table=`. The saved pool must be a real
expression (`name-roll` refuses `@` references, like extended-roll).

**Extended rolls**: `ExtendedRollStore` — storage keys `xroll:<id>` + pointer
`current-extended`; `resolve(id?)` = explicit id → current-if-open →
single-open (else undefined/ambiguous).

**Extended contests**: `ExtendedContestStore` — mirrors ExtendedRollStore;
storage keys `xcontest:<id>` + pointer `current-contest`; same `resolve(id?)`.

**Players**: `PlayerStore` — the engine's first identity concept. Plain
normalized id strings (no record); `STORYTELLER = "storyteller"` always valid;
storage keys `current-player` + `default-player`, both defaulting to
storyteller. `current()/setCurrent/getDefault/setDefault`. `[[player]]`
shows/switches (`default=true` also sets the default).

**Aliases**: `AliasRegistry` — ONE storyStorage key `aliases` =
`{global: {alias→target}, players: {pid→{…}}, characters: {ckey→{…}}}` (all
normalized; alias keys stored WITHOUT `@`; targets may name NPCs — no record
required until used). `set/remove/lookup(scope, owner, alias)` +
`resolve(alias, {charKey?, playerKey?})` walking **character → player →
global**. `parseAliasToken(token)` (post-normalization single-`:` forms):
`@global:a` · `@player:<id>:a` · `@char:<name>:a`/`@character:<name>:a` · bare
`@a` (chain); malformed → undefined. Pool-position `@` stays the
named-roll sigil (disambiguated by position). Character names may not start
with `@` (creation refuses). Display: names store normalized; replies render
Title Case (`disp()` in game.ts = `StringUtil.toTitleCase`; contest notes in
rolls.ts do the same for side names).

**Config registries** — four INSTANCES of the services.ts generic stores
(surfaces unchanged from their hand-rolled predecessors; each self-registers
into `ALL_CONFIG_STORES`, so init + the creator-mode hook reload them all
without naming them):
- `ResourceOverrides` = `MapConfigStore<Partial<ResourceDef>>` on
  `wod:config:resources` (`RESOURCE_CONFIG_ENTRY`) — the house-rule layer;
  `current()` feeds `CharacterResources.defsFor`; the wizard `save()`s it.
- **`TableLibrary`** (NOT a ListConfigStore — tables live in a category TREE,
  §7.21): `TABLES_CATEGORY = "wod:config:success-tables"` names the tree root.
  Implements ConfigStoreLike (self-registers; `entry` label = the root).
  `loadFromLorebook()` enumerates the root category + every
  `wod:config:success-tables:<sub>` (one level; deeper ignored), parses EVERY
  card per category (general first, others by name — a later card SHADOWS an
  earlier one), registers into the pure `SuccessTableRegistry` (reset first —
  built-ins reseed) under `name` (root) / `<sub>:name` keys. `put(def, sub?)`
  → `ensurePath` + read-modify-write the GENERAL card (returns `{shadowed}`
  when another card wins the key). `remove(key)` edits general only (reports
  `still: "built-in" | "another-card"`). `subcategories()`. `reset()` =
  registry reset.
- **`TableAliases`** — storyStorage `table-aliases` flat map alias→tableKey
  (stored without `@`, normalized); `all/set/remove/resolve`. Position
  disambiguates the sigil: `table=` slot → table alias.
- `ConstraintRegistry` = `ListConfigStore<ConstraintGroup>` on
  `wod:config:constraints` (`CONSTRAINTS_ENTRY`), no defaults,
  make=`makeConstraintGroup`.
- `AfflictionRegistry` = `ListConfigStore<AfflictionDef>` on
  `wod:config:afflictions` (`AFFLICTIONS_ENTRY`), defaults=`DEFAULT_AFFLICTIONS`
  (the overlay SHADOWS built-ins; `remove` is overlay-only so
  `forget-affliction` resurfaces them), make=`makeAfflictionDef`.

**`CreatorMode`** — the hand-editing flag (storage key `creator-mode`,
unchanged); `enabled()/set(on)`. The router's game-registered hook consults it.

**Live per-character afflictions**: `ActiveAffliction {def, bindings:
{slot→normalized name}, note?}`; **`CharacterAfflictions`** — storyStorage
`affl:<name>`, keyed by NORMALIZED NAME, character record NOT required (an NPC
animal can carry a mirror); `list/afflict (replaces an instance of the same
def)/lift (returns the removed instance)/clear/tags` (union of active defs'
tags).

**`resolveTraitFromRecord(char, name)`** — a record's numeric buckets
(attributes → abilities → backgrounds → virtues → disciplines → traits →
poolStarts → 0); shared by game.ts roll plumbing and `CharacterBoosts` caps.
Returns the UN-ENHANCED base by design (XP prices from it); Trait Enhancement
folds in at the roll env.

**Owned powers (state side)**: `PlayableCharacter` gains
`specialties?: Record<trait, string[]>` (VERBATIM labels — display text;
seeded `{}`). `ownedMeritInstances(char)` resolves the meritsFlaws bucket's
keys (incl. `name:<param>` instances) through the registry (unknown keys
skipped here, surfaced by check-constraints); `passiveOpsFor(char)` = every
substituted+scaled passive op; `enhancementsFor(char)` = per-trait "enhance"
totals (effective bonus + advisory advancement ceiling).

**Live per-character state** (all story-scoped via ScopedStorage, keyed by
normalized character name; all default lazily from the record/template):
- `CharacterResources` — `res:<char>` → `{resourceName: current}`. `defsFor`
  (union + overrides + replaces-filter), `resolveDef(nameOrRole)` (name →
  role → replaces), `current/all/spend/gain` (clamped 0..max; start =
  `poolStarts[name] ?? def.start`).
- `CharacterHealth` — `hp:<char>` → `{bashing, lethal, aggravated}` counts;
  `track()` rebuilds a real HealthTrack (agg→lethal→bashing order) from
  `healthLevelsForTemplates`, so penalty/incapacitation/overkill are computed
  by the real engine; `damage/heal (worst-first among allowed)/summary`.
- `CharacterBoosts` — `boost:<char>` → `{trait: bonus}`;
  `resolveIncreaseTarget(char, constraint, targetArg)` (constraint = attribute
  group | record bucket | specific trait; group/bucket needs the arg) and
  `add(char, trait, amount, cap)` where **cap bounds record dots + boost
  total**; `all/clear`. Boost duration is ST-adjudicated (`[[clear-boosts]]`)
  until the turn system.
- `EffectUses` — `uses:<char>` → `{resource:effect → count}`; `record/count/
  counts/resetAll`. The advisory usage ledger; the turn system will enforce
  from this data.

**`WizardSession`** — storage `wizard:active` = `{def, state, prompt}`
(`ActiveWizard`); `get/set/clear`. The definitions and the reply loop live in
game.ts.

### src/game.ts (3041) — the verbs (interpreter, wizards, handlers, registrations)

**Table seam + modals**: `resolveTableRef(raw)` — the ONE place a table
argument (`key`, `sub::name`, or `@table-alias`) becomes a registry key;
`tableNote(raw, outcome, successes)` reads a table REF through it for rolls
AND contests — the caller resolves the ref (`cmd.named["table"] ?? savedTable`
in rollAndReport, so a SavedRoll's table sidecar applies unless overridden).
`confirmModal(title, body, actions[])` — generic `api.v1.ui.modal.open`
prompt (actions run + show their outcome in-modal; Cancel/Close dismiss) —
game-flow confirmations are MODALS here, distinct from window.ts' spec-driven
form WINDOWS (build order: game precedes window, so the modal helpers can't
live there). Uses: (1) `define-table` with a missing subcategory → "Create
table category?" (the pending def rides the closure); (2)
**`reconcileLorebook()`** — TrackedLorebook findings → adopted = note only;
conflict → modal [Keep the new card / Combine both (hidden when unparseable) /
Restore the old card]; missing → [Restore from backup / Forget it]; every
action reloads all config stores; each distinct drift prompts ONCE per
session (tempStorage guard `recon:<cat>/<ent>:<kind>:<hash>`). Runs at init
and FIRST in `syncFromCreatorEdits()`.

**Creator-mode sync (the router's game-side hook)**: `syncFromCreatorEdits()` =
`CharacterStore.syncFromLorebook()` + `reloadAllConfigStores()`; registered
once as `CommandRouter.beforeRoute(async () => { if (await
CreatorMode.enabled()) await syncFromCreatorEdits(); })` and reused by
`cmdCreatorMode`'s off-path. THE former triplicated 5-store reload list is
gone — a new registry reaches every sync point by existing.

**Character-argument seam**: **`resolveCharacterRef(token)`** turns a
character argument (real name or @alias, via `parseAliasToken` +
`resolveAliasOwner` + the registry chain) into a normalized name — wired into
`cmdPlay`, `cmdRollFor`, `cmdSetDefault`, `cmdSheet`, affliction binding
values (`resolveBindingValue`), and the `vs=` of
`cmdVersus`/`cmdExtendedContest`. `disp()` = `StringUtil.toTitleCase` for
replies. **`cmdSheet`** renders the record as the engine reads it: every
numeric bucket through the `characterRollEnv` resolver, so the sheet marks
`base (eff)` wherever enhancement/boost changes what a roll uses — the
verification half of the creator-mode manual-fill loop (edit the pc: entry's
JSON, any command syncs it, `[[sheet]]` shows what landed).

**Owned powers in play**: `poolTraitsOf(char, pool)` — THE gate seam: a
pre-parse of the POOL ONLY (a trait appearing just in the difficulty
expression does NOT count as used; `resolveSpec` feeds both through one
resolver, hence the separate pass). `characterRollEnv` resolver = record +
`enhancementsFor` + boosts. `passiveRollExtra(char, poolTraits, tags)` folds
owned passive roll ops into rolls, `cmdVersus`'s side AND `execContestSide`
(named sides; unmet gates skip SILENTLY — passives don't spam).
`resolveSpecialty(char, ref, poolTraits)` — trait or label, ambiguity
refused, pool-must-use-trait advisory, `diceMod +1`, at most ONE per roll;
`specialty=` rides ROLL_KNOBS and the SavedRoll sidecar. `applySpend`/
`applyEffectSpec` thread `rollTraits` so SPEND ops honor the trait gate
("needs a roll using X - skipped"). `unmetRequirements` +
`meritInstanceFindings` (unknown keys, atMostOneAt) feed take-merit and the
check-constraints report — reported even when ZERO constraint groups exist
(the check no longer short-circuits on an empty registry); `ownedTraitsOf`
resolves parameterized keys for the merit/flaw split.

**Afflictions in play**: **tags bite** via `withAfflictionTags(name, spec)` —
merges active affliction tags into the RollSpec (deduped) in `rollAndReport`,
`cmdVersus` (my side), and `execContestSide` (named sides), so registered
RollModifiers fire on every roll the afflicted character makes. Helpers:
`resolveBindingValue` (@aliases else normalize — NPC strings fine),
`afflictionSubject` (`on=` else current character), `afflictionLine`,
`applyAffliction` (validates required bindings BEFORE any write; fires
`def.mirror` onto `bindings.target` bound back `{target: subject}` + note
"(mirror)"), `removeAffliction` (lift + lift the mirror from the bound
target). `cmdAdvance` = the manual chain trigger (turn system will automate):
removes the instance, applies `def.then` CARRYING BINDINGS FORWARD
(successor's mirror fires). `cmdLift` `spend=` = the Willpower shrug-off via
`applySpend` (requires a sheet; NPCs can be lifted but not spend). Durations
render via `describeDuration` + "(ST-enforced)". `ownedTraitsOf(char)`
(backgrounds/merit/flaw keys, merit-vs-flaw via MeritFlawRegistry, templates)
feeds `checkConstraints`.

**The effect interpreter**: `applyEffectSpec(char, def, effectName, spec,
{targetArg?, applications?, rng?, rollTags?})` →
`{extra?, notes[], refuse?, insufficient?}`:
increase-targets are validated **before any cost is paid**; applications clamp
to `maxPerUse`; cost = units×applications minus the `reducedBy` roll's net
successes × perSuccess (floor 0); `insufficient` when unaffordable (caller
maps: mandatory → refuse, optional → note-and-roll-anyway); ledger recording +
"use N/M per X (ST-enforced)" notes; ops: roll ops accumulate into `extra`
(action-tag gated: skipped + noted if the roll lacks the tag), `increase` via
boosts (expression caps via `parsePoolExpression`, `fillToCap`), `heal` via
CharacterHealth, **anything else → "recorded — Storyteller adjudicates (no
interpreter yet)"**; non-instant durations noted "(ST-enforced)".

**Wizards (the resources wizard; session storage is in state.ts)**:
- `RESOURCES_WIZARD` (`WIZARD_DEFS.resources`) — per-resource
  keep/customize → start → max → effect knob (first `difficulty|dice|
  successes` op's amount, via `knobIndex`) → roles step (text: `"resource:
  role"` repeatable, "done") → confirm (diff summary) → saves via
  `ResourceOverrides.save` + reload. State `RwState` is plain JSON.
- `answerActiveWizard` — "cancel" exits; `resolveReply` errors re-prompt;
  `done` clears session + summary.
- `cmdConfigureResources` / `cmdCancelWizard`.
- **Input seam**: in `processAdventureInput`, when a wizard is active and the
  input contains **no** `[[commands]]`, the whole input is the wizard reply
  (prompt→reply conversation, `stopGeneration: true`); `[[commands]]` still
  route normally mid-wizard.

**Registrations**: every verb registers `(name, handler, CommandSpec)` at the
bottom of game.ts (`ROLL_KNOBS` is the shared difficulty/diff-mod/requires/
dice-modifier/tags/spend param slice; `SPEND_HINT = "res[::effect][!]"`). Enum
params reference the EXPORTED rules vocabularies (`CONSTRAINT_RELATIONS`,
`CONSTRAINT_DOMAINS`) — a new relation reaches help AND the window by being
added to the array. Parser/router/spec machinery itself lives in
`src/command.ts` (see its section). `afflict` is the one `openNamed` spec
(its slots depend on the affliction def).

**`processAdventureInput(rawInputText)`** — extracts every `[[...]]`, routes
each, replaces with single-line `[SYSTEM: ...]` notes; `stopGeneration: true`
when the input was command-ONLY **or** any command's verb is in **`QUIET_VERBS`**
(the game-layer set of read-only query commands — help/characters/sheet/
resources/health/merits/tables/… — kept OUT of the pure CommandSpec; it uses
`CommandParser.parse(body).name` to test each match); non-command input →
wizard reply (if active) else untouched (`undefined`).

**The command surface** (registered verbs; [[help]] DERIVES each line from the
verb's CommandSpec at the bottom of game.ts — the grammars below match it):
`help [verb]` (list commands, or one's usage) ·
`creator-mode set=true|false` · `create-playable name="…" templates="a,b"` ·
`play [name="…"]` (no name → default) · `characters` (list; marks
current/default) · `sheet [name|@alias]` (the record as the ENGINE reads it —
all numeric buckets, merits, specialties; effective value marked when
enhancements/boosts differ: `strength 1 (3 eff)`; the verification half of
the creator-mode manual-fill loop) · `set-default name="…"` · `roll <pool|@name>
[difficulty|expr] [diff-mod] requires= dice-modifier= tags= spend=res[:effect][!]
table=` (difficulty may be a number OR a trait/calculation like `stamina+3`) ·
`roll-for "Name" <pool|@name> …` (doesn't change selection) ·
`name-roll <name> <pool> … [spend=…] [specialty=…] [table=…]` (bakes in the
sidecars; refuses a `@` pool) · `list-rolls` (shows sidecars) ·
`forget-roll <name>` ·
`extended-roll <pool> requires=<target> intervals=<max> [interval=] [label=]
[on-botch=…] + roll knobs` (rolls interval 1; `requires` is repurposed as the
ACCUMULATED target) · `continue-roll [id] [named overrides]` (whoever is
current continues — collaborative; named-only overrides so the id positional
can't be mistaken for a pool) · `roll-status [id]` · `cancel-roll [id]` ·
`resources` · `spend <resource[:effect]> [target] [amount] [reason="…"]` ·
`gain <resource> [amount]` · `damage <severity> [n]` · `health` ·
`clear-boosts` · `reset-uses` · `configure-resources` · `cancel-wizard` ·
`resist <your-pool> <their-pool> [vs="Name"] [difficulty=] [vs-difficulty=]
[table=] [spend=…]` · `contest <your-pool> <their-pool> …` (same shape) ·
`extended-contest <your-pool> <their-pool> target=<n> rounds=<max> [vs="Name"]
[label=] [interval=] [on-botch=…] [difficulty=] [vs-difficulty=]` ·
`continue-contest [id] [difficulty=] [vs-difficulty=] [named overrides]` ·
`contest-status [id]` · `cancel-contest [id]` · `tables [name]` ·
`define-table name="[sub::]name" [rows=<literal: 1:Cowed, 3:Terrified[=2]>]
[value-per-success=N] [cap=N] [overflow-per=N] [overflow-value=N]
[overflow-label=..] [botch=..] [failure=..] [description=..]` (writes the
addressed category's GENERAL card; rows/labels are BACKTICK literals — case
survives; naming a built-in SHADOWS it; a MISSING subcategory prompts a
create-it modal; refuses a table with nothing to read) ·
`forget-table <[sub::]name|@alias>` (general card only; built-ins/shadowing
cards resurface) · `define-table-category name=".."` (creates
wod:config:success-tables:<name> + its general card) ·
`table-alias [@a "<[sub::]name>"]` (no args = list; table=@a resolves;
advisory when the target doesn't exist yet) · `forget-table-alias <@a>` ·
`win-table` (window over define-table) ·
`win-affliction` (define-affliction form; then/mirror pickers) ·
`win-afflict` (pick an affliction → its binding slots appear → routes afflict) ·
`win-roll` (the roll BUILDER: one window multiplexing roll / roll-for /
name-roll — For picker chooses the verb, pool picker offers @saved, knob
fields walked from roll's spec with spend/specialty/table pickers, Save as →
name-roll) ·
`define-constraint name=".." relation=exclusive|restricted|forbidden
domain=background|merit|flaw|meritflaw|any members="a,b" [max=N] [scope=".."]
[note=".."]` · `constraints` · `constraint <name>` · `forget-constraint <name>` ·
`check-constraints` (constraint conflicts + merit-instance caps + unknown
merit keys) · `take-merit <name[::param]> [points] [waive=true]` ·
`drop-merit <name[::param]>` · `merits` (instances + enhancement
base→effective→ceiling + advisory issues) · `specialty <trait> <literal>` ·
`forget-specialty <trait> [<literal>]` · `specialties` · (roll knob
everywhere: `specialty=<trait|label>` — ONE specialty, +1 die, pool must use
its trait; SavedRoll carries it as a sidecar) ·
`win-constraint` (opens the constraint window - registered
in `src/window.ts`, emits `define-constraint`) ·
`define-affliction name=".." [bindings="target"] [duration="1 turn|until x|
instant"] [then=".."] [mirror=".."] [tags="a,b"] [description=".."]
[note=".."]` · `affliction [name]` (list defs, or one in full) ·
`forget-affliction <name>` (overlay only; built-ins resurface) ·
`afflict <affliction> [on=<name|@alias>] [<slot>=<name|@alias> …]` (mirror defs
also afflict the bound target) · `advance <affliction> [on=..]` (end it, begin
its `then` successor, bindings carried forward) · `lift <affliction> [on=..]
[spend=res[::effect][!]]` (removes it AND its mirror; spend = shrug-off) ·
`afflictions [<name|@alias>]` (active list; NPCs work too) ·
`alias <@token> "Target"` (bare @a = global; `@global::a`,
`@player::<id|storyteller|default>::a`, `@char::<name|default>::a` pin a scope) ·
`aliases` · `forget-alias <@token>` · `player [name="…"] [default=true]`
(show/switch the current player; ids are plain strings, storyteller always valid).
Doc convention: paths in help strings are written with `::`
(`spend=res[::effect]`) — the boundary normalizer folds `::` to the internal `:`.

Roll plumbing shared by roll/roll-for: `extractRollArgs(cmd, offset)` returns
only **supplied** fields (so overrides distinguish keep vs reset; difficulty +
diff-mod positional OR named, named wins). A difficulty token that is a strict
integer sets `difficulty`; anything else (a trait/calculation, incl. `3+2`) sets
`difficultyExpr` (same in `rollOverridesFromNamed`). `@name` loads a saved spec +
`overrideSpec`; `applySpend(char, cmd, ctx, tags, spendOverride?)` handles
`spend=` (the `@name` sidecar spend passes in as `spendOverride`; mandatory `!`,
named `:effect`, roll-ops-only rule — standalone effects refuse with a
`[[spend]]` pointer);
`characterRollEnv(char)` = `{resolver (traits+boosts), penalty}` shared by rolls
AND contests; `rollAndReport` folds the **wound penalty into extra.diceMod**
(noted) and reads `cmd.named["table"] ?? savedTable` via
`tableNote(raw, outcome, successes)` (the SavedRoll table sidecar).
`rollOverridesFromNamed` for continue-roll. Trait values come from state.ts'
`resolveTraitFromRecord`.

Contest plumbing (`cmdVersus(mode, cmd, ctx)` behind `resist`/`contest`): side A
is the current character (may `spend=` on its own roll); side B is `vs="Name"`
(a stored character rolls live) or ad-hoc (`vs="the lock"`/omitted → literal
pool, `oppName` labels it). `execContestSide(base, charName?, rng, extra?)` rolls
one side — a named character via `characterRollEnv` (+wound penalty), else a
zero resolver so only literals count; a deleted char degrades to ad-hoc.
`contestTableInput(outcome)` feeds `table=` the actor's winning **margin** (botch
→ botch, any non-win → failure). `extended-contest`/`continue-contest` reuse
`execContestSide` each round (re-resolving both pools live) + `applyContestRound`.

### src/window.ts (395) — api.v1.ui windows that EMIT commands, DERIVED from specs
Imports host + **command** + **rolls** (SuccessTableRegistry for the table
picker) + **state** (registries feed domain windows and picker options; still
NOT game — the split's dependency win).
**A window is an abstraction over the command layer, not a second path**, and
since the architecture pass its form is **derived from the verb's
CommandSpec**: `openCommandWindow(verb, {title?, blurb?, submitLabel?})` looks
up `CommandRouter.specFor(verb)` and renders per param — enum →
`selectorRow` (button-row single-select, bullet marks current, `default`
pre-seeded into tempStorage; no native select part exists), int →
`numberInput`, else `textInput` (label = `desc ?? key`, placeholder =
`example`); temp keys **`win:<verb>:<param>`**; the submit button collects the
temp values, refuses on a missing required param, then routes
`composeCommand(verb, values, spec)` through the SAME `CommandRouter` and
shows the `[SYSTEM: ...]` reply in-window. `openConstraintWindow()` =
`openCommandWindow("define-constraint", …)`; `[[win-constraint]]` and
`[[win-table]]` (over define-table) register at module load (pure registry
mutation). **The picker** (selection-widgets mode 2, docs/ui-parts.md;
user-specced): `pickerField(part, {key, label, storageKey, options: thunk,
rerender, placeholder?})` = textInput (typing stays live) + a
`Choose <key>…` button → modal with one button per option (current ✅,
"(clear)", Cancel); picking writes the temp key, closes, re-renders.
`openCommandWindow` accepts `opts.pickers: {paramKey → options-thunk}` (same
temp key — composeCommand untouched). **`[[win-affliction]]`** =
openCommandWindow("define-affliction") with pickers on `then`/`mirror`
(`afflictionOptions` = AfflictionRegistry.all(), `name - description` labels).
**`[[win-afflict]]`** (`openAfflictWindow`) — the first DOMAIN-driven window:
affliction pickerField; `on` input; the picked def's `bindings` slots render
as inputs (temp `win:afflict:bind:<slot>`; the picker's rerender reveals
them); Afflict composes `[[afflict]]` via specFor("afflict") (openNamed
carries the slots) and shows the handler's reply (refusals included)
in-window.
**`[[win-roll]]`** (`openRollWindow`) — the roll BUILDER, one window
multiplexing THREE verbs (temp `win:roll:<key>`; field keys ARE the param
keys): a **For** pickerField (`characterOptions` = CharacterStore.listNames;
blank = current) chooses Roll's verb (`roll` vs `roll-for`); a **Pool**
pickerField (`savedRollOptions` = @NamedRollStore.names); the knob fields are
WALKED from `specFor("roll")` (skipping `pool` — custom row — and `diff-mod`:
with difficulty blank a lone modifier would slide into the difficulty
positional slot) with pickers on `spend` (`spendOptions` =
CharacterResources.defsFor of `rollWindowChar()` — the For-else-current
character, read at modal-open so options FOLLOW the For field), `specialty`
(`specialtyOptions` = that character's specialties, "label (trait)" display),
`table` (`tableOptions` = SuccessTableRegistry.all + @TableAliases); a
**Save as** input; buttons **Roll** (refuses blank pool in-window) / **Save**
(refuses blank Save-as name; composes `name-roll`, For ignored — saved rolls
are chronicle-global) / Close; `submit(verb, extra)` walks the TARGET verb's
spec params reading each from the form (`extra` pre-binds cross-verb params:
`character`, `name`) → composeCommand → route → reply in the result box.

### src/index.ts / src/main.ts
Re-export everything (incl. `./command`, `./state`, `./window`) + `init()`:
bootstrap → `ensurePath("config")` + `ensurePath("config:success-tables")`
(the base virtual paths + their general cards) → `reconcileLorebook()` (drift
modals may open) → merits → `reloadAllConfigStores()` → log with per-entry
counts + reconciliation notes; main calls `init().catch`.

### scripts/build-single.ts (91)
`MODULES` order (= layering, now 14 files incl. command + state),
`stripModule` regexes (whole-line re-exports, import statements, leading
`export `), `buildSingleFile()` + `OUTPUT_PATH` (exported for the sync test),
guardrails (starts with `//`, NOT `/*---`, no import/export lines survive).

### test/ (3763 + 34 lines, 339 tests, 88 describes)
`test/system.test.ts` — everything; `test/build.test.ts` — dist sync +
plain-TS guarantees. Conventions: `seqRng(faces[])` (maps desired d10 faces to
rng values; **throws when exhausted** — used to prove exact dice counts),
`allTens`; `beforeAll` bootstraps the lorebook once; suites that touch
storage/lorebook/config registries do `__resetStorageMock();
__resetLorebookMock(); resetAllConfigStores(); await
LorebookManager.bootstrap();` in `beforeEach` (ONE call resets every config
store AND restores the success-table defaults — the per-registry reset list
that leaked a stale ResourceOverrides cache into the afflictions suite is
gone); command e2e via `CommandRouter.route(body, {rng})`; wizard e2e
replies via `processAdventureInput` (plain text). `types/bun-test.d.ts` +
`types/bun.d.ts` are minimal ambient shims so tsc runs without bun-types
(note: `expect.objectContaining` is NOT in the shim — assert fields directly).

## 6. Persistent state map (complete)

**ScopedStorage keys** (all under prefix `<scriptId>_` in `storyStorage`):
`pc:<name>` character records · `current-character` / `default-character`
pointers · `creator-mode` flag · `xroll:<id>` extended actions ·
`current-extended` pointer · `xcontest:<id>` extended contests ·
`current-contest` pointer · `res:<char>` resource currents · `hp:<char>`
health counts · `boost:<char>` trait boosts · `uses:<char>` effect-use ledger
· **`affl:<name>`** active afflictions (keyed by normalized name — NPCs
without records carry them too) · **`lb:ids`** (tracked lorebook uuids:
`cat:<category>` / `ent:<category>/<entry>`) · **`lb:backup:<category>/<entry>`**
(tracked-card text backups) · **`table-aliases`** (alias→table-key map) ·
`wizard:active` wizard session · **`aliases`** (the whole 3-scope alias map) ·
**`current-player`** / **`default-player`** pointers (default "storyteller") ·
**`time:clock`** (the story clock `{start, now}`, epoch seconds — seeded
create-if-missing with `1197-01-01-00`, §7.30) · **`time:dates`** (named date
bookmarks, `name → epoch` map) · **`scene:<name>`** (scene records, §7.31) /
**`current-scene`** pointer (the open scene's normalized name) · `char_<name>`
(legacy LiveCharacter serialization). **tempStorage**
(session-scoped, cleared on close): `win:<verb>:<param>` (a command window's
live form fields, e.g. `win:define-constraint:relation` - the documented home
for UI storageKey state) · `recon:<category>/<entry>:<kind>:<hash>` (the
once-per-session reconciliation-modal guard).

**Lorebook** (all data entries = instructions above `=====`, data below):
`srd:abilities` (talents/skills/knowledges lists) · `srd:backgrounds` ·
`srd:merits-flaws` (JSON defs merged over defaults) · `wod:player-characters`
(`pc:<name>` entries — SOURCE OF TRUTH for characters) · `wod:named-rolls`
(`wod:named-rolls:library` JSON map) · `wod:config` (entries: `general`
seeded global-config card, unread for now; `wod:config:resources` overrides
map; `wod:config:constraints` constraint groups; `wod:config:afflictions`
affliction-def overlay — each array or `name → def` map) ·
**`wod:config:success-tables`** — a CATEGORY (the virtual-subcategory tree,
§7.21): its `general` card + any extra cards hold bare-named tables; each
subcategory is the real category `wod:config:success-tables:<sub>` (own
`general` + extra cards), tables addressed `<sub>::name`. Engine-written
cards are all tracked (id map + backups above).

## 7. Design decisions and their WHY (chronological-ish)

1. **Lorebook = editable database.** Rule lists and configs live in lorebook
   entries the player can edit; the engine creates categories if missing and
   seeds them WITH the tutorial in the entry card (above the `=====` marker).
   No id bookkeeping — `api.v1.uuid()`.
2. **Free successes are separate from their source** (Potence, spent
   Willpower) — `automaticSuccesses` is a roll-level number, sources add to it.
3. **DamagePacket**: severity (class w/ promote/demote) ⊥ kind (string set) ⊥
   source; reactions rewrite packets before soak; "complicated systems must
   not get in the way of simple dirty damage" (simple API preserved).
4. **Demon is Dark Ages: Devil's Due** — NOT Demon: the Fallen. Resolve 1–10.
   Torment ascends to unplayable 10. Arcana, not Lores (Lores = possible
   future option for DtF-style play).
5. **Dark Ages Mage**: Foundation & Pillars (not Spheres), no Paradox.
6. **Characters**: uuid = forever identity; lorebook entry = source of truth;
   sync strictly lorebook→storage (player edits win); storage copy makes the
   character recoverable if the entry is deleted. **Playable before any
   allocation** (attrs 1 / abilities 0 / willpower 0) — allocation is opt-in,
   an undecided character ≈ a plain mortal.
7. **Parser ≠ router** so commands are cheap to add and could someday be
   lorebook-defined.
8. **Difficulty > 10 is never silently clamped** — +1 required success per
   point over 10 (or "impossible" policy).
9. **Named rolls** = saved RollSpec + per-use overrides; **pool is never
   overridable**; `@name` sigil inside the existing roll verbs; ONE global
   chronicle library (lorebook), read live.
10. **Extended rolls**: persistent, collaborative (one starts, others
    continue), per-continuation overrides (helpers change dice), **botch
    normally kills the whole action** (configurable: fail / lose-successes /
    ignore), interval + max rolls both first-class; interval spacing advisory
    until a turn system exists.
11. **Resources are abstract**: roles ("use X as Y" is data), replaces
    (identity takeover), and the **effect grammar** — the user's insight that
    every effect type on their wishlist is the same sentence with different
    words, so ops/targets are open vocabularies and unknown words must be
    STORED not rejected. Executable dims now; time-based dims stored +
    advisory + ledger-counted (the turn system will inherit and enforce).
12. **The advisory pattern** (used 3×: extended-roll intervals, boost
    durations, use limits/cooldowns): store the config, show it, count what
    can be counted, mark "(ST-enforced)", never block on a missing system.
13. **Wizards are UIs over data**: the wizard writes the same lorebook entry a
    player can hand-edit in creator mode; the engine is medium-agnostic
    (structured prompts; text renderer now, api.v1.ui modals later); while a
    wizard runs, plain input = reply, commands still work; "cancel" always
    escapes.
14. **Single readable artifact, committed, sync-tested; no frontmatter** (see §3).
15. **Willpower is universal** (every oWoD template), and is BOTH +1 auto
    success AND static spell fuel (named `fuel` effect) — the same resource,
    different named contexts. Mandatory costs use the `!` suffix: can't pay →
    the action doesn't happen.
16. **Success tables are the "table-thing"** (the user's insight): the dice
    roll produces a count and is NOT responsible for knowing what it means; a
    separate `SuccessTable` interprets it. ONE mechanism spans qualitative
    ladders (degrees, discipline per-success effects) and the **direct numeric
    function** (damage/soak = `valuePerSuccess:1`), with `cap` (wasted extras)
    and `overflow` (rule-specified bonus per batch) for the ">5 successes"
    cases. Tables are pure data, lorebook-overlayable, attached to any roll with
    `table=`. **Resisted vs contested is oWoD classic** (user choice): resisted
    counts only the actor's margin over the resister (tie = fail); contested is
    symmetric (higher wins, tie = draw); a botched side scores 0 and is flagged.
    **Extended contests** = both accumulate, first to the goal wins (dead heat
    stays open). `ContestSide.char` keeps rolls.ts character-agnostic while the
    game layer re-resolves each side's live pool every round.
    *Addendum (post-§7.20)*: table AUTHORING closed the config-family gap —
    `define-table`/`forget-table`/`win-table` write the same
    `wod:config:success-tables` entry the player can hand-edit; rows/labels
    ride the backtick-literal channel so their case survives normalization.
17. **Wizard-windows EMIT commands - one path, not two** (the user's framing):
    an `api.v1.ui` window is an abstraction over the command layer, so its submit
    composes a `[[command]]` string and routes it through the SAME `CommandRouter`
    a typed command uses. Nothing a window does bypasses commands. Consequence:
    the command + data model is the real, testable deliverable; the window is a
    thin emitter, verified off-host by a UI mock that records the part tree and
    fires callbacks (a real NovelAI window can't render here). **Constraint
    groups** are the first data atom + the first window: a reusable allow/deny
    primitive (exclusive/restricted/forbidden over backgrounds & merits/flaws),
    stored/surfaced/**advisory** (ST-enforced via `[[check-constraints]]` until a
    creation engine consumes them) - deliberately the SMALLEST piece so the
    reusable host-UI infrastructure (contract + mock, `src/window.ts`) is the star.
    No native select part in the UI registry → choices render as button rows.
18. **Boundary normalization + @ aliases** (user spec): EVERY string entering
    the engine — command tokens/values AND lorebook list items — passes through
    `StringUtil.normalizeInput` once, at the boundary ("Alice and Bob" ≡
    "ALIcE and BoB" ≡ `alice-and-bob`). `::` is the documented **path
    separator** (space-tolerant, folds to internal `:` — docs/help write
    `spend=res[::effect]`; unspaced `:` still works). Spaces after `@` and
    around `,`/`+` are stripped (the last two are an engineering addition so
    lists/pools survive hyphenation). **Backtick literals** skip normalization
    (display text). Names store normalized; replies render Title Case via
    `disp()` — the display/key split. **Aliases** are `@`-prefixed (names may
    never start with `@` → no shadowing), live in storyStorage in three scopes
    resolved most-specific-first (**character → player → global**), with
    explicit-scope tokens (`@char::erik::sire`, `@player::storyteller::kat`,
    `@global::backup`; owner `default` → the default character/player). Bare
    `@a` DEFINES global but RESOLVES down the chain. Position disambiguates the
    `@` sigil: pool slot = saved roll, character slot = alias. `PlayerStore`
    (current/default player, default "storyteller") is the engine's first
    player-identity concept.
19. **Afflictions are parameterized states, not flat flags** *(shipped as
    "conditions"; renamed afflictions — §7.22)* (the user's Feral
    Speech analysis): an affliction can need a **target** ("concentrating-on
    *the squirrel*"), can **chain** into a successor (`then` — concentrating-on
    lasts 1 turn, then feral-whispers begins; `[[advance]]` is the manual
    trigger until the turn system), and involves the OTHER party too. Two
    decisions via questions: **mirror automatically** (a def may declare
    `mirror="<affliction>"`; afflicting the subject also afflicts
    `bindings.target` — sheet or not — with the mirror bound back; lifting
    lifts both) and **tags bite now** (a def's `tags[]` auto-join every roll
    the afflicted character makes, firing existing `RollModifierRegistry`
    modifiers — ZERO new modifier machinery; unregistered tags surface as the
    usual unknown-tag note). Durations reuse `EffectDuration`, advisory
    "(ST-enforced)" per §7.12. Binding values resolve `@aliases`; instances
    live under normalized names so sheetless NPCs participate. `lift spend=`
    is the Willpower shrug-off (roadmap #3's wish, via `applySpend`).
    Naming history: damage.ts's health-box states were first renamed
    `HealthConditionDef`/`HealthConditionState` (freeing `ConditionDef` for
    the central concept; the single-scope dist build forbids duplicate
    globals), then became `HealthStateDef`/`HealthStateSlot` in the
    affliction rename (§7.22).
20. **The architecture pass (pre-windows): specs, generic stores, the split**
    — a dedicated coupling/cohesion/connascence review before the
    command-emitting-windows work. Three defects found and fixed:
    (a) *window↔command↔help triple duplication* — window.ts hand-copied the
    relation/domain vocabularies (connascence of VALUE across modules), the
    define-constraint arg names (connascence of NAME, uncheckable), and its
    own quoting (a typed `"` broke tokenization; notes were silently
    lowercased). Fix: **every verb registers a `CommandSpec`**; `[[help]]` is
    DERIVED from it; windows RENDER it; `composeCommand` is the one sanitizing
    composer (the grammar deliberately has no escape syntax, so compose strips
    breakers; `literal` params ride in backticks). Cross-module value/meaning
    connascence collapsed to single-locus name/type, compiler-visible.
    (b) *config-family algorithm connascence, degree 4 (+3 sync sites)* — four
    hand-rolled registries and a thrice-copied reload list (whose per-registry
    test-reset convention caused a real leak bug the same day). Fix: generic
    `ListConfigStore`/`MapConfigStore` + self-registering `ALL_CONFIG_STORES`
    + `reloadAllConfigStores`/`resetAllConfigStores`.
    (c) *game.ts god module (2954 lines)* — split into `command.ts` (the bus)
    / `state.ts` (character model + every store) / `game.ts` (the verbs), with
    `CommandRouter.beforeRoute(hook)` inverting the router→stores dependency
    (the router dispatches; game decides what runs first). window.ts now
    depends on command.ts only. **Null-findings recorded deliberately**:
    data-only interfaces + free make*/describe* functions are CORRECT here
    (everything round-trips as player-editable JSON; methods would force
    hydration everywhere); live state stays keyed by normalized NAME not uuid
    (NPCs have no record; revisit with renames/#10/#11); static-class
    namespaces are fine in the single-scope build (instances only where
    genericity pays); and the layered command-bus architecture STAYS — ECS and
    event pub/sub were weighed and rejected (no perf need, single dispatcher,
    host.ts already is the hexagonal port+adapter+mock).
21. **The virtual-subcategory policy** (user-specced; THE lorebook nesting
    rule — nothing prior conflicted, but it did change one physical fact:
    `wod:config:success-tables` used to be an ENTRY in `wod:config` and is now
    a CATEGORY; no chronicle existed, so no migration — the old entry is
    treated as never having existed). The policy: NovelAI categories cannot
    nest, so nesting is CONCEPTUAL and ONLY the Lorebook module (services.ts)
    knows — user code speaks virtual paths. A path `a::b` (folds to `a:b`)
    maps to the flat real category `wod:a:b`; every engine-owned category has
    a default **`general`** card (default write target, backed up); table
    subcategories go ONE level below success-tables for now. Reading a table
    category = EVERY card, general first, later cards shadow by name (the
    user's card-overflow complaint solved at both levels); writes always land
    in general. **Tracked cards**: everything the engine writes gets its
    uuids mapped (`lb:ids`) and its text backed up (`lb:backup:*`) — the map
    exists for DRIFT DETECTION and cheap writes, NOT read speed (reads are
    O(1) registry hits; the rejected alias→uuid-LINE cache would go stale on
    any edit and duplicate the registry). Reconciliation at init + creator
    sync: identical recreation (structuralHash ignores the tutorial header) →
    silently ADOPT the player's new uuid (never destroy-and-recreate a card to
    keep an old id); structural conflict → modal [keep new / combine (player's
    defs win) / restore]; deletion → modal [restore from backup / forget].
    Each distinct drift prompts once per session. **Table aliases** are a flat
    map, a separate domain from character aliases; the `table=` position
    disambiguates the `@` sigil (like pool position = saved rolls). These are
    the project's FIRST MODALS — game-flow confirmations, deliberately distinct
    from window.ts' spec-driven form windows.
22. **condition → affliction (a word reservation)** (user directive): the
    parameterized-state concept is named **affliction**, and — crucially —
    the name does NOT imply harm: an affliction can be good, bad, neutral, or
    outside such categorization (Feral Whispers is a gift). The word
    **condition** is deliberately RESERVED for future conditional things —
    predicates the engine will someday evaluate. The note lives in the README
    and as a comment above `AfflictionDef` (rules.ts). Renames: AfflictionDef/
    AfflictionRegistry/CharacterAfflictions/ActiveAffliction/
    DEFAULT_AFFLICTIONS; verbs define-affliction/affliction/forget-affliction/
    afflictions (afflict/advance/lift kept their noun-free names); window
    win-affliction (win-afflict kept); data keys renamed outright — storage
    `affl:<name>`, lorebook `wod:config:afflictions` (no chronicle existed,
    no migration). To complete the reservation, damage.ts's HealthCondition*
    became **`HealthStateDef`/`HealthStateSlot`** (box field `state?`, config/
    summary field `states`, method `States()`) — "condition" now appears
    nowhere as an engine name. NovelAI's own `LorebookCondition` (host.ts)
    is the HOST's API type and is untouched.
23. **Owned powers are parameterized merits with passive effects** (user
    fork: DEF-DRIVEN over first-class stores — powers live as data, not
    ad-hoc state). A `MeritFlawDef` may declare a `param` slot (owned as
    `name::value` instances), `passive` ops (always-on; amounts scale by
    points; `"$param"` substitutes) and `atMostOneAt` (advisory
    cross-instance cap — checked, not blocked, until the creation engine).
    The `trait` gate on EffectOp is the actionTag gate's twin and fires on
    the POOL ONLY — `poolTraitsOf` pre-parses the pool because resolveSpec
    feeds pool AND difficultyExpr through one resolver (a trait in the
    difficulty is not "used"). Trait Enhancement is a PERMANENT layer beside
    the temporary boosts: effective = record + enhancement + boost, XP prices
    from the un-enhanced record (§ the user's Strength 3+2→5, ceiling 7,
    eventual 9 example), ceilings advisory until the XP engine. Specialties
    are record data with VERBATIM labels; at most ONE applies per roll
    (+1 die, user's rule — not V20's double-10s), the pool must use its
    trait, and fiction-fit stays the ST's call until the generateWithStory
    ask ships. Passives with unmet gates skip SILENTLY (no note spam);
    spend-op gates note their skip (the player paid).
24. **Vendor NovelAI's types; the release redefines none** (user directive:
    "a file in dist that's the release [that] cannot carry any NovelAI type
    definition — if we put script-types.d.ts somewhere, it won't have to,
    right?"). YES. We vendor NovelAI's own `script-types.d.ts` at
    `types/novelai/` as the AMBIENT source of truth (it has no import/export,
    so `api` + every `UIPart`/`WindowOptions`/`LorebookEntry`/… is global; the
    existing `tsconfig.include: ["types"]` picks it up). Our mirror in host.ts
    is DELETED — `tsc` now checks src against NovelAI's REAL types (the mirror
    turned out accurate: zero fixes needed). host.ts shrinks to `log` + two
    aliases; the off-host mock + test hooks move to `src/host-mock.ts`, which is
    NOT in the build MODULES, so the concatenated `dist/naiowod.ts` carries no
    NovelAI type and no `const api` — pasted into an editor that knows those
    types, it can't collide. WHY a separate mock file (not inline-and-strip):
    the release must exclude the mock cleanly, and off-host consumers install it
    explicitly (`import "../src/host-mock"` first, before any top-level
    `new ScopedStorage()` reads `api.v1.script.id`). The standalone artifact
    check now compiles dist TOGETHER WITH the d.ts (ES2021 only — the artifact
    needs nothing but the ambient api + ES built-ins; `main.ts` errors via
    `api.v1.error`, not `console`). build.test.ts guards the invariant. Bonus:
    the d.ts corrected a stale fact (the host DOES have `setIfAbsent`) and
    surfaced unused capabilities for later (`generateWithStory`, decorations,
    theme). We kept the release name `dist/naiowod.ts` (it IS the paste
    artifact); no second dist file — tests run on `src/` modules.

25. **Engine reply prefix `((OOC-Storyteller: ...))` → `[SYSTEM]: ...`** (user
    directive, ahead of live play): the engine's mechanical replies are the
    SYSTEM voice in a wider speaker scheme the player is introducing —
    `Player:` / `OOC-Player:` / `ST:` / `OOC-ST:` / `<character-name>:` (incl.
    the player's). All ~242 inlined `\`((OOC-Storyteller: BODY))\`` literals
    became `\`[SYSTEM]: BODY\`` (greedy per-line sed). The init setup banner
    aligned too (`[SYSTEM]: Storyteller setup`). `processAdventureInput`
    concatenation is unchanged — the reply string just carries the new prefix.
    NOTE: `ST:`/narration voices are NOT the engine's to emit yet; they arrive
    with the generateWithStory Storyteller loop. (Superseded by §7.26, which
    centralized the format.)
26. **Central output formatter `sys()`** (user follow-up: "shouldn't we have a
    central function so we never find-and-replace 242 strings again?"). YES.
    `sys(body)` + `SYSTEM_PREFIX` in command.ts (the reply formatter belongs
    with the command bus); every `\`[SYSTEM]: BODY\`` literal became
    `sys(\`BODY\`)` (greedy sed; the 14 nested-ternary-backtick lines survive
    because the outer closing backtick is still the line's last). The setup
    banner uses it too (services→command import, allowed by layering). Now the
    prefix lives in ONE place: re-tagging the engine voice — or growing `sys`
    into a general `speak(speaker, body)` when the Player/ST/OOC voices land —
    is a one-line change. Chose command.ts over host.ts/core: it's the
    command-reply convention, and game/window already depend on command.
27. **`[SYSTEM: ...]` format + "quiet the turn" for query commands** (user, two
    small live-play asks). (a) Format: `[SYSTEM]: ...` → `[SYSTEM: ...]` — a
    one-line edit in `sys()` (the §7.26 centralization paying off; `SYSTEM_PREFIX`
    dropped, the wrap lives inline in `sys`). (b) Generation control: the lever
    is the `onTextAdventureInput` return's **`stopGeneration`** (the "cancel the
    turn" flag the user guessed at — confirmed by the vendored d.ts). Previously
    set only when the input was command-ONLY; now ALSO when any command's verb is
    a read-only query. Home decision: a game-layer **`QUIET_VERBS`** set next to
    `processAdventureInput`, NOT a `CommandSpec.quiet` flag — generation-
    suppression is a turn/game POLICY, and CommandSpec must stay pure grammar
    (it feeds help + windows, lower layers). `processAdventureInput` tests each
    match with `CommandParser.parse(body).name`. Querying the system never makes
    the AI narrate; an in-fiction action wrapped in prose still generates.
28. **Named procedures — a saved roll that can be EXTENDED and carry a table +
    description; ship a starter Drama set** (user, live-testing Dark Ages:
    Vampire's *Drama* named rolls, Climbing first — "I still think it's a saved
    roll, it's just extended, and maybe defines a table"). Kept as ONE concept,
    NOT a new "procedure" type: `SavedRoll` gains `extended?: ExtendedSavedConfig`
    (`{intervals?, interval?, onBotch?}` — the extended DEFAULTS; presence ⇒
    invoking `@name` launches an extended action) and `description?` (verbatim
    rules prose, literal channel). The **target is play-time input**
    (`requires=`/`target=`; wall height ÷ ft-per-success, the ST's call), NEVER
    baked into the save — refused with guidance if absent; intervals fall back to
    the save's `extended.intervals`. `launchExtended` is now THE one launcher
    (shared by `[[extended-roll]]` and the saved-`@name` extended branch in
    `rollAndReport`); each interval rolls through the FULL character env
    (`execCharacterRoll`: affliction tags + enhancements/boosts + wound penalty +
    tag/trait-gated passives), so a saved roll's `climb` tag lets a grip power's
    `−2 difficulty target:climb` reach the extended climb — the gate the claws
    will use (unifying extended with the single-roll env is what makes that gate
    meaningful; extended-roll formerly used only the raw record resolver).
    **Extended value-table readings ACCUMULATE**: a `valuePerSuccess` table
    (climbing = 10 ft/success) reports the TOTAL distance so far
    (`accumulated × value`, "= 20 so far") because the climb ends when you've
    climbed the ENTIRE distance (the user's model); qualitative tables (degrees)
    still read the interval's own net (`extendedTableNote` splits on
    `valuePerSuccess`; an empty pool / botch-reset falls back to the interval
    outcome). `DEFAULT_NAMED_ROLLS` (state.ts) + a `climbing` success table
    (rolls.ts, `valuePerSuccess:10`) ship the flagship **climbing** procedure
    (dexterity+athletics, diff 6, tags climb, extended ≤10, the Drama text);
    `NamedRollStore.seedDefaults()` (called from `init`) CREATES the library only
    if MISSING — a player's edits/deletes stick, never re-clobbered (chosen over
    an overlay: matches "pre-saved, fully-owned, hand-editable"; trade-off — new
    defaults don't reach existing chronicles, fine for starter content). Saved
    rolls stay revisable (the library is hand-editable JSON, so more tags can be
    added later — the user's plan for grip powers). Authoring/display:
    `name-roll` accepts `extended=true`/`intervals=`/`interval=`/`on-botch=`/
    `description=` (echoed via `describeExtendedSaved`); new **`roll-info <name>`**
    (a QUIET verb, §7.27) prints the full spec + sidecars + description + invoke
    hint (sentence-joined without doubling a trailing period); `list-rolls` marks
    `[extended]` and points at roll-info. Follow-ups RECORDED (not built here):
    win-roll window fields for extended/description + the two live-play UX fixes
    ("Choose pool…" → "Choose saved roll…", collapse the advanced knobs); the
    claws/grip powers themselves (an affliction/merit whose `passive` is
    `{op:"difficulty", amount:-2, target:"climb"}`); and the **`generateWithStory`
    ask for the play-time ft-per-success / target** (the user: "which distance per
    success is where we enter with the Generation API" — asks the AI off-screen).
29. **The "real arena": contested saved rolls + multi-stage advisory procedures**
    (user, pasting the Dark Ages *Drama* chapter: "there are contested rolls,
    activities that require one roll and then another. Can we do this? Just make
    them possible — don't implement the actual named rolls"). Two confirmed forks
    via questions: multi-stage = **advisory sequence** (not a full auto-branching
    flow engine — that stays gated on the turn system); scope = **the two flagged
    primitives** (not the smaller trait-indexed-table / variable-pool sugar). Both
    slot onto the same seam §7.28 built — *a saved roll launches a richer action*:
    - **Contested saved rolls** — `SavedRoll.opposed?: OpposedSavedConfig`
      (`{mode: "resisted"|"contested"; pool?; vsDifficulty?; extended?}`). Invoking
      launches the EXISTING contest machinery instead of a single roll; the
      OPPONENT is play-time input (`vs=`), like an extended roll's target. `pool`
      omitted ⇒ the opposition rolls the actor's OWN pool (symmetric, e.g.
      Str+Intimidation both sides). **opposed + extended = an extended contest**
      (a race like Pursuit): the extended cfg rides on `opposed.extended` so the
      top-level branch stays clean, and it needs a play-time `requires=<target>`
      (refused if absent). `cmdVersus` was refactored into `resolveOpponent` +
      `runSingleContest` (returns a BODY string, not sys-wrapped, so a procedure
      can append its next-steps); `launchOpposedFromSaved` / `launchOpposedExtended`
      reuse them. Actor-side rolls keep cmdVersus's existing manual spend+env path
      (no owned-passive fold on side A — a pre-existing gap, deliberately not
      changed here).
    - **Multi-stage procedures** — `SavedRoll.steps?: ProcedureStep[]`
      (`{when: "always"|"on-success"|"on-fail"|"on-botch"; roll: "@ref"; note?}`).
      The saved roll's OWN spec is step 1 (the entry); steps are FOLLOW-UPS that
      compose OTHER named rolls. Invoking the entry runs it, then `surfaceSteps`
      appends the matching branch as ready-to-run `[[roll @ref]]` command(s) —
      **advisory**: the ST/player picks and runs it, no flow engine (auto-running
      branches / handling per-turn drains is a later pass, roadmap #1). Authored
      with **`add-step <proc> roll=@<follow-up> when=<cond> note=\`…\``** +
      **`clear-steps`** (dedicated commands, not crammed into name-roll's flat
      grammar — structured data, window-friendly; the library JSON stays
      hand-editable). Composition is the whole story: Bribery = a procedure whose
      step 2 (`@bribery-convince`) is itself a CONTESTED saved roll.
    Display: `describeSidecars` gains `[opposed: …]` + `[N-step procedure]`;
    `name-roll` accepts `opposed=`/`vs-pool=`/`vs-difficulty=`; `invokeHint`
    centralizes the "needs vs= / requires=" suffix; `roll-info` prints the step
    list (`describeSteps`). NO actual Drama rolls shipped — only the primitives
    (the user builds the named rolls themselves; DEFAULT_NAMED_ROLLS stays just
    climbing). Recorded follow-ups (the smaller Drama needs, deferred): **trait-
    indexed tables** (Feats of Strength: Strength → lift capacity; Throwing:
    Strength → range — our SuccessTable keys on successes, not a trait value),
    **variable-pool sugar** (Jump = Str | Str+Ath), escalating per-interval
    difficulty (Swimming), two-axis value tables (Jump's vert/horiz), and the full
    **auto-branching flow engine** for procedures. *Addendum (window pass):*
    **win-roll now bakes contests** — `openRollWindow` renders an Opposed knob
    (none / resisted / contested) that, on pick, reveals vs-pool + vs-difficulty
    fields; because Save's `submit("name-roll", …)` already reads every name-roll
    param from its form field by key, rendering the fields was the whole job (the
    contract the §7.28/§7.29 window teaching walked the user through). LEFT: the
    `steps`/`extended` knobs in win-roll (procedures are built with `add-step`,
    which — like every registered spec — gets a free window via
    `openCommandWindow`), and the `win-add-step`/`win-clear-steps` wrappers.
30. **Time — the story clock** (user: "the thing we've been avoiding: time. Start
    with a config value for when the story begins (yyyy-mm-dd-hh); commands to
    pass time forward, check elapsed-since-start and the current date, save/forget
    dates, and measure between any two — later Scenes and turn-length; combat's
    3-second turns"). This pass is the CLOCK/CALENDAR only (Scenes/turns are
    deferred). Decisions: **real proleptic Gregorian time** (Dark Ages is
    historical Europe; 3-second combat = real seconds → correct month/year
    rollover, not a fantasy fixed-length calendar — flagged to the user as the
    one load-bearing choice, swappable in `core/time.ts` if ever wanted);
    **second-granular epoch** internally so future 3-second turns fit; **one clock
    in storyStorage** `{start, now}` (UNDO-rewindable once roadmap #11 lands) plus
    a **bookmark map**; **diffs report an exact calendar breakdown + a day total**
    from the real endpoints (never the ambiguous "how long IS a month"). Pure math
    in `core/time.ts` (§5); stores `StoryClock` (setStart/advance/seedDefault) +
    `DateBook` in state.ts; commands in game.ts: **`story-start`** (seeded default
    `1197-01-01-00` create-if-missing in init, so a clock always exists), 
    **`advance-time`** (NOT `advance` — that verb is the affliction chain-stepper
    §7.19; the two MERGE when the turn system makes advancing time process
    affliction/effect durations), **`story-date`**, **`save-date`**/`forget-date`/
    `dates`, **`time-between`** (each endpoint a saved name / `now` / `start` /
    ad-hoc `yyyy-mm-dd-hh`). The query verbs join `QUIET_VERBS`. This is the
    substrate roadmap #1 (the turn/time system) will build Scenes and turn-length
    on; advancing is a manual ST action until then.
31. **Scenes — the named unit of play on the clock** (user, opening the
    Storyteller-loop design: "how will we deal with scene? each one should be
    named"; then chose "Both, Scene then hide"). A `Scene` (state.ts) is the
    book's basic unit — ONE location, "as many turns as it needs" — NAMED, opened
    at the current `StoryClock.now`, with an optional **`turnLength`** answering
    "how long is a Turn here?" (`3s` combat; ABSENT = a freeform scene that counts
    turns without moving the clock). `[[turn n]]` advances the clock by
    `turnLength × n`; **`[[downtime <dur>]]`** closes the scene AND glosses the
    clock forward (the book's "you wait three days…"). This makes the six time
    units concrete on the §7.30 clock: **Turn** = turnLength, **Scene** = a
    clocked span, **Downtime** = advance-between-scenes (Chapter/Story/Chronicle
    stay light labels — a scene's optional `chapter`). `SceneStore` mirrors
    ExtendedRollStore (records `scene:<name>` keyed by normalized name +
    `current-scene` pointer, storyStorage). Opening a scene **auto-closes** the
    previous open one at the current instant (a new scene = a new place).
    Commands: `scene`/`turn`/`end-scene`/`downtime`/`scenes`/`scene-info`/
    `forget-scene`; `location`/`chapter` ride the literal channel (verbatim
    display); `scenes`/`scene-info` are QUIET. The Scene carries a private
    **`plan`** field — the seam for **Pass B** (the confirmed next pass): the AI
    emits `<hide op=append|overwrite>…</hide>`, an **`onResponse`** hook strips it
    from the narrative and mirrors the active scene's plan into the **Author's
    Note** (semi-hidden — AI-visible every turn, player-peekable, not in the story
    flow). That pass adds a NEW host surface (the generation hooks `onResponse`/
    `onContextBuilt` + `authorNote`/`systemPrompt`/`prefill`, all confirmed in the
    vendored d.ts — the last three need the `storyEdit` permission) to host.ts's
    contract + the off-host mock, mirroring the api.v1.ui buildout (§7.24). The
    system-prompt rewrite (engine owns the speaker scheme + injects current
    scene/date via onContextBuilt) is the pass after that.

## 8. Roadmap — NOT yet implemented (with the user's requirements)

Ordered roughly by unlock value:

1. **Turn/time system** — the biggest unlock. The **story clock** (§7.30) AND
   **Scenes + turn-length** (§7.31: `Scene`/`SceneStore` + `scene`/`turn`/
   `end-scene`/`downtime`/`scenes`) are now BUILT — the real-calendar substrate
   and the named unit of play (combat marches the clock in 3-second turns; a
   freeform scene counts turns without moving it). LEFT: making advancing time
   ENFORCE what is advisory today — effect durations, cooldowns, uses-per-scene
   (from the existing `EffectUses` ledger), boost expiry, `Pool.perTurnLimit`
   (blood per turn — field exists, unenforced), extended-roll interval spacing,
   willpower-per-turn, and auto-`advance` of affliction chains (merging the
   affliction stepper `[[advance]]` with `[[advance-time]]`); and the Chapter/
   Story/Chronicle hierarchy above Scene (light labels for now).
2. **Roll-system residuals** — resisted / contested / extended contests and
   success tables **shipped** (§5, §7.16). Left: **auto-applying a table's
   numeric output** (damage/soak currently read the count for display but don't
   yet mark the live track from a roll — the `damage` command still takes the
   number directly); **per-round spends** inside contests (single `resist`/
   `contest` already allow the actor to `spend=`); and folding table readings
   into the LiveCharacter soak/damage pipeline once records go "ready".
   **The combat damage formula (user ruling, 2026-07-16)**: attack roll
   (attribute+skill), optionally opposed by a defense roll; a fully successful
   defense = NO damage roll; otherwise the damage POOL = net attack successes
   (attack − defense; ALL net successes as stated — note the V20 book adds
   only successes beyond the first; flagged to the user, recorded as stated)
   + Strength + weapon bonus/penalty + Potence dots as DICE, with Potence's
   rating ALSO counted as automatic successes on the damage roll (§7.2: free
   successes stay separate from their source — `LiveCharacter.Roll`'s
   `potence: true` + `bonusDiceFrom` already model both halves). Damage roll
   reads through the `damage` table (1/success), then soak. Attack-vs-defense
   maps onto the existing resisted-contest machinery (margin = net successes).
3. **Afflictions on live characters** — largely **SHIPPED** (§7.19):
   `AfflictionDef` + registry + `afflict`/`advance`/`lift`/`afflictions`,
   bindings, `then` chains, mirrors, tags-bite-in-rolls, and the
   Willpower shrug-off (`lift spend=willpower`). Left: the `suspend` op
   executing against active afflictions (broad "all mental disciplines" AND
   narrow "effect of Majesty" — granular configuration), duration
   enforcement + auto-`advance` (turn system, #1), and the
   affliction-builder window (#12 — this command set is its substrate).
4. **Targeting others** — healing others (with "others must be X" —
   `targetMustBe` field already stored), enemy-resistance effects (`resist`
   op); `roll-for` and now the `resist`/`contest` two-side machinery are the
   precedents — a spend effect that opposes a target can reuse `compareRolls`.
5. **Allocation + creation budgets** — customizable per-template budgets;
   attribute/ability **priorities (primary/secondary/tertiary)**; freebies;
   merits/flaws taken at creation (`meritsFlaws` bucket exists, empty);
   ALL OPT-IN (play-before-allocating stays sacred); **hybrids need a
   budget-merge rule**; probably delivered as a creation wizard on the
   existing engine + allocation commands. **Constraint groups** (§7.17) already
   exist as data + `[[check-constraints]]`; creation is where they become
   enforced (block/allow backgrounds & merits/flaws) instead of advisory.
6. **Template choices** — clans (vampires), families (revenants), fellowships
   (mages) as selectable data configuring the character (in-clan disciplines,
   allowed roads/morality, and **the constraint groups they own via `scope`**).
   `DISCIPLINES` already carries clan lists; a Choice primitive is the next data
   atom after constraints, referenced by the template-definer window.
7. **Sorcerer Paths** (static magic) + the "other powers": dynamic magic,
   blood sorcery, ritual magic, Arcana — all currently just words the effect
   grammar can already reference.
8. **Owned-power roll effects — SHIPPED** (§7.23): Trait Affinity, Trait
   Enhancement and Specialties are live (parameterized merits + passive
   effects + the specialty= knob). LEFT from this item: the
   **`generateWithStory` specialty-applicability ask** ("which specialty
   applies, if any?" with story context; chat messages, GLM 4.6 — confirmed
   in the API reference) — the FIRST Storyteller-loop integration, its own
   pass (host contract + mock + prompt design). Original spec follows for
   reference:
   - *Trait Affinity* (Devil's Due; earlier misrecorded "Trait Aptitude"):
     each stack LOWERS DIFFICULTY BY 1 on any roll whose pool uses that
     Attribute/Ability. Stacking rule: ONE chosen trait may hold up to
     THREE stacks; every OTHER trait caps at TWO; the number of
     affinity-bearing traits is bounded only by points to spend. Engine:
     effect-grammar roll ops gain an optional **`trait` gate** (the twin of
     the existing actionTag gate) plus `permanent: true`;
     `characterRollEnv`'s resolver RECORDS which traits a pool actually
     used; owned merits/arcana with permanent trait-gated ops auto-apply.
     Stack caps are validation data. Pure data — no new registry
     (Iron-Will-style cost reduction already exists as effect data).
   - *Specialties* (user correction — NOT the V20 double-10s rule): when a
     specialty applies the roll gains **+1 DIE**, and **at most ONE
     specialty applies per roll** even if several could. `specialties`
     record bucket (trait → list of strings, creator-editable);
     applicability is fiction-dependent → a manual `specialty=` roll arg now
     (advisory pattern), and the **`api.v1.generateWithStory` ask** ("does
     specialty X apply to this action? yes/no" with story context; chat
     messages, GLM 4.6 — confirmed in the API reference) as the FIRST
     Storyteller-loop integration, its own later pass (host contract + mock
     + prompt design).
   - *Trait Enhancement* (user-specced 2026-07-17): +N permanently raises
     the trait's EFFECTIVE value for all purposes AND extends its
     advancement POTENTIAL, while XP keeps operating on the BASE. Worked
     example (user's): Strength 3 with +2 Enhancement = effective 5; the
     next dot is priced as raising base 3→4; the XP-raise ceiling becomes
     template max + N (5 → 7), so the eventual effective tops at 9. Engine:
     a permanent per-trait enhancement layer BESIDE CharacterBoosts (boosts
     stay the temporary layer) feeding every effective-value read
     (`resolveTraitFromRecord` consumers), plus a max-extension consumed by
     the future allocation/XP engine (#5, #16); XP costs read the
     un-enhanced base.
9. **Named-roll + spend integration** — let a saved roll carry its spend;
   composed/multi-resource spends in one command.
10. **LiveCharacter ⇄ PlayableCharacter unification** — build a LiveCharacter
    from a "ready" record so rolls fold in Discipline auto-successes, real
    pools, soak and the square-based track; retire `serializeLiveCharacter`/
    `char_<name>` path; then stage: "ready".
11. **historyStorage migration** — move mechanical state (health, resources,
    boosts, extended actions, ledger) so story UNDO rewinds mechanics.
12. **More wizard-windows.** The infra is now SPEC-DRIVEN (§7.20):
    `openCommandWindow(verb)` renders any registered CommandSpec as a form and
    submits through `composeCommand` — a static-shaped window costs a spec
    that already exists. Selection widgets policy (user idea, recorded in
    docs/ui-parts.md "Design notes — selection widgets"): few options → inline
    button row (exists); MANY options → the **picker modal** (current value ✅
    + a Choose… button opening a modal with one button per option — a dropdown
    substitute, to be a third enum-rendering branch of openCommandWindow);
    open vocabularies → text input. The **affliction windows are DONE**
    (`[[win-affliction]]` + `[[win-afflict]]` — the domain-driven pattern
    proven; the picker is `pickerField`, reusable via
    `openCommandWindow({pickers})`). The **`[[win-roll]]` roll builder is
    DONE** (one window multiplexing roll/roll-for/name-roll; knob fields
    walked from roll's spec; For-aware spend/specialty pickers; Save bakes
    the spend/specialty/**table** sidecars — `SavedRoll.table` added with it;
    **difficulty-as-expression DONE** in `RollSpec.difficultyExpr`).
    The **Opposed knob is DONE** (§7.29 addendum): a none/resisted/contested row
    that reveals vs-pool + vs-difficulty, so Save bakes a contest. Remaining:
    **win-roll fields for the extended/steps knobs** (extended toggle +
    intervals/interval/on-botch, a description input; procedures via a
    `win-add-step` free window) and the two live-play UX fixes — "Choose pool…" →
    "Choose saved roll…", collapse the advanced knobs so name + buttons stay
    visible (§7.28); the **advisory**
    `self:`/`ally:`/`target:`/`opposition:` prefixes - in the "Design notes"
    section of `docs/ui-parts.md`; migrating the TEXT wizards
    (`RESOURCES_WIZARD`) to render as windows; and a template-definer window
    once the Choice primitive lands.
13. **Creation-budget wizard** (same engine).
14. **Aliases + redefinable default character** — **DONE** (§7.18):
    `[[set-default]]` changes the default character; `@` aliases in three
    scopes resolve in `play`/`roll-for`/`set-default`/`vs=`; `[[player]]`
    switches the current player. Remaining niche: aliases inside pool
    expressions (pool `@` still means saved rolls).
15. **The Storyteller loop itself** — `api.v1.generate` narration, UI panels
    (`ui-extensions`/`ui-parts`/`modals` docs already mirrored), token budget
    handling. The reason the project exists; everything above serves it.
16. Old `RulesetConfig` XP/freebie numbers → replaced by the real cost engine
    (5); creation-cap enforcement in `Stat` is partially unused until then.

## 9. Session-restart checklist

1. Read this file, then `README.md` (player-facing view of the same facts).
2. `git log --oneline -15` — anything after the "Last synced" commit above
   means this file may be stale: diff those commits and update it FIRST.
3. `bun test && bun x tsc --noEmit` to confirm a green baseline.
4. The user speaks in WoD terms (splats, freebies, botches, soak); prefers
   plans confirmed via questions before big passes; wants everything
   configurable-as-data; accepts advisory enforcement when a system is
   missing; and pushes straight to `main`.
5. When in doubt about NovelAI host behavior: `docs/novelai-api.md`, then the
   mirrored `docs/*.html` (api-reference.html is the index).
