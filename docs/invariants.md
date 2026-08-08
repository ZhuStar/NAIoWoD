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
- **Writing a DEFINITION CARD is not a story beat.** Every `define-*`/`forget-*`
  verb that writes the chronicle's rulebook declares `inStory: false`. Sheet
  edits (`set-trait`, `take-merit`, `specialty`, `grant`) are NOT in that set:
  a thing that happens to a character is something the Storyteller should see.
- **`[[help]]` is the exception to the `show-*` naming.** It keeps its name
  because it is what a player types before knowing anything; it is listed in
  `QUIET_VERBS` instead, and `show-help` is an alias of it.
- **`@all` is reserved in `parseAliasToken`.** `@` is the alias sigil, so an
  alias named "all" would shadow the wildcard on every listing.
- A scope a subject does not declare is answered with a CORRECTION naming the
  scopes it does, never with an empty list.

---

## 7. A trait has a KIND and a CATEGORY

```
kind      attribute · ability · background · virtue · discipline · trait · pool
category  physical/social/mental   (Attributes - a fixed nine, so it is a RULE)
          talent/skill/knowledge   (Abilities  - the CHRONICLE's lists)
```

- `traitCategoryOf(name)` is **synchronous**, because its callers are: a passive
  gated on "any Knowledge" is judged inside a roll, and a roll must not await the
  lorebook (§9). `AbilityCategories` caches the three lists at `init()` and falls
  back to the shipped ones when nothing has been loaded.
- **Both spellings are accepted** — `knowledge` and `knowledges` — because a card
  writes the plural and a pick reads the singular (`singularCategory`).
- A trait with **no** category (a Background, a Discipline, a pool) answers
  `undefined`. That is a real answer, not a miss.
- **A field the card READER does not know does not exist.** A definition is
  written to its lorebook card and read back from it, so adding a field to
  `MeritFlawDef` without teaching `ownedPowerFromCard` silently drops it on the
  round-trip. `grants`, `aka` and `choices` were all lost exactly this way.

  The asymmetry is **structural, not careless**: the writer
  (`namedDefsToCard`) spreads whatever the def has and so can never lose
  anything, while every reader enumerates its fields by hand and so loses
  whatever nobody remembered. Being careful does not fix an enumeration.
  **The guard is the round-trip test** (`test/system.test.ts`, "every shipped
  def survives the trip through its own lorebook card"): every def the engine
  ships is written to a card, read back, and any field that fails to return is
  named in the failure. It found `choices` — the gate that made all 38
  Exclusive Merits/Flaws exclusive — which had been silently making them
  available to *everyone* since they were written. **Add a field to a def type,
  and the test tells you the moment you forget the reader.**
- **An auto-created affliction gets no `tags`.** A tag is something a ROLL
  carries; one nobody wrote a modifier for is reported as `[unknown tag: …]` on
  every roll the character makes.

---

## 8. An affliction is a MECHANISM, not a label

`AfflictionDef.apply` holds EffectOps that run while it is on — the same ops and
the same two gates a merit's passive uses (`trait` names a trait OR a category,
`target` names a roll tag), plus **`$binding` substitution** and **instance
`level` scaling**. That is what makes one definition reusable by every merit.

- **Difficulty is SIGNED and there is ONE of it.** `-2` is two *easier*. Never
  add a "difficulty-bonus"/"difficulty-penalty" pair: lower is better here, so a
  "bonus" would carry a negative number and every reader would have to remember
  it. Reports say "(easier)"/"(harder)".
- **An instance's identity is def + bindings + `from`**, not the def alone
  (`CharacterAfflictions.instanceKey`). A SHARED affliction is held once per
  source; replacing by name alone let one merit delete another's effect.
- **A `$binding` nobody filled DROPS its gate, not the op.** No `tags` given
  means "every roll using that trait" — which is what leaving it out means.
  `trait=all` is how an instance says "no trait gate at all".
- **Do not put the same effect in a passive AND its granted affliction** — it
  applies twice. If a def grants an affliction that does the work, the def
  carries no passive of its own (Trait Affinity).
- **AFFLICTIONS ARE NAMED ROLE FIRST** (`AFFLICTION_ROLES`): `emitting-majesty`,
  not `majesty-emitter`. The name's first part is what KIND of affliction it is,
  so an alphabetical list groups by role rather than by subject. Advisory —
  `[[define-affliction]]` nudges a name without one and stores it anyway.
- **A rename keeps the old name working.** `AfflictionDef.aka` holds it, and
  **every lookup goes through `resolveAffliction`**, never the store's own `get`
  — one place knows about aliases. Gate sets use `afflictionNames`, so a
  recovery rule written against the old name still gates.
- **HELD DOWN IS NOT GONE.** `[[lift]]` suspends (still on him, relief runs
  out), `[[remove]]` ends it, `[[restore]]` ends the relief early. A suspended
  instance contributes NO ops and NO tags and is still listed, still counted,
  still ended by whatever would have ended it. Anything reading an affliction
  for EFFECT must call `afflictionActive`; anything reading it for EXISTENCE
  must not.
- **`lift.how` defaults to `never`**, because most afflictions are not
  shruggable and a permissive default would quietly make every one optional.
- **A suspension is owned.** `by: "self"` runs on its own expiry clock;
  `by: <affliction>` is recomputed by `refreshSuppression` and ends when that
  affliction does — so the glove coming off restores the claws with nobody
  remembering to. Call it wherever the affliction list changes.
