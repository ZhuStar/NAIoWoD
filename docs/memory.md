# NAIoWoD — Project Memory

> **Purpose of this file.** This is the project's externalized memory: enough
> for a fresh Claude session (or any developer) to rebuild full context without
> the original conversation. It maps everything implemented to its files,
> classes and functions; records every design decision **and its reason**; and
> lists everything not yet built. **Keep it current: any commit that changes
> behavior, architecture, commands, data shapes, or the roadmap must update
> this file in the same commit.** Docs-only commits don't require a re-sync.
> **Last synced with the code as of commit `281ea88`** ("One affliction most
> merits want, and it is signed").
> Prior: `49a4c57` ("A trait knows what kind of trait it is, and a merit can say
> what it turns on").
> Prior: `06bf156` ("A contest is a field, and writing the rulebook is not a
> story beat").
> Prior: `147a55f` ("A flag with no value means yes, and in-story belongs to
> every command").
> Prior: `e63dec7` ("One way to look at anything: show-* verbs, seven scopes,
> and none of it in context").
> Prior: `70892be` ("An arcanum is not a merit: its own type, its own list, its
> own gate").
> Prior: `0ecd2c3` ("A command reference that writes itself").
> Prior: `dc271c4` ("The event does the work, and a passive you can
> switch off").
> Prior: `a704283` ("A power that is simply on, and the traps written
> down").
> Prior: `1d0e480` ("Lose the arcanum, lose what it granted").
> Prior: `490b719` ("Say where it came from, not just that it was
> free").
> Prior: `4d3aebc` ("One prefix for time, and a cooldown is a duration
> read backwards").
> Prior: `86ccd2e` ("Afflictions are the common currency, and the
> language learned to say yes or no").
> Prior: `a4bf27a` ("Afflictions that run out, places that are afflictions,
> and magick with a k").
> Prior: `4881040` ("A command that can travel, and the chain that may make it
> unnecessary").
> Prior: `9101ce3` ("A post office, and the one thing a message cannot do").
> Prior: `25de8bf` ("Say what the spend did, and say that you can spend two").
> Prior: `12a9fae` ("A purse with prices, a pool you cannot use, and
> Disciplines that are his own").
> Prior: `a05d8d4` ("A pool that reads the sheet"); `3639376` ("A template you
> can extend, and an Ouroboros that is no longer code"); `72c0076`
> ("Successes the Storyteller simply grants"); `b182c7d` ("Say each thing
> once"); `e26e005` ("One arithmetic,
> and a way to point at the sheet"); `725fa3a` ("The budget a
> character is built against"); `5778ec5` ("Backgrounds get a bag
> of their own"); `cb386af` ("An arcanum is not
> filed under merits; set-trait; families of power"). Prior: `84c5aa0` ("Arcana are not
> Merits: their own purse, priced per template"). Prior: `3cb162a` ("Rationed top
> ratings"); `ce304b3` ("The words move out
> of the windows"); `38d2007` ("A floor for the
> die target, and the knob the card format was eating"); `e72acb5`
> ("One point, one
> difficulty break; stacking Willpower is a spellcasting rule");
> `46e362c` ("A mage has no
> Resolve: correct the tests that invented one"); `38f11a8` ("Sharpened
> Senses, and a ceiling that is a trait"); `094c61b` ("Cards are written
> in a language for people, not for parsers"); `ca94301` (the cap formula
> + a fused point at the floor); `d9e2829` ("Living Resolve IS
> the other four: no phantom Willpower, Resolve's bonus"); `62e6534`
> (define-merit + resource-gated passives); `2d2a45a` ("certainty scales
> with Foundation; the wizard's roles step reads the sheet"); `6719345`
> ("the Sanctum pass:
> rating-scaled afflictions, the Library of the Unseen and its cray");
> `1f5e7f2` (the Ouroboros: a unique template; Hermetic fellowship; rest gates);
> `cc85f35` (Living Resolve, recovery on the clock, ghoul/revenant soak, the
> Dark Ages: Mage casting engine); `d3a13fd` (document cleanup); `f537584`
> (context hygiene); `baa8252` (<hide> plans → Author's Note); `25c6a9a`
> (scenes); `cb5b4c3` (vendor script-types.d.ts).

---

> **`docs/commands.md`** — every verb, GENERATED from the registry
> (`bun run docs:commands`). Never hand-edit it.
>
> **Two companion files, both newer than most of this one:**
> **`docs/invariants.md`** — the rules that must not break, each recorded with
> the commit that found it. Read it before changing code.
> **`docs/architecture.md`** — what each file is and which one to open.

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
src/core/cardtext.ts pure: THE card language - parse/format/coerce (§7.43)
src/core/dice.ts     pure: the d10 roller
src/core/damage.ts   pure: Severity/Kind, packets, reactions, HealthTrack, soak
src/wizard.ts        pure: medium-agnostic wizard engine
src/rolls.ts         pure: roll specs, modifiers, extended-roll state machine
src/rules.ts         DATA: templates, resources, effect grammar, roads, SRD seeds
src/command.ts       the command bus: parser, CommandSpec/describe/compose, router+hooks
src/services.ts      ScopedStorage, LorebookManager, MeritFlawRegistry + ArcanumRegistry, generic config stores
src/state.ts         the character model + EVERY persistent store (config registries, live state)
src/ui-text.ts       pure: THE window copy - every user-facing window string (§7.48)
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
`MeritFlawRegistry.loadFromLorebook()`, `ArcanumRegistry.loadFromLorebook()`,
`reloadAllConfigStores()` (every
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
  read-only query (`isQuietVerb` — the `show-` prefix since §7.73) — the hook's cancel-the-turn lever.
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

### src/host-mock.ts (217 lines) — off-host mock + test hooks, TEST-ONLY
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

### src/core/cardtext.ts (~440) — the readable card language (§7.43)
- `CardValue` = string|number|boolean|null|CardValue[]|`CardMap`;
  `CARD_VALUE_KEY = "value"` (a node's own value when it also has an
  annotation block).
- **`parseCardText(text)`** → `CardValue | undefined` (undefined = empty or
  comment-only; NEVER throws — a malformed card yields what could be read and
  the player's text is never destroyed). Pipeline: `stripComment` (quote-aware,
  `#` at line start or after whitespace) → `indentOf` (tab = 2) → `splitKey`
  (key ends at the FIRST `":"` followed by space/EOL) → indentation tree
  (`readNodes`, `- ` items carry an inline `key: value` as their first child) →
  `nodeValue` (keyed children → block, all-item children → list, `addKey`
  turns a REPEATED key into a list) → `readScalar` (quoted / number / decimal /
  yes-no-on-off / none-null / top-level commas → inline list / text).
- **`formatCardText(value)`** — blank line between multi-line top-level blocks;
  scalar lists inline up to `INLINE_LIST_WIDTH` (88) else `- ` items; a list of
  annotated values is written as the key REPEATED; `needsQuote`/`quote` for
  anything that would be misread. `inlineCardText` is the one-line form.
- Tables: `TEXT_KEYS` (comma = punctuation, never auto-typed), `LIST_KEYS`
  (always a list), `TOKEN_TEXT_KEYS` = {target} (text, comma spacing squeezed),
  `FIELD_ALIASES`/`canonicalKey`/`wireKey` (hyphenated wire ↔ camelCase field).
- Coercions: `asText` (re-joins a comma-split value), `asNumber`, `asBool`,
  `asList`, `asStringList`, `asMap`, `asNumberMap`, `asNamedList` (name-keyed
  block OR `- name:` items). `canonicalCardText` = order-independent digest
  (keys sorted, whitespace collapsed) — what `structuralHash` hashes.

### src/core/expr.ts (~250) — the one expression language (§7.55)
Pure, zero imports. EVERY number a chronicle can write instead of hard-code
parses here: pools, difficulties, effect caps, purse budgets, trait ceilings,
derived values.
- **THE HYPHEN RULE**: inside a name, `-` continues the name only when a
  **letter** follows it. `self-control` is one name; `courage - 1` and
  `12-generation` are subtraction (a number token can never absorb a hyphen).
  Every expression written before this module existed still parses the same.
- Grammar: `expr := term (('+'|'-') term)*`, `term := factor (('*'|'/') factor)*`,
  `factor := '-' factor | primary`, `primary := num | name'(' args ')' | name |
  '(' expr ')'`. Recursive descent, evaluating as it goes (no tree is kept).
- `ExprScope {lookup(path: string[]), call?(name, args)}` — `undefined` (not 0)
  is how a scope says it does not know a name. `EMPTY_SCOPE`, `mapScope(values)`.
- `evaluateExpr(expr, scope) -> ExprResult {value, terms, unknown, error?}`.
  **`terms`** are the top-level addends with SIGNED values (a term that recorded
  exactly one leaf keeps its identity, so a bare ref stays a ref); `ExprTerm
  .negated` exists because `-0` cannot carry a sign. **`unknown`** is the point:
  a typo used to read as 0 in silence. **Nothing throws** — a malformed
  expression is value 0 with `error` set.
- `evalNumber(expr, scope, fallback)`, **`Numeric = number | string`**,
  `evalNumeric(value, scope, fallback)` — the type every rules field that might
  be written in terms of the character now uses.
- `exprRefs(expr)` (static analysis, for cycle checks and provenance),
  `describeTerms(terms)` ("Strength 4 + Brawl 3 - 1"), `BUILTIN_FUNCTIONS`
  (min/max/sum/abs/floor/ceil/round).

### src/core/dice.ts (~130)
- `Rng` = () => number in [0,1); `Random(min,max,rng)`.
- `Dice.roll(input: number | RollTrait[], options)` → `RollResult`: difficulty
  (default 6), `nAgain` (default 10; 11 disables), `automaticSuccesses` (free
  successes — kept separate from their source by design),
  **`uncancelableSuccesses`** (§7.33: successes 1s can NEVER cancel — when any
  exist, `net = max(0, successes+auto−ones) + uncancelable`, header `+N sure`;
  when none, net keeps its exact historical form incl. negatives), explosion
  chain (MAX_DICE 200), botch = initial roll has ≥1 one, 0 successes AND 0
  auto AND 0 uncancelable (a cancelled success is a failure, not a botch).
  `message` is a full audit line with emoji faces (💣 one, 💥 explode, ✅ hit,
  ❌ miss).

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

### src/core/time.ts (~190) — pure calendar/clock math (§7.30, §7.33)
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
- **Recovery boundaries (§7.33):** `countDayBoundaries(from,to)` = UTC
  midnights in `(from,to]` (split advances accumulate; `to<=from` → 0);
  `countFullMoons(from,to)` + `nextFullMoon(epoch)` on the MEAN synodic month
  (29.530588853 d anchored to the 2000-01-06 18:14 UTC new moon + half a
  cycle; ±hours vs true phase, fine proleptically in 1197).

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

### src/rolls.ts (~600) — pure roll machinery
- `RollSpec {pool, difficulty(6), difficultyExpr?, difficultyMod, requires(≥1),
  diceMod, tags[], difficultyCap?}` — serializable (that's what enables named
  rolls); `makeRollSpec`. **`difficultyExpr`** (optional) is the difficulty as a
  pool expression — a trait/calculation like `"stamina+3"`; `resolveSpec`
  evaluates it via `parsePoolExpression` against the SAME resolver as the pool,
  in place of the numeric `difficulty`. **`difficultyCap`** (§7.33, default 10)
  generalizes the over-10 rule to any ceiling (Mage casting; carried by
  `overrideSpec`, shown by `describeSpec` when ≠10). `describeSpec` shows the
  expression; `overrideSpec` swaps numeric ↔ expression (a numeric override
  clears any expression). `RollModifier`/`ResolvedRoll` also carry
  **`uncancelableSuccesses`** (§7.33) through `resolveSpec`/`executeRoll` into
  `Dice.roll`. `DEFAULT_ROLL_MODIFIERS` gained the no-op identity tags
  `magic`/`cast` (so [[cast]]'s tags aren't "unknown").
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

### src/rules.ts (~1030) — all game DATA
- `ATTRIBUTES {physical, social, mental}` + `ALL_ATTRIBUTES` (the fixed nine).
- `RulesetConfig` (freebie/XP/downtime costs — placeholder until the real cost
  engine; `VAMPIRE`, `MAGE` presets).
- Soak specs: `MORTAL_SOAK` (bashing only, Stamina), `VAMPIRE_SOAK`
  (b/l Stamina+Fortitude, agg Fortitude only), **`GHOUL_SOAK`** (§7.33 —
  b/l Stamina+Fortitude, agg Fortitude; ghouls & revenants), `MAGE_SOAK`
  (=mortal), `DEMON_SOAK` (all three, Stamina), `WEREWOLF_SOAK` (all three;
  silver/fire handled by reaction instead).
- **§7.33 additions**: `EffectOp.once` (fire once per spend);
  `ResourceDef.description?/recovery?: RecoveryRule[]/rollAs?: {cap?,
  negatesPenaltiesAbove?}` (`RecoveryRule.requires` = one gate or an ARRAY that
  must ALL be active); `LIVING_RESOLVE` owned by **`TEMPLATE_OUROBOROS`**
  (unique) + `TEMPLATE_REVENANT` (+ `revenant`/`ouroboros` keys); `FELLOWSHIPS`
  (Order of Hermes: Modus + Anima/Corona/Primus/Vires); the `in-umbra` /
  `full-rested` / `in-sanctum` DEFAULT_AFFLICTIONS; mage Quintessence gained
  the umbra + rested-in-sanctum recovery rules;
  `MagicRules`/`DEFAULT_MAGIC_RULES`/`MAGIC_KNOB_NAMES`/`magicRulesFrom`
  (knob overlay, unknown/non-numeric ignored); Mage Quintessence effect
  gained `limits.maxPerUse 3` + Fount/min-diff label.
- **§7.35 additions**: `TemplateConfig.Awakened` (+ `isAwakened(keys)`);
  `AfflictionTier` + `AfflictionDef.scalesWith/tiers/requiresAwakened` +
  **`foldAfflictionTiers`** (cumulative, untargeted-supersedes-targeted);
  the `in-sanctum` (8 tiers) / `in-library` / `in-rotunda` DEFAULT_AFFLICTIONS;
  `RecoveryRule.requiresTrait`; `MagicRules.uncancelablePerFoundation` +
  **`uncancelableCap`** (§7.36); Mage Backgrounds (Cray/Fount/Library/Sanctum/
  Talisman) in the SRD seed; `DEFAULT_ROLL_MODIFIERS` gained the place tags.
- **§7.54 additions — the creation budget** (all ABOVE `TemplateConfig`, which
  defaults a constructor argument to `BASE_CREATION`): `PriorityPools`,
  `TraitLimit {start?, max?, note?}`, `CreationBudget {attributes,
  attributeStart, attributeMax, abilities, abilityStart, abilityMax,
  backgrounds, freebies, disciplines?, virtues?, limits?, notes?}`,
  **`BASE_CREATION`** (7/5/3 over 1, 13/9/5 over 0, 5 Backgrounds, 15
  freebies), `creationBudget(over)`, `traitLimitFor(budget, kind, trait)`, and
  **`creationBudgetFor(keys[])`** (stacks templates, concatenates notes).
  `TemplateConfig.Creation` is the trailing field; vampire, mage and Ouroboros
  carry their own. **`Clan {name, disciplines, aliases?, family?, limits?}`** +
  **`CLANS`** (15 entries, 13 clans — Nosferatu's `limits.appearance {0,0}`) +
  `clanByName` (returns `& {id}`) + **`clanFamilies()`** + `clanFamilyOf()`.
  `Fellowship` gained `aliases`/`theme`; **all six FELLOWSHIPS**;
  `fellowshipByName` (returns `& {id}`). `MeritFlawRequirements.choices` +
  `exclusiveDefs()` + **`EXCLUSIVE_MERITS_FLAWS`** (13+6 pairs, prepended to
  `DEFAULT_MERITS_FLAWS`). `DEFAULT_ADVANCEMENT_COSTS`: foundation freebie 5,
  pillar 3, new `specialty` row.
**`src/core/bus.ts`** (§7.62, PURE — no `api`, no imports at all): the dispatch
rule and nothing else. `BUS_PRIORITIES` (first/early/normal/late/last/**monitor**,
where monitor runs last and its verdict is IGNORED — the observe-only slot),
`LOCAL_PREFIX = "local:"` + `isLocalChannel`, `busChannel` (trim+lowercase, so
two spellings of one intent cannot drift), **`BusEvent {channel, data, from?,
at, cancelled, stopped, errors}`**, `BusVerdict {cancel?, stop?}`, `BusHandler`,
and **`class EventBus`** (`on`/`off`/`emit`/`listeners`/`channels`). `emit` is
SYNCHRONOUS and a throwing handler is recorded on `event.errors` rather than
ending the run.

- **§7.60 additions — purses, capabilities, affinity**: **`BudgetDef {allows?,
  freebie?, experience?, note?}`** + `BudgetEntry = string | BudgetDef` +
  `budgetDef(entry)` + `budgetBuyable(price)` + **`NOT_PURCHASABLE = "-"`**;
  `TemplateConfig.Budgets` holds `BudgetEntry` and merges FIELD BY FIELD in
  `templateFromDef`. **`CAPABILITIES`** (awakened / vitae / resolve) +
  `capabilityNote`; `ResourceDef.requires`; **`TemplateConfig.Capabilities`
  REPLACED the `Awakened` boolean** (which is now a getter) and
  `TemplateConfig.CannotUse(def)` names what is missing.
  **`DisciplineAffinity {disciplines, mode?}`** + `TemplateConfig.Affinity` +
  empty **`GHOUL_FAMILIES`/`REVENANT_FAMILIES`** + **`AFFINITY_SOURCES`** +
  `familyByName(registry, name)` (`clanByName` now delegates) +
  **`affinityDisciplines(choices, template)`**. `TemplateDef` gained
  `capabilities` and `disciplines`; `makeTemplateDef` decodes a purse written
  either as one line or as a block. The vampire's blood is
  `blood-max(generation)` / `blood-per-turn(generation)`; the demon's arcana
  purse carries both prices as `NOT_PURCHASABLE` plus the book's formula as a
  note; the Ouroboros def carries `capabilities: ["vitae","resolve"]`,
  `budgets.arcana = {allows: "role:willpower", freebie: "-", experience: "-"}`,
  `creation.disciplines = 2`, and `disciplines: {disciplines: [], mode:
  "replace"}`.
- **§7.55 additions — expressions**: every `CreationBudget` /`PriorityPools` /
  `TraitLimit` field is now **`Numeric`** (a number OR an expression), plus
  `disciplineMax` and `virtueStart`. `traitLimitFor` takes a `"discipline"`
  kind. **`Derivation {trait, expr, when?: "start"|"always", note?}`** +
  `TemplateConfig.Derived: Derivation[]`. `TRAIT_MAX_BY_GENERATION` +
  **`traitMaxForGeneration`** (8th and thinner: 5; 7th: 6; 3rd: 10);
  `roadRatingExpr(road)` spells a Road's rating Virtues as an expression. The
  **Generation Background** joins `DEFAULT_BACKGROUNDS` (max 5, vampire/ghoul/
  revenant, a tier note per step). TEMPLATE_VAMPIRE's Creation gained
  `attributeMax`/`abilityMax`/`disciplineMax` = `"trait-max(generation)"` and
  four derivations (generation, road, willpower, blood-pool-max); the notes it
  used to carry for those are gone, because they are computed now.
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
- **OWNED POWERS — two categories, one mechanism (§7.72).** `OwnedPowerDef` is
  the SHARED MACHINERY: `{name, kind, points: n|n[], budget?, perTemplate?,
  requires? {templates any-of, tags all-of, meritsFlaws all-of, choices},
  description?, param?, passive?: EffectOp[], limits?, maxFromTrait?, grants?}`.
  Two types extend it and NOTHING else does:
  - **`MeritFlawDef {kind: "merit"|"flaw"}`** — `MERIT_FLAW_KINDS`,
    `DEFAULT_MERITS_FLAWS`, `MeritFlawRegistry`, `srd:merits-flaws`,
    `char.meritsFlaws`. Open to **any** character.
  - **`ArcanumDef {kind: "arcanum"|"taint"}`** — `ARCANUM_KINDS`,
    **`DEFAULT_ARCANA`** (Trait Affinity, Trait Enhancement, Sharpened Senses,
    Celestial Radiance), `ArcanumRegistry`, `srd:arcana`, `char.arcana`. Open
    only to a character with **`ARCANA_CAPABILITY`** (`thrall`, `demon`,
    `ouroboros`, or `[[attune arcana]]`).

  `budgetOfKind`/`kindSpends` read `KIND_BUDGET`/`KIND_SPENDS` over the union
  `OwnedPowerKind` (merit/flaw→freebie, arcanum/taint→arcana; merit/arcanum
  COST, flaw/taint GRANT). **Owned-power pattern (§7.23)**: `param?`
  (instance-parameter slot — owned as `name:<value>`, typed `name::value`),
  `passive?` (always-on ops; amounts SCALE by points taken; `"$<param>"` fields
  substitute the instance value), `limits?` (advisory cross-instance caps).
  `EffectOp` gains the **`trait` gate** (twin of the actionTag `target` gate):
  the op applies only when the roll's POOL used that trait. Helpers:
  **`resolvePowerInstance<T>(key, lookup)`** — GENERIC in the def type, so the
  caller must name which registry it is asking (splits `base:param` only when
  the base def declares `param`; param defs owned bare are malformed) — and
  `passiveOpsOf(def, param, points)` (substituted, scaled). Card readers
  `meritFlawFromCard` / `arcanumFromCard` wrap one `ownedPowerFromCard` and
  each ACCEPT ONLY THEIR OWN KINDS; `kindOnCard` lets a reader say where a
  misfiled block belongs.
- SRD lorebook seeds: `SRD_HEADER_MARKER = "====="` — **every data entry is
  human instructions ABOVE the marker, data BELOW it** (user design: the
  tutorial lives in the entry card itself, no separate readme). `srdEntryText`
  helper; `SRD_CATEGORIES`: `srd:abilities` (entries `srd:abilities:talents`
  /`:skills`/`:knowledges` — one name per line, `#`//`//` comments),
  `srd:backgrounds` (`srd:backgrounds:all`), `srd:merits-flaws`
  (`srd:merits-flaws:custom` — name-keyed defs merged over defaults),
  **`srd:arcana`** (`srd:arcana:custom` — the same, for Arcana & Taints, which
  are NOT merits and do not share their card).
- **Constraint groups (pure)**: `ConstraintGroup {name, relation:
  exclusive|restricted|forbidden, domain: background|merit|flaw|meritflaw|arcanum|any,
  members[], max?, scope?[], note?}` — plus **`arcanum`** (§7.72: Arcana and
  Taints are a list of their own, so a `merit` constraint never catches one and
  `any` searches everything); `ConstraintViolation {group, relation,
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
- `OwnedPowerRegistry<T>` — the shared registry class; two instances:
  **`MeritFlawRegistry`** (`DEFAULT_MERITS_FLAWS`, `srd:merits-flaws`) and
  **`ArcanumRegistry`** (`DEFAULT_ARCANA`, `srd:arcana`). Each accepts ONLY its
  own kinds; a block naming the other's kind is skipped and reported with where
  it belongs. In-code defaults + `loadFromLorebook()`; `get/all/register/reset` (kept
  OUT of the config-store family: different shape — multi-entry category merge).
- `LorebookParser.ParseFromApi()` — zero-dot Stat maps from the lorebook
  ability/background lists.

### src/state.ts (~1720) — the character model + every persistent store
**§7.33 additions**: `MagicRulesConfig` (MapConfigStore<number>,
`wod:config:magic`, self-registers in ALL_CONFIG_STORES); `CastAttempts`
(`cast:<char>` scene-scoped spell-retry ledger — `get`/`record`, lazy reset on
scene change, success deletes the spell's entry); **`CrayStore`** (§7.35 -
`cray:<char>`; rating/capacity read the sheet's Background, `tap` marks the day,
`replenish` credits 1/day for days that ENDED untapped, 1/year while dormant,
never when dead).

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

**§7.60 additions — state.ts**: `PlayableCharacter.capabilities?: string[]`
(sheet-level attunements, on top of the template's) and `.budgets` retyped to
`Record<string, BudgetEntry>`; both round-trip through the sheet card (a purse
is one line when it is only an allowance, a block when it is priced).
`CharacterResources.capabilities(char)` / `.cannotUse(char, def)`;
`.spend` returns `{spent: 0, blocked}` for a pool the character cannot use;
`ResourceView.blocked`. The scope gained **`role:<name>[:start|max|per-turn]`**
beside `resource:` — same `resourceDepth` guard, but resolved through
`CharacterResources.resolveDef` (name → role → replaced) and defaulting to
`:start`, with the player's `poolStarts` entry winning.

**§7.55 — THE CHARACTER SCOPE** (right after `resolveTraitFromRecord`, which is
unchanged and still the RAW bucket read). One place answers "what is this name
worth on this sheet", so every expression in the engine reads a character the
same way.
- `characterScope(char, extend?)` → `ExprScope`. A **bare** name = sheet →
  Background grant → derivation, first one with something to say. A **prefixed**
  path asks one place: the seven `TRAIT_NAMESPACES` (attribute/ability/
  background/virtue/discipline/trait/pool), `derived:` (force the derivation,
  ignoring the sheet), `granted:` (only what a Background confers). Anything
  else falls through to `extend`.
- **UNRATED ≠ UNKNOWN**: a namespaced name the CHRONICLE defines but the sheet
  does not rate is 0, not a typo — `knownTraitNames()` checks ALL_ATTRIBUTES /
  `BackgroundRegistry` / `DISCIPLINES` (Abilities and Virtues are already seeded
  into their buckets; `trait:` is deliberately open, so unrated there IS
  unknown). Without this, `12 - background:generation` would read as a typo on
  every sheet without the Background.
- `ScopeExtension` is the upward seam: game.ts hands in `budget:`/`spent:`/
  `left:` from the purse ledger (state.ts cannot compute those). THIS is what a
  legality proof will be built on.
- `derivationsOf(char)` (last template wins a name), `derivedValuesOf(char)` →
  `DerivedValue[] {trait, value, expr, when, note?, terms, unknown, error?,
  overridden?}`, `traitValueOf`, `evalOn`, `numericOn`, `resolvedLimit`,
  `roadOf(char)` (an explicit `choices.road`, else the template's).
- Lazy + **memoized with a cycle guard**: a derivation may reference another
  (`trait-max(generation)` needs `generation`), and a circular one is reported
  (`X defines itself in a circle`) with the sheet's own value, never a crash.
- Domain functions live here because the domain does: `trait-max`, `blood-max`,
  `blood-per-turn`, `road-virtues`.
- `newPotential` now SEEDS the Road's three Virtues at their free dot (like
  Attributes at 1) for any template with `HasVirtues` — without them a fresh
  vampire's derived Road and Willpower would read 0 instead of 2 and 1.

**Playable characters (the current creation path)**:
- `PlayableCharacter` record: `{id: uuid (the FOREVER identity — recoverable
  from storyStorage even if the lorebook entry is deleted), name, templates[]
  (1+, hybrids legal, merge resolved later), stage: "potential"|"ready",
  attributes, abilities, backgrounds, virtues, disciplines, traits,
  poolStarts, meritsFlaws, tags[]}` — plus the optional sidecars added later:
  **`arcana?`** (§7.72 — Arcana & Taints in a bucket of their OWN, absent on
  the sheets that have none; `migratePowerBuckets()` moves them out of
  `meritsFlaws` on load for sheets written before the split),
  `specialties`, `instances` (§7.43), `budgets`/`paid` (§7.50, retyped to
  `BudgetEntry` in §7.60), `capabilities` (§7.60: what this sheet may USE, on
  top of the template's — including `arcana`, which opens the Arcana list), and
  `choices`/`priorities` (§7.54: the clan/fellowship picks, and which
  Attribute/Ability categories are primary/secondary/tertiary).
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
seeded `{}`). **THREE walks, and choosing one is not a style choice (§7.72):**
`ownedMeritInstances(char)` resolves `meritsFlaws` through `MeritFlawRegistry`
and NEVER sees an arcanum; `ownedArcanumInstances(char)` resolves `arcana`
through `ArcanumRegistry` and never sees a merit; **`ownedPowerInstances(char)`
= both**, and is what MECHANISM must use (passive ops, purse ledgers,
`passiveSourceFor`, instance-limit breaches). All three go through
`resolvePowerInstance` (incl. `name:<param>` instances); unknown keys are
skipped here and surfaced by check-constraints, which now names the bucket a
stray key belongs in. `passiveOpsFor(char)` = every substituted+scaled passive
op from BOTH categories (Trait Enhancement is an arcanum);
`enhancementsFor(char)` = per-trait "enhance" totals (effective bonus +
advisory advancement ceiling).

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

### src/game.ts (~3560) — the verbs (interpreter, wizards, handlers, registrations)

**§7.33 additions**: the roll ops incl. `"uncancelable"` (§7.56 turned the
`ROLL_OPS` set into **`rollOpPatch`**, which both tests membership and says
which field each op moves, plus `mergeRollExtra`); `applyEffectSpec` honors
`EffectOp.once` (multiplier 1, not effectUnits) and maps uncancelable;
`passiveRollExtra` maps it too. `RollAsBinding` + `characterRollEnv` returns
`{resolver, penalty, rollAs}` (resolver answers a rollAs resource's own or
replaced names with min(cap, current)); `applyPenaltyShield(rollAs, poolTraits,
specDiceMod, extra)` (mutating; returns the note) called from BOTH
`execCharacterRoll` (which gained an optional `seed` extra param) and
`rollAndReport`. `launchExtended` opts gained `firstExtra`/`preNotes`.
`applyRecovery(from, to)` + wiring in `cmdAdvanceTime`; `cmdStoryDate` shows
`nextFullMoon`. **MAGIC section** after `cmdResources`: `parsePillars`,
`grantsUncancelableOnSpend`, `afflictionRollExtra` (§7.35 - the twin of passiveRollExtra, folding scaled
affliction tiers with the `@foundation` sentinel), `applyPenaltyShield`,
`cmdMeasureDoor`/`cmdLeaveLibrary`/`cmdCray`/`cmdHarvest`/`cmdAbsorb`/
`cmdResearch` + `drawFromCray`/`crayLine`, `cmdCast`, `cmdSealSpell`,
`resolveFoundation`
(explicit foundation= → a literal `foundation` trait → the first FELLOWSHIPS
Foundation the caster actually has), `cmdFellowships` (QUIET). `applyRecovery`
gates accept an array (ALL must be active). `cmdResources` lines gained
perTurn/rollAs/recovery/description. Registrations: `cast`, `seal-spell`,
`fellowships`. §7.43/§7.44 added `jsonCardBody` + `cmdConvertCards` (the one
place JSON is still understood) and `cmdCosts`; `cmdSheet` reports
"Held more than once" for a trait with `instances`. §7.45 added
`meritTraitCeiling` (the `maxFromTrait` ceiling, checked in `cmdTakeMerit` and
reported by `meritInstanceFindings`).

**§7.54 additions — the CREATION section** (just before `cmdBackgrounds`):
`categoryTraits(kind)` → `{order, of}` (Attributes from `ATTRIBUTES`, Abilities
from the chronicle's `srd:abilities` lists; plural AND singular both answer),
`creationOf(char)` = `creationBudgetFor(char.templates)`, `limitsFor(char)`
(template limits + the chosen clan's), **`cmdCreation`** (per-category spend vs
pool, `⚠ uncounted` dots, the Background purse, in/out-of-clan Disciplines,
Virtues over their free dots, freebies, `limits` + `⚠ over:`, then the budget's
notes as sentences), **`cmdChoose`** (clan / fellowship / the two priority
triples; unknown categories refused with the known list), **`cmdClans`**
(`clans` + `clan <name>`). `resolveFoundation` gained a `chosen` argument that
WINS over auto-detection; `unmetRequirements` gained the `choices` gate, which
compares clans by FAMILY. Registrations: `creation`, `choose`, `clans`, `clan`.

**§7.60 additions — priced purses in play**: `budgetsOf(char)` returns
`Record<string, BudgetDef>` (creation pools → templates → sheet, field by
field), seeds a **`discipline`** purse from `creation.disciplines`, and fills
missing prices from `advancementCostsFrom` by purse name; `budgetAllowance`,
`budgetPrices`; `purseLedger` counts Discipline dots; `affinityOf(char)` (every
template's Affinity folded, then `affinityDisciplines`); **`[[attune]]`**
(`cmdAttune`); `cmdSpend` refuses an unusable pool by name; `pairsArg`,
`CREATION_FIELDS`, `numericArg`, and a `cmdExtendTemplate` that **edits** the
def in force rather than rebuilding it.

**§7.55 additions — expressions in play**: `purseScope(char)` (the
`budget:`/`spent:`/`left:` ScopeExtension, built on `purseLedger` +
`budgetsOf`); `evalBudget(char, expr)` now goes through `evalOn` rather than the
pool parser; `characterRollEnv`'s resolver reads **`traitValueOf`** instead of
the raw bucket, so a conferred or derived value is rollable
(`[[roll willpower]]` on a sheet that states no Willpower); `cmdCreation`
resolves every budget field through `numericOn` and reports a **`ceilings:`**
line (the generation-driven maxima) plus a **`derived:`** line; `derivedLine`
(expands `road-virtues()` to the actual Virtues via `roadRatingExpr`+`roadOf`).
New commands **`[[derived]]`** and **`[[eval <expression>]]`** (both QUIET).

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
(backgrounds/merit/flaw keys via MeritFlawRegistry, **arcana keys of their
own**, templates) feeds `checkConstraints`.

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
when the input was command-ONLY **or** any command's verb is QUIET (`isQuietVerb`: the `show-` prefix, §7.73)
(the game-layer set of read-only query commands — help/characters/sheet/
resources/health/merits/tables/… — kept OUT of the pure CommandSpec; it uses
`CommandParser.parse(body).name` to test each match); non-command input →
wizard reply (if active) else untouched (`undefined`).

**The command surface** (registered verbs; [[help]] DERIVES each line from the
verb's CommandSpec at the bottom of game.ts — the grammars below match it):
`help [verb]` (list commands, or one's usage) ·
`creator-mode set=true|false` · `create-playable name="…" templates="a,b"` ·
`play [name="…"]` (no name → default) · `characters` (list; marks
current/default) · `convert-cards` (§7.43: one-shot, idempotent migration of
any `wod:`/`srd:` card still holding JSON) · `budget [name]` (§7.50/§7.60: each purse -
allowance expression, value, spent, left, AND what a dot costs in freebies and
experience; advisory) ·
`attune [capability] [off]` (§7.60: what this character can USE; a pool he
cannot use is only points) ·
(roll knob everywhere: `spend-amount=N` — §7.61 put it on every spec that
already honoured it; a resource's `limits.maxPerUse` clamps it and says so) · `paid <key> [expr|listed]` (§7.50:
what a purchase REALLY cost; no expression = granted) · `costs [kind]` (§7.44: what a dot
costs from each purse — chronicle rules, Storyteller-applied) ·
`sheet [name|@alias]` (the record as the ENGINE reads it —
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

### test/ (3910 + 34 lines, 350 tests, 91 describes)
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
**`current-scene`** pointer (the open scene's normalized name) · **`gen:count`**
(real-generation counter, §7.32 — incremented by onContextBuilt when !dryRun) ·
**`cast:<char>`** (the same-scene spell-retry ledger `{scene, spells: {key →
{unsuccessful, botched}}}`, §7.33 — lazily reset when the current scene differs;
key = cast label else the pillar signature; success deletes its entry) ·
**`cray:<char>`** (the cray SITE's live state `{points, status: active|dormant|
dead, lastTapDay}`, §7.35 - the RATING is a Background on the sheet) ·
`char_<name>` (legacy LiveCharacter serialization). **tempStorage**
(session-scoped, cleared on close): `win:<verb>:<param>` (a command window's
live form fields, e.g. `win:define-constraint:relation` - the documented home
for UI storageKey state) · `recon:<category>/<entry>:<kind>:<hash>` (the
once-per-session reconciliation-modal guard).

**Lorebook** (all data entries = instructions above `=====`, data below):
`srd:abilities` (talents/skills/knowledges lists) · `srd:backgrounds` ·
`srd:merits-flaws` (name-keyed defs merged over defaults) · `wod:player-characters`
(`pc:<name>` entries — SOURCE OF TRUTH for characters) · `wod:named-rolls`
(`wod:named-rolls:library`, name → spec) · `wod:config` (entries: `general`
seeded global-config card, unread for now; `wod:config:resources` overrides
map; **`wod:config:magic`** spellcasting knob map, kebab-case name → number overlaid
on `DEFAULT_MAGIC_RULES`; **`wod:config:costs`** advancement prices, kind →
purse → text, overlaid on `DEFAULT_ADVANCEMENT_COSTS` (§7.44);
`wod:config:constraints` constraint groups;
`wod:config:afflictions` affliction-def overlay) ·
ALL of these are **card text** (§7.43), never JSON — `[[convert-cards]]`
migrates a story written before the change. ·
**`wod:config:success-tables`** — a CATEGORY (the virtual-subcategory tree,
§7.21): its `general` card + any extra cards hold bare-named tables; each
subcategory is the real category `wod:config:success-tables:<sub>` (own
`general` + extra cards), tables addressed `<sub>::name`. Engine-written
cards are all tracked (id map + backups above).

**Generation-side (not storage):** the engine also WRITES the **Author's Note**
(`api.v1.an.set`, needs `storyEdit`) — an engine-owned marked block
`<!--wod:scene-plan-->…<!--/wod:scene-plan-->` mirroring the active scene's
`plan`, left alongside any player-authored note (§7.31 Pass B). `systemPrompt`
and `prefill` are mocked/available but not yet written.

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
    match with `CommandParser.parse(body).name`.
    **SUPERSEDED IN PART by §7.73**: the placement decision stands (still a
    game-layer policy, still not on CommandSpec), but the SET is gone — quiet is
    now the `show-` prefix, because a hand-maintained register is a thing new
    verbs get forgotten from, and they did. Querying the system never makes
    the AI narrate; an in-fiction action wrapped in prose still generates.
    **§7.54 caught a drift here**: a set is a list somebody has to remember to
    add to, and four passes of listings (`budget`, `paid`, `costs`,
    `backgrounds`, `background`, `arcana`, `arcanum`, `supernatural`) had never
    been added — so those replies were reaching the AI as noise. They are in now,
    with `creation`/`clans`/`clan`, and a test asserts a listing both stops the
    turn and leaves nothing in the context.
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
    ad-hoc `yyyy-mm-dd-hh`). The query verbs are quiet (`show-*` since §7.73). This is the
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
    *Addendum (Pass B — SHIPPED):* the hide→Author's-Note loop is live. NO
    host.ts change was needed (the generation surface is already ambient in the
    vendored d.ts; Author's Note is **`api.v1.an`**, not `authorNote`). host-mock.ts
    gained `an`/`systemPrompt`/`prefill` + a hooks registry + `__fireOnResponse`/
    `__authorNote` helpers. game.ts: pure `extractHideBlocks` (regex over
    `<hide [op=append|overwrite]>…</hide>`, default append), `applyHideDirectives`
    (append/overwrite the CURRENT scene's `plan`), `syncSceneToAuthorNote`
    (writes an engine-owned marked block `<!--wod:scene-plan-->…` into the AN,
    leaving player-authored AN intact; `try/catch` swallows the missing-storyEdit
    error — the plan still lives in the scene record), `processGeneratedText`
    (the onResponse body: strip + route, returns cleaned text or undefined when
    there is no `<hide>`), and a manual **`[[hide text=\`…\` op=]]`** command.
    index.ts registers `onResponse`. Scene open/switch/close re-sync the AN block.
    Chosen: keep the AI's `<hide>` TAG syntax (what the user's prompt already
    teaches) intercepted by onResponse — NOT the `[[...]]` command syntax (the
    AI's output isn't input, so onTextAdventureInput never sees it). Streaming
    caveat: a `<hide>` split across onResponse chunks isn't stripped by onResponse
    itself (it handles complete blocks per call) — but §7.32 Pass 2's
    `onGenerationEnd` document scan is the BACKSTOP that removes any such block
    once it lands in the story. The system-prompt/`onContextBuilt` injection pass
    is next.
32. **Context hygiene: keep engine noise out of the AI's context** (user: "many
    commands, such as help, should not be included in the context... wrap blocks
    to be subtracted with a marker... the hook for when context is about to be
    built is the most reliable to count AI generations, using the dryRun flag to
    separate a story generation from a context inspection"). Pass 1 of two.
    A **QUIET reply** (help/listings/sheet/scene-info — the §7.27 query set) is
    for the PLAYER, noise to the model, so `processAdventureInput` wraps each
    quiet reply in a **`<!--wod:ctx-skip:<gen>-->…<!--/wod:ctx-skip-->`** marker
    (tagged with the generation count at write time, for Pass 2's age-out); the
    **`onContextBuilt`** hook (`processContextBuilt`) strips those spans out of
    the `messages` before generation (dropping any message that becomes empty),
    so the AI never reads them. onContextBuilt is ALSO where **real generations
    are counted** (`GenCounter`, storyStorage `gen:count`): it fires for both
    generations and the player's context *inspections*, and **`dryRun`** (true =
    inspection, no generation — confirmed in the vendored d.ts) tells them apart,
    so the count increments only when `!dryRun`. Stripping happens on both (an
    inspection shows the same clean context the AI gets). `Message` is
    `{role, content?}`; the return `{messages}` replaces the array.
    *Pass 2 (SHIPPED):* the **`onGenerationEnd`** document cleanup
    (`processGenerationEnd`, best-effort, needs `documentEdit`). It `scan`s the
    document and per section does two jobs: (a) the **streaming-`<hide>` backstop**
    — a block that survived a chunk split lands in the story, so any complete
    `<hide>…</hide>` is extracted, routed via `applyHideDirectives` (to the current
    scene's plan + Author's Note), and stripped out; (b) **age-out** —
    `stripAgedCtxSkip` deletes ctx-skip blocks whose creation gen is ≥
    `CTX_SKIP_KEEP` (=2) generations behind `GenCounter.get()`. A section left
    empty is `removeParagraph`'d, else `updateParagraph`'d (double-space gap
    collapsed). host-mock gained a minimal `document` (scan/remove/update/append)
    + `__seedDocument`/`__document`/`__fireOnGenerationEnd`. Streaming limitation:
    a `<hide>` whose content spans MULTIPLE paragraphs isn't reassembled (single-
    section blocks — the common case — are handled). The system-prompt/
    onContextBuilt-injection pass is still next.
33. **Living Resolve + recovery-on-the-clock + ghoul/revenant soak + the Dark
    Ages: Mage casting engine** (the user pasted the full "How Magic Works"
    chapter and their protagonist's fused-resource spec; forks CONFIRMED via
    questions: spell **difficulty cap = 10** — their call, the book plays 9,
    shipped as a data knob; **LR = 30/30 start full**, Willpower/Resolve-POOL
    rolls cap at min(10, current) and each point above 10 negates 1 die of pool
    reductions; **recovery auto-applies** on advance-time).
    *Engine:* core/dice.ts **`uncancelableSuccesses`** — successes 1s can NEVER
    cancel: `net = max(0, successes+auto−ones) + uncancelable` when any exist
    (exact historical net, incl. negatives, when none), botch impossible with
    any, header shows `+N sure`. rolls.ts threads it through `RollModifier`/
    `resolveSpec`/`executeRoll`; **`RollSpec.difficultyCap`** (default 10)
    generalizes the over-10 rule: die target clamps to the cap, `+1 required
    success` per excess point, and because reductions subtract from RAW
    difficulty they buy the surcharge off BEFORE lowering the die target — the
    book's ordering by arithmetic (verified against the Ladislav example).
    `EffectOp.once` = fire once per spend regardless of units (the max-1-sure-
    success rule as data); interpreter honors it; `"uncancelable"` joined
    the roll ops (§7.56: `rollOpPatch`) and `passiveRollExtra`. `"magic"`/`"cast"` are registered as no-op
    identity tags (not typos; powers gate on them).
    *rollAs (game.ts):* `ResourceDef.rollAs {cap, negatesPenaltiesAbove}` —
    `characterRollEnv` returns bindings; the resolver answers the resource's
    name OR a replaced name with min(cap, current); `applyPenaltyShield`
    offsets the wound penalty + explicit negative dice mods (spec/extra) when
    the POOL used the resource, noting "living-resolve shields N dice".
    LIMITATION: tag-driven dice reductions inside resolveSpec and contest-side
    rolls are unshielded in v1.
    *Recovery:* `ResourceDef.recovery: RecoveryRule[] {amount, per: day|
    full-moon, requires?, note?}`; core/time.ts `countDayBoundaries` (UTC
    midnights in (from,to] — split advances accumulate, rewinds credit 0) +
    `countFullMoons`/`nextFullMoon` (MEAN synodic month 29.530588853d anchored
    to the 2000-01-06 18:14 UTC new moon + half cycle — proleptically fine for
    1197, ±hours vs true phase, documented approximation). `cmdAdvanceTime`
    calls `applyRecovery(before, after)`: for every `CharacterStore.listNames()`
    character and recovery-bearing def, credit rules whose `requires` matches an
    ACTIVE affliction def-name/tag ("in-umbra" — a new DEFAULT_AFFLICTIONS
    entry, the encoded "can't go yet" Umbra flag), 🌕-flag moon credits, report
    only real gains. `story-date` shows the next full moon.
    *Soak:* **GHOUL_SOAK** (bashing & lethal stamina+fortitude, aggravated
    fortitude — the user's erratum "they are alive... but the rules say so");
    TEMPLATE_GHOUL switched from MORTAL_SOAK; new **TEMPLATE_REVENANT**
    (ghoul-like, blood 10/10 START FULL + `recovery 1/day`, key `revenant`).
    *Living Resolve as data:* `LIVING_RESOLVE` in rules.ts, owned by the unique
    `TEMPLATE_OUROBOROS` (§7.34 — it FIRST shipped as a story-wide "resource
    preset" adopted via `[[adopt-resource]]`; the user corrected that same day:
    he is the only creature in the world with it, so it belongs to a template).
    The def:
    pool 30/30, perTurnLimit 6 (surfaced ST), roles blood/willpower/resolve/
    magic-fuel/quintessence, replaces all four, rollAs {10, 10}, recovery
    [1/day; 1/day requires in-umbra; 20/full-moon], effects: default = +1
    uncancelable (once, maxPerUse 1); heal (1 b/l per pt); boost (+1 Physical,
    scene); **fuel** (pure cost — the Willpower component is CONSUMED by an
    activation: no free success); **fuel-surge** (cost 2 = required cost + 1
    extra point buys the sure success — the user's exact rule); **focus** (−1
    casting diff per point max 3 + the once-op sure success). `[[resources]]`
    displays description/recovery/rollAs/perTurn.
    *Magic:* `DEFAULT_MAGIC_RULES` (12 knobs incl. difficulty-cap 10, min-diff
    4, quint-per-turn 3, free-limit 2, retry 1, botch-retry 2, ongoing ×10,
    fuel 1/success, seal 5/dot + 1 WP per 10) overlaid by the
    `wod:config:magic` MapConfigStore<number> via `magicRulesFrom`.
    **`[[cast pillars="name:REQUIRED-level,..."]]`**: ratings live in the free
    `traits` bucket (foundation= names the trait, default `foundation`);
    refuses when own rating < required or Foundation is 0. Primary pillar =
    highest REQUIRED (tie → best own score, per the book). Simple: pool
    F+Pillar, diff 4+required; complex: pool F+primary+⟨extras⟩ literal, diff
    5+highest+extras. Same-scene retry penalty from **CastAttempts** (state.ts,
    `cast:<char>`, `{unsuccessful, botched}` per spell key; penalty =
    (botched ? 2 : 1) × unsuccessful; success clears; different scene = lazy
    reset). Quintessence: MANDATORY stabilizer when required > Foundation
    (Ladislav-verified: it does NOT reduce difficulty; refuse if unpayable);
    `quintessence=N` EXTRA points −1 diff each within (per-turn cap −
    mandatory) and the min-diff-4 floor; >free-limit → Fount note; spends via
    role `magic-fuel`; if the paying def carries a once-uncancelable effect
    (Living Resolve), the sure success is AUTO-GRANTED (seeded, capped 1).
    `spend=` also rides (applySpend). Tags magic+cast; `requires=` successes.
    **extended=true/ongoing=true** route through `launchExtended` (new
    `firstExtra` seed + `preNotes` opts): onBotch DEFAULT "fail" (the book:
    a botch ENDS the casting — Backlash, successes lost; on-botch= can
    soften), ongoing target = requires × 10 + per-success-fuel note + seal
    pointer. Single-roll botch appends the ⚡ BACKLASH stub note (Backlash
    systems unmodelled). Extended/ongoing castings record the retry ledger
    only when interval 1 concludes the action (continue-roll doesn't know
    it's a cast — recorded limitation). **`[[seal-spell pillar=N [pay=true]]]`**:
    5×N magic-fuel + ceil(that/10) Willpower; a FUSED payer (one def fills
    both roles) pays max(the two) once and says so; partial payment = "owed,
    payable over time (ST tracks)".
34. **The Ouroboros: a UNIQUE template, the Hermetic fellowship, and the rest
    gates** (user, correcting §7.33 the same day: "every character should not
    get this pool. He's actually the only creature in the world with this pool.
    You could make him a unique template").
    *Why it matters:* the resource-overrides layer is STORY-WIDE, so adopting a
    one-of-a-kind resource there gave it to everyone. A unique creature is a
    unique TEMPLATE — that's what templates are for, and the union-of-templates
    resource rule (§7.18) then does the work for free.
    **`TEMPLATE_OUROBOROS`** ("Ouroboros (unique: revenant + laham + Awakened)",
    key `ouroboros`): revenant + laham (whence the Resolve) + Awakened Hermetic,
    made by a powerful witch in a ritual involving Belial, the Great Beast.
    RulesetConfig.MAGE, GHOUL_SOAK, Road/Humanity + Virtues (still alive), and
    exactly ONE pool — `LIVING_RESOLVE`, moved above the templates so it can be
    referenced there. **REMOVED**: `RESOURCE_PRESETS`,
    `ResourceOverridePatch`/`preset`, and `[[adopt-resource]]` — a stale
    `{"preset": true}` patch in an existing story is now simply inert (it names
    no template resource and lacks kind/start/max, so `resourcesForTemplates`
    ignores it — no migration needed).
    **`FELLOWSHIPS`** (rules.ts): a mystic society's Foundation + Pillars as
    data. Shipped: **Order of Hermes** — Foundation **Modus** (*the Ouroboros*:
    knowledge begets discipline and focus, which begets more knowledge), Pillars
    **Anima** (life), **Corona** (mind), **Primus** (magic itself), **Vires**
    (forces) — the user picked Pillars-as-Spheres deliberately, "so as to not
    have to learn complicated weird spheres". Ratings stay ordinary `traits`
    entries; `resolveFoundation` makes `foundation=` OPTIONAL (explicit → a
    literal `foundation` trait → the first fellowship Foundation the caster has
    > 0), and the no-Foundation refusal now lists the known ones.
    **`[[fellowships]]`** (QUIET) lists/details them.
    **The rest gates**: `RecoveryRule.requires` accepts `string | string[]` — an
    array must ALL be active SIMULTANEOUSLY (`applyRecovery` checks every gate).
    New afflictions **`full-rested`** (eight hours of sleep) and
    **`in-sanctum`**; both Living Resolve AND the mage's Quintessence gained
    `+1/day if in-umbra` and `+1/day if full-rested+in-sanctum` (Quintessence
    still has no daily brew of its own — only the gated rules). Living
    Resolve's base 1/day is now labelled "revenant vitae" (it IS the revenant
    daily point, per the user), and `[[resources]]` renders multi-gates as
    "if full-rested+in-sanctum".
35. **The Sanctum pass: rating-scaled afflictions, the Library of the Unseen and
    its cray** (user: "these conditions should also look at the character's
    background... all this is predicated on one being a mage (or something else,
    like my character, but still Awakened)"). Also: the Ouroboros has NO
    morality and NO Virtues - "in this sense, he's like a mage".
    *The gap:* afflictions granted only flat TAGS, but what "in my sanctum"
    means depends on the Sanctum Background - 2 and 8 are different worlds.
    **`AfflictionDef.scalesWith` + `tiers[]` + `requiresAwakened`** close it;
    `foldAfflictionTiers(rating, tiers)` (pure) collects every tier at or below
    the rating (the book: "these benefits are cumulative") and applies ONE
    resolution rule: **within an op kind, an UNTARGETED op supersedes targeted
    ops of the same kind**. That single rule expresses the user's ruling on the
    6/8 tiers (asked and confirmed): the wider tier WIDENS rather than stacks,
    so Sanctum 8 casts at -2, not -4, and gets ONE automatic success, not two.
    (The alternative - literal cumulative stacking - was offered and declined.)
    `TemplateConfig.Awakened` (mage + ouroboros) + `isAwakened()` gate the lot.
    *Rolls:* `afflictionRollExtra(char, active, poolTraits, tags)` in game.ts -
    the twin of `passiveRollExtra`, folded into BOTH roll paths. Op gates are
    the existing ones (`target` = action tag, `trait` = a trait the pool used),
    plus the **`@foundation` sentinel** resolved per-caster through
    `resolveFoundation` (Sanctum 5's "+1 die to Foundation" without hardcoding
    Modus). `afflictionLine(c, char?)` reports a scaled affliction's CURRENT
    grants, so [[afflictions]] answers "what is my sanctum doing for me".
    Place tags (`in-sanctum`, `in-umbra`, `in-library`, `in-rotunda`,
    `full-rested`, `hermetic`) joined DEFAULT_ROLL_MODIFIERS as no-op identity
    tags so they stop reading as typos on every roll made there.
    *The sanctum:* the book's table with the user's 6-8 continuation; **Backlash
    immunity at ANY rating** (cmdCast's botch branch checks for in-sanctum: the
    spell still fails utterly, but nothing turns on the caster - the retry
    penalty stands, since the botch happened). Sanctum 4's sleep point became a
    `RecoveryRule.requiresTrait {sanctum, 4}` gate on both fuels.
    *The Library of the Unseen:* his sanctum IS an Umbral realm, so
    **`[[measure-door]]`** (the Talisman "Cosmos Within the Measure": ten
    minutes on the clock, no roll, no resource, gated on having a Library
    Background) stamps `in-sanctum` + `in-umbra` + `in-library` together;
    `[[leave-library]]` lifts all three. `[[research <topic>]]` rolls
    Intelligence + Library (must be inside). A general item/Talisman system was
    considered and DEFERRED (asked; "one command now" chosen) - roadmap.
    *The cray:* a real site, not a number. `CrayStore` (state.ts) holds
    `{points, status, lastTapDay}` against the sheet's Cray Background (rating x
    5 capacity); `[[harvest N [time=]]]` is the ritual (no roll - for him,
    reading the books), `[[absorb]]` the dangerous way (Wits + Foundation vs
    10 - rating). **Overdraw** past empty by up to its rating: the site loses a
    dot ON THE SHEET, then its reduced rating rolls vs 8 - success = depleted,
    failure = dormant (1/YEAR), botch = dead forever. All auto-applied and
    reported (asked; "auto-apply and report" chosen, matching the recovery
    precedent). `applyRecovery` also refills the cray - 1/day for days that
    ENDED untapped (a boundary credits the day that just finished, so the
    harvest day earns nothing). Everything credits the `magic-fuel` ROLE, which
    is why "anything mentioning Quintessence is Living Resolve to him" needs no
    special case.

36. **Certainty scales with Foundation + the wizard's roles step reads the
    sheet** (user, after playing: "[configure-resources step 2/3] doesn't know
    Living Resolve"; and "if Foundation is 5, if I spend 2 points of Living
    Resolve for any reason, I gain two un-cancelable successes. For a regular
    character, this means spend 2 extra Willpower explicitly").
    *The cap became a rule, not a constant.* §7.33 shipped "max 1 un-cancelable
    success per roll" as `EffectOp.once` + `maxPerUse: 1`. It is really
    `uncancelableCap(foundation, rules) = max(1, floor(Foundation /
    uncancelablePerFoundation))` - a new MagicRules knob (default 2, so
    Foundation 5 -> 2, Foundation 3 -> 1, matching both data points the user
    gave; the alternative ceil(F/3) reading was offered and left unanswered, so
    the halving ships as the default and the knob flips it). The uncancelable
    ops on willpower / living-resolve / fuel-surge / focus dropped `once` and
    now scale 1-per-point; `applyEffectSpec` clamps the total to the cap and
    says so. `resolveFoundation` gained `rating`; `cmdCast`'s auto-grant seeds
    `min(points spent, cap)` and the spend= merge takes the LARGER of the two
    grants rather than clamping to 1. `grantsUncancelableOnSpend` no longer
    keys on `once` (it was the regression that silently killed the cast grant).
    `once` stays in the grammar - still the right flag for genuinely
    once-per-spend data - just unused by these defs.
    *Willpower changed for everyone:* its default effect is now un-cancelable
    successes rather than plain automatic ones ("for a regular character, this
    means spend 2 extra Willpower explicitly to gain those successes"). A
    character with no Foundation is capped at 1, which is what the old rule
    effectively was. `TUNABLE_OPS` gained "uncancelable" so the resources wizard
    can still tune Willpower's knob (dropping it silently SKIPPED the effect
    step - caught by the wizard walk test).
    *The wizard bug:* `rw.rolesPrompt` listed only roles ADDED during the run
    and hardcoded a "quintessence: resolve" example - so for a character whose
    Quintessence is replaced by Living Resolve, step 2/3 named a resource he
    does not have and showed nothing about the one he does. It now lists every
    resource on the sheet with the roles it currently fills (overrides applied)
    and draws its example from them.

37. **`[[define-merit]]` + resource-gated passives** (user: "Is there a way for
    me to create this arcanum with a command? Inviolate Soul is an inherent
    natal Investiture... While he has at least one Living Resolve, he is immune
    to fear and supernatural mind control").
    *Two gaps.* (a) Merits were the ONLY definable thing without a `define-*`
    command - tables, constraints and afflictions all had one, while custom
    merits/arcana meant hand-writing JSON into srd:merits-flaws. (b) Passive ops
    could gate on a trait (the pool used it) or an action tag, but not on
    "while I still HOLD this much of a resource".
    **`EffectOp.requiresResource {resource, atLeast}`** closes (b): checked LIVE
    against the character's current pools (by name, role, or a replaced name -
    `characterRollEnv` now exposes `resourceAt`), so the benefit lapses the
    instant the pool empties. `passiveRollExtra` takes the lookup and skips
    gated ops silently, as it does its other gates.
    **`[[define-merit]]`/`[[merit]]`/`[[forget-merit]]`** close (a), writing the
    srd:merits-flaws:custom card and reloading the registry. Passives are
    authored with a mini-syntax - `<op>[:<target>] [+N|-N] [if=<trait>]
    [while=<resource>[>=N]] [once]`, ";"-separated - parsed by
    **`parsePassiveOps`** with a raw-JSON escape hatch; `describePassiveOp`
    renders ops with their gates for [[merit]], [[merits]] and [[take-merit]].
    *Backticks matter*: name/passive/description must be LITERALS, else the
    boundary normalizer (§7.22) turns their spaces into hyphens - the command
    detects that signature and says so instead of parsing nonsense.
    `passiveOpsOf` no longer invents `amount: 1` for a FLAG op (an immunity has
    no magnitude to scale by points); take-merit prints the def's display name.
    *Deliberately not enforced:* an immunity is an open-vocabulary op - recorded
    and surfaced for the Storyteller, since no possession/fear/mind-control
    system exists to enforce it against. That is the §7.9 policy, not an
    oversight.
    *Thaumaturgy paths* (asked in the same breath) need no new machinery: the
    Discipline is a `disciplines` entry, the PATH a rated `traits` entry
    ("rego-vitae": 3), and the classic Willpower + Path roll is a saved roll -
    `[[name-roll rego-vitae willpower+rego-vitae 6]]`. Paths as first-class data
    (in-clan lists, per-level rituals) stay roadmap #7.

38. **Living Resolve IS the other four** (user, in play: "I have willpower 10. I
    should not have willpower. I should have Living Resolve. Also, I think we
    were forgetting that Living Resolve is also Resolve, so it applies its
    bonuses").
    *The phantom:* `CharacterStore.newPotential` seeded `poolStarts: {willpower:
    0}` unconditionally, from the days when no template lacked Willpower. For
    the Ouroboros - whose Willpower is REPLACED by Living Resolve - that left a
    willpower entry that `resolveTraitFromRecord` could still find (rolls were
    safe: the rollAs binding intercepts first, §7.33). Now seeded only when the
    templates actually grant a non-replaced Willpower
    (`CharacterStore._grantsWillpower`), and `[[sheet]]` FLAGS a leftover pool
    start naming a resource the character doesn't have - existing sheets are
    surfaced, never silently rewritten.
    *The forgotten component:* Living Resolve carried the "resolve" ROLE but
    none of Resolve's payout. Its default effect now grants BOTH halves of an
    ordinary spend - the Willpower's un-cancelable success AND Resolve's -2
    difficulty (Devil's Due) - and a `cast` effect mirrors Resolve's full bundle
    (+1 success, 8-again, -2 difficulty, 3/scene) for spending it into a spell
    wholesale. `focus` deliberately KEEPS the plain Quintessence math (-1 per
    point, max 3): the book's casting difficulties are calibrated against that,
    and stacking Resolve's -2 on top of it per point would collapse them. The
    division is now explicit in the def's comments: default = Willpower+Resolve,
    focus = Quintessence, heal/boost = vitae, fuel = the consumed-cost case.
    *SUPERSEDED THE SAME DAY by §7.39* - the owner overruled the split.
39. **One point of Living Resolve is all four AT ONCE** (user: "Yes, Living
    Resolve is supposed to be OP... It should not need to be spent in separate
    ways. One point of it is the same as 1 point of Willpower AND Quintessence
    AND Vitae AND Resolve, all at once").
    §7.38 had divided the components by which job a spend was doing, and
    deliberately kept the book's Quintessence maths intact for casting. The
    owner's ruling replaces that: the DEFAULT effect now carries every roll-side
    component together - `uncancelable +1`, `difficulty -2`, and
    `difficulty -1 target:magic` (the Quintessence reduction, which the action-tag
    gate confines to spell rolls, so an ordinary roll gets -2 and a casting -3).
    `[[cast]]` matches it: when the magic-fuel payer is the fused substance,
    every point spent there ALSO pays its Willpower (the capped un-cancelable
    successes, already there) and its Resolve (`resolveComponentBreak` reads the
    -2 off the def, so retuning the data moves the casting maths with it).
    Two points on a difficulty-8 spell now land it at 2 with two sure successes -
    that is the intended power level, not an overshoot.
    `focus` survives ONLY as an @deprecated alias of the default (older saved
    rolls carrying `spend=…:focus` still resolve); the `cast` bundle added an
    hour earlier is gone, unused. `heal`/`boost` remain because they aim the same
    point at flesh and need a target - not a separate way to spend.
    *Lore, for the record* (the owner's, on why it is this strong): his mother
    Velia, the unbondable Rafastio Matriarch of the Old Faith - ancient on
    Tal'mahe'Ra cainite vitae, co-inventor of Thaumaturgy with Tremere's Seven,
    a servant in the gardens of Enoch who met Inauhaten - built her own
    Foundation, the Living Measure, then spent decades on a Baali-style organ
    pit growing a perfected male twin of herself, stripped of instinct and
    marked with Belial's celestial name and sigil. She summoned the Great Beast
    to occupy both bodies, then took Inauhaten's road of death and rebirth to
    reclaim her own, leaving Belial the male vessel. The son keeps the body
    (millennia, used sparingly); Belial and Velia both ride his senses without
    his knowing - which is why his arcana are sensory - and Belial uses them to
    hunt Lucifer, the one thing the Beast actually wants. A novice in
    everything else (ordinary Attributes and Abilities, one-dot Pillars), his
    Living Resolve IS his potential.

40. **The stale-sheet hint** (user: "I have these in the lorebook, but they
    don't seem to sync, maybe? What am I doing wrong?" - a `[[cast]]` insisting
    Primus was 0 while the pc: card plainly showed 1).
    Nothing was broken: §7.20's policy is that the router does NOT re-read the
    lorebook on every command - pc: cards sync only while CREATOR MODE is on
    (the beforeRoute hook) or when it is switched off. An edit made with creator
    mode off is simply invisible, and a stray trailing comma makes the JSON
    unparseable (reported, correctly, only when a sync actually runs). Both
    reproduced before answering.
    The gap was diagnosability, so `cmdCast`'s two "you don't have that" refusals
    (the Pillar check and the missing-Foundation check) now append
    **`staleSheetHint()`**: with creator mode off it names the cause and the fix
    ([[creator-mode set=true]] pulls it in on the next command); with it on, it
    just points at [[sheet]] as the engine's own view. Deliberately NOT changed:
    auto-syncing outside creator mode, which would re-read the lorebook every
    command.

41. **The Resolve component pays in FULL** (user, reading a casting line: "I
    didn't gain extra successes or 8-again, it seems").
    A bug in §7.39's collapse, not a rules question: folding the components
    together, I took only the plain `resolve` effect (-2 difficulty) and DROPPED
    the richer bundle the resource also carries (+1 automatic success, 8-again,
    -2 difficulty) instead of merging it. One point is one Resolve point, so it
    pays what a Resolve point pays. The default effect now carries the whole
    thing - uncancelable +1, successes +1, nagain 8, difficulty -2, plus the
    magic-gated difficulty -1 - and the deprecated `focus` alias mirrors it.
    `[[cast]]` stopped hand-computing one op: `resolveComponentBreak` (which
    read only the difficulty) became **`fusedComponentExtra(def, points, cap)`**,
    which folds EVERY untargeted roll op off the def's default effect, scaled by
    the points spent, capping uncancelable at the Foundation limit. Targeted ops
    are skipped by design: cast has already counted the Quintessence reduction
    in its own difficulty maths, and folding it again would pay for the same
    point twice. The Devil's Due 3/scene limit on that bundle is deliberately
    NOT carried over - this substance is not Resolve, it is the fusion, and the
    owner's ruling is that it is meant to be overwhelming.

42. **The cap formula, and a fused point is never wasted at the floor** (user:
    "It's supposed to be 2 un-cancelable... `modus` at 5 grants that extra
    willpower bonus: floor((5 - 1) / 2)").
    TWO things, only one of which was the cause. The formula: §7.36 shipped
    `max(1, floor(F / 2))`, the owner states `floor((F - 1) / 2)` - the first dot
    is the price of entry, then every two more buy another. They AGREE at
    Foundation 5 (both 2), so the formula was never why he saw 1; adopted
    anyway, since he is the rules authority and they differ at even ratings
    (F=8: 4 -> 3). Modus was being read as the Foundation correctly all along
    (the Hermes fellowship resolves it; the pool printed "Modus + Primus").
    The REAL cause: he asked for `quintessence=2` on a difficulty-5 spell, and
    the min-difficulty floor left room for only ONE reduction - so cmdCast
    refused to spend the second point at all, and one point grants one
    un-cancelable success. That was §7.39's split creeping back in: the point
    was being judged purely as Quintessence. A fused point is never wasted -
    its Willpower and Resolve still have work to do - so the Quintessence block
    now separates `reducing` (points the floor lets lower the difficulty) from
    `spare` (the rest), spends BOTH for a fused payer, and applies the
    Quintessence -1 only to `reducing`. Ordinary Quintessence still stops at the
    floor, having nothing else to give; the "could not be spent" note names
    whichever limiter actually bound.
    Result on the owner's exact command: +2 auto, +2 sure, -4 difficulty from
    the pair instead of one point's worth.

43. **Cards are written in a language for people** (user: "I'm wondering if we
    could make the language of the lorebook entries less actual JSON, and more
    human-readable/writable. Maybe XML-like? or merely YAML. Or a mixture of
    both?... Help me make it least astonishing"; confirmed forks: scope =
    **"Sheets + the config entries"**, migration = **"New format only"**).
    The binding constraint decided the shape: `dist/naiowod.ts` ships with ZERO
    dependencies, so a real YAML/XML parser is not available and a *partial*
    implementation of a real standard would be worse than a *complete*
    implementation of a small one. So: **`src/core/cardtext.ts`**, a hand-rolled
    indentation format, ~430 lines, pure (no host imports).
    - **One node shape**: `key: value`, plus an optional indented block. A block
      under a key that already HAS a value annotates it (the value lands under
      the reserved key `value`). This dissolves the user's own question ("maybe
      name should be changed to `key`?") - **the key IS the key**, so no def
      needs a `name:` field and no sheet needs a `trait:` field.
    - **A repeated key is a list.** This is the actual reason the format exists:
      his example sheet had two Mentors, which JSON cannot say at all.
    - **The reader is untyped; the consumers coerce** (`asText`/`asNumber`/
      `asList`/`asStringList`/`asMap`/`asNamedList`). That is what lets a human
      write `templates: mage` for a list field and a comma inside a sentence,
      with no syntax for either. Two small tables carry the knowledge:
      `TEXT_KEYS` (a comma is punctuation there: description, note, label,
      name, ...) and `LIST_KEYS` (always a list: tags, roles, passive, ...).
      `FIELD_ALIASES` maps the engine's camelCase fields to hyphenated wire
      spellings BOTH ways (`difficulty-expr` <-> `difficultyExpr`); it is a
      fixed table, never a general camel/kebab rule, because trait names, merit
      keys and table names are DATA and must never be renamed.
    - **The key ends at the first `": "`** (or a trailing `:`), so
      `trait-affinity:melee: 3` keys on the whole instance name and
      `he said: hi` is a value with a colon in it.
    - Writer quotes on demand (empty, padded, `,` `#` `"` newline, or anything
      that would auto-type); reader unquotes. `formatCardText(parseCardText(x))`
      is stable, which the tests assert.
    JSON reading is **gone** from every card path: `parseConfigBody`,
    `ListConfigStore`/`MapConfigStore`, `MeritFlawRegistry.loadFromLorebook`,
    `NamedRollStore`, `TableLibrary`, `CharacterStore` read/write, `combineConfigTexts`
    and `structuralHash` (now `canonicalCardText`, whitespace-collapsed, empty
    bodies canonical). New decoders own their shapes: `meritFlawFromCard` /
    `effectOpsFromCard` (rules.ts), `characterToCard` / `characterFromCard` and
    `savedRollToCard` / `savedRollFromCard` (state.ts). `makeConstraintGroup` /
    `makeAfflictionDef` now take their list fields through `asStringList`, so a
    single-value `scope:` can never reach `.map` as a string.
    **`[[convert-cards]]`** is the one place JSON is still understood: a
    one-shot, idempotent migration that rewrites every `wod:`/`srd:` card whose
    body starts with `{`/`[`, keeps the player's header, re-keys arrays of named
    defs by name, and re-syncs. Chosen over silent fallback because the user
    asked for "new format only", but a live story with a fully built character
    must not be destroyed to honour that.
    **Two Mentors made the model grow**: the format could now express something
    `PlayableCharacter` could not hold, and a repeated rating read as 0. Added
    `instances?: Record<string, TraitInstance[]>` - the bucket rates the trait at
    the HIGHEST (one slot, one number), every instance is kept with its note,
    `[[sheet]]` reports "Held more than once", and the card writes the key once
    per instance. Which mentor a given roll is about is ST-adjudicated (that
    needs targeting) - the standing "store it, surface it, never block" rule.
    Known and documented limit: `#` comments are the player's, and a card the
    engine REWRITES keeps only the data - so anything worth keeping goes in a
    `note:`.

44. **Advancement costs are chronicle rules, not character data** (user, on his
    example sheet: costs for exp/freebies/maturation "maybe these shouldn't be
    in the user-fronting character, but they should still be somewhere").
    They are identical for every sheet, so putting them on one is duplication
    waiting to drift. `DEFAULT_ADVANCEMENT_COSTS` + `advancementCostsFrom`
    (rules.ts) + the `wod:config:costs` card (`AdvancementCosts`, a
    `MapConfigStore`) + `[[costs]]` / `[[costs <kind>]]`. Ten kinds
    (attribute/ability/background/discipline/pillar/foundation/virtue/
    willpower/road/merit-flaw) x three purses (experience/freebie/maturation);
    an override replaces ONE purse's price without restating the others.
    Values are **text on purpose**: there is no advancement engine, so nothing
    evaluates them. The user's own cost-expression sketch
    (`{if(@curr eq 0) then 10 else [@curr*6]}`) is deliberately DEFERRED - a
    language nothing can execute is worse than a string that says what it means
    - and the table is the seam the XP engine will read when it lands.

45. **Sharpened Senses, and a ceiling that is a trait** (user, pasting the
    arcanum: "Each purchase of this Arcana provides a cumulative -1 modifier to
    all Perception difficulties. A character may not purchase this Arcana more
    times than his Resolve").
    The bonus needed nothing new - it is the Trait Affinity shape exactly:
    `passive: [{op: "difficulty", amount: -1, trait: "perception"}]`, since
    passive amounts already SCALE by the points an instance is taken at and the
    `trait` gate already means "the roll's POOL actually used this". So N
    purchases = -N, and only on pools that really use Perception. Not
    parameterized: the sense is fixed.
    The CAP was the gap. `atMostOneAt` says "only one instance at this value",
    which is a different rule; nothing said "the ceiling is a RATING". Added
    **`MeritFlawDef.maxFromTrait?: string`** + `meritTraitCeiling(char, def)`
    (game.ts): `[[take-merit]]` refuses above it (with `waive=true`, matching
    how unmet prerequisites already behave), `[[merit]]` prints it,
    `define-merit max-from-trait=` authors it, and the card writes it as
    `max-from-trait:`.
    Resolution is the load-bearing decision: **`permanentRatingOf(char, name)`**
    (state.ts) tries the rated buckets, then `CharacterResources.resolveDef` -
    the existing name/role/**replaces** lookup - and reads the OWNING resource's
    value. So "resolve" finds a DEMON's Resolve at 3 AND the Ouroboros' Living
    Resolve at 30, with the definition saying only "resolve". It is
    deliberately the PERMANENT rating, never the live pool: a creation-time
    ceiling measured against a spent-down pool would rise and fall mid-scene.
    A ceiling can MOVE (Resolve drops), which strands purchases above it -
    `meritInstanceFindings` reports that ("sharpened-senses is at 5 but resolve
    is only 3") and never trims the character, matching the surrounding
    advisory-not-enforced policy for everything creation-related.
    **Correction the owner had to make** (worth keeping, because the mistake was
    invisible): the first tests gave a MAGE a Resolve. Who holds what is
    per-splat and the templates already had it right - mage = Quintessence +
    Willpower, demon/thrall (infernal) = Resolve + Willpower, vampire/ghoul/
    revenant = Blood + Willpower, Ouroboros = Living Resolve which IS all four
    at once. The test passed anyway because it hand-wrote `poolStarts.resolve`
    and `resolveTraitFromRecord` searches that bucket BLINDLY - the same phantom
    class as the Willpower one in §7.38. Two consequences: `maxFromTrait` needs
    no template gate (a mage's Resolve is 0, so the arcanum simply is not open
    to him, and the refusal says THAT rather than "0"), and
    `meritInstanceFindings` now reports a `poolStarts` key no template grants,
    so a hand-edited card giving a mage a Resolve is visible instead of silently
    authoritative.

46. **One point, one difficulty break; and stacking Willpower is a spellcasting
    rule** (user, auditing the fusion: "if I spend 2 Quintessence to lower a
    spell's difficulty, the difficulty is lowered by Resolve, but not *again* by
    Quintessence"; and separately "this expenditure of more than 1 Willpower to
    get un-cancelable successes is only allowed for spellcasting").
    Two genuine bugs in §7.39-§7.42's collapse, both found by the owner reading
    output rather than code.
    **(a) The difficulty was paid twice.** `cmdCast` subtracted the Quintessence
    -1 per reducing point (`difficulty -= applied`) AND `fusedComponentExtra`
    added Resolve's -2 for every point, so one point broke the difficulty by 3.
    The ruling: a point lowers the difficulty ONCE, by the DEEPEST break any of
    its natures gives - Resolve's -2 IS the Quintessence break seen from another
    side. Fixed in two places so it cannot come back: LIVING_RESOLVE now carries
    ONE `difficulty` op (the redundant `-1 target:magic` is gone, with the
    invariant written into the def), and `fusedComponentExtra` folds `difficulty`
    ops by DEPTH rather than summing them (and now honours targeted ops whose
    tag the roll carries, instead of skipping every targeted op). `cmdCast` no
    longer subtracts anything itself for a fused payer: the rider owns the whole
    break, including for the MANDATORY stabilizing point, which is the same
    substance and not a fee off the top. The `reducing`/`spare` split collapsed
    into one `optional` (the Quintessence floor only bounds an ORDINARY payer),
    which also killed the confusing "past the difficulty floor (still spent)"
    note. Successes are explicitly NOT folded this way: Resolve's automatic
    success and the Willpower's un-cancelable one are different currencies and
    both land.
    **(b) Certainty stacked everywhere.** The interpreter capped un-cancelable
    successes at `uncancelableCap(Foundation)` on EVERY roll, so 2 Living
    Resolve on a Discipline bought 2. But the multi-Willpower rule is Mage's:
    the old law is one Willpower per action. New `isCastingRoll(tags)` +
    `uncancelableAllowance(casting, foundation, rules)` (rules.ts, beside
    `uncancelableCap`) - the Foundation ceiling applies only on a roll tagged
    `magic`/`cast`; everywhere else the allowance is 1, whatever rode the spend.
    The Resolve half still scales off a spell (2 points = +2 automatic
    successes, -4 difficulty); only the Willpower half is once per action. For
    unawakened characters nothing changed numerically (their cap was already 1)
    - only the reason given in the reply.
    Also answered, since the owner asked: he has exactly ONE pool.
    `defsFor` filters out everything `replaces` names, so `[[resources]]` prints
    one line and `spend=willpower` reports "spent 1 living-resolve". The four
    names are not pools he also has; they resolve to the one he has.

47. **A floor for the die target, and the knob the card format was eating**
    (user: "it should be possible to set minimum difficulties for rolls... a
    global minimum difficulty, and a per-roll minimum difficulty. If global is
    not set, no rolls have minimum difficulties, except the ones that state
    it").
    `RollSpec.minDifficulty` (rolls.ts) is honoured in `resolveSpec` AFTER every
    modifier - `dieDifficulty = max(floor, min(cap, raw))`, with a note when it
    actually bit - so a deep reduction cannot dig under it. `min-difficulty=` on
    every roll verb, saved with a named roll (card key `min-difficulty`). The
    chronicle-wide one is `RollRulesConfig` (`wod:config:rolls`, knob
    `min-difficulty`, read by `rollFloorFrom`) folded in by a new game.ts
    **`runRoll`** - the single wrapper EVERY `executeRoll` call now goes
    through, which is what makes "global" actually global. Unset means unset:
    only the engine's hard minimum of 2 remains. Deliberately distinct from the
    `min-difficulty` MAGIC knob, which bounds how far Quintessence talks a
    SPELL down; both cards say so in their headers.
    **The regression it uncovered**: §7.43's `FIELD_ALIASES` rewrites
    `difficulty-cap` -> `difficultyCap` on read, and `MAGIC_KNOBS` is keyed on
    the hyphenated name, so `difficulty-cap: 9` in the magic card had been
    SILENTLY IGNORED since that commit. Knob names are DATA, and the alias table
    was warned against exactly this - but the collision was with a key I did not
    think of as data. Fixed generally: `knobKey()` compares on letters alone, so
    `difficulty-cap`, `difficultyCap` and `difficulty cap` are one knob, in both
    `magicRulesFrom` and `rollFloorFrom`. A test pins it.
    **Three warts fixed alongside**, all found by building the owner's own
    table end to end: `parseTableRows` now splits on `;` when the text has one
    (a prose label holds commas - "age, family, and whether he resisted" - which
    the comma-only grammar could not express); `botch`/`failure`/`overflow-label`
    joined TEXT_KEYS so a hand-written table card doesn't split them either;
    `TableLibraryStore.put`'s "another card shadows this name" check compared
    `JSON.stringify` of two objects whose KEY ORDER differs after a card round
    trip, so every fresh table claimed to be shadowed - it now compares
    `canonicalCardText`. And `[[roll-info @name]]` accepts the `@` the player
    just used to invoke the roll.
    **UI**: the window's placeholders came from `hint`, which is the help
    GRAMMAR (`res[::effect][!]`) and unreadable in a form field. `ParamSpec`
    already had `example`, which window.ts prefers - so the grammar stays in
    `hint` for `[[help]]` and the friendly text goes in `example`, with the
    `desc` (the field's label) now explaining what `::effect` and `!` mean.

48. **The words move out of the windows** (user: "Are window texts (like text
    fields used and labels, and those help text used inside text input) inside
    the window itself or in a kind of 'string resources' thingy? If they are
    inside, we should move them").
    Half the answer was already yes: the labels and placeholders he was looking
    at come from the verb's `ParamSpec` (`desc` / `example` / `hint`), the same
    spec `[[help]]` derives from - §7.20's one-source-of-truth rule, which
    stays. But window.ts also carried ~40 strings of its own: titles, blurbs,
    button labels, refusals, the ad-hoc labels of fields no single spec owns
    (the roll window multiplexes three verbs), and the `win-*` OOC replies.
    Those moved to **`src/ui-text.ts`** - one `UI_TEXT` object, pure, no
    imports, grouped per window with a `common` block for chrome and functions
    for the parameterized ones (`chooseButton(key)`, `needs(label)`,
    `bindingLabel(slot)`). window.ts is now layout and behaviour only.
    One duplication was RETIRED rather than moved: the afflict window hand-wrote
    "On (blank = the current character)" while `[[afflict]]`'s own spec already
    said "Who (default: the current character)" - a new `labelOf(spec, key)`
    reads it off the spec. The roll window's "For"/"Pool"/"Opposed" framing
    deliberately stays in UI_TEXT: those fields are shared by roll / roll-for /
    name-roll, so no single spec's wording is right for the form.
    Enforced, not just tidied: **test/build.test.ts fails if a bare quoted
    literal reappears** after `text:` / `placeholder:` / `label:` / `title:` in
    window.ts. Verified by reintroducing one and watching it fail; template
    literals pass, because they interpolate data or UI_TEXT.

49. **Rationed top ratings, and the parameterized def that already existed**
    (user: "Should we create a 'define-merit' that leaves its target trait to be
    chosen at [[take-merit]]?... you may choose 1 attribute and 1 ability (or 2
    abilities) to buy the arcanum for three times. All other traits... a maximum
    of two times").
    The first half was already built: `param` (§7.28) makes a def parameterized,
    owned as `name::value`, with `$param` substituted into its passive ops -
    `define-merit ... param=trait passive="difficulty -1 if=$trait"`, taken as
    `[[take-merit trait-affinity::melee 2]]`. Said so rather than building it
    twice.
    The second half was NOT expressible. `atMostOneAt` says "one instance at
    this rating", and the real rule rations TWO slots with a per-KIND ceiling
    inside them. New **`InstanceLimit {atRating, slots, perKind?}`** +
    `limits: InstanceLimit[]`, with `atMostOneAt` kept as a `@deprecated` shim
    folded in by `instanceLimitsOf`. "Two traits at 3, at most one an Attribute"
    is one entry, and it IS "one Attribute and one Ability, or two Abilities" -
    the same statement without enumerating the combinations.
    `instanceLimitBreaches(char, def, pending?)` is the single checker, used
    BOTH by `cmdTakeMerit` (refuses, `waive=true` overrides, naming which limit
    bound) and by `meritInstanceFindings` (reports a sheet already over the
    line - a waiver, or a hand-edited card). Trait KIND comes from
    `traitKindOf(char, name)` (state.ts): the character's own buckets answer
    first, so a chronicle that invents an Ability is believed, with
    ALL_ATTRIBUTES catching an Attribute the sheet has not rated yet; undefined
    means the engine does not guess.
    Authored with `limit-at` / `limit-slots` / `limit-per-kind=attribute:1`; the
    card writes it as a `limits:` block.
    **Trait Affinity's own rule was corrected** from `atMostOneAt: 3` ("one
    favoured trait may reach 3", the narrower guess) to the owner's statement.
    If his "Trait Aptitude" is a SEPARATE arcanum rather than this one under
    another name, it is one define-merit away - flagged to him.

50. **Arcana are not Merits: their own purse, priced per template** (user:
    "Arcana are not really merits. They don't spend bonus points... if arcana
    count as merits, it will flag the character as illegal. Arcana have a budget
    of their own... write it as an expression... templates may alter their cost,
    the ability to purchase them or not, and even their effects").
    A DATA-MODEL pass, deliberately: there is no creation engine yet, so nothing
    is enforced - the standing rule is store it, surface it, let the Storyteller
    decide. Getting the shape right now is what stops the legality check from
    being wrong when it lands.
    - **`MeritFlawKind` gains `arcanum` and `taint`.** The kind decides two
      things at once: the PURSE (`KIND_BUDGET`: merit/flaw -> freebie,
      arcanum/taint -> arcana, overridable per def with `budget`) and the
      DIRECTION (`KIND_SPENDS`: merit/arcanum cost, flaw/taint grant). That one
      table is the whole answer to "an arcanum must not be counted as a merit".
      Pacts are left as prose - their price is a calculation over Obligation,
      Consequence and Frequency, and inventing a calculator for it would be
      worse than storing what the book says.
    - **Budgets are EXPRESSIONS**, on `TemplateConfig.Budgets` and overridable
      on `PlayableCharacter.budgets`, evaluated through `parsePoolExpression` -
      the same evaluator pools use, which is what makes "in terms of another
      budget" reachable later. Demon and thrall carry PLACEHOLDER arcana
      budgets (25 / 10), labelled as such. A purse with no budget anywhere is
      reported as the Storyteller's call rather than defaulted to zero.
    - **`perTemplate: Record<template, TemplateVariant{cost, available, note}>`**
      + `meritCostFor(def, templates)`. A printed "(7/5)" IS this: demon 7,
      thrall 5, and the thrall's `note` carries the lesser effect. The list is
      EXHAUSTIVE - naming any template means only those may take it, which is
      what the printed notation means - so a def anyone may take names none.
      First bug caught in the live smoke: Celestial Radiance had `points: 0`,
      and the fallback treated "declared zero" as "has a plain price", letting a
      VAMPIRE take it; the exhaustive rule replaced the fallback entirely.
    - **Price paid is not price listed** (his: "sometimes the character just
      starts with some Arcana because the Storyteller says so, same as with
      backgrounds. That should, in fact, be true for all traits"). New
      `PlayableCharacter.paid: Record<key, expr>` and `TraitInstance.paid`, set
      by **`[[paid <key> [expr|listed]]]`** (no expression = 0 = granted) or
      inline with `take-merit paid=`. `[[budget]]` counts the override, `[[sheet]]`
      shows it, and the card round-trips it.
      His own example lands exactly here: Mentor 5 is his mother (granted, paid
      0), Mentor 3 is Daujotas his Hermetic Master (paid 3) - two instances of
      one Background, each with its own note AND its own price.
    - **`[[budget]]`** reports each purse: the expression, its value, what the
      owned merits/arcana draw, and what is left - explicitly advisory.
    LEFT for the creation engine: pricing ATTRIBUTE and ABILITY dots per
    priority (the `wod:config:costs` table from §7.44 is the seam), and the
    legality verdict itself.

51. **An arcanum is not filed under merits; [[set-trait]]; families of power**
    (user: "Trait Aptitude is not merit-flaw, it's an arcanum... How do I take
    the Backgrounds again? The conversion tool deleted them... I think we should
    have different categories of things, I would call these
    supernatural-traits").
    Three things, one of them a scare.
    **(a) The card files owned powers by KIND.** §7.50 gave arcana their own
    purse but left them printed under `merits-flaws`, which is what he was
    looking at. `characterToCard` now writes an `arcana:` block beside
    `merits-flaws:`, and BOTH read back into the one `meritsFlaws` bucket via
    BUCKET_SYNONYMS - so nothing migrates and the card stops lying. **(SUPERSEDED
    by §7.72: the `arcana:` block now reads into its OWN bucket, because one
    bucket was the shape of the mistake.)** The Devil's
    Due powers were re-kinded with it: Trait Affinity, Trait Enhancement and
    Sharpened Senses are `arcanum`, not `merit`, and now draw on the arcana
    budget.
    **(b) The conversion did NOT delete his Backgrounds** - reproduced with a
    full JSON sheet and they survive intact. The real hole was that there was no
    way to put a rating BACK except hand-editing the card: `take-merit` exists,
    `specialty` exists, and every other rating had nothing. New
    **`[[set-trait <name> <n> [group=] [note=] [paid=] [add=true]]]`**, with the
    group inferred from the character's buckets, then the chronicle's SRD lists
    (`srdGroupOf` - so a Background nobody has rated still files as one), then
    `group=`, then the free `traits` bucket. `add=true` builds the §7.43
    instances, note and price included.
    And the thing that should have warned him: `syncFromLorebook` now reports a
    group that went from N entries to ZERO, because the card is the source of
    truth and a group left off it IS erased. First attempt printed nothing - the
    beforeRoute hook syncs BEFORE the command runs, so `creator-mode set=false`
    had nothing left to notice; `lastEmptied` carries the hook's finding into
    the reply.
    **(c) `SupernaturalCategory` + `SupernaturalTraitDef`** (rules.ts): the
    families - disciplines, magic, sorcery, blood-sorcery - each with the
    templates it is open to and the sheet bucket its ratings live in, plus a
    per-MEMBER `parent`, because that is where the irregularity lives: a
    Thaumaturgical path needs Thaumaturgy and a Mortis path needs Mortis, while
    Koldunic sorcery needs no Discipline. Put on the member rather than the
    category precisely so the exception costs nothing to say.
    **`[[supernatural]]`** lists what a character holds per family and flags a
    path whose parent Discipline is missing; `[[supernatural <category>]]`
    details one. Data only - no powers engine, nothing enforced.

52. **Backgrounds get a bag of their own** (user: "the background should have
    their own bag too... those two are free: mentor 5 and talisman 5. But the
    Talisman 5, Cosmos Within the Measure, grants me access to the Library of
    the Unseen... Anything usually has the same cost as it has dots... We are
    creating a case where number of dots and cost can be different").
    Backgrounds were the one trait family with NO definitions - a list of names
    in the lorebook and nothing else, which is why they had no ceiling, no
    ladder and no way to say what one DOES. Now:
    **`BackgroundDef`** (name, description, max, templates, `resource`, `tiers`,
    `grants`) + **`BackgroundRegistry`** (`wod:config:backgrounds`, a
    ListConfigStore over `DEFAULT_BACKGROUNDS`) + `[[backgrounds]]`,
    `[[background <name>]]`, `[[define-background]]`, `[[forget-background]]`.
    - **DOTS ARE NOT COST.** §7.50's `paid` already said this for merits; the
      new **background purse** in `purseLedger` applies it here, walking the
      bucket AND its instances so two Mentors price separately. The owner's own
      sheet is the test: Fount 5, Talisman 5 and Mentor 5 given (paid 0),
      Mentor 3 and Resources 2 bought - `[[budget]]` reports exactly `background:
      5 spent`, which is what he actually paid.
    - **ONE MAY CONFER OTHERS.** `grants: TraitGrant[]` - the Talisman that IS a
      place (Cosmos Within the Measure) grants Cray 5, Library 5, Sanctum 5.
      `grantedTraitsOf` + **`effectiveTraitOf`** (max of bucket and grant) is
      folded into the roll env resolver, the affliction TIER lookups (both of
      them), `[[measure-door]]`, `[[research]]`, `CrayStore.rating` and
      recovery's `requiresTrait` - so a conferred Sanctum opens the door and
      scales the tiers exactly like a bought one, while costing nothing.
    - **Fount** ships with the book's ladder (1: hold 12, spend 2/turn ... 5:
      hold 20, spend 6/turn) as `tiers`, and records the derivation the owner
      reminded me of: Fount 5 plus ten dots of vitae IS Living Resolve's 30/6
      pool. Nothing recomputes it - the pool already carries those numbers - but
      now the sheet says WHY.
    Bug caught by the live smoke: registry defaults must be stored NORMALIZED
    (like DEFAULT_AFFLICTIONS), or `ListConfigStore.get` - which compares a
    normalized name - can never find them. `[[background fount]]` said "no
    background fount" until the defaults were lower-cased.

53. **The arcana vocabulary** (user: "I hope now we have commands equivalent to
    those of Merits and Flaws, except for Arcana and Taints").
    They always shared the machinery - one registry, four kinds - and what was
    missing was names that mean it. `define-arcanum` (kind defaults to
    `arcanum`), `take-arcanum`, `drop-arcanum`, `arcana`, `arcanum`,
    `forget-arcanum`, all thin wrappers over the merit handlers. `[[arcana]]`
    and `[[merits]]` filter by purse so neither family drowns the other, and
    `wrongFamily()` makes the vocabulary MEAN something: `take-arcanum
    iron-will` refuses and points at `[[take-merit]]`. Wrappers rather than a
    parallel implementation - there is one owned-power mechanism and it stays
    one.
    **SUPERSEDED BY §7.72.** "A vocabulary over one registry" was the third time
    I answered a structural complaint with a naming one. Filtering a shared list
    by purse still leaves the arcana IN the merits list - which is what he was
    reading when he finally said so flatly. The wrappers are now real handlers
    over a second registry, second card and second bucket; `wrongFamily` is
    gone, replaced by `familyOwning()` + `PowerFamily.other()`.

54. **The creation budget: pools as data, clans and fellowships as CHOICES**
    (user: "We should, by this point, create the actual budget for character
    creation", with the whole allocation - per-template starts and maxima,
    priority pools, the vampire and mage extras, the freebie table, all six
    Fellowships and every clan's Disciplines).
    - **`CreationBudget` is per template, and templates STACK.** `BASE_CREATION`
      carries what every Dark Ages character gets (Attributes 7/5/3 over one
      free dot, Abilities 13/9/5 from nothing, 5 Background dots, 15 freebies);
      `TemplateConfig.Creation` overrides it, and **`creationBudgetFor(keys[])`**
      folds several templates by overriding numbers in turn and CONCATENATING
      notes. Stacking rather than last-wins because a vampire-and-mage owes both
      sets of dots - shadowing would silently delete one splat's obligations.
      Vampire: `disciplines: 4`, `virtues: 7`. Mage and Ouroboros: notes only.
    - **The derived values ship as NOTES, not as computation.** Road = the sum of
      the Road Virtues, Willpower = Courage, blood = 1d10 + Domain + Herd,
      generation starts at 12th, Quintessence = max(Cray + Fount, 5). Every one
      of these needs a subsystem that does not exist (Road tracking, generation,
      a creation-time roll), so the standing rule applies: **store it, surface
      it, never block on it.** `[[creation]]` prints them verbatim.
    - **`[[creation]]` reports, never enforces**, like everything creation-side.
      It needs the player's priorities to say anything per-category, so
      **`[[choose attributes physical,social,mental]]`** /
      **`[[choose abilities talents,skills,knowledges]]`** record them in
      `PlayableCharacter.priorities`, and until they exist the report says
      `7/5/3 to spend - [[choose …]] first`.
    - **Which Ability is a Talent is the CHRONICLE's call.** `categoryTraits()`
      reads the `srd:abilities` talents/skills/knowledges lists rather than a
      hard-coded table, so a house-ruled Ability counts in whichever list names
      it. Corollary: dots in no list would vanish from the arithmetic, so they
      are reported as **`⚠ uncounted`**. Same honesty for a rating a clan limit
      forbids: **`⚠ over: Appearance 1 > 0`**, said and not corrected.
    - **A clan/fellowship is not a template**, so it does not belong in
      `templates[]`: it steers traits (naming Disciplines, a Foundation and four
      Pillars) instead of being a splat. `PlayableCharacter.choices` is its own
      map, written by **`[[choose clan …]]` / `[[choose fellowship …]]`**, and
      the value stored is the registry **id** (`assamite-vizier`), never the
      display name (`Assamite (Warrior)` normalizes to something nobody types).
      A chosen fellowship now WINS over auto-detection in `resolveFoundation`:
      a Valdaermen with a Modus rating still casts on Blot.
    - **Thirteen clans, fifteen entries.** The three Assamite castes pick
      different Disciplines, so they are separate `CLANS` entries, but they are
      one clan: `Clan.family` + `clanFamilies()` (13) + `clanFamilyOf()` make
      **`EXCLUSIVE_MERITS_FLAWS`** thirteen pairs rather than fifteen, and the
      gate in `unmetRequirements` compares CLANS, so a Vizier may buy what
      Assamites may buy. `MeritFlawRequirements.choices` is the new gate kind -
      templates and tags could not express "only a Nosferatu".
    - **All six Fellowships** ship with their Foundation, four Pillars, theme and
      `aliases`, findable through `fellowshipByName` (`batini`, `aedun`,
      `runecrafters`, `hermetic`, …). Consequence caught by a test: Sensitivity
      is now somebody's Foundation, so the "no Foundation" refusal needed a
      trait no fellowship names.
    - **Freebie prices corrected** from the book the user quoted: Foundation 5
      (was 10), Pillar 3 (was 7), and a new `specialty` row at 1.
    - **One number, two reports.** `budgetsOf` now SEEDS the `background` and
      `freebie` purses from the creation budget, so `[[budget]]` says
      `background: 2/5, 3 left` where it used to say "no budget set (Storyteller's
      call)" while `[[creation]]` was already saying `2/5`. Two commands quoting
      different numbers for the same pool is exactly the kind of drift this file
      exists to prevent. Template `Budgets` and the sheet's own `budgets` block
      still override, in that order.
    Load-order bug worth remembering: `BASE_CREATION` is referenced by
    `TemplateConfig`'s constructor default, so the whole creation-budget block
    has to sit ABOVE it in rules.ts or the module crashes with "used before
    initialization" at import time.

55. **Expressions, and references into the sheet** (user: "we have to finally
    come up with a way to evaluate expressions and refer to other parts of the
    character", with three cases: Generation 5 → 7th generation → every ceiling
    6; Road = the sum of the two Road Virtues, 2 before assigning; Willpower =
    Courage, 1 after assigning. Explicitly asked to design for three FUTURE
    passes: modifying a template, extending one by overriding only some fields
    including budgets, and a legality proof that says what the budget was and
    where it went.)
    - **ONE language, not two.** `parsePoolExpression` was a `+`-splitter and
      four other things wanted more; a second evaluator would have drifted from
      it within a pass. `core/expr.ts` is now the only arithmetic, and the pool
      parser is a thin wrapper that keeps `PoolBreakdown` for the roll display.
    - **THE HYPHEN RULE** was the whole syntax decision. Trait names contain
      hyphens (`self-control`, `al-ikhlas`) and arithmetic needs subtraction, so
      a hyphen continues a NAME only when a **letter** follows it. `12 -
      generation`, `12-generation` and `courage - 1` all subtract (a number
      token can never absorb a hyphen); only `a - b` between two NAMES needs the
      spaces. Chosen over braced refs (`{self-control}`) and mandatory
      namespaces (`virtue:self-control`) because both would have changed how
      every pool and difficulty already in the chronicle is typed, to buy
      nothing the one-sentence rule doesn't.
    - **An unknown reference is 0 AND reported.** This is the real upgrade: the
      old resolver returned 0 for a typo in silence. `ExprResult.unknown` names
      it, and `[[eval]]` prints it. The corollary took a bug to find: a
      namespaced name the CHRONICLE defines but the sheet does not rate must be
      **0, not unknown**, or `12 - background:generation` reads as a typo on
      every vampire without the Background. Hence `knownTraitNames()`.
    - **Nothing throws.** A malformed expression is 0 with `error` set, because
      a bad lorebook card must never take the story down.
    - **Derived ≠ stored.** Road, Willpower, generation and the blood ceiling
      are consequences of other parts of the sheet, so they are computed on
      demand and never written. `Derivation.when` carries the only distinction
      that matters: **`start`** answers while the sheet is absent-or-0 and steps
      aside the moment you rate the trait (Willpower starts at Courage, then
      freebies buy it up — and the report still says where it began, via
      `DerivedValue.overridden`); **`always`** recomputes whatever the sheet
      says, because it is not a rating (generation IS 12 minus the Background).
      "Absent or 0" rather than "absent" because `newPotential` seeds
      `poolStarts.willpower = 0`, and 0 has always meant "unassigned" here.
    - **Seeding the Virtues** was the missing half of the user's numbers: a
      fresh vampire had an EMPTY virtues bucket, so Road would have derived 0
      instead of 2. `newPotential` now seeds the Road's three at their free dot,
      exactly as Attributes seed at 1. Road 2 before assigning, Willpower 1
      after — the user's figures, reproduced.
    - **`ScopeExtension` is the seam the future passes named.** state.ts owns
      traits and derivations; game.ts hands in `budget:`/`spent:`/`left:` from
      the purse ledger without state.ts ever reaching upward. A legality proof
      is `left:background != 0` plus the `terms` trace that already says where
      each number came from — no new machinery. Likewise `Numeric` on every
      budget/limit field is where a template-override pass writes its overrides,
      and `creationBudgetFor` already stacks templates.
    - Memoized with a **cycle guard**: derivations reference each other
      (`trait-max(generation)` needs `generation`), and a circular one is
      reported with the sheet's own value rather than blowing the stack.
    - Two ambient wins: `characterRollEnv` now resolves through `traitValueOf`,
      so a CONFERRED or DERIVED rating is rollable (`[[roll willpower]]` on a
      sheet stating no Willpower); and `-0` cannot carry a sign, which is why
      `ExprTerm.negated` exists (`12 - background:generation 0` printed as `+`
      until it did).

56. **Say each thing once** (user: "look for anything we're doing that could be
    simplified to become smaller ... duplicated code that could be turned into
    one function ... remove anything we no longer use, anything that's
    deprecated").
    Found with two throwaway scripts rather than by eye: an export scanner
    (declared, referenced nowhere including tests) and a 4-line-window duplicate
    finder. Both are worth re-running before any future cleanup.
    - **`rollOpPatch(op, amount)`** is now THE table of which roll op moves which
      `RollModifier` field, and `undefined` doubles as the membership test - so
      `ROLL_OPS` is gone and the set and the translation can no longer disagree.
      **`mergeRollExtra(into, ...patches)`** replaced four hand-written folds
      (two of them five-branch); it is also the one place that records that every
      field ADDS except `nAgain`, which TIGHTENS.
    - **`commitContestRound`** replaced three copies, and unified a real
      divergence: the two verbs that OPEN a contest never cleared the "current
      contest" pointer when a contest was decided on round one - only
      `continue-contest` did. Now covered by a test that fails without the fix.
    - **`[[creation]]`'s Background total now comes from `purseLedger`.** The
      copy it used to keep read `paid` with `parseInt` while the ledger evaluated
      it as an EXPRESSION, so `paid=courage` made the two reports disagree.
    - `lookupTable` (the table-ref + registry lookup both readers repeated),
      `noCharacter()` (**36** verbatim copies of one refusal string),
      `intOrUndef` (five copies of the same three-line integer parse — four of
      them local redefinitions shadowing the module-level one), `TWO_SIDED_PARAMS`
      (`resist` and `contest` differ only in how the margin is read),
      `closeButton`/`resultBox` (three windows agreeing on what a dismissal and a
      reply look like), and `extended-contest` now calling `resolveOpponent`
      instead of re-implementing it.
    - `GHOUL_SOAK`/`MAGE_SOAK`/`WEREWOLF_SOAK` were byte-identical to
      VAMPIRE/MORTAL/DEMON: now `{ ...OTHER }`, which SAYS the rule ("ghouls soak
      like the half-vampires they are") and stays a separate object, so editing
      one splat's soak cannot silently edit another's.
    - **Deprecated, removed**: `MeritFlawDef.atMostOneAt` (superseded by
      `limits: [{atRating, slots}]` — with its card alias, its `define-merit`
      param and the fold in `instanceLimitsOf`), and LIVING_RESOLVE's `focus`
      effect, which only ever restated the plain spend AND whose copy still
      carried the double difficulty break §7.46 removed from the real one.
    - **Dead, removed**: `UIHandle`, `__systemPrompt`/`__prefill`, `ROLL_KNOB_NAMES`,
      `asNumberMap`, `EMPTY_SCOPE`, `evalNumber` (folded into `evalNumeric`), and
      `traitLimitFor`/`resolvedLimit` — two helpers written speculatively in the
      last two passes and never called. Writing a helper "for later" is how dead
      code gets in; if the caller does not exist yet, neither should it.
    - One thing the sweep FOUND rather than deleted: `ROAD_OF_KINGS` and
      `ROAD_OF_THE_BEAST` were unreachable data, because §7.55's `roadOf` only
      ever looked at template Roads. They are rules the chronicle should be able
      to pick, so the fix was a **`ROADS` registry + `roadByName` + `[[choose
      road …]]`**, not a deletion. Unused DATA and unused CODE are different
      findings.

57. **Successes the Storyteller simply grants** (user: "we also need a way to
    add automatic successes and un-cancelable successes to a roll manually").
    Both concepts already existed inside the engine - `RollModifier
    .autoSuccesses` / `.uncancelableSuccesses` - but were reachable ONLY through
    a spend, a tag or a passive. They are now **`RollSpec` fields**, which is
    the choice that matters: a spec is serializable, so `[[name-roll
    potence-punch strength+brawl successes=2]]` bakes them into a saved roll and
    `describeSpec` reports them. `resolveSpec` seeds its counters from the spec
    instead of 0, so tags/spends/passives still ADD rather than replace.
    Named `successes=` / `uncancelable=` to match the effect-grammar op names
    (`successes`, `uncancelable`) a merit's passive already uses; `auto=`/`sure=`
    are accepted as the report's own shorthand.
    **A bug fell out of it**: there were TWO named-argument readers -
    `extractRollArgs` (for `[[roll]]`/`[[roll-for]]`) and
    `rollOverridesFromNamed` (for saved rolls and contests) - each reading the
    same knobs separately, so a knob added to one was silently missing from the
    other. `extractRollArgs` now delegates and adds only what is peculiar to
    typing a roll out: the pool and the POSITIONAL difficulty/diff-mod.
    (§7.56's duplicate finder missed this pair: their shared lines are not
    contiguous.) The window needed no change - it is spec-driven, so
    `[[win-roll]]` grew both fields from the `ROLL_KNOBS` list alone.

58. **A template you can extend** (user: "first we need a way to extend a
    template ... make the Ouroboros template not be hardcoded. Probably by
    extending Mage, and adding Disciplines and whatever else. That means we'll
    have to also create the Living Resolve resource with commands").
    - **`TemplateDef` is how you WRITE one; `TemplateConfig` is what the engine
      READS.** A def names its `extends` parent and states only the difference;
      `templateFromDef(def, parent)` folds them. Resources are **appended** to
      the parent's (a `replaces` list then hides what it stands in for -
      exactly how Living Resolve covers Blood/Willpower/Resolve/Quintessence);
      `budgets`/`creation` merge field-by-field; `reactions`/`derived` append.
      Soak, morality and ruleset are chosen **by NAME** (`SOAK_TABLES`,
      `MORALITIES`, `RULESETS`, `REACTIONS`), because a card cannot hold an
      object - and each is an open record, so a chronicle that invents a soak
      names it too.
    - **THE OUROBOROS IS NO LONGER CODE.** `TEMPLATE_OUROBOROS` is deleted; it
      is a `TemplateDef` in `DEFAULT_TEMPLATE_DEFS` - `{extends: "mage", soak:
      "ghoul", resources: [LIVING_RESOLVE], creation: {notes}}` - and its tests
      now assert the RESOLVED template, which is the stronger claim.
    - **Where the fold lives vs. where the card lives.** rules.ts owns
      `TEMPLATES` + `applyTemplateDefs`; state.ts owns the `wod:config:templates`
      card via `TemplateRegistry` and drives the fold through `ListConfigStore
      .onChanged` - a hook that had existed unused since §7.21. Nothing below
      state.ts learns that a lorebook exists, and the built-ins are rebuilt from
      scratch on every change, so DELETING a card entry puts the shipped
      template back.
    - **A half-written def is reported, not fatal**: a missing parent or a cycle
      skips that def and returns a problem string (surfaced by `[[templates]]`),
      while every other def and all the built-ins still build. A cascading
      failure is reported ONCE - the parent's reason, not the child's echo.
    - Commands: **`[[templates]]`** (QUIET; `*` marks the data-written ones),
      `[[templates <name>]]`, **`[[extend-template]]`**, **`[[forget-template]]`**,
      and **`[[define-resource]]`** - which writes into the SAME
      `ResourceOverrides` card `[[configure-resources]]` tunes, so there is one
      place a resource can come from. The proof this pass exists for: a whole
      fused-pool Awakened creature built from two commands, played (cast, spend)
      and then forgotten again, entirely without TypeScript.
    - Bug found while wiring it: `makeTemplateDef` decoded only the CARD's
      resource shape (a name-keyed block), so a def handed ready-made
      `ResourceDef`s from code or a command silently lost them. It now accepts
      both.
    - **Scope note.** `LIVING_RESOLVE` stays a constant in rules.ts (it is 60
      lines of data the shipped def references), rather than moving into a
      seeded card. `[[define-resource]]` makes it REPRODUCIBLE from commands,
      which is what "creatable with commands" needed; moving the constant itself
      would buy nothing and would put the Ouroboros behind a store load that
      ~30 tests do not perform.

59. **A pool that reads the sheet** (user, quoting the Fount Background's ladder:
    "To define this resource, we have to use the reference to other parts that I
    mentioned. Quintessence depends on Fount ... Living Resolve is equal to
    Quintessence + Blood-Pool (10 for a revenant). We have first to have those
    two resources, add them to get the resource we're making, then drop
    Quintessence, Blood, and Willpower").
    - **`ResourceDef.start`/`.max`/`.perTurnLimit` are `Numeric`.** The Fount
      ladder - five rows of a printed table - is now two expressions:
      `max: "10 + 2 * background:fount"`, `perTurn: "max(2, background:fount + 1)"`.
      Both reproduce the published rows exactly, including the bare 10/2 for a
      mage with no Fount at all.
    - **`resource:<name>:max|start|per-turn`** is the new scope namespace, so a
      pool can be made OF pools. Living Resolve is
      `resource:quintessence:max + resource:blood:max` - which is what the owner
      always said it was - and the Ouroboros def now carries the revenant's
      blood BESIDE the mage's quintessence so there are two things to add. Its
      30 is now derived (20 at Fount 5 + 10 vitae), and it was 30 hardcoded.
    - **The def is read BEFORE replacement filtering**, which is the subtle part:
      `replaces` hides what the CHARACTER sees, not what an expression may name,
      so Living Resolve can be defined in terms of the Quintessence it hides.
    - `resourceNumbers(char, def)` is the seam - every reader of a capacity now
      goes through it (`CharacterResources`, the spend/gain/recovery reports,
      `[[resources]]`'s per-turn line, `permanentRatingOf`). The legacy
      `CharacterFactory` path has no PlayableCharacter to evaluate against and
      falls back to a plain number; that is recorded, not hidden.
    - A resource defined in terms of ITSELF terminates: the scope keeps a
      `resourceDepth` guard, so the first re-entry is worth 0 and the outermost
      evaluation still completes. `[[define-resource]]` takes expressions too.
    - **Test fallout worth remembering**: ~30 tests asserted the old constant
      capacities. Fixing them meant giving the modelled character the Fount 5 he
      actually has - so the suite now asserts a DERIVED 30 rather than a
      hardcoded one, which is the stronger claim. One helper overwrote
      `backgrounds` wholesale and silently dropped the Fount that `set-trait`
      had just written.

60. **A purse with prices, a pool you cannot use, and Disciplines that are his
    own** (user, six requirements at once: "Can I change any part of the budget
    of the new template? I should be capable of doing that. If yes, than you
    just set the Arcana budget to Willpower (or whatever replaces it; not
    purchasable with freebies or XP) ... The Ouroboros-clone template is supposed
    to be **capable** of using resolve ... What if the person gaining the
    resource just has no way of using resolve? ... Same thing for Quintessence
    and Blood ... is Blood-Pool resolved using the Generation Background
    already? ... As for Disciplines, we could have a simple form that either
    overrides or adds whatever is not duplicated in clan, ghouls, and revenant
    families disciplines ... the budgets must contain how each dot of this costs
    in freebies, and how much each dot of this costs in XP (we leave maturation
    for later; put it in memory)").
    - **A PURSE IS AN ALLOWANCE AND ITS PRICES.** `BudgetDef {allows?, freebie?,
      experience?, note?}`; `BudgetEntry = string | BudgetDef`, so every purse
      written the old short way ("25") still parses and `budgetDef()` normalizes
      at every reader. `NOT_PURCHASABLE = "-"` is the one price the engine
      READS: `budgetBuyable()` distinguishes *nobody said* (absent - the
      Storyteller's call, as ever) from *the answer is no*.
      **Prices default from `DEFAULT_ADVANCEMENT_COSTS` by purse name**, since
      the purse names ARE the cost kinds (background, discipline, virtue) - so a
      purse always knows what a dot costs without anyone restating it.
    - **🚧 MATURATION IS DELIBERATELY ABSENT from a budget** (the owner's
      instruction, recorded here as asked). `DEFAULT_ADVANCEMENT_COSTS` keeps its
      `maturation` column for the Storyteller and `[[costs]]` still shows it; a
      purse grows a `maturation` price when there is a **downtime engine** to
      spend it. Roadmap item 5.
    - **The Ouroboros' arcana purse is `role:willpower`, freebie `-`,
      experience `-`.** That answers the owner's question - yes, any part of any
      template's budget is overridable - and encodes his ruling. The demon's
      placeholder 25 gained the same two prices plus the book's formula as a
      note; 🚧 permanent-vs-temporary Torment is still unmodelled, so the number
      stands in for `(Resolve x permanent Torment) + temporary Torment +
      Willpower + Taints`.
    - **`role:<name>` is a new scope namespace: "or whatever replaces it".**
      `resource:willpower:max` reads the pool NAMED willpower (before
      replacement filtering - §7.59 needs that); `role:willpower` resolves the
      way a character does (name -> role -> replaced), so for the one creature
      whose four fuels are one substance, all four names land on Living Resolve.
      It defaults to `:start` rather than `:max` because **a pool's start is its
      RATING** (a mage's Willpower 5 in a tracker that tops out at 10), and a
      rating is what a rule means by "equal to your Willpower". The player's own
      `poolStarts` entry wins over the def, exactly as `permanentRatingOf` does.
    - **CAPABILITIES: holding a pool is not being able to spend it.** The
      owner's framing, near-verbatim: a mage cannot use the ten blood points in
      his body as a vampire does; a vampire cannot harvest Quintessence from a
      cray, gain it from Tass, or burn a talisman's store on Awakened magic.
      `ResourceDef.requires: string[]` (blood -> `vitae`, quintessence ->
      `awakened`, resolve -> `resolve`) meets `TemplateConfig.Capabilities`
      and `PlayableCharacter.capabilities`.
      **`TemplateConfig.Awakened` STOPPED BEING A FIELD** and became
      `Capabilities.includes("awakened")` behind a getter - one concept replacing
      a special case, with every existing reader (`isAwakened`, the sanctum
      tiers, `[[templates]]`) untouched. `TemplateDef.awakened` survives as the
      shorthand that adds/removes it, and is the ONE way a def can SUBTRACT a
      capability (a template built on a mage may well be something that never
      woke).
      `CharacterResources.spend` returns `{spent: 0, blocked: [...]}` rather than
      paying, `ResourceView.blocked` makes `[[resources]]` say "held but
      UNUSABLE", and **`[[attune <cap> [off]]]`** grants one on the sheet -
      the seam an item system will use. It refuses to take back a capability the
      TEMPLATE has: a mage who forgets he Awakened is a different template.
      🚧 Objects that GRANT a pool are still roadmap; the question of who can use
      one is answered now.
    - **A vampire's blood pool now follows the Generation Background live** (the
      owner's question, answered yes-for-ceilings/no-for-the-pool and then
      fixed): `max: "blood-max(generation)"`, `perTurnLimit:
      "blood-per-turn(generation)"`. A 12th holds **11**, not 10 - three tests
      asserted the old constant and were wrong about the rules, not about the
      code. `fromGeneration` stays for the legacy `CharacterFactory` path, which
      has no sheet to evaluate against.
    - **DISCIPLINE AFFINITY: whose Disciplines these are.** `DisciplineAffinity
      {disciplines, mode?: "add"|"replace"}` on `TemplateConfig.Affinity`, and
      `affinityDisciplines(choices, template)` asks three registries in turn:
      `CLANS`, **`GHOUL_FAMILIES`** and **`REVENANT_FAMILIES`** - the last two
      **deliberately empty** (the "empty mechanism that returns no disciplines
      yet" the owner asked to override). `clanByName` collapsed into a general
      `familyByName(registry, name)`. A template's `mode: "replace"` is the
      override, and it is a real statement even with an empty list: it says the
      family registries have nothing to add. `[[creation]]` now says "out of
      affinity" rather than "out of clan", and says nothing at all when nothing
      has named them - the Ouroboros' own list is **left empty on purpose**,
      because inventing his three Disciplines is the owner's call, not the
      engine's. He has a discipline BUDGET (2 dots, max 5).
    - **`discipline` is a purse.** `purseLedger` counts Discipline dots the way
      it counts Background dots (`paid` overrides, dots are not cost), and
      `budgetsOf` seeds it from `creation.disciplines` - so `[[budget]]` and
      `[[creation]]` cannot disagree about it, the same guarantee §7.54 made for
      Backgrounds.
    - **`[[extend-template]]` EDITS as well as creates.** It now seeds from the
      def already in force (chronicle overlay, else the shipped default) and
      lays the arguments over it. Without that, the second call would gut the
      first - the overlay REPLACES a default wholesale by name - and "set the
      Ouroboros' arcana purse" would silently cost him his soak, his pools and
      his notes. New arguments: `capabilities=`, `budgets=` (`purse=<expr>` for
      the allowance, `purse:freebie=` / `purse:experience=` for a price),
      `creation=` (all ten pools, each a number or an expression), `disciplines=`
      (a leading `=` means replace).

61. **Say it once, say it short** (user: "I don't know how to spend two points of
    Resolve in a regular roll ... in Quintessence, I don't remember how to spend
    more than one point ... The general reply for any roll contains wording
    about magic and Quintessence. I don't think it should. It should be smaller
    and more precise, more to the point").
    - **Both "missing" features already worked.** `spend-amount=N` has been read
      by `applySpend` since §7.33; it was simply **not in any CommandSpec**, so
      `[[help roll]]` never listed it and the owner had no way to find it. The
      lesson is recorded rather than the fix: *a knob the parser honours and the
      spec omits does not exist.* It is now a param on `roll`, `roll-for`,
      `extended-roll`, `continue-roll`, `resist`/`contest`, `cast` and `lift` -
      and because `[[win-roll]]` walks the roll spec, the window gained the
      field for free.
    - Likewise the **time commands** (`[[advance-time]]`, `[[story-date]]`,
      `[[turn]]`, `[[scene]]`) and **`[[win-roll]]`'s spend picker** were both
      reported missing and are both present in `dist/naiowod.ts`; the owner was
      running an older paste. Nothing to fix, worth remembering: **"it's gone"
      usually means "the artifact is stale"**.
    - **The roll's tail now says what the spend DID, not what the resource IS.**
      It used to append `e.label` verbatim - a paragraph about spellcasting,
      Foundations and the Quintessence break - to *every* roll, including a
      punch. The mechanical result is already on the roll line (`+2 auto +1 sure
      vs diff 2`), so the note carries only what that line cannot say: how many
      points left the pool, and anything that capped or skipped an op. The
      caveat strings shrank with it (`1 sure only (stacking Willpower is a
      casting rule)`). The full prose is one `[[resources]]` away.
    - **`SavedRoll.spendAmount`** (data shape): a saved roll can bake in "always
      burn two Resolve"; the command's `spend-amount=` still overrides it.
    - **THE FOUNT LADDER WAS WRONG AND THE OWNER CORRECTED IT.** His first
      statement said a mage with no Fount spends **two** a turn; his second,
      after checking, gives the table as **1 + Fount** flat - no Fount spends
      **one**. `perTurnLimit` went from `max(2, background:fount + 1)` to
      `1 + background:fount`. Recorded because the two statements conflict and
      the SECOND one is the ruling.
    - **`heal` is a ROLE now**, on `blood` and on Living Resolve (asked for
      directly). It says "this is the substance this creature mends himself
      with", so `[[spend heal::heal 2]]` finds it without knowing its name.
      🚧 What healing COSTS, how much it mends, and how often aggravated damage
      may be healed are explicitly NOT modelled - the owner ruled them too
      complicated to attempt now ("just create the heal role if it doesn't
      exist"). The conditional case (a Regeneration arcanum letting Resolve
      heal) is the shape `requiresResource` + a granted effect will take.

62. **The post office** (owner, designing it himself: *"suppose the bus is Amazon
    and suppose you both buy and sell from it. Each script will have their post
    office ... If you use Amazon to sell something to yourself, you still
    receive it"*; plus a priority enum, a stop-spreading verdict, a cancel
    boolean *"some scripts can ignore the cancel thing and never check for it,
    others could check if(event.isCancelled) return"*, and *"anything can be a
    channel"*).
    - **His model is right and is what shipped.** `core/bus.ts` is the dispatch
      rule (pure); `PostOffice` in services.ts is the half that knows about
      `api.v1.messaging`. `publish` delivers LOCALLY first, then relays — and
      the publisher cannot tell which mattered, which is the simplicity he asked
      for.
    - **WHY LOCAL DISPATCH IS A DIRECT CALL, NOT A ROUND TRIP.** He asked
      whether a self-message could just go through the bus *"for the sake of
      simplicity"*, and whether the cost would be efficiency. It is not an
      efficiency question and the answer is no, for two documented reasons:
      `broadcast()` **excludes the sender** (a script cannot receive its own
      broadcast at all), and every messaging call is a **Promise** — so an event
      that left and came back would arrive on a later tick, after the thing that
      raised it had already finished. "Let a handler adjust this roll before it
      is rolled" is impossible across the wire and trivial in a function call.
      The test `emit is SYNCHRONOUS - the verdict is readable on the next line`
      is the one that pins this.
    - **cancel vs stop are different, exactly as he specified.** `cancel` is a
      FLAG: later handlers still run and may honour it or ignore it entirely
      (both branches are tested). `stop` is the interruption: no further
      handlers, and **the post office does not relay it onward** — a handler can
      keep something off the wire.
    - **`local:` is his "loco" prefix**, spelled the way the rest of the engine
      spells things. A channel named that way never reaches messaging.
    - **On sending methods across the wire as an IIFE's `toString()`** (his
      idea): not built, and recorded as a hazard rather than a plan. `toString`
      is the one thing that does NOT carry the closure, rebuilding needs
      `eval`/`new Function` which the sandbox may not allow, and it would put
      un-reviewable code in a paste-able artifact. The engine already solves this
      the boring way: **plain data plus a NAME both sides resolve through their
      own registries** (`REACTIONS`, `SOAK_TABLES`, `MORALITIES` are all
      string-keyed for exactly this reason). Templates-as-data (§7.58) turns out
      to have been the prerequisite for distribution.
    - `src/host-mock.ts` grew a messaging mock faithful to the DOCUMENTED
      contract and no further (`__resetMessagingMock`, `__sentMessages`,
      `__deliverMessage`) — a broadcast is never delivered back to its sender
      there either.
    - **`scripts/probe-messaging.ts`** (not in the build): a paste-into-NovelAI
      script that answers the four things the docs are silent on — does `send`
      to your own id deliver, is delivery ordered, is it ever synchronous, and
      does a second script hear it. **Off-host green proves nothing about these**;
      the mock can only be as truthful as the docs it was written from.
    - Its own bug, found by its own test: `PostOffice.open()` was idempotent on
      a flag the HOST can invalidate underneath it (a reload drops the
      subscription while `_wired` still claims it). `close()` is now
      best-effort and always clears the flag.
    - **Nothing in the engine publishes to the bus yet.** This pass is additive
      on purpose: the bus exists, is proven, and adopting it is a later
      deliberate pass rather than a rewrite smuggled in beside it.

63. **A command on the wire, and the reason the huge file can go** (owner:
    *"this is all about not needing the huge file anymore. We can distribute the
    script ... The script that handles commands in the text adventure input
    thing publishes the commands in the bus in a formalized manner, which we
    have to come up with, and anyone that is in the correct channel receives
    them. This is why I have been pushing for data-driven stuff"*).
    - **The size he is describing**: `dist/naiowod.ts` is 14,912 lines / 787 KB.
      The SHARED core every distributed script would still need (host + core/* +
      command) is ~2,200 lines. So a satellite that owned time would be roughly
      2,400 lines rather than 14,900 - and the duplication of that core across
      slots is the real, quantified cost of distribution. Worth knowing before
      committing, not after.
    - **`ParsedCommand` was already the wire format.** Four fields, no methods,
      no classes: `{name, positional, named, raw}`. The long push toward data
      paid here without anyone planning it. `commandEnvelope()` adds only what a
      second script cannot work out for itself - **who it is about, who asked,
      and a correlation id** - and `envelopeToCommand()` reads it back as
      exactly what the local router already takes, so a received command runs
      through the ordinary registry with no special path (tested).
    - **The host hands us a correlation id for free**: `onTextAdventureInput`
      carries a `continuityId`, documented as *"an id that will be present for
      any other generation/context building hooks called in continuation of this
      hook"*. That is precisely the request id an envelope needs.
    - **CHANNEL CONVENTION** (two per command, because the bus filters by
      channel and messaging has no wildcards): `command` for every command -
      where a logger or a ledger listens - and **`command:<verb>`** for one
      verb, where its OWNER listens. A time script subscribes to
      `command:advance-time` and hears exactly what it is for.
    - **THE ARCHITECTURE MAY NOT NEED MESSAGING AT ALL, and this is the finding
      of the pass.** `docs/hooks.md` already promises: *"Scripts execute their
      hooks in the same order as they are listed in the User Scripts modal"*,
      each may modify `inputText`, and any one may set `stopFurtherScripts` to
      halt the rest. **That is an ordered bus with priority and
      stop-propagation, provided by the host, synchronous, requiring no
      messages.** So there are two candidate architectures:
      - **A. The hook chain.** Every script registers the input hook and handles
        the verbs it owns. Guaranteed by the docs today, synchronous, no
        correlation ids, no timeouts. Cost: each slot carries the parser, and
        ordering is the player's modal ordering rather than ours.
      - **B. Kernel plus satellites** (the owner's plan). One script parses and
        publishes; the others subscribe. Needs a reply to arrive **while the
        input hook is awaiting it** - which is undocumented, and which decides
        the whole thing: `onTextAdventureInput` must RETURN the text, so if the
        host does not deliver messages during that await, the hook returns
        before any answer exists and only fire-and-forget events can be
        distributed.
      **Q5 in `scripts/probe-messaging.ts` is that exact test** (publish inside
      the real hook, await a sibling's reply, report answered-in-Nms or TIMED
      OUT). Nothing further should be built on B until it has been run on-host.

64. **Afflictions in time, places as afflictions, and magick with a k** (owner:
    *"our next step should be to take care of afflictions in time"*; afflictions
    with *"cooldown/durations such as 'next N rolls (maybe rolls with/without
    these tags or using or not using these traits)' ... Optionally, these could
    also have a timed cooldown/duration, and whichever happens first wins"*).
    - **`AfflictionExpiry`** (rules.ts, pure): `{rolls?, withTags?, withoutTags?,
      usingTraits?, notUsingTraits?, until?}` on the ACTIVE INSTANCE, not the
      def - the same affliction may be three rolls long on one man and an hour
      long on another. `rollSpendsCharge` (filters AND together; unfiltered
      counts every roll), `expiryElapsed` (either side ending is enough - the
      owner's "whichever happens first"), `describeExpiry`,
      `makeAfflictionExpiry` (filters WITHOUT a charge count are not an expiry -
      "ends on melee rolls" has to say how many).
    - **Two tick points, and they are the only two**: `spendAfflictionCharges`
      runs AFTER the dice in `rollAndReport` (a charge buys the roll it was
      spent on) and `expireAfflictions` runs on `advance-time`, over EVERY
      character - a curse on an absent NPC ends whether or not anyone was
      looking at his sheet. Both lift through `removeAffliction`, so a mirror
      goes with its original; a mirror also inherits the expiry, so a curse and
      its reflection end together.
    - **`[[afflict <name> rolls=N with-tags= without-tags= using= not-using=
      for=<duration>]]`** is the whole surface.
    - **BEING SOMEWHERE IS AN AFFLICTION** (owner: *"the commands to enter
      library and exit library, enter sanctum and exit sanctum should be
      commands to cause afflictions and remove afflictions ... We should be able
      to describe these affordances in data and in story cards"*). `PLACES` is a
      two-entry table and `enterPlace` only afflicts or lifts;
      **`[[enter-sanctum]] / [[exit-sanctum]] / [[enter-library]] /
      [[exit-library]]`**. Every affordance stays in the affliction's own card
      (the rating-scaled tiers of §7.35), so a place grants nothing in code.
    - **`[[flush-context]]`** (his name): the post-generation cleanup on demand -
      *"if the user is experiencing issues, they are encouraged to use this
      command and wait"*. It passes `keepFor = 0`, so unlike the automatic pass
      it does NOT respect the keep-noise-for-two-generations age-out: somebody
      asking for a clean story means now. Its own test found that.
      QUIET, since it is the player operating the machine.
    - **`[[cast]]` became `[[magick]]`** (owner: *"it should be magick, with a k
      ... because we will have Blood Sorcery and Regular Sorcery and Kulunic
      Sorcery ... and disciplines that look like you are casting something, like
      Chimerstry, so the name would be confusing"*). `cast` stays registered and
      **`@deprecated`**, sharing magick's params, so live stories and saved
      rolls do not break - and so that "cast" is free for Sorcery when it comes.

65. **Every way an affliction can end** (owner, generalizing: *"Not only Arcana
    have cooldown and durations. We should put those in afflictions: passive,
    togglable passive, time-based duration and cooldown, turn/scene based ...
    'until X' based (where X is a boolean expression using time events, such as
    next full moon, and/or values in the character), 'until Y' based (where Y is
    some event that cannot be measured ... and should be advisory). Afflictions
    can be inflicted (or self-inflicted) by Arcana, Spells, Disciplines, the
    result of rolls, etc."*).
    - **AFFLICTIONS ARE THE COMMON CURRENCY.** That is the architectural point
      and it is the owner's: an arcanum, a spell, a Discipline and a botched
      roll all pay in the same coin, so duration and cooldown belong to the
      AFFLICTION and none of those four need their own timer. `ActiveAffliction`
      gained **`from`** (free-form: `arcanum:sharpened-senses`, `spell`,
      `botch`) - afterwards, the source is the only thing that tells them apart.
      It is printed RAW, never through `disp()`: it is an identifier, and
      title-casing would mangle the thing that makes it matchable.
    - **`AfflictionExpiry` now carries all six measures** and they COMPOSE -
      whichever runs out first ends it: `rolls` (+ the four filters of §7.64),
      `turns`, `scenes`, `until` (a story epoch), **`untilExpr`** and
      **`untilEvent`**. `AfflictionMode` (passive / togglable / temporary)
      records intent beside it.
    - **"UNTIL X" MEANT TEACHING THE EXPRESSION LANGUAGE TO SAY YES OR NO.**
      `core/expr.ts` gained a CONDITION layer above the arithmetic:
      comparisons (`> < >= <= = == !=`) and `and`/`or`/`not`, reached ONLY
      through the new **`evaluateCondition`** - so every existing arithmetic
      expression (a difficulty, a budget, a pool) parses exactly as before and
      never sees it. `and`/`or`/`not` are recognised as NAME values rather than
      by the tokenizer, so a trait may still be called "order" or "android".
      Truth is 1 and falsehood is 0, so a condition is still a number.
      **An empty or malformed condition is FALSE**, deliberately: "no condition"
      must never read as "already over", or a mistyped card would end an
      affliction instantly.
    - The condition's scope is the CHARACTER plus the clock facts an affliction
      cares about, all measured from when it began (`ActiveAffliction.at`):
      `full-moons`, `elapsed-days`, `elapsed-hours`, `now`, `applied`. So "until
      the next full moon" is `full-moons >= 1`, "until his blood runs out" is
      `blood <= 0`, and both together join with `or`.
    - **A REAL BUG THIS FOUND, in `buildScope`**: a BARE name the sheet could
      not answer returned `undefined` WITHOUT offering the path to the scope
      extension. So an extension could only ever supply PREFIXED paths, and
      `full-moons >= 1` read as an unknown trait worth 0 - which is to say,
      never true. Bare names now fall through to `extend` as prefixed ones
      always did.
    - **"UNTIL Y" IS ADVISORY AND SAYS SO.** `untilEvent` ("until you next
      attend the voivode") is stored, shown on every listing with
      `⚠ advisory: nothing ends this but [[lift]]`, and deliberately absent from
      `expiryElapsed` - the engine never pretends to decide it.
      `expiryIsAdvisoryOnly` is how a reader tells that case apart.
    - **Four tick points now, all of them lifting through `removeAffliction`**
      (so a mirror goes with its original): rolls (after the dice), the clock
      (`advance-time`), turns (`[[turn]]`) and scenes (`[[end-scene]]`). The
      turn tick also re-checks the timed side, since a turn with a `turnLength`
      moves the clock.
    - 🚧 **COOLDOWN is NOT built.** It is the same shape pointed the other way -
      when may this be applied AGAIN - and wants a per-character "ready at"
      record beside the active list. The expiry model is its substrate; this is
      the next small piece.

66. **`system::time`, and cooldowns as the same shape reversed** (owner: *"We can
    prefix anything relating to time with `system::time`. We already have the
    ability to name dates or use them as literals. Maybe a little function
    `system::time::full-moons-since(date-prev, date-next)` and underneath it, we
    can shorten it to a property that implicitly fills up the date-prev as the
    start of the affliction and the now-date as the date next. And yes,
    cooldowns are the same thing."*).
    - **THE TIME NAMESPACE, exactly as he specified it: two forms of each fact.**
      The general FUNCTION takes any two dates -
      `system:time:full-moons-since(a, b)`, `days-since`, `hours-since` - and
      the PROPERTY is the same thing with the dates filled in implicitly
      (`system:time:full-moons` = since this began, until now). The bare
      shorthands (`full-moons`, `elapsed-days`, `elapsed-hours`) remain, because
      a condition should read like English. One prefix means a chronicle can see
      at a glance which names are the engine's and which are its own traits.
    - **Named dates are first-class arguments**: `system:time:date:<name>` reads
      the DateBook that `[[save-date]]` writes, so *"the full moon after the
      wedding"* is expressible without anyone hard-coding an epoch. That was the
      point of his "we already have the ability to name dates".
    - **A REAL BUG THIS FOUND, in `core/expr.ts`**: `::` is the path separator
      everywhere in the engine and the BOUNDARY normalizer folds it to `:` - but
      an expression inside BACKTICKS skips normalization by design, so
      `system::time::now` tokenized as a DIFFERENT NAME from `system:time:now`
      and simply did not resolve. The tokenizer now folds `::` itself, which is
      where it always belonged: expressions arrive by more routes than commands.
    - **`[[eval]]` now sees the clock too** (time scope + purse scope, read as a
      CONDITION), so an until-condition can be tested before it is written onto
      a card - which is the difference between a language and a guess.
    - **COOLDOWN IS `AfflictionExpiry` POINTED THE OTHER WAY**, and reusing it
      cost almost nothing: same six measures, same four ticks, same arithmetic.
      `ActiveAffliction.cooldown` is the SPEC (armed when the affliction ends,
      wherever it ends - by hand, out of charges, or timed out);
      **`CharacterCooldowns`** (`cool:<char>`) holds what is ARMED. An entry
      exists only while the thing is NOT ready, so absence means ready and
      nothing needs a separate "is it done" flag.
    - `expiryFromArgs(cmd, prefix)` gained a prefix, so every measure works as
      `cooldown-for=`, `cooldown-scenes=`, `` cooldown-until=`…` `` for free -
      one function, both directions.
    - **The cooldown is checked in exactly one place**: `[[afflict]]`, the one
      moment somebody tries to apply the thing again (`waive=true` overrides, as
      everywhere). And `cooldownLeft` SWEEPS as it reads - an elapsed cooldown is
      deleted on the way past, so "ready" needs no tick of its own.
    - `[[afflictions]]` lists what is cooling beside what is active: *"why can't
      I do that again"* is the same question as *"what is on me"*, from the
      other side.

67. **A price of zero is not one fact but several** (owner: *"Instead of paid=0,
    we should have explicit bonuses ... my paid=0 were bonuses given by
    storyteller's discretion. This both says what you paid, for legality
    reasons, but also where did that come from. For example, a storyteller might
    allow you to get a couple flaws, getting more freebies in the process, that
    are beyond your maximum of 7 points of flaws, because everyone in the
    campaign has those flaws ... Also, a ghoul gains a free dot in Potence
    (which sometimes can be Fortitude). That unpaid dot is not Storyteller
    discretion, but it has to do with the template."*).
    - **`paid` says WHAT it cost; `source` says WHY.** §7.50's `paid=0`
      conflated two different facts and the owner named both: a ghoul's free
      Potence dot is *what a ghoul is*, and a Storyteller's bonus is *a ruling
      about this chronicle*. `GRANT_SOURCES` (freebies, arcana, template, clan,
      background, storyteller, experience, maturation) with
      **`CREATION_SOURCES` = freebies + arcana** and `sourceDrawsOnPurse()`:
      everything else is real, costs a creation purse nothing, and the ledger
      prints WHICH source rather than an unexplained zero. `undefined` still
      means "bought normally", so nothing already on a sheet changes meaning.
    - **`CreationGrant`** on the creation budget - the template's free dots, with
      **`choose`** for the ghoul's case exactly: *"1 free dot of Potence or
      Fortitude"*. `TEMPLATE_GHOUL` carries it. **Reported, never auto-applied**:
      which of the two it is belongs to the player, so `[[creation]]` states the
      grant and marks it ✓ once the sheet has it.
    - **`CreationBudget.flawMax` (7)** is the ceiling the owner mentioned, and it
      is data rather than a constant, so a chronicle may move it.
    - **THE STORYTELLER'S RULING IS A PURSE BONUS, RECORDED AS ONE.**
      `PlayableCharacter.purseGrants` - `{purse, points, source, note}` - and
      `budgetsOf` ADDS them to the allowance with the reason attached, so
      `[[budget]]` reads `freebie: 0/18 ... +3 from storyteller: everyone here is
      Suspect`. That is the exact case he described (Flaws past the cap that
      still pay), kept as a stated bonus instead of a silently larger budget.
    - **`[[grant]]`** is one verb with two shapes, because he named two things:
      `[[grant potence source=template]]` marks a purchase as off-purse, and
      `[[grant freebie 3 source=storyteller note=\`…\`]]` adds to a purse.
      `[[forget-grant]]` undoes either. Both round-trip through the sheet card.

68. **When the source is no more** (owner, asking whether Trait Aptitude and
    Trait Expansion could already be arcana with always-on passives, then: *"If
    you lose (temporarily or forever) any arcanum, you have to lose the powers
    granted by it, especially always-on passives ... If the source of this
    affliction is no more, you immediately lose it / you will lose it in T time
    / the duration continues as normal / you apply the following expression to
    its duration. Some of those things could be the same thing in the
    implementation, I don't know."*).
    - **THEY ARE THE SAME THING, and his instinct was right.** An orphan policy
      is **one expression over what is LEFT**, evaluated the moment the source
      goes. All four behaviours are that one code path:
      immediately = `0`; in T = the seconds of T; continues = no policy at all;
      an expression = itself, with `remaining-seconds` and `remaining-rolls` in
      scope. `OrphanPolicy {rolls?, seconds?}`, `makeOrphanPolicy` for the
      shorthands (`immediately`/`at-once`/`now`, `keep`/`continue`/`as-normal`).
      **No policy is the default**, and the default is "carries on" - an
      affliction does not vanish because nobody thought about it.
    - **`orphanAfflictions(subject, sourceKey)` matches `from` BY PREFIX**, so
      dropping `arcanum:trait-affinity` takes `arcanum:trait-affinity:melee`
      with it: the instance key is a path, and losing the arcanum loses every
      trait it was applied to. Fired from `[[drop-merit]]`/`[[drop-arcanum]]`.
    - **`[[afflict … orphan=immediately | keep | \`1 hour\` | \`remaining-seconds / 2\`]]`**
      is the whole surface, and `[[afflictions]]` shows the policy beside the
      source.
    - **ANSWER TO THE ARCANA QUESTION: they already are arcana, not merits.**
      `Trait Affinity` and `Trait Enhancement` ship as `kind: "arcanum"` with the
      exact mechanics he re-described - affinity is `difficulty -1 per point on
      rolls whose pool uses the trait`, enhancement is `enhance +1 per point`
      raising both the effective value and the ceiling while XP still prices
      from the un-enhanced base. Parameterized per trait, stackable across
      traits, priced in arcana points. **NAMING IS UNRESOLVED**: he called them
      *Trait Aptitude* and *Trait Expansion* this time; an earlier message had
      corrected "Aptitude" to "Affinity" (recorded in the roadmap). Left as-is
      and flagged rather than renamed twice.
    - **A LIVE BUG THIS FOUND, in §7.66's own time namespace**: the story clock
      counts **SECONDS** (core/time.ts is explicit), and `elapsed-hours`,
      `hours-since` and the orphan arithmetic all divided or multiplied by
      1000 as though it were milliseconds. `elapsed-hours` was 1000x too small
      and an orphan's "1 hour" became 41 days. Caught by the first test that
      asserted a real interval rather than a boolean - which is the argument for
      testing durations against the clock instead of against themselves.

69. **A power that is simply on, and three docs for the next reader** (owner:
    *"arcana are not merits or flaws. They should not be considered such
    anywhere in our code ... We should have both merits and flaws and Arcanum
    and disciplines with passive powers like potence and fortitude. We should
    have the effect that, when you take any of these, it immediately applies the
    passive affliction ... the reply to all commands that cause afflictions
    would make it clear for the user that the related affliction is now
    applied ... which is using the infrastructure of our event bus."*; plus a
    documentation pass, *"because you keep introducing mistakes, for example
    this one about the time length"*).
    - **`PassiveGrant {afflicts, orphan?, note?}`** on BOTH `MeritFlawDef` and
      `DisciplineDef`. Three categories that are not each other, sharing one
      behaviour: taking the power applies its affliction (`from` =
      `<kind>:<key>`, orphan defaulting to `immediately`), and losing it takes
      the affliction away through §7.68's orphan sweep. Potence grants `potent`,
      Fortitude grants `fortified`, and the two Devil's Due arcana grant
      `trait-aptitude` / `trait-expansion`.
    - **The reply says so**, on every path: `[[set-trait potence 2
      group=discipline]]` answers *"Potent is now applied (from
      discipline:potence)"*, and rating it back to 0 answers *"Potent ends
      with discipline:potence"*.
    - **THE BUS IS NOW CARRYING TRAFFIC.** `affliction:applied` on every
      automatic application, and **every command** on `command` plus
      `command:<verb>` in the §7.63 envelope. Nothing subscribes yet - the
      announcement is the seam, and it exists before anything needs it, which is
      the point of having built the bus first.
    - **NAMING SETTLED**: the owner confirmed the existing names are right, so
      `Trait Affinity` / `Trait Enhancement` stay as the def names and
      `trait-aptitude` / `trait-expansion` are the afflictions they apply.
    - **THREE DOCS, and the reason is a bug I wrote** (the seconds-vs-
      milliseconds error of §7.68, which every earlier time test missed because
      they compared durations against themselves):
      - **`docs/invariants.md`** - the rules that must not break, each recorded
        WITH the commit that found it: units, the two normalizers, the hyphen
        rule, what crosses a wire, the performance rules, the policies that look
        like bugs, the battery, and a symptom → cause table. Written flatly, for
        a reader with no context - **including a less capable model**, which the
        owner asked for explicitly.
      - **`docs/architecture.md`** - what each file is and which one to open,
        the build/dependency order, the load-bearing ideas, and the four
        categories that are NOT each other (Merits/Flaws, Arcana/Taints,
        Disciplines, Backgrounds).
      - README gained a pointer to both, and a section stating the arcana
        distinction in the player-facing voice.
    - 🚧 STILL TO DO from this message: a per-file MD for the remaining modules,
      and an audit of the older `docs/*.md` (the transcribed NovelAI docs are
      fine; the project's own prose has not been re-read end to end).

70. **The event CAUSES it** (owner: *"If we do this command, it should emit an
    event, and someone should use that event to apply the affliction ... Maybe
    we have a subtype of events that happen just inside communications between
    the various parts of the system. We should use one of those to turn on an
    affliction when its source is taken, which must contain data detailing that
    when it is taken, such and such afflictions are applied automatically, or
    that it grants the ability to apply such and such afflictions."*).
    - **THE INVERSION.** §7.69 applied the affliction and THEN announced it,
      which is an event that reports. Now the command publishes
      `local:power:taken` and **a handler does the work** - the thing that knows
      WHEN is no longer the thing that knows HOW. The test that proves it
      removes the handler and asserts nothing happens.
    - **SYSTEM CHANNELS are his "subtype of events"**: `SYSTEM.powerTaken`,
      `.powerLost`, `.afflictionRequested`, `.afflictionLiftRequested`, all under
      the `local:` prefix, so they are internal by construction and can never
      reach the wire (asserted).
    - **A HANDLER MAY NOW DO ASYNC WORK.** `emit` has to stay synchronous - a
      verdict must be readable on the next line - but applying an affliction
      touches storage. So `BusEvent.pending` is an array a handler pushes its
      promise onto, and `PostOffice.publish` awaits them all (collecting
      rejections into `event.errors`). **Verdicts stay synchronous; effects may
      take their time.** This is the piece that makes an event able to CAUSE
      anything at all.
    - **AUTOMATIC vs OFFERED is data**, exactly as he framed it:
      `PassiveGrant.mode` - `automatic` applies the affliction on taking
      (Potence), `offered` grants the ABILITY and waits for **`[[invoke]]`**.
      `togglable` marks an automatic passive the character may switch off:
      **`[[toggle <affliction>]]`** lifts it and switches it back on WITHOUT
      losing the power, finding the source through `passiveSourceFor` (merits,
      arcana and Disciplines in one walk). Potence and Fortitude are togglable.
    - **`registerSystemHandlers()` is a FUNCTION, and idempotent.** Handlers used
      to be bare module-level side effects; a test that silenced one had no way
      to put it back, and it poisoned every later test through the module-level
      `Bus` singleton. A distributed engine will want to say explicitly which
      handlers a script owns, so this is the right shape anyway. **Lesson worth
      keeping: a module-level registration that tests can disturb needs a named,
      re-runnable way back.**

71. **The command reference generates itself** (owner: *"Can you produce a list
    of all the commands we have and what they do ... That's probably achievable
    with a script. I also want to know the help command and what it publishes,
    as well as the targeted help command on each of the commands we have."*).
    - **`scripts/command-reference.ts` -> `docs/commands.md`**, run by
      **`bun run docs:commands`**. It boots the host mock, calls `init()`, walks
      the live `CommandRouter`, and ROUTES `[[help]]` and `[[help <verb>]]` for
      real rather than reconstructing them - so the document shows what a player
      actually sees. **131 commands, 2,714 lines.**
    - Three sections: what bare `[[help]]` publishes; a one-line table of every
      verb; then each verb in full - its grammar, its note, a table of every
      argument (kind, type, required, enum options, description or hint,
      example), and its own `[[help <verb>]]` reply.
    - **A SYNC TEST, like dist/'s** (`test/build.test.ts`): the committed file
      must equal what the script prints. A verb added or renamed without
      regenerating fails the suite. That is the only way a 131-row document
      stays true - **the same bet as the committed single-file build.**
    - Its own bug, caught by reading the output: a pipe must be ESCAPED inside a
      markdown table cell and left ALONE inside a fenced block, and the first
      version escaped once for both - putting backslashes into the usage line a
      reader is meant to copy and type. Two contexts, two forms; `cell()` is now
      the only place that escapes.

72. **An Arcanum is not a Merit — the structural split** (owner, having read the
    generated command reference: *"First wrong thing I see is an arcanum being a
    type of merit or flaw. It is not. Define merit shouldn't be able to define an
    arcanum. I've been trying to say this, but now I can't [not say it]. ... You
    have to create a new thing, a new thing that only some characters might
    have. Just like: disciplines are something just some characters have /
    pillars are something just some characters have / arcana are something that
    just some characters have / merits and flaws are something any character can
    have to a certain extent. ... for it to have it, it has to gain the template
    thrall at least. Anyone can be a thrall of a demon, like a mage, vampire,
    anyone can be. ... for the regular vampire and mage, there should be no
    Arcana in the list of Merits and Flaws. It should be a different list."*).

    He had raised this three times (§7.51, §7.52, §7.53) and each time I gave him
    a conceptual separation - a different `kind`, a different purse, different
    verbs - over a shared `MeritFlawDef` inside a shared `DEFAULT_MERITS_FLAWS`.
    **A shared `kind` field is not a category.** Every vampire and mage who typed
    `[[merits]]` was still being shown Devil's Due Arcana. This time the
    separation is structural, and the old shape is unrepresentable.

    - **TWO TYPES.** `OwnedPowerDef` is now the SHARED MECHANISM ONLY - name,
      points, budget, `perTemplate`, `requires`, `param`, `passive`, `limits`,
      `maxFromTrait`, `grants`. `MeritFlawDef extends OwnedPowerDef {kind:
      "merit"|"flaw"}` and `ArcanumDef extends OwnedPowerDef {kind:
      "arcanum"|"taint"}`. `MERIT_FLAW_KINDS` lost its two arcana kinds to the
      new `ARCANUM_KINDS`. **An arcanum inside `DEFAULT_MERITS_FLAWS` is now a
      type error** - which is the only kind of "must not" that holds.
    - **TWO LISTS, TWO REGISTRIES, TWO CARDS.** `DEFAULT_ARCANA` (Trait Affinity,
      Trait Enhancement, Sharpened Senses, Celestial Radiance) moved out of
      `DEFAULT_MERITS_FLAWS`. `OwnedPowerRegistry<T>` is the shared class;
      `MeritFlawRegistry` (`srd:merits-flaws`) and `ArcanumRegistry`
      (`srd:arcana`, a new seeded SRD category) are its two instances. A block
      in the wrong card is **skipped and REPORTED with where it belongs** -
      the old reader filed it as a merit.
    - **TWO BUCKETS ON THE SHEET.** `PlayableCharacter.arcana?:
      Record<string, number>`, absent on the (vast majority of) sheets with
      none. The card already wrote an `arcana:` block; it now reads back into
      its own bucket. **`migratePowerBuckets()` runs in `CharacterStore.load`
      AND `characterFromCard`**, so a sheet written before the split moves its
      arcana across on the way out and nobody re-enters a character.
    - **`PowerFamily<T>` in `game.ts`** is the descriptor the handlers take:
      kinds, registry, category, card entry, bucket accessors, instance walk,
      verb names, the capability gate, the card header, and `other()`. Every
      verb is `defineOwnedPower(cmd, MERIT_FAMILY)` or `(cmd, ARCANUM_FAMILY)`.
      **`[[define-merit]]` cannot define an arcanum because it is holding a
      family whose `kinds` do not contain one** - not a check it might forget.
      Every refusal names the other verb, so no dead end is ever reached.
    - **THREE WALKS, and picking one is not a style choice.**
      `ownedMeritInstances` (the Merits report - never arcana),
      `ownedArcanumInstances` (the Arcana report - never merits),
      `ownedPowerInstances` (MECHANISM: passive roll ops, the purse ledger,
      `passiveSourceFor`, instance-limit breaches - a machine that must look at
      everything the character owns). `resolveMeritInstance` became
      **`resolvePowerInstance<T>`, generic in the def type**, so a caller cannot
      ask a registry for something it does not hold without saying so.
    - **WHO HAS THE LIST AT ALL is a CAPABILITY, not a template list.** His
      ruling is that any splat may acquire it, so `ARCANA_CAPABILITY`
      (`"arcana"`) joins `CAPABILITIES` beside `awakened`/`vitae`/`resolve`;
      `thrall`, `demon` and `ouroboros` carry it. A character without it is told
      **he has no Arcana at all** - not shown an empty list - and
      `[[attune arcana]]` opens it for a chronicle that says otherwise
      (`waive=true` for one purchase). Capabilities were built for "holding a
      pool is not being able to spend it"; this is the same idea one level up,
      and it needed no new mechanism.
    - **`[[arcana]]` now means what `[[merits]]` means** - what this character
      owns - and `[[arcanum]]` what `[[merit]]` means: the definitions. Bare
      `[[arcana]]` on a vampire is the "you have none at all" message.
      `[[sheet]]` grew an `Arcana/Taints:` line, shown only when there are any.
      `PASSIVE_AFFLICTIONS`, `applyPassiveGrant` and the orphan sweep now use
      the def's OWN kind for the source key (`arcanum:x`, `taint:x`, `flaw:x`),
      and `dropOwnedPower` sweeps every kind its family holds.
    - **`ConstraintDomain` gained `arcanum`** and `OwnedTraits` an `arcana`
      list, so a constraint written over a merit cannot catch an arcanum (it
      would have, before, because they shared a bucket) and one written over an
      arcanum finds it. `any` still searches everything.
    - The parallel he drew is recorded in `docs/architecture.md`'s table:
      **Pillars are the same kind of thing** - a category belonging to mages.
      They are not modelled as owned powers yet (they are rated traits the
      fellowship names), and when they are, `PowerFamily` is the shape.


73. **One way to look at anything** (owner: *"All of our commands that just show
    things on screen, just list things for the player, the result of all of those
    should be something that, with the markers, will be removed from context by
    default. The player can overwrite this default by appending an argument
    `in-story=true`. These commands should all start with 'show'. For example,
    show-merit. We should then have a name argument for the merit and then a
    scope as a 'in' or 'from' or whatever argument. If the name is '@all' it
    means show all merits. As for scopes, we have: the campaign / any character,
    identifiable by name / the current character being played / a template. I
    think these are all the instances of scopes, but do correct me if I'm
    wrong."*).

    Forty verbs only reported, and they had arrived one at a time: `merits` vs
    `merit`, `scenes` vs `scene-info`, `arcana` vs `arcanum`, `list-rolls` vs
    `roll-info`. **The singular/plural split was a SCOPE distinction nobody had
    declared** - `merit` meant "what the chronicle defines", `merits` meant "what
    this character owns". Two names for one question asked of two places.

    - **THE NAME IS THE POLICY.** `isQuietVerb` reads the `show-` prefix, so a
      listing is hidden from the AI's context BY BEING CALLED THAT. The old
      `QUIET_VERBS` set was a hand-maintained register that new verbs kept being
      forgotten from; what is left in it is the two read-only verbs that are not
      listings (`flush-context`, `convert-cards`). A deprecated alias is as quiet
      as the verb that replaced it.
    - **`in-story=true` is context ONLY** (his ruling when asked): it strips the
      ctx-skip marker and leaves `stopGeneration` alone. Looking something up is
      still not an action, so the reply sits in the story and is read on the NEXT
      generation rather than prompting one now.
    - **SEVEN SCOPES, not four.** His four were right; three more exist in this
      codebase and are not reducible to a template, which he asked to be
      corrected on: **clan** and **fellowship** are CHOICES (§7.54) that
      exclusive merits gate on - `in=clan::nosferatu` answers "what may a
      Nosferatu take", which was previously unaskable - plus **scene** and
      **player**. A bare name is resolved character -> template -> clan ->
      fellowship -> scene -> player; a name meaning two things REPORTS the
      collision and names both `kind::name` forms rather than guessing.
    - **The scope actually FILTERS.** `openToScope` re-uses the gate
      `[[take-merit]]` enforces at the door (`requires.templates`,
      `requires.choices` with clan-family matching, `meritCostFor` availability),
      and a family with a capability requirement answers "a vampire has no Arcana
      at all" for a template scope, not a catalogue he can never buy from.
      Advisory, like everything creation-side.
    - **`SHOW_SUBJECTS` is one table** (the same bet as `PowerFamily`, §7.72):
      declaring a subject registers the verb, its `name`/`in`/`in-story` params
      and the deprecation pointer on every old name it replaces. A test walks
      the registry and fails if any show verb is missing a knob or any
      deprecation points at an unregistered verb. `render` mostly DELEGATES to
      the handler that already existed - this is a re-naming and re-scoping pass,
      not a rewrite of thirty reports (eight handlers grew an optional
      `forChar` so a show verb can ask them about somebody else).
    - **`CommandSpec.deprecated`** + `CommandRouter.deprecate()`: old names route
      exactly as before and `route()` appends "⚠ [[merits]] is now
      [[show-merit]]" from ONE place, so a deprecation cannot be declared without
      the pointer. They are hidden from `[[show-help]]` and filed in their own
      section of `docs/commands.md` - except `help` itself, which stays visible
      because it is what a player who knows nothing else types.
    - **`@all` had to be RESERVED.** `@` is the alias sigil, so an alias named
      "all" would shadow the wildcard on every listing; `parseAliasToken` refuses
      it, and `[[alias @all …]]` says so at the door.
    - 93 stale `[[old-verb]]` pointers inside reply text were rewritten to the
      current names, and `PowerFamily.verbs.list/info` now name the show verbs.


74. **The flag, generalized** (owner, four things at once: *"Do we currently have
    a command to show in-game time? / We should consider this `in-story` thing as
    valid for all commands. Some commands have this as true by default, others as
    default false. / Any Boolean argument to a command should be considered true
    if it has no value. For example, `[[... in-story]]` means `in-story=true`. /
    `help` commands are the exception to this 'show-<thing>' we just implemented.
    `[[help]]` and its more specific cases are not deprecated. `[[show-help]]`
    can be an alias, I guess."*).

    1. **YES** - `[[show-date]]` (§7.73's merge of `story-date` + `dates`) prints
       the in-game date AND time to the minute, elapsed-since-start, the next
       full moon, and every bookmark. No new verb needed.
    2. **`in-story` IS UNIVERSAL, AND RUNS BOTH WAYS.** `CommandRouter.register`
       attaches `IN_STORY_PARAM` to EVERY spec - declaring it 130 times would be
       130 chances to forget, and a knob missing from its spec does not exist.
       `wantsInStory` is now a three-step resolver: what the player said on this
       call → `CommandSpec.inStory` (a verb whose default is not what its name
       implies) → `!isQuietVerb`. So `[[show-sheet in-story]]` shows a listing to
       the AI and **`[[roll stealth in-story=false]]` is a roll behind the
       Storyteller's screen** - the second direction did not exist before and is
       the more interesting one. It still does NOT touch `stopGeneration`
       (§7.73's ruling stands).
    3. **A FLAG WITH NO VALUE CAN ONLY MEAN ONE THING.** New `ParamType "bool"`,
       and `promoteBareFlags` turns a bare positional matching a declared flag
       into `key=true`. **Placed in `CommandRouter.parse`, not `CommandParser`**:
       the parser is spec-agnostic by design (it only tokenizes), and the router
       is the layer that knows what a verb declares. `processAdventureInput` was
       switched to `CommandRouter.parse` so the promotion is identical on both
       paths. `readBool` accepts true/yes/y/on/1 and false/no/n/off/0, and
       **returns `undefined` for anything else - a mistyped flag reads as ABSENT,
       never as false**, so a typo cannot silently mean "no". Only an exact match
       on a declared bool is promoted, so `[[show-merit iron-will]]` keeps its
       name. Every param whose whole vocabulary was `["true"]` or
       `["true","false"]` (waive, extended, ongoing, pay, add, default, set,
       awakened, has-virtues) became a `bool`, and the six hand-rolled
       `=== "true"` comparisons scattered through game.ts became `flagOf`.
       Help renders a flag BARE when optional and `key=true|false` when required
       (creator-mode's `set` must teach both directions); windows render one as
       a three-way selector - true / false / (default).
    4. **`[[help]]` KEEPS ITS NAME.** §7.73 renamed it to `show-help` and left
       `help` as a visible alias, which was backwards: help is the one command a
       player types before they know anything at all, in this engine and every
       other. It is no longer deprecated, it is listed in `QUIET_VERBS` (having
       no `show-` prefix to be quiet by), and **`show-help` is registered as the
       alias** for players who now reasonably guess it. The 93-pointer sweep of
       §7.73 had rewritten `[[help]]` to `[[show-help]]` in reply prose; that
       part is reverted.


75. **The rulebook is not the story; a contest is a field** (owner: *"Yes, flip
    the define/forget family to in-story=false by default if they write to
    Lorebook entries. They do, right? // Also, do we have a way to roll a contest
    with more than 2 participants? We must."*).

    **(a) THEY DO - and I checked rather than remembered.** A probe script spied
    on `api.v1.lorebook.create/updateEntry` and ran every define/forget verb:
    all nine `define-*` and six `forget-*` definition verbs write a card; four
    (`forget-alias`, `forget-date`, `forget-scene`, `forget-roll`) and both table
    aliases touch only storage; and TWO - `forget-specialty`, `forget-grant` -
    write a lorebook entry that is the CHARACTER SHEET, via
    `CharacterStore.save`'s write-through.
    So the line is not "writes a lorebook entry" (that would sweep in every
    `set-trait`) but **writes a DEFINITION CARD**: the chronicle's rulebook.
    Those 16 verbs plus the two table aliases (storage-only, but the same act -
    naming a thing for the chronicle to reuse) declare **`inStory: false`**, so
    "Defined merit X" stops costing context. `forget-specialty`/`forget-grant`
    are deliberately LEFT in-story: their siblings `[[specialty]]`/`[[grant]]`
    are in-story, and splitting a pair would be incoherent - a thing that happens
    to a character is something the Storyteller should see.

    **(b) NO, WE DID NOT - contests were hard-wired to two.** `aNet`/`bNet`,
    `winner: "a"|"b"|"none"`, `ExtendedContest {a, b}`, `applyContestRound(c,
    aExec, bExec)`. Two men wrestling is one shape a contest takes; three thieves
    reaching for the same purse is another, and only the arithmetic was fixed.
    - **`compareField(mode, entrants[])` is now the primitive**, and
      `compareRolls(mode, a, b)` is the field of two implemented in terms of it,
      so there is ONE adjudication. `FieldOutcome` carries ranked `standings`,
      `winners[]` (several = a tie) and `margin` over the runner-up.
      `ContestOutcome` keeps its two-sided shape and gains `.field`.
    - **Equal nets SHARE a rank**: a three-way tie at the top is three winners
      and the next man is FOURTH. That is the thing a two-sided comparison had no
      way to express.
    - **Resisted generalizes to "beat the BEST of them"** - it only takes one to
      stop you - and says `best of N` when there is more than one.
    - **`ExtendedContest.sides: ContestSide[]`**, `status` is a winner's NAME
      (or `CONTEST_OPEN`/`CONTEST_DRAW`), `log` entries carry
      `nets: Record<name, number>`. `applyContestRound(c, execs[])`.
      **Under `on-botch=fail` a botcher is now REMOVED and the rest carry on** -
      with two sides that could only ever end the contest, so the old reading is
      the special case. `migrateContest` reads the old `{a, b}` shape and
      `ExtendedContestStore.load` calls it, so a race started before this still
      runs.
    - **Command surface, backwards compatible:** `vs=` takes a comma list
      (`vs="Erik,Rok,Sigrid"`); they all roll the second positional pool, or
      **`vs-pool="a,b,c"`** gives each its own (one entry = all of them). Naming
      the same side twice is refused as the typo it is. A success table still
      reads the ACTOR's margin - the field only changes who he had to beat.
    - The reply now NAMES the winner ("The Opposition wins by 2") rather than
      phrasing it from the actor's view ("loses by 2"), because with three in the
      field the actor's view is not enough to say who took it.


76. **A trait knows what KIND of trait it is** (owner: *"Do we have a window to
    define a merit? Simple merits should be able to define the passive affliction
    they grant. Also, do we have Talents, Skills, and Knowledges separate in
    character? Physical, Social, and Mental Attributes? We should. For one
    because of the primary, secondary, and tertiary thing in budgets, but also
    because an arcanum, merit or flaw, or something else entirely might say
    something like 'pick a knowledge. You have so and so bonus in that
    knowledge,' or 'All talents are blah blah.'"*).

    Answers first: **no window** (win-constraint/table/affliction/afflict/roll
    existed, no win-merit), **no `grants=`** (only the shipped built-ins could
    apply an affliction), and the categories **existed as data but nothing could
    ask**: `ATTRIBUTES` groups the nine, `Category` in core/traits.ts names all
    six, `srd:abilities` holds three lists, and `categoryTraits()` in game.ts
    used them - but only for the creation report, and only ASYNC.

    - **`AbilityCategories`** caches the chronicle's three lists at `init()`,
      because every consumer is SYNCHRONOUS: a passive gated on "any Knowledge"
      is judged inside a roll and a roll must not await the lorebook.
      Never-loaded falls back to the shipped lists (now `DEFAULT_TALENTS` etc.,
      which the SRD seed itself is built from, so card and fallback cannot
      drift). `traitCategoryOf(name)` is the one answer; `singularCategory`
      accepts both spellings because a card writes "Knowledges" and a pick reads
      "a Knowledge".
    - **Three things can now name a category**, which is the whole ask:
      `EffectOp.trait` (via `poolUsesTrait` - "-2 on every Knowledge" is ONE op,
      not ten), `InstanceLimit.perKind` (via `traitKindsOf`, which returns kind
      AND category, so `attribute:1` and `knowledge:1` both work), and the new
      **`MeritFlawDef.paramFrom`** - "pick a Knowledge" refuses a Skill at take
      time, names what the value actually is, LISTS the valid choices, and is
      waivable like every creation-side check.
    - **The sheet and the card group by category.** `[[show-sheet]]` reads
      "Physical: … | Social: … | Mental: …" and "Talent: … | Skill: … |
      Knowledge: …"; `characterToCard` nests Attributes and Abilities under their
      category. **The reader takes EITHER shape** (a category is recognised by
      name, and only when the value is a block, so a rating carrying `paid` or a
      `specialty` is never mistaken for one), so a hand-written flat card still
      loads. A trait no list names goes under **Other** rather than being
      dropped.
    - **`grants=` on define-merit / define-arcanum**, with `grants-mode`,
      `grants-togglable`, `grants-orphan`. If the affliction does not exist it is
      DEFINED as part of the same command - "a simple merit is one command, not
      two" - and the reply says so. It gets **no tags**: a tag is something a
      roll carries, and one nobody wrote a modifier for is reported as
      `[unknown tag: …]` on every subsequent roll (caught in the live smoke).
    - **`[[win-merit]]` and `[[win-arcanum]]`**, both `openCommandWindow` over
      the define specs with a picker over the defined afflictions - so every knob
      added to the verb appears in the form for free.

    **THE BUG THIS PASS FOUND, worth an invariant:** `grants` was set on the def,
    written to the lorebook card, and LOST on the way back, because
    `ownedPowerFromCard` had never been taught to read it. A definition
    round-trips through its card, so **a field the reader does not know does not
    exist** - the same class of mistake as a knob missing from its CommandSpec.
    Now in docs/invariants.md §7.


77. **One affliction most merits want** (owner: *"Do we have the affliction that
    Trait Affinity grants? It could be reused for so many merits and flaws. ...
    This should be called 'difficulty-bonus' (is that a good name? The opposite
    would be 'difficulty-penalty'. We could perhaps have a 'difficulty-modifier'
    and mean both?) ... I think it would be another affliction if it requires a
    tag, right? ... Maybe this could be a difficulty-bonus-tags? I don't know.
    I'm making this distinction because I'm thinking about how we might cache all
    of this, but maybe it's not necessary. Maybe it could just be a field in
    difficulty-bonus/modifier. Yes, it would work the same way."*).

    **The affliction existed and was WORTHLESS to reuse.** `trait-aptitude` was a
    name, a description and a tag - nothing else. The actual "-1 per level" lived
    in Trait Affinity's own `passive` EffectOp, so a second merit reusing the
    affliction would have inherited a label and no rule. `AfflictionDef` could
    only carry ops through `tiers`, which need a rating to scale against.

    - **`AfflictionDef.apply: EffectOp[]`** - what it DOES while it is on, judged
      by the same two gates a passive uses. Plus the two things a passive cannot
      have: **`$binding` substitution** (`trait: "$trait"` reads the instance's
      own binding) and **`ActiveAffliction.level`** scaling. Those two are the
      whole reason ONE definition serves every rated merit in the book.
    - **HIS NAMING QUESTION, answered: ONE signed thing.** Not a
      bonus/penalty pair. In this system a LOWER difficulty is better, so
      "difficulty-bonus" would carry a NEGATIVE number and the name would fight
      the sign at every reading. `difficulty-modifier`, signed, and the reports
      say "(easier)"/"(harder)" so nobody holds the convention in their head.
    - **HIS TAG QUESTION, answered as he guessed: a FIELD.** `trait` and `tags`
      are two independent optional conditions on the same op; a second affliction
      would double the surface to say the same thing. And it is not a caching
      concern - the gates are evaluated per roll from data already in hand.
      Crack Driver is `trait=ride tags=reckless level=2`, and it works.
    - **A CATEGORY in the trait gate** (§7.76) means "-1 on all Talents" is one
      instance; `trait=all` is how an instance says "no trait gate at all".
    - **Trait Affinity now USES the rule instead of owning one.** Its `passive`
      is GONE - keeping both would apply the effect twice, which the suite caught
      immediately - and `PassiveGrant` gained **`binds`/`level`** (`$param`,
      `$rating`) so the grant fills the affliction from the instance that carries
      it. It buys what a passive never had: the effect is a STATE, so it can be
      lifted, toggled, given an expiry, or inflicted by a spell or a botch.
    - **INSTANCE IDENTITY had to change.** `CharacterAfflictions.afflict`
      replaced by def NAME, which for a shared affliction means the second merit
      to apply it silently deletes the first one's effect. An instance is now
      def + bindings + `from` (`instanceKey`); an affliction with neither
      binding nor source is still one-of, exactly as before.
    - **A consumed tag is not "unknown".** `resolveSpec` gained `usedTags`:
      reporting `[unknown tag: reckless]` on the very roll where an affliction
      gated on `reckless` tells the player their tag did nothing when it did the
      whole job.
    - `[[define-affliction apply=...]]` (same shorthand as a merit passive) and
      `[[afflict ... level=N]]` make all of it authorable; the card reader learned
      `apply` too, per §7's invariant.


## 8. Roadmap — NOT yet implemented (with the user's requirements)

Ordered roughly by unlock value:

1. **Turn/time system** — the biggest unlock. The **story clock** (§7.30) AND
   **Scenes + turn-length** (§7.31: `Scene`/`SceneStore` + `scene`/`turn`/
   `end-scene`/`downtime`/`scenes`) are now BUILT — the real-calendar substrate
   and the named unit of play (combat marches the clock in 3-second turns; a
   freeform scene counts turns without moving it) — and **recovery rules are
   the FIRST thing the clock enforces** (§7.33: advance-time credits
   per-day/per-full-moon refills). LEFT: making advancing time ENFORCE the
   rest of what is advisory today — effect durations, cooldowns, uses-per-scene
   (from the existing `EffectUses` ledger), boost expiry, `Pool.perTurnLimit`
   (blood/Living-Resolve per turn — field exists, surfaced, unenforced),
   extended-roll interval spacing, willpower-per-turn, and auto-`advance` of
   affliction chains (merging the affliction stepper `[[advance]]` with
   `[[advance-time]]`); and the Chapter/Story/Chronicle hierarchy above Scene
   (light labels for now).
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
5. **Allocation + creation budgets** — the BUDGET is **shipped** (§7.54:
   `CreationBudget` per template, `creationBudgetFor` stacking them, the
   priority pools, per-trait `TraitLimit`s, the freebie table, `[[creation]]` /
   `[[choose]]`), and so are the **derived values** and the **expression
   language** that let a ceiling be a consequence (§7.55: Road, Willpower,
   generation → trait maxima). LEFT: **spending** through it — nothing
   decrements a pool, so `[[creation]]` counts what the sheet holds instead of
   gating what may be bought; **freebie arithmetic** (the `[[costs]]` values are
   still text, so nobody multiplies "current x 2" — but `Numeric` + the
   evaluator are now the obvious home for it, and §7.60 moved the two prices
   that matter onto the PURSE itself: `BudgetDef.freebie` / `.experience`, per
   template, with `NOT_PURCHASABLE` already a rule the engine reads); the
   **XP engine** the same table waits for; **🚧 MATURATION** — the third Dark
   Ages purse, spent in downtime — which §7.60 deliberately left OFF a budget
   at the owner's instruction: `DEFAULT_ADVANCEMENT_COSTS` keeps its column,
   `[[costs]]` shows it, and `BudgetDef` grows a `maturation` price when there
   is a downtime engine to spend it; the **creation WIZARD** (the wizard engine exists —
   this is a script over it); and the starting-blood die. **Constraint groups**
   (§7.17) exist as data + `[[check-constraints]]`; creation is where they would
   become enforced (block/allow backgrounds & merits/flaws) instead of advisory.
   ALL OPT-IN stays sacred — play-before-allocating is untouched.
   **The three passes §7.55 was designed for:**
   - **Modifying a template — SHIPPED** (§7.58): `TemplateDef` + the
     `wod:config:templates` card + `TemplateRegistry` overlay + `[[templates]]`
     / `[[extend-template]]` / `[[forget-template]]`.
   - **Extending a template, budgets included — SHIPPED** (§7.58 for the shape,
     §7.60 for the budgets): purses merge field by field (allowance and both
     prices separately), the creation pools are settable one at a time, and
     `[[extend-template]]` EDITS the def in force rather than rebuilding it.
     `TemplateConfig.Derived` merges the same way (last name wins).
   - **The legality proof** ("what was the budget, and where did it go" —
     including unassigned points): the pieces exist. `purseScope` exposes
     `budget:`/`spent:`/`left:` to any expression, `ExprResult.terms` already
     carries the provenance trace, and `[[creation]]` already flags `⚠ over` and
     `⚠ uncounted`. A `[[legality]]` verb is a REPORT over those, not new
     machinery: unspent = `left:X > 0`, overspent = `left:X < 0`, over-ceiling =
     the existing check per bucket.
6. **Template choices** — **shipped for clans and fellowships** (§7.54:
   `CLANS` with their Disciplines and `TraitLimit`s, all six `FELLOWSHIPS`,
   `PlayableCharacter.choices`, `[[choose]]`/`[[clans]]`, and
   `MeritFlawRequirements.choices` as the exclusivity gate). §7.60 added the
   MECHANISM for the other two — `GHOUL_FAMILIES` / `REVENANT_FAMILIES` are
   real registries wired into `affinityDisciplines` and `[[choose
   ghoul-family|revenant-family]]` — but they are **EMPTY**: no Dark Ages
   bloodline is transcribed yet, and a template's own `disciplines` list
   (`mode: "replace"`) covers for them meanwhile. LEFT: **the family DATA**; a clan/
   fellowship owning **constraint groups via `scope`**; allowed roads/morality
   per clan; and making a choice a **generic data atom** a template-definer
   window could edit, instead of two hard-coded records in rules.ts.
7. **Sorcerer Paths** (static magic) + the "other powers". The **Dark Ages:
   Mage casting PROCEDURE is SHIPPED** (§7.33: `[[cast]]`/`[[seal-spell]]`,
   simple/complex/extended/ongoing, Quintessence, retries, the cap knob), as are
   the **places of power** (§7.35: rating-scaled sanctum/library, the cray as a
   real drainable site, the Talisman door).
   LEFT: Sorcerer Paths; **Backlash systems** (a botch prints the stub note, and
   the sanctum's immunity is real, but nothing is rolled); Foundation/Pillars as
   MODELLED powers (ratings are free `traits`-bucket entries; FELLOWSHIPS names
   them but validates nothing); per-interval Quintessence on
   `[[continue-roll]]` for extended castings (the launch interval takes it;
   later intervals need `spend=` by hand); retry-ledger recording for
   multi-interval castings; the Library's experience-cost benefit (needs the XP
   engine, #5); and spell EFFECTS (what a spell does is still narration/ST —
   the effect grammar's open vocabulary is the seam).
   **Items / Talismans** are their own deferred atom: `[[measure-door]]` ships
   the one Talisman as a command (asked; chosen over building a general item
   registry now). A real system would own possession, attunement, rituals and
   effects — and `[[measure-door]]` becomes its first entry.
   **§7.60 answered half of it early**: an object that GRANTS a pool is still
   deferred, but *who can use one* is settled — `ResourceDef.requires` vs
   template/sheet `capabilities`, with `[[attune]]` as the sheet-level grant an
   item system will drive.
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
15. **The Storyteller loop itself** — its FIRST piece now exists (§7.31 Pass B):
    the engine registers an **`onResponse`** hook that strips the AI's `<hide>`
    blocks from generated narration and mirrors the active scene's plan into the
    **Author's Note** (`api.v1.an`) — the first time the engine reads/writes the
    generation surface (`an`/`systemPrompt`/`prefill` + the generation hooks, all
    mocked in host-mock.ts). LEFT: `api.v1.generate`/`generateWithStory` narration
    (the `generateWithStory` specialty/distance asks §7.23/§7.28 wait on this),
    **`systemPrompt.set` + `onContextBuilt` injection** of the speaker scheme +
    current scene/date (the "engine owns the system prompt" pass — the user's
    prompt shrinks to the creative parts), `prefill`, UI panels, token budgets.
    The reason the project exists; everything above serves it.
16. Old `RulesetConfig` XP/freebie numbers → replaced by the real cost engine
    (5); creation-cap enforcement in `Stat` is partially unused until then.

16. **RESOURCE CAPS AS A GENERAL MECHANISM** (owner, 2026-07-31 — the design is
    stated, the build is not started). Today two ladders are hard-coded to two
    Backgrounds: Quintessence's capacity reads `background:fount`, blood's reads
    `generation`. **Neither the Background nor the numbers should be baked in.**
    What he wants is one general way to say:
    - *these things set the MAXIMUM of this resource* (expression or table);
    - *these things set the MOST THAT MAY BE SPENT IN ONE TURN* (ditto);
    - *these afflictions (on a character) and tags (on a roll) modify both*,
      each with its own expression or table.

    His preferred notation, verbatim:
    ```
    Quintessence:
        max: 10 + Backgrounds::Fount * 2
        per-turn: 1 + Backgrounds::Fount

    override Resources::Quintessence
        max: super::max - Background::whatever
        // per-turn can remain the same
    ```
    Two things the engine does not have yet: **`Backgrounds::Fount`** (the `::`
    path form over the existing `background:fount`, which the normalizer already
    folds `::` → `:` for, so this is nearly free) and **`super::max`** — an
    override that is written in terms of *the value it overrides*. `super::` is
    the real new idea: it needs the resolver to keep the shadowed layer
    reachable while evaluating the shadowing one.

    **Per-turn is a TURN limit, not a per-roll one.** Owner's ruling for now:
    **one roll counts as one turn**; the turn system (#1) is what will make the
    distinction real.
    **Foundation limits WILLPOWER usage** (not Resolve) — already how
    `uncancelableAllowance` works. **Vitae per turn is limited by generation**,
    already expressed as `blood-per-turn(generation)`; that function is the
    hard-coded table this item would replace with data.

    **Recalculation model** (his words): these are *"calculated once,
    synchronized when creator-mode is toggled on and off, when an update command
    is called"* — and *"this path will eventually be deprecated, when we do what
    I have in mind: event bus"*. So: a cache with explicit invalidation now, an
    **event bus** later. Today every read is live through `resourceNumbers`,
    which is correct but recomputes; the cache is the optimisation this item
    buys, not a behaviour change.

17. **BACKGROUNDS IN DICE POOLS** (owner, 2026-07-31): *"Backgrounds must have
    levels, and they can be part of a dice pool. For example, there's a roll
    that rolls against Library. There's another that rolls Library plus
    Intelligence."* `[[roll intelligence+library]]` **already works** —
    `characterRollEnv`'s resolver goes through `traitValueOf`, which reads the
    backgrounds bucket — so what is left is the *difficulty* side (`vs library`,
    a roll whose TARGET is a Background rating) and confirming the seeded
    Background set carries the levels each one needs. Verify before building.

18. **EVERY TEMPLATE HAVING WILLPOWER IS AN ASSUMPTION** (owner: *"it's not
    entirely true that all things have willpower. In the worst-case scenario, we
    should be able to drop willpower, having no resource"*). Every shipped
    template calls `willpowerResource(n)`; a template with **no resources at
    all** must be expressible. Mostly a matter of letting a `TemplateDef` SUBTRACT
    a parent's resource (there is `replaces`, which hides one behind another, but
    no "remove"), plus auditing the readers that assume a `willpower` role exists
    (`[[cast]]`'s seal cost, `uncancelableAllowance`, `[[lift spend=willpower]]`).

19. **LOREBOOK ENTRIES FOR THE CONCEPTS** (owner): `Resolve`, `Willpower`,
    `Quintessence` and the rest as lorebook cards **whose keys are capitalized**
    (`Resolve`, not `resolve`) — prose that BOTH the player and the AI read, so
    the Storyteller knows what the substance means, not just what it costs. Note
    this cuts against the engine's normalize-everything boundary rule: these keys
    are display text on purpose.

20. **WHICH ROLLS ACCEPT WHICH RESOURCE** (owner, thinking aloud: *"If a roll
    accepts that resource or not is probably a matter of tags, with Willpower
    being accepted by default, and needing a tag to say it isn't"*). The
    machinery exists — `EffectOp.target` already gates an op on a roll tag — but
    nothing yet refuses the SPEND itself. Default-yes-for-Willpower with an
    opt-out tag is the stated shape.

21. **A RESOURCE LEDGER, PER CHARACTER** (owner: *"we should keep track of the
    resources spent and recovered now that we have access to time"* — then,
    correcting me: *"Resource ledger should not live in the story. It is part of
    each character in the story"*). Every spend/gain stamped with the story date,
    so "how much Quintessence did he burn this week" is answerable and the
    per-turn limit has something to enforce against. **It belongs to the
    character, not to the chronicle**: the same shape as `res:<char>` (the live
    values) rather than a story-wide log, so it moves, copies and is forgotten
    WITH the sheet. `EffectUses` is the precedent (a per-scene counter keyed by
    character); this is its grown-up form.

22. **LIVING RESOLVE MUST NOT BE IN THE RULES** (owner: *"Living Resolve is
    unique to this game, and it shouldn't be in the rules. I should be able to
    create Living Resolve, not hard coded at all. We should have flexible
    resources, and we should hard code only the ones that we actually know about
    and that are canon in the World of Darkness rules"*). `LIVING_RESOLVE` and
    `DEFAULT_TEMPLATE_DEFS`' Ouroboros both live in `rules.ts` today. Everything
    needed to build them from commands already exists (`[[define-resource]]` +
    `[[extend-template]]`); the work is **moving them out** into the chronicle's
    own cards and proving the round trip, so `rules.ts` ships only canon.

23. **THE EVENT BUS, AND SPLITTING THE SCRIPT ACROSS SCRIPTS** (owner,
    2026-07-31: *"What messages will allow us to do is to distribute the script.
    We will have a bus, an event bus, and that event bus will send events as
    messages in. I think that will make our architecture more understandable for
    both of us"*). **The API is documented and vendored already** — no research
    needed: `docs/api-reference.md` §api.v1.messaging (lines ~3157-3327) and the
    types at ~8744, with real typings in `types/novelai/script-types.d.ts`
    (~2756), so it compiles under the standalone artifact check.

    Four calls, and that is the whole surface:
    ```ts
    api.v1.messaging.send(toScriptId, data, channel?)   // one script
    api.v1.messaging.broadcast(data, channel?)          // ALL OTHERS
    api.v1.messaging.onMessage(cb, {fromScriptId?, channel?}) -> subIndex
    api.v1.messaging.unsubscribe(subIndex)
    ```
    `ScriptMessage = {fromScriptId, toScriptId?, channel?, data: any,
    timestamp: number}` — a usable event envelope as-is, timestamp included.

    **Four things that shape the design, all from the docs:**
    - **`broadcast` explicitly excludes the sender.** A script never hears its
      own events. So messaging is the DISTRIBUTION mechanism, not an in-process
      emitter: an internal bus still needs a plain synchronous emitter beside it,
      and the messaging layer is what carries events ACROSS scripts. Conflating
      the two would produce a bus that silently drops every local event.
    - **Filtering is only `fromScriptId` and `channel`** — no topic patterns. So
      either one channel per event family, or the topic rides inside `data` and
      handlers filter themselves.
    - **`data` is serialized.** Only plain data crosses: no functions, no class
      instances. `TemplateConfig` has methods (`GetPool`, `CannotUse`) and
      `DamageReaction` is a class — those must be rebuilt on the far side from
      their defs, which is exactly why §7.58 made templates DATA. The
      already-data-shaped layers (`TemplateDef`, `ResourceDef`, `SavedRoll`, the
      card text format) are the ones that can cross a wire unchanged.
    - **Nothing is documented about ordering, delivery guarantees or failure.**
      For a rules engine whose backbone this would be, that is the risk to probe
      first with a throwaway two-script experiment before committing.

    **The bus itself SHIPPED in §7.62** (`core/bus.ts` + `PostOffice`, with the
    messaging mock and `scripts/probe-messaging.ts`). What is LEFT of this item:
    running the probe on-host to learn what messaging actually guarantees, and
    then **adopting** the bus — nothing in the engine publishes to it yet, by
    design. The obvious first publishers are the ones the owner has already
    asked for: the per-character resource ledger (#21) as a `monitor` handler,
    and the recalculation cache (#16), whose invalidation is what an event bus
    is FOR.

24. **DO THE WORK WHILE THE PLAYER IS READING** (owner, 2026-07-31: *"a lot of
    the script is asynchronous due to the nature of the NovelAI Scripting API.
    On a smaller, more budget-oriented device it doesn't run so well ... it gets
    word-per-second laggy when I play on my cell phone with too much other stuff
    open. We should find a way to set timers and try to do most of the work when
    the user is thinking, reading the story"* - and, explicitly, *"that's for the
    future ... We should think about it only insofar as whether what we are
    doing contributes or hinders this final objective"*). NOT BUILT. Measured,
    so the future pass starts from numbers instead of guesses.

    **The hooks that bracket a generation already exist**: `onGenerationRequested`
    (*"the first hook that triggers when a user generates text ... context has
    not yet been built"*) and `onGenerationEnd` (*"the generation is fully
    finished, the editor is unlocked, and generation is no longer blocked"*) -
    which is precisely the idle moment he wants. `onScriptsLoaded` is the third
    useful one (setup that would fail at top level).

    **What the engine costs today, counted (not guessed) by wrapping every
    `api.v1.*` surface and firing each hook:**

    | hook | host round-trips |
    |---|---|
    | `onContextBuilt` (once per generation) | **2** - GenCounter get + set |
    | `onResponse` (per streaming chunk) | **0** |
    | `onGenerationEnd` (300-paragraph story) | **2** - one `document.scan`, one get |
    | `onTextAdventureInput`, one `[[roll]]` | **8** - all `storyStorage.get` |

    CPU is not the problem and should not be optimized: the whole
    `onGenerationEnd` regex pass over 2,000 paragraphs is ~3ms, and 2,000
    `onResponse` chunks ~4ms. **The cost is the number of awaits against the
    host**, exactly as the owner diagnosed.

    **THE ONE CONCRETE HOT SPOT, and it is not where either of us looked.** Our
    `onResponse` handler does zero I/O - but it is declared `async`, so it
    returns a Promise on **every streaming chunk** and the host awaits a
    microtask hop several hundred times per generation for a handler that almost
    always has nothing to do. The typings allow a SYNCHRONOUS return
    (`OnResponseReturnValue | void | Promise<...>`), so the common path could
    return `undefined` outright and hand back a Promise only when `<hide` is
    actually present. Three lines, and it targets the word-per-second symptom
    directly. Offered and not taken yet, on his "that's for the future" ruling.

    Second: **8 storage reads for one roll** is the Enter-key latency. Those
    collapse into one read behind the recalculation cache of #16 - which is the
    same item, approached from the other end.

    **DOES THE BUS/DISTRIBUTION WORK HELP OR HINDER? Both, and the rule matters
    now rather than later.**
    - *Helps.* The `monitor` priority is already the "runs last, cannot change
      the outcome" slot - the natural home for deferrable work. Local bus
      dispatch is in-memory: **zero host calls**. And distribution means a
      satellite's hooks are its OWN: a script that owns time need not register
      `onResponse` at all, whereas today one script registers all four hooks and
      every generation pays for all of them.
    - *Hinders, badly, if undisciplined.* **N scripts each registering
      `onResponse` is N host-to-script awaits per chunk** - distribution would
      multiply the exact cost that is hurting him. Likewise anything that put
      MESSAGE traffic on the streaming path would be strictly worse than a
      function call, since messaging is async and serializes.
    - **The rules to hold to, from here on:** only ONE script registers
      `onResponse`, and it returns synchronously unless it has real work; nothing
      on a per-chunk path may await the host; deferred work goes on
      `onGenerationEnd` at `monitor` priority; and a satellite registers the
      fewest hooks it can.

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
