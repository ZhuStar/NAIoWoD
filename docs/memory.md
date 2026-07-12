# NAIoWoD — Project Memory

> **Purpose of this file.** This is the project's externalized memory: enough
> for a fresh Claude session (or any developer) to rebuild full context without
> the original conversation. It maps everything implemented to its files,
> classes and functions; records every design decision **and its reason**; and
> lists everything not yet built. **Keep it current: any commit that changes
> behavior, architecture, commands, data shapes, or the roadmap must update
> this file in the same commit.** Docs-only commits don't require a re-sync.
> **Last synced with the code as of commit `bbe2ac7`** ("Conditions:
> parameterized character states — bindings, chains, mirrors, live tags").

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
bun test            # 190 tests across test/system.test.ts + test/build.test.ts
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

**Commit conventions**: descriptive body; end with the
`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` and `Claude-Session:`
trailers (see git log for the exact format). Push with retries/backoff.
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
src/services.ts      ScopedStorage, LorebookManager, MeritFlawRegistry, LorebookParser
src/game.ts          everything live: characters, stores, interpreter, commands
src/window.ts        api.v1.ui wizard-windows that EMIT commands (win-constraint)
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
`MeritFlawRegistry.loadFromLorebook()`, `ResourceOverrides.loadFromLorebook()`,
logs a summary, returns `{ setupMessage }` (the OOC note when SRD categories
were created).

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

### src/rolls.ts (555) — pure roll machinery
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

### src/rules.ts (823) — all game DATA
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

### src/services.ts (261)
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
- `MeritFlawRegistry` — in-code defaults + `loadFromLorebook()` merging any
  JSON arrays found in `srd:merits-flaws`; `get/all/register/reset`.
- `LorebookParser.ParseFromApi()` — zero-dot Stat maps from the lorebook
  ability/background lists.

### src/game.ts (2954) — the live layer
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
`@a` (chain); malformed → undefined. `resolveAliasOwner` maps owner
`default` → the default player/character. **`resolveCharacterRef(token)`** is
the ONE seam turning a character argument (real name or @alias) into a
normalized name — wired into `cmdPlay`, `cmdRollFor`, `cmdSetDefault`, and the
`vs=` of `cmdVersus`/`cmdExtendedContest`. Pool-position `@` stays the
named-roll sigil (disambiguated by position). Character names may not start
with `@` (creation refuses). Display: names store normalized; replies render
via `disp()` = `StringUtil.toTitleCase` (contest notes in rolls.ts do the same
for side names).

**Success tables (live)**: `loadSuccessTablesFromLorebook()` — resets the
registry to defaults, then overlays an optional lorebook entry
`wod:config` / `wod:config:success-tables` (`SUCCESS_TABLES_ENTRY`): JSON below
the marker, either an **array** of `SuccessTable` or a **map** `name → table`.
Re-run at init, and on BOTH creator-mode sync points (alongside
ResourceOverrides). Same config family as overrides.

**Constraint groups (live)**: `ConstraintRegistry` — same config family; lorebook
`wod:config` / `wod:config:constraints` (`CONSTRAINTS_ENTRY`), JSON array of
`ConstraintGroup` (or a `name → group` map) below the marker; module-level cache
(ResourceOverrides pattern), NO built-in defaults; `loadFromLorebook`/`save(list)`
/`all`/`get`/`reset`/`put(group)` (add-or-replace by name)/`remove(name)`. Loaded
at init + both creator-sync points. `ownedTraitsOf(char)` (backgrounds/merit/flaw
keys, merit-vs-flaw via MeritFlawRegistry, templates) feeds `checkConstraints`.

**Conditions (live)**: `ConditionRegistry` — config family with SHIPPED
defaults (`DEFAULT_CONDITIONS`); lorebook `wod:config` /
`wod:config:conditions` (`CONDITIONS_ENTRY`), JSON array of `ConditionDef` (or
`name → def` map); overlay cache SHADOWS same-named defaults;
`loadFromLorebook` (init + both creator-sync points + creator-mode-off)
/`get`/`all` (overlay first, unshadowed defaults after)/`save`/`put`/
`remove` (overlay only — shipped defs resurface, `forget-condition` says so)
/`reset`. **`CharacterConditions`** — storyStorage `cond:<name>` →
`ActiveCondition[]` where `ActiveCondition {def, bindings: {slot→normalized
name}, note?}`; keyed by NORMALIZED NAME, character record NOT required (an
NPC animal can carry a mirror); `list/afflict (replaces an instance of the
same def)/lift (returns the removed instance)/clear/tags` (union of active
defs' tags). **Tags bite** via `withConditionTags(name, spec)` — merges
condition tags into the RollSpec (deduped) in `rollAndReport`, `cmdVersus`
(my side), and `execContestSide` (named sides), so registered RollModifiers
fire on every roll the afflicted character makes. Helpers:
`resolveBindingValue` (binding values resolve `@aliases` via
`resolveCharacterRef`, else normalize — NPC strings fine), `conditionSubject`
(`on=` else current character), `conditionLine`, `applyCondition` (validates
required bindings BEFORE any write; fires `def.mirror` onto
`bindings.target` bound back `{target: subject}` + note "(mirror)"),
`removeCondition` (lift + lift the mirror from the bound target).
`cmdAdvance` = the manual chain trigger (turn system will automate): removes
the instance, applies `def.then` CARRYING BINDINGS FORWARD (successor's
mirror fires). `cmdLift` `spend=` = the Willpower shrug-off via `applySpend`
(requires a sheet; NPCs can be lifted but not spend). Durations render via
`describeDuration` + "(ST-enforced)".

**Resource overrides (house-rule layer)**: `ResourceOverrides` — lorebook
`wod:config` / `wod:config:resources`, JSON map `name → Partial<ResourceDef>`
below the marker; **cached module-level for sync reads** (MeritFlawRegistry
pattern); `loadFromLorebook()` (re-run at init, on wizard save, and on BOTH
creator-mode sync points), `save(map)`, `current()`, `reset()` (tests).

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

**Wizards (session + the resources wizard)**:
- `WizardSession` — storage `wizard:active` = `{def, state, prompt}`.
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

**Command layer**:
- `CommandParser.parse(body)` → `ParsedCommand {name, positional[], named{},
  raw}` — quote-aware; `key=value`/`key="v"` named (lowercased keys), bare or
  quoted tokens positional in order. **Every token/value passes through
  `StringUtil.normalizeInput` at parse time** — EXCEPT backtick-quoted values
  (`` key=`Verbatim` `` or a `` `positional` ``), which stay verbatim (the
  literal escape hatch for display text). `raw` stays raw. **Why split from
  routing**: user wants parser and router to be different things (future
  lorebook-defined commands).
- `CommandRouter` — verb → `{handler(cmd, ctx), help}` registry
  (`register/verbs/helpFor/help/route`; `help()`/`helpFor()` back `[[help]]`);
  `CommandContext {rng?}` (tests inject `seqRng`); creator-mode pre-sync
  (characters + overrides reload) before every command while creator mode is on;
  unknown verb lists all verbs.
- `processAdventureInput(rawInputText)` — extracts every `[[...]]`, routes
  each, replaces with single-line OOC notes; prose-free input →
  `stopGeneration: true`; non-command input → wizard reply (if active) else
  untouched (`undefined`).

**The command surface** (registered verbs, exact grammars in the register
calls at the bottom of game.ts):
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
`rollOverridesFromNamed` for continue-roll. `resolveTraitFromRecord(char, name)`
checks attributes → abilities → backgrounds → virtues → disciplines → traits →
poolStarts → 0.

Contest plumbing (`cmdVersus(mode, cmd, ctx)` behind `resist`/`contest`): side A
is the current character (may `spend=` on its own roll); side B is `vs="Name"`
(a stored character rolls live) or ad-hoc (`vs="the lock"`/omitted → literal
pool, `oppName` labels it). `execContestSide(base, charName?, rng, extra?)` rolls
one side — a named character via `characterRollEnv` (+wound penalty), else a
zero resolver so only literals count; a deleted char degrades to ad-hoc.
`contestTableInput(outcome)` feeds `table=` the actor's winning **margin** (botch
→ botch, any non-win → failure). `extended-contest`/`continue-contest` reuse
`execContestSide` each round (re-resolving both pools live) + `applyContestRound`.

### src/window.ts (95) — api.v1.ui wizard-windows that EMIT commands
The window layer, built AFTER game (imports `api`+UI types from host,
`CommandRouter` from game). **A window is an abstraction over the command layer,
not a second path**: it renders a UIPart form, binds fields to `tempStorage` via
`storageKey`, and on submit composes a `[[command]]` string and routes it through
the SAME `CommandRouter`. `openConstraintWindow()` builds the constraint form
(name; relation/domain **button-rows** - no native select, each button writes a
temp key and re-renders via the handle's `update`; members/max/scope/note; a
Create button that routes `define-constraint …` and shows the reply in-window);
`selectorRow`/`submitConstraint` helpers; keys under `win:constraint:*`.
Registers `[[win-constraint]]` at module load (pure registry mutation - purity
preserved). `index.ts` `export * from "./window"` runs that registration.

### src/index.ts / src/main.ts
Re-export everything (incl. `./window`) + `init()` (now also
`ConstraintRegistry.loadFromLorebook()` + `ConditionRegistry.loadFromLorebook()`);
main calls `init().catch`.

### scripts/build-single.ts (86)
`MODULES` order (= layering), `stripModule` regexes (whole-line re-exports,
import statements, leading `export `), `buildSingleFile()` + `OUTPUT_PATH`
(exported for the sync test), guardrails (starts with `//`, NOT `/*---`, no
import/export lines survive).

### test/ (2701 + 20 lines, 262 tests, 73 describes)
`test/system.test.ts` — everything; `test/build.test.ts` — dist sync +
plain-TS guarantees. Conventions: `seqRng(faces[])` (maps desired d10 faces to
rng values; **throws when exhausted** — used to prove exact dice counts),
`allTens`; `beforeAll` bootstraps the lorebook once; suites that touch
storage/lorebook/overrides do `__resetStorageMock(); __resetLorebookMock();
ResourceOverrides.reset(); await LorebookManager.bootstrap();` in
`beforeEach`; command e2e via `CommandRouter.route(body, {rng})`; wizard e2e
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
without records carry them too) · `wizard:active` wizard session · **`aliases`** (the whole 3-scope alias map) ·
**`current-player`** / **`default-player`** pointers (default "storyteller") ·
`char_<name>` (legacy LiveCharacter serialization). **tempStorage**
(session-scoped, cleared on close): `win:constraint:*` (the constraint window's
live form fields - the documented home for UI storageKey state).

