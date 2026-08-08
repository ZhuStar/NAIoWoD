# Invariants — the things that are true, and the traps that hide them

> **Read this before changing code.** Every rule below is here because breaking
> it produced a real bug in this repository. The commit that found each one is
> named, so you can read the fix if the rule alone is not enough.
>
> This file is written for **anyone working on NAIoWoD** — including a model with
> less context than the one that wrote a given pass. It states things flatly and
> does not assume you have read the source.

---

## 1. Units and encodings

| Thing | Unit | Trap |
|---|---|---|
| **The story clock** | **epoch SECONDS** | Not milliseconds. `formatStoryDate` multiplies by 1000 *because* the stored value is seconds. |
| `Duration` | `{months, seconds}` | Calendar months are separate because months are not a fixed number of seconds. |
| `EffectDuration` | prose | Advisory. Not the same type as `AfflictionExpiry`. |
| Dice pools, difficulties | plain integers | — |

> ⚠️ **THE SECONDS TRAP** (`1702bcd`). Three places in `system::time` divided by
> `3_600_000` as though the clock were in milliseconds. `elapsed-hours` came out
> a thousandfold too small and an affliction's "one hour" became 41 days.
> **Every earlier time test compared a duration against itself, so the error
> cancelled out.** Test a duration by advancing the clock and asserting *when it
> fires*, never by comparing two numbers you computed the same way.

---

## 2. String normalization — there are TWO of them

```
StringUtil.normalize(s)   lowercase + trim + whitespace→hyphen.        NO :: folding.
normalizeInput(s)         the BOUNDARY normalizer (core/traits.ts).    Folds :: → :,
                          strips spaces around @ , + and ::.
```

- Command arguments pass through **`normalizeInput`** on the way in.
- **Backtick literals skip it entirely** — that is what backticks are *for*.
- So anything that can arrive inside backticks and is later compared as a path
  **must fold `::` itself**.

> ⚠️ Bitten twice. `core/expr.ts`'s tokenizer now folds `::` (`a2892ad`:
> `system::time::now` tokenized as a different name from `system:time:now`), and
> `ActiveAffliction.from` folds it (`1702bcd`: an orphan sweep looked for a name
> one colon different from the one it had stored).

---

## 3. The hyphen rule

A hyphen belongs to a **name** only when a **letter** follows it.

```
self-control      one name
courage - 1       subtraction (the spaces are required)
12-generation     subtraction
```

Between two names, put the spaces in.

---

## 4. Expressions

- `evaluateExpr` — arithmetic. Everything numeric a chronicle can write.
- `evaluateCondition` — **the same language plus comparisons and `and`/`or`/`not`**,
  reached only through this entry point. Arithmetic never sees the comparison
  layer, so adding to one cannot break the other.
- **An empty or malformed condition is FALSE**, never true. "No condition" must
  not read as "already elapsed".
- **An unanswered reference is 0 *and is reported*** (`ExprResult.unknown`). A
  typo must never read as zero in silence.
- Nothing throws. A malformed expression is worth 0 and says why.

> ⚠️ **A bare name reaches the scope extension** (`bcd4c97`). `buildScope` used
> to return `undefined` for a single-token name the sheet could not answer,
> *without* offering it to the extension — so an extension could only ever supply
> prefixed paths.

---

## 5. Categories vs mechanisms — the one that keeps being broken

**Merits/Flaws** are open to any character. **Arcana/Taints**, **Disciplines**
and **Pillars** each belong to a *kind of creature*. They are not four flavours
of one thing:

```
MeritFlawDef  kind: merit|flaw     MeritFlawRegistry   srd:merits-flaws   char.meritsFlaws
ArcanumDef    kind: arcanum|taint  ArcanumRegistry     srd:arcana         char.arcana
```

`OwnedPowerDef` is the **shared machinery** (parameterized instances, passive
ops, per-template prices, instance caps, `PassiveGrant`) and nothing more.

> ⚠ Arcana lived inside `DEFAULT_MERITS_FLAWS` as `kind: "arcanum"` for a long
> time, so every vampire and mage saw Devil's Due Arcana in their Merits list.
> A shared `kind` field is not a category. **Rules:**
> 1. A registry answers only for its own kinds; `resolvePowerInstance` is
>    generic so the caller must name which one.
> 2. A REPORT walk (`ownedMeritInstances` / `ownedArcanumInstances`) sees one
>    category. A MECHANISM walk (`ownedPowerInstances`) sees both — passive ops,
>    purse ledgers, "which power grants this affliction".
> 3. Whether the list exists at all is a **capability**
>    (`ARCANA_CAPABILITY`), not a template list — anyone may become a thrall.

---

## 6. Read-only verbs are called `show-*`, and that IS the policy

A verb that only reports is named `show-<thing>`. The prefix is not a
convention — `isQuietVerb` reads it, so the reply is stripped from the AI's
context before generation (`markCtxSkip` / `processContextBuilt`).

- **A listing that is not called `show-*` will leak into the model's context.**
  The old `QUIET_VERBS` set was hand-maintained and new verbs were forgotten
  from it; what remains there is only read-only verbs that are not listings.
- **`in-story` is UNIVERSAL and runs BOTH ways.** `CommandRouter.register`
  attaches it to every verb, so there is no command whose context placement the
  player cannot override: `[[show-sheet in-story]]` shows a listing to the AI,
  `[[roll stealth in-story=false]]` hides an action from it. Resolution order is
  what the player said → `CommandSpec.inStory` → `!isQuietVerb`.
