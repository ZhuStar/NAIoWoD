# Architecture — what each file is, and how they fit together

> **[`docs/commands.md`](commands.md)** is the generated reference for all 131
> verbs — do not hand-edit it; run `bun run docs:commands`.
>
> Companion to `docs/invariants.md` (the rules you must not break) and
> `docs/memory.md` (every decision and *why*). This file answers a narrower
> question: **if I have to change X, which file do I open?**

---

## The shape of it

```
       host.ts          the ambient `api` and log/error. Nothing else touches the host directly.
          │
      core/*.ts         PURE. No `api`, no storage, no imports outside core.
          │             Each one is a single idea, testable alone.
          │
   rules.ts             THE DATA. Every World of Darkness rule that is a number,
          │             a table or a definition. No I/O, no commands.
          │
   command.ts           The parser and the router. Knows nothing about the game.
          │
   services.ts          Storage, the lorebook, config stores, the post office.
          │             The layer that talks to the host.
          │
   state.ts             The character model and every store. THE CHARACTER SCOPE
          │             lives here: one place that answers "what is this name worth".
          │
   game.ts              THE VERBS. Every command handler and every report.
          │
   window.ts            Windows and modals, built by walking a verb's CommandSpec.
          │
   index.ts             init(): registers hooks, seeds the lorebook. The only
                        module with a side effect, and only when called.
```

**Build order is dependency order.** `scripts/build-single.ts` concatenates these
into `dist/naiowod.ts`, stripping the import/export wiring. A module may only
reference names declared *above* it in that list.

---

## File by file

### `src/host.ts` (23 lines)
The ambient `api` declaration and `log`/`error`. Deliberately tiny: the real
typings are vendored in `types/novelai/script-types.d.ts`, so the artifact
type-checks alone.

### `src/core/` — pure, no host, no storage

| File | What it is | Open it when |
|---|---|---|
| `traits.ts` | `StringUtil`, `Stat`, `Category`, and **`normalizeInput`** — the boundary normalizer | a name is compared wrong |
| `cardtext.ts` | the readable lorebook format (parse + serialize) | a card round-trips badly |
| `expr.ts` | **the one arithmetic** + the condition layer | a number should be writable as an expression |
| `dice.ts` | rolling, botches, n-again, un-cancelable successes | dice behave wrong |
| `damage.ts` | health tracks, soak, damage kinds, reactions | wounds behave wrong |
| `time.ts` | the calendar and clock. **Epoch SECONDS** | anything about dates |
| `bus.ts` | the event bus: priority, cancel, stop, local dispatch | events |

### `src/rules.ts` (~2,700 lines) — the data layer
Everything that is *a rule* rather than *a behaviour*: templates, resources,
soak tables, clans, fellowships, roads, backgrounds, merits/flaws, **arcana (a
separate list — `DEFAULT_ARCANA`, never inside `DEFAULT_MERITS_FLAWS`)**,
disciplines, afflictions, the creation budget, advancement costs, magic knobs.

**If you are adding a game rule, it probably belongs here as data** — not as code
in `game.ts`. That is the project's central bet.

