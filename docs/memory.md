# NAIoWoD — Project Memory

> **Purpose of this file.** This is the project's externalized memory: enough
> for a fresh Claude session (or any developer) to rebuild full context without
> the original conversation. It maps everything implemented to its files,
> classes and functions; records every design decision **and its reason**; and
> lists everything not yet built. **Keep it current: any commit that changes
> behavior, architecture, commands, data shapes, or the roadmap must update
> this file in the same commit.** Docs-only commits don't require a re-sync.
> **Last synced with the code as of commit `bd841ad`** ("Virtual lorebook
> subcategories, tracked cards + reconciliation modals, table aliases").

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
1. `bun run build` then `bun test` (includes the dist-sync test) — 0 fail.
2. `bun x tsc --noEmit` clean.
3. Standalone type-check of the artifact (copy `dist/naiowod.ts` to a temp dir
   outside the project, run tsc on it alone with
   `--strict --skipLibCheck --target ES2021 --lib ES2021,DOM,DOM.Iterable`).
   This catches global-scope collisions the per-module check can't (it once
   caught `StorageManager` shadowing the DOM global → renamed `ScopedStorage`).
4. Import purity: `bun -e 'await import("./src/index.ts")'` must print nothing
   (side effects live only in `init()`).
5. A live e2e: `init()` then drive `processAdventureInput("[[...]]")`.

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
src/host.ts          host contract + off-host mock (ONLY file touching globalThis)
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
- **Why no `.naiscript` frontmatter**: NovelAI's script editor takes plain TS;
  the YAML `/*--- ---*/` header (with an embedded script id) only matters for
  the export/import flow, which the user avoids because baked-in ids cause
  confusion. So the file starts with a `//` comment note, never `/*---`
  (guardrails + tests enforce this).