- **A tag something else consumed is not `unknown`.** `resolveSpec`'s `usedTags`
  exists so a roll does not tell a player their tag did nothing when an
  affliction gated on it.

---

## 9. A contest is a FIELD, not two sides

`compareField(mode, entrants[])` is the primitive; `compareRolls(mode, a, b)` is
the case where the field has two, implemented in terms of it so there is ONE
adjudication.

- **Contested** ranks the field; **equal nets SHARE a rank**, so a tie at the
  top is a draw between those and the next entrant is third, not second.
- **Resisted** is entrant 0 (the actor) against the **best** of the rest — it
  only takes one to stop you.
- A botch is **zero, never negative**, and is named in the note.
- In an extended contest under `on-botch=fail`, a botcher is REMOVED and the
  rest carry on. With two sides that could only ever end the contest, so the
  two-side reading ("the other one wins") is a special case of this.
- `ExtendedContest.status` is a **winner's NAME**, or `CONTEST_OPEN`/
  `CONTEST_DRAW` — never `"a"`/`"b"`. `migrateContest` reads the old shape, and
  `ExtendedContestStore.load` calls it, so a race started before this still runs.

---

## 10. What crosses a wire

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

**Nobody is listening, so nobody is told.** `publish` touches the wire only when
another script has *declared* that channel. The host has no script directory
(`api.v1.script.id` exists; there is no `listScripts`), so interest is announced:
`open()` broadcasts a hello of `{scriptId, channels}`, and hearing one records it
and `send`s ours **back to that script only** — marked `reply: true`, which is
what stops two scripts introducing each other forever. Alone, the directory is
empty and the wire is never touched at all.

Consequences worth knowing before you write a test:

- A test asserting "this reached the wire" must **first deliver a hello** that
  declares the channel, or nothing will be sent and the assertion is vacuous.
- `open()` itself puts one hello on the wire, so `__sentMessages()` is never
  empty after opening. Filter it out (`wireTraffic()` in the suite) when the
  question is about events.
- `local:` still wins over any declared interest. A remote asking for `*` gets
  everything *except* `local:`, because that prefix means it never leaves.

**Commands are distributed by the HOOK CHAIN, not by messages.** `docs/hooks.md`:
scripts run their hooks in User-Scripts-modal order, each may rewrite
`inputText`, any may set `stopFurtherScripts`. That is already an ordered,
synchronous, cancellable bus. Messaging carries fire-and-forget events only.

---

## 10b. A window field lives in the store its `storageKey` NAMES

**Measured on-host** (`scripts/probe-window-field.ts`, 2026-08-08) — not
inferred from the docs, which are silent on the unprefixed case:

| `storageKey` | the host files it in |
|---|---|
| `"foo"` | `api.v1.storage["foo"]` — per **script** |
| `"story:foo"` | `api.v1.storyStorage["foo"]` — per **story**, shared by all scripts |
| `"history:foo"` | `api.v1.historyStorage["foo"]` — undo-aware |

The engine wrote **unprefixed** keys — so the host filed them under
`api.v1.storage` — and then read them back out of **`tempStorage`**. Two stores
that never meet, so **every window field was permanently empty**:
`[[win-roll]]`'s Roll button answered "Needs a pool" forever, and the other
windows submitted their command with every knob blank.

- Fields are bound with **`story:`** (`fieldKey`) and read with `readField`,
  which tests **presence, not truthiness** — a field the player cleared reads as
  cleared, not as absent. `story:` is the *right* store and not merely a working
  one: a form belongs to the **story** being played, not to the script that drew
  it, which is also what makes it survive the multi-script split.
- **Never touch `api.v1.tempStorage` directly for a form field.** Use
  `fieldKey` / `readField` / `writeField`; the picker modal and the input it
  belongs to must agree, and one pair of helpers is what keeps them agreeing.
- **The mock models the sync** (`__uiTypeInto`, `__uiFieldValue`, `__uiFields`).
  A test that writes a field with `tempStorage.set` is testing a store the host
  never writes to and proves nothing — which is exactly why this shipped for so
  long. Type through `__uiTypeInto`.

---

## 11. Performance — count awaits, not milliseconds

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

## 12. Policies that look like bugs but are not

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

## 13. The verification battery — run ALL of it before pushing

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

## 14. Where to look when something is wrong

| Symptom | Look at |
|---|---|
| "the command doesn't exist" | The pasted `dist/naiowod.ts` is stale. Rebuild. |
| A knob works but nobody can find it | It is missing from its `CommandSpec`. A knob the parser honours and the spec omits **does not exist** (`bd6bf50`). |
| A listing is cluttering the AI's context | Its verb is not named `show-*`. §6. |
| A definition loses a field when reloaded | The card reader does not know it. §7. |
| An effect applies twice | It is in a passive AND in the affliction that passive grants. §8. |
| A lifted affliction still bites | Something read it without `afflictionActive`. §8. |
| A name resolves to 0 | `::` folding, or the hyphen rule, or a bare name not reaching the extension. |
| A duration is wildly wrong | Seconds vs milliseconds. §1. |
| An arcanum shows up as a merit (or vice versa) | Something asked the wrong registry, or a report walk used `ownedPowerInstances`. §5. |
| A window has no field for a knob | Windows walk the verb's `CommandSpec`. Add the param and the field appears. |
| `docs/commands.md is in sync` fails | You added or renamed a verb. Run `bun run docs:commands`. |