**Lorebook** (all data entries = instructions above `=====`, data below):
`srd:abilities` (talents/skills/knowledges lists) · `srd:backgrounds` ·
`srd:merits-flaws` (JSON defs merged over defaults) · `wod:player-characters`
(`pc:<name>` entries — SOURCE OF TRUTH for characters) · `wod:named-rolls`
(`wod:named-rolls:library` JSON map) · `wod:config`
(`wod:config:resources` overrides map; `wod:config:success-tables` optional
success-table overlay — array or `name → table` map; `wod:config:constraints`
constraint groups — array of `ConstraintGroup` or `name → group` map;
`wod:config:conditions` condition-def overlay — array of `ConditionDef` or
`name → def` map, shadows shipped defaults by name).

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
12. **More wizard-windows.** The host UI infra now EXISTS: `api.v1.ui` contract +
    off-host mock in `src/host.ts`, the window layer `src/window.ts`, and the
    first window `[[win-constraint]]` (§7.17). Remaining: the `[[win-roll]]`
    roll-builder window (spec + decisions - window not modal;
    **difficulty-as-expression now DONE** in `RollSpec.difficultyExpr`; still to do
    the **advisory** `self:`/`ally:`/`target:`/`opposition:` prefixes - in the
    "Design notes" section of `docs/ui-parts.md`); migrating the
    existing TEXT wizards (`RESOURCES_WIZARD`) to render as windows on the same
    infra; and a template-definer window once the Choice primitive lands.
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