- **Why readable concatenation, not an IIFE bundle**: the user wants the single
  file to be hand-readable/editable ("naiscript is just TS with a metadata
  header above"). An earlier IIFE build was replaced.

**Host vs mock** (`src/host.ts`): `const __host = globalThis as {api?}` — if
the real NovelAI `api` exists it is used; otherwise an in-memory mock (4
storage stores as Maps, an empty lorebook, uuid fallback, hooks.register that
just logs). Test helpers: `__resetLorebookMock()`, `__resetStorageMock()`.
`log(...)` routes through `api.v1.log`.

**`init()`** (`src/index.ts`): registers the `onTextAdventureInput` hook →
`processAdventureInput(rawInputText)`, then `LorebookManager.bootstrap()`,
`MeritFlawRegistry.loadFromLorebook()`, `reloadAllConfigStores()` (every
config registry in one sweep), logs a summary with per-entry counts, returns
`{ setupMessage }` (the OOC note when SRD categories were created).

## 4. NovelAI host facts (details in `docs/novelai-api.md` + `docs/*.html` mirror)

- Four storage stores share `get/set/remove/list` (all async):
  `api.v1.storage` (per script), `storyStorage` (per story — **we use this**,
  via `ScopedStorage`), `historyStorage` (story + undo-aware — planned home for
  mechanical state), `tempStorage` (session, self-clearing). **No
  `setIfAbsent`** on the host (ScopedStorage emulates it).
- Lorebook: `entries(categoryId?)/categories()/entry/createCategory/createEntry`
  (create* resolve to the **new id**; pass `api.v1.uuid()` to control ids),
  `updateEntry/removeEntry`. Entries filter by category **id**, not name.
- `onTextAdventureInput` handler gets `{continuityId, inputText, rawInputText,
  mode}` and may return `{inputText?, mode?, stopGeneration?,
  stopFurtherScripts?}`. **The host strips newlines from returned inputText**
  → all OOC replies are single-line `((OOC-Storyteller: ...))`.
- `api.v1.uuid()`, `api.v1.generate` (future Storyteller loop), UI extension
  API (`api.v1.ui.*` — future wizard renderer), permissions for document edit.

## 5. Fine-grained module map

### src/host.ts (266 lines)
- Types: `OnTextAdventureInputReturnValue`, `OnTextAdventureInput`,
  `LorebookEntryData`, `LorebookCategoryData`, `LorebookCondition`; internal
  `StorageApi`, `WodApi`.
- **UI contract**: the `UIPart` union + the parts our windows use (text,
  textInput, numberInput, button, row, column, box, collapsibleSection),
  `WindowOptions`/`ModalOptions`, `UIHandle {update,close,isClosed,closed}`,
  `UiPartHelpers`, `UiApi` (`window.open`/`modal.open`/`part.*`/`toast`) - now a
  field on `WodApi.v1.ui`. Shapes from `docs/ui-api-reference.md`.
- `api` (the guarded mock/real switch), `log()`, `__resetLorebookMock()`,
  `__resetStorageMock()`.
- **UI mock**: `window.open`/`modal.open` record `{options,handle}`; the handle's
  `update` merges + re-records; `part.*` add `type`. Test hooks
  `__resetUiMock()`, `__uiWindows()`, `__uiClickButton(text)` (fires a button's
  callback - drives the whole window→command path off-host).

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
  heal: "normal"|"never"|"special", healCost, condition?}`, `HealthConditionDef`
  (state label from damaged/total linked boxes — e.g. poison), wrap-around
  upgrade (bashing past capacity upgrades existing), `Overkill`, `Penalty`
  (deepest filled square, values are NEGATIVE: -1, -2, -5), `Level`,
  `IsIncapacitated/IsDead`, `ApplyDamage/Heal/HealWithPoints`, `Summary()` →
  `HealthSummary {bashing, lethal, aggravated, filled, capacity, overkill,
  penalty, level, isIncapacitated, isDead, conditions}`.
  `STANDARD_HEALTH_LEVELS` = classic 7 (Bruised 0 … Incapacitated -5).
  **Why squares**: conditions, unhealable/costed boxes; was regressed by a
  fork once and deliberately restored — keep the simple API working on top.
- `SoakTypeRule {soakable, pool: traitNames[]}`, `SoakSpec {bashing, lethal,
  aggravated, difficulty}`.

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

### src/rolls.ts (576) — pure roll machinery
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

### src/rules.ts (825) — all game DATA
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
  `DEFAULT_MERITS_FLAWS` (13 examples incl. Iron Will, Acute Senses…).
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
- **Conditions (pure data)**: `ConditionDef {name, description?, bindings?[]
  (required slots like "target"), duration?: EffectDuration (advisory), then?
  (successor for [[advance]]), mirror? (condition the bound target gains, bound
  back), tags? (join the afflicted character's rolls), note?}` +
  `makeConditionDef` (normalize), `describeConditionDef`,
  `parseConditionDuration("1 turn"|"2 scenes"|"until x"|"instant")` →
  EffectDuration, `describeDuration`. `DEFAULT_CONDITIONS` = the **Feral
  Speech** exemplar: `concentrating-on {target, 1 turn, then feral-whispers}`
  and `feral-whispers {target, 1 scene, mirror feral-whispers}`. (Health-box
  conditions are the separate `HealthConditionDef` in core/damage.ts —
  RENAMED from ConditionDef to free the name; single-scope build forbids
  duplicates.)

### src/command.ts (173) — the command bus (pure; depends on core/traits only)
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

### src/state.ts (1370) — the character model + every persistent store
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
`{name: SavedRoll}` where **`SavedRoll = RollSpec & { spend? }`** (the optional
resource/role token, a game-layer sidecar kept OUT of the pure RollSpec); **read
fresh every call** (no cache) so hand edits are always live;
`all/get/names/save/remove`. A saved `spend` is auto-paid on `[[roll @name]]`
unless the command supplies its own `spend=` (via `applySpend`'s `spendOverride`).

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
- `ConditionRegistry` = `ListConfigStore<ConditionDef>` on
  `wod:config:conditions` (`CONDITIONS_ENTRY`), defaults=`DEFAULT_CONDITIONS`
  (the overlay SHADOWS built-ins; `remove` is overlay-only so
  `forget-condition` resurfaces them), make=`makeConditionDef`.

**`CreatorMode`** — the hand-editing flag (storage key `creator-mode`,
unchanged); `enabled()/set(on)`. The router's game-registered hook consults it.

**Live per-character conditions**: `ActiveCondition {def, bindings:
{slot→normalized name}, note?}`; **`CharacterConditions`** — storyStorage
`cond:<name>`, keyed by NORMALIZED NAME, character record NOT required (an NPC
animal can carry a mirror); `list/afflict (replaces an instance of the same
def)/lift (returns the removed instance)/clear/tags` (union of active defs'
tags).

**`resolveTraitFromRecord(char, name)`** — a record's numeric buckets
(attributes → abilities → backgrounds → virtues → disciplines → traits →
poolStarts → 0); shared by game.ts roll plumbing and `CharacterBoosts` caps.

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

### src/game.ts (2069) — the verbs (interpreter, wizards, handlers, registrations)

**Table seam + modals**: `resolveTableRef(raw)` — the ONE place a table
argument (`key`, `sub::name`, or `@table-alias`) becomes a registry key;
`tableNote` (now async) reads `table=` through it for rolls AND contests.
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
`cmdPlay`, `cmdRollFor`, `cmdSetDefault`, condition binding values
(`resolveBindingValue`), and the `vs=` of `cmdVersus`/`cmdExtendedContest`.
`disp()` = `StringUtil.toTitleCase` for replies.

**Conditions in play**: **tags bite** via `withConditionTags(name, spec)` —
merges active condition tags into the RollSpec (deduped) in `rollAndReport`,
`cmdVersus` (my side), and `execContestSide` (named sides), so registered
RollModifiers fire on every roll the afflicted character makes. Helpers:
`resolveBindingValue` (@aliases else normalize — NPC strings fine),
`conditionSubject` (`on=` else current character), `conditionLine`,
`applyCondition` (validates required bindings BEFORE any write; fires
`def.mirror` onto `bindings.target` bound back `{target: subject}` + note
"(mirror)"), `removeCondition` (lift + lift the mirror from the bound
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
(its slots depend on the condition def).

**`processAdventureInput(rawInputText)`** — extracts every `[[...]]`, routes
each, replaces with single-line OOC notes; prose-free input →
`stopGeneration: true`; non-command input → wizard reply (if active) else
untouched (`undefined`).

**The command surface** (registered verbs; [[help]] DERIVES each line from the
verb's CommandSpec at the bottom of game.ts — the grammars below match it):
`help [verb]` (list commands, or one's usage) ·
`creator-mode set=true|false` · `create-playable name="…" templates="a,b"` ·
`play [name="…"]` (no name → default) · `characters` (list; marks
current/default) · `set-default name="…"` · `roll <pool|@name>
[difficulty|expr] [diff-mod] requires= dice-modifier= tags= spend=res[:effect][!]`
(difficulty may be a number OR a trait/calculation like `stamina+3`) ·
`roll-for "Name" <pool|@name> …` (doesn't change selection) ·
`name-roll <name> <pool> … [spend=…]` (bakes in a spend) · `list-rolls` ·
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
`define-constraint name=".." relation=exclusive|restricted|forbidden
domain=background|merit|flaw|meritflaw|any members="a,b" [max=N] [scope=".."]
[note=".."]` · `constraints` · `constraint <name>` · `forget-constraint <name>` ·
`check-constraints` · `win-constraint` (opens the constraint window - registered
in `src/window.ts`, emits `define-constraint`) ·
`define-condition name=".." [bindings="target"] [duration="1 turn|until x|
instant"] [then=".."] [mirror=".."] [tags="a,b"] [description=".."]
[note=".."]` · `condition [name]` (list defs, or one in full) ·
`forget-condition <name>` (overlay only; built-ins resurface) ·
`afflict <condition> [on=<name|@alias>] [<slot>=<name|@alias> …]` (mirror defs
also afflict the bound target) · `advance <condition> [on=..]` (end it, begin
its `then` successor, bindings carried forward) · `lift <condition> [on=..]
[spend=res[::effect][!]]` (removes it AND its mirror; spend = shrug-off) ·
`conditions [<name|@alias>]` (active list; NPCs work too) ·
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
(noted) and reads `table=` via `tableNote(cmd, outcome, successes)`.
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

### src/window.ts (120) — api.v1.ui windows that EMIT commands, DERIVED from specs
Imports host + **command** only (NOT game — the split's dependency win).
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
shows the OOC reply in-window. `openConstraintWindow()` =
`openCommandWindow("define-constraint", …)`; `[[win-constraint]]` and
`[[win-table]]` (over define-table) register at module load (pure registry
mutation). Windows needing DOMAIN-driven fields (condition binding slots)
will hand-build their part tree and still submit through `composeCommand`.

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

### test/ (3068 + 20 lines, 288 tests, 79 describes)
`test/system.test.ts` — everything; `test/build.test.ts` — dist sync +
plain-TS guarantees. Conventions: `seqRng(faces[])` (maps desired d10 faces to
rng values; **throws when exhausted** — used to prove exact dice counts),
`allTens`; `beforeAll` bootstraps the lorebook once; suites that touch
storage/lorebook/config registries do `__resetStorageMock();
__resetLorebookMock(); resetAllConfigStores(); await
LorebookManager.bootstrap();` in `beforeEach` (ONE call resets every config
store AND restores the success-table defaults — the per-registry reset list
that leaked a stale ResourceOverrides cache into the conditions suite is
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
· **`cond:<name>`** active conditions (keyed by normalized name — NPCs
without records carry them too) · **`lb:ids`** (tracked lorebook uuids:
`cat:<category>` / `ent:<category>/<entry>`) · **`lb:backup:<category>/<entry>`**
(tracked-card text backups) · **`table-aliases`** (alias→table-key map) ·
`wizard:active` wizard session · **`aliases`** (the whole 3-scope alias map) ·
**`current-player`** / **`default-player`** pointers (default "storyteller") ·
`char_<name>` (legacy LiveCharacter serialization). **tempStorage**
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
map; `wod:config:constraints` constraint groups; `wod:config:conditions`
condition-def overlay — each array or `name → def` map) ·
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
19. **Conditions are parameterized states, not flat flags** (the user's Feral
    Speech analysis): a condition can need a **target** ("concentrating-on
    *the squirrel*"), can **chain** into a successor (`then` — concentrating-on
    lasts 1 turn, then feral-whispers begins; `[[advance]]` is the manual
    trigger until the turn system), and involves the OTHER party too. Two
    decisions via questions: **mirror automatically** (a def may declare
    `mirror="<condition>"`; afflicting the subject also afflicts
    `bindings.target` — sheet or not — with the mirror bound back; lifting
    lifts both) and **tags bite now** (a def's `tags[]` auto-join every roll
    the afflicted character makes, firing existing `RollModifierRegistry`
    modifiers — ZERO new modifier machinery; unregistered tags surface as the
    usual unknown-tag note). Durations reuse `EffectDuration`, advisory
    "(ST-enforced)" per §7.12. Binding values resolve `@aliases`; instances
    live under normalized names so sheetless NPCs participate. `lift spend=`
    is the Willpower shrug-off (roadmap #3's wish, via `applySpend`).
    Naming: damage.ts's health-box states were RENAMED
    `HealthConditionDef`/`HealthConditionState` to free `ConditionDef` for the
    central concept (single-scope dist build forbids duplicate globals).
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

## 8. Roadmap — NOT yet implemented (with the user's requirements)

Ordered roughly by unlock value:

1. **Turn/time system** — the biggest unlock. Makes real: effect durations,
   cooldowns, uses-per-scene (enforce from the existing `EffectUses` ledger),
   boost expiry, `Pool.perTurnLimit` (e.g. blood per turn — field exists,
   unenforced), extended-roll interval enforcement, willpower-per-turn rules.
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
3. **Conditions on live characters** — largely **SHIPPED** (§7.19):
   `ConditionDef` + registry + `afflict`/`advance`/`lift`/`conditions`,
   bindings, `then` chains, mirrors, tags-bite-in-rolls, and the
   Willpower shrug-off (`lift spend=willpower`). Left: the `suspend` op
   executing against active conditions (broad "all mental disciplines" AND
   narrow "effect of Majesty" — granular configuration), duration
   enforcement + auto-`advance` (turn system, #1), and the
   condition-builder window (#12 — this command set is its substrate).
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
8. **Merits/flaws → automatic roll modifiers** — derive RollModifierRegistry
   entries from a character's owned merits (today the ST tags rolls manually;
   Iron-Will-style cost reduction exists as effect data).
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
    open vocabularies → text input. Remaining: the **condition-builder window** (specs +
    DOMAIN-driven fields from `ConditionDef.bindings` — hand-built part tree,
    same composeCommand submit); the `[[win-roll]]` roll-builder window
    (window not modal; **difficulty-as-expression DONE** in
    `RollSpec.difficultyExpr`; still to do the **advisory**
    `self:`/`ally:`/`target:`/`opposition:` prefixes - in the "Design notes"
    section of `docs/ui-parts.md`); migrating the TEXT wizards
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