### `src/command.ts` (~260 lines)
`CommandParser` (tokenizing, backtick literals), `CommandRouter` (registry,
`beforeRoute` hooks), `CommandSpec`/`ParamSpec` (the ONE declarative description
of a verb's arguments), and the **command envelope** for the wire.

> `[[help]]` derives from the spec. Windows derive from the spec. **A knob missing
> from its spec does not exist**, however well the parser handles it.

### `src/services.ts` (~800 lines)
`ScopedStorage`, `LorebookManager`, the generic config stores, tracked-card
reconciliation, and **`PostOffice`** (the bus wired to `api.v1.messaging`).

### `src/state.ts` (~2,600 lines)
`PlayableCharacter` and every store (`CharacterStore`, `CharacterResources`,
`CharacterAfflictions`, `CharacterCooldowns`, `StoryClock`, `SceneStore`, …), and
**`buildScope`** — the character scope every expression reads through.

### `src/game.ts` (~6,500 lines)
Every command handler. The largest file and the one most worth splitting when the
engine is distributed across scripts. Two tables carry most of its structure:
**`SHOW_SUBJECTS`** (every read-only verb, its scopes and the old names it
replaced) and **`PowerFamily`** (merits vs arcana).

### `src/window.ts` / `src/ui-text.ts`
Windows are **generated from CommandSpecs**, so adding a param to a verb adds a
field to its window for free.

---

## The load-bearing ideas

1. **Everything is data.** Rules live in `rules.ts` and in player-editable
   lorebook cards. When a subsystem does not exist yet, store the config, surface
   it, mark it `(ST-enforced)` — never block on it.
2. **One arithmetic.** Every number a chronicle can write goes through
   `core/expr.ts`. One grammar, one error style, one place to extend.
3. **One scope.** `buildScope` is the only answer to "what is this name worth on
   this sheet". Reports, rolls, budgets and conditions all read through it.
4. **One declarative spec per verb.** Help text and windows are derived, never
   written twice.
4b. **The name is the policy.** A read-only verb is called `show-*`, and that
   prefix — not a hand-maintained list — is what keeps its reply out of the AI's
   context. `SHOW_SUBJECTS` is the one table; a subject cannot be half-wired.
   `[[help]]` is the deliberate exception: it keeps the name everybody already
   knows, and `show-help` aliases it.
4c. **`in-story` is on every verb**, attached by `CommandRouter.register` rather
   than declared 130 times, and it runs both directions.
5. **Afflictions are the common currency.** An arcanum, a spell, a Discipline and
   a botched roll all express "something is on you" the same way — with a source,
   an expiry, a cooldown and an orphan policy.
6. **Advisory, not enforced.** The engine reports; the Storyteller decides.
7. **A bad card must never take the story down.**

---

## Categories that are NOT each other

The code once blurred these, and the fix was structural, not a rename.

| Category | Who has it | Purse | Type | Registry | Sheet bucket |
|---|---|---|---|---|---|
| **Merits / Flaws** | **anyone**, to a degree | `freebie` | `MeritFlawDef` | `MeritFlawRegistry` (`srd:merits-flaws`) | `meritsFlaws` |
| **Arcana / Taints** | only the infernal-bound | `arcana` | `ArcanumDef` | `ArcanumRegistry` (`srd:arcana`) | `arcana` |
| **Disciplines** | vampires and their kin | `discipline` | `DisciplineDef` | `DISCIPLINES` | `disciplines` |
| **Pillars** | mages | `freebie` | fellowship data | `FELLOWSHIPS` | `traits` |
| **Backgrounds** | anyone | `background` | `BackgroundDef` | `BackgroundRegistry` | `backgrounds` |

**Merits and Flaws are the only row open to every character.** Everything else
belongs to a *kind of creature*, and a character who is not that kind does not
have a short list — they have **no list**. `[[merits]]` on a vampire shows no
Arcana; `[[arcana]]` tells him he has none at all and why.

What they share is a MECHANISM — `OwnedPowerDef` (parameterized instances,
passive ops, per-template prices, instance caps) and `PassiveGrant` (taking it
applies its affliction). **Shared machinery is not shared identity.** Do not put
anything on `OwnedPowerDef` that means one category and not the other, and do not
let one registry answer for another: `resolvePowerInstance` is generic in the def
type precisely so the caller has to name which list it is asking.

The gate on Arcana is `ARCANA_CAPABILITY` (`rules.ts`) rather than a template
list, because any splat may become a demon's thrall. `[[attune arcana]]` opens it
for a chronicle that says otherwise.

---

## Adding something — the usual path

| You want | Do |
|---|---|
| a new rule/number/table | `rules.ts`, as data |
| a new verb | handler in `game.ts` + `CommandRouter.register` with a full `CommandSpec` |
| a new knob on an existing verb | add the `ParamSpec` — help and windows follow |
| a new kind of always-on power | give its def a `PassiveGrant` + an `AfflictionDef` |
| a new CATEGORY of owned power | a type over `OwnedPowerDef`, its own registry + lorebook category, and a `PowerFamily` in `game.ts` — the verbs come for free |
| a new thing to LOOK at | a `ShowSubject` in `game.ts`'s `SHOW_SUBJECTS` — the verb, its `name`/`in`/`in-story` knobs, its deprecated aliases and its context-hiding all follow |
| a new expression name | a scope extension, or `scopeFunctions` in `state.ts` |
| a new persistent thing | a store class in `state.ts` over `ScopedStorage` |

Then: tests in `test/system.test.ts`, update **`docs/memory.md` in the same
commit**, and run the whole battery in `docs/invariants.md` §12.