- **It overrides the hiding and nothing else.** The turn stays quiet: looking
  something up is not an action, so the reply is read on the NEXT generation
  rather than prompting one now.
- **A bare flag means true** (`[[... in-story]]`), promoted by
  `CommandRouter.parse` — NOT by `CommandParser`, which stays spec-agnostic.
  Anything read as a flag must be declared `type: "bool"`, or the bare form
  does not exist and the value is filed as a positional.
- **A mistyped flag value reads as ABSENT, never as false** (`readBool`
  returns `undefined`), so a typo cannot silently mean "no".
- **`[[help]]` is the exception to the `show-*` naming.** It keeps its name
  because it is what a player types before knowing anything; it is listed in
  `QUIET_VERBS` instead, and `show-help` is an alias of it.
- **`@all` is reserved in `parseAliasToken`.** `@` is the alias sigil, so an
  alias named "all" would shadow the wildcard on every listing.
- A scope a subject does not declare is answered with a CORRECTION naming the
  scopes it does, never with an empty list.

---

## 7. What crosses a wire

`api.v1.messaging` **serializes**. Only plain data survives.

- ✅ `TemplateDef`, `ResourceDef`, `SavedRoll`, `ParsedCommand`, card text.
- ❌ `TemplateConfig` (has methods), `DamageReaction` (a class), anything with a
  closure.

The pattern that works: **plain data + a NAME both sides resolve through their
own registry** (`REACTIONS`, `SOAK_TABLES`, `MORALITIES` are string-keyed for
exactly this reason).

**`broadcast` excludes the sender.** A script cannot hear its own broadcast, and
every messaging call is a Promise, so an event that leaves and returns arrives on
a *later tick*. That is why `EventBus.emit` is a direct synchronous call and the
post office relays *afterwards* — a correctness choice, not a performance one.

---

## 8. Performance — count awaits, not milliseconds

CPU is not the bottleneck; **host round-trips are**. Measured (`80f1d2f`):

| hook | host calls |
|---|---|
| `onContextBuilt` (per generation) | 2 |
| `onResponse` (**per streaming chunk**) | 0 |
| `onGenerationEnd` | 2 |
| `onTextAdventureInput`, one `[[roll]]` | 8 |

**Rules:**
1. Only ONE script registers `onResponse`, and it returns **synchronously**
   unless it has real work. (It is currently `async`, so the host awaits a
   microtask on every chunk — a known, unfixed cost.)
2. Nothing on a per-chunk path may await the host.
3. Deferred work goes on `onGenerationEnd`, at `monitor` priority.
4. A satellite script registers the fewest hooks it can.

---

## 9. Policies that look like bugs but are not

- **Advisory, not enforced.** Everything creation-side reports and lets the
  Storyteller decide. `[[creation]]`, `[[budget]]`, constraints, instance caps —
  all of them *say* and none of them *refuse*.
- **`waive=true` overrides any gate**, everywhere, on purpose.
- **A bad lorebook card must never take the story down.** Malformed data is
  skipped and *reported*; a throwing bus handler is recorded on `event.errors`
  and the rest still run.
- **UNRATED is not UNKNOWN.** A Background the chronicle defines but the sheet
  does not rate is `0` — a real answer. A name nobody defines is unknown.
- **An affliction with no orphan policy outlives its source.** Not a missing
  default; the stated one.
- **A character who is not that kind of creature has NO list, not a short one.**
  A vampire asking for `[[arcana]]` is told he has none at all and why — not
  shown an empty list, and never shown them inside `[[merits]]`.

---

## 10. The verification battery — run ALL of it before pushing

```bash
bun run build          # dist/naiowod.ts is COMMITTED; the suite checks it is in sync
bun run docs:commands  # docs/commands.md is GENERATED; the suite checks it too
bun test
bun run typecheck
# standalone: the artifact must compile alone, against the vendored .d.ts
cp dist/naiowod.ts types/novelai/script-types.d.ts <scratch>/ && cd <scratch> &&
  bun x tsc --ignoreConfig --strict --skipLibCheck --target ES2021 --lib ES2021 \
    --noEmit naiowod.ts script-types.d.ts
# import purity: this must print NOTHING
bun -e 'await import("./src/host-mock.ts"); await import("./src/index.ts");'
```

Then a live `init()` smoke reproducing whatever the change was about.

`dist/naiowod.ts` must start with `//` comments — **never** `/*---` frontmatter.

---

## 11. Where to look when something is wrong

| Symptom | Look at |
|---|---|
| "the command doesn't exist" | The pasted `dist/naiowod.ts` is stale. Rebuild. |
| A knob works but nobody can find it | It is missing from its `CommandSpec`. A knob the parser honours and the spec omits **does not exist** (`bd6bf50`). |
| A listing is cluttering the AI's context | Its verb is not named `show-*`. §6. |
| A name resolves to 0 | `::` folding, or the hyphen rule, or a bare name not reaching the extension. |
| A duration is wildly wrong | Seconds vs milliseconds. §1. |
| An arcanum shows up as a merit (or vice versa) | Something asked the wrong registry, or a report walk used `ownedPowerInstances`. §5. |
| A window has no field for a knob | Windows walk the verb's `CommandSpec`. Add the param and the field appears. |
| `docs/commands.md is in sync` fails | You added or renamed a verb. Run `bun run docs:commands`. |
