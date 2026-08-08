# Command reference

> **GENERATED — do not edit.** `bun run docs:commands` rewrites this file from
> the live `CommandRouter`, and a test asserts the committed copy matches. If a
> verb is here it exists; if it exists it is here.

Commands are written `[[like this]]` in the Text Adventure input box. Several
may share one line; each is replaced by its `[SYSTEM: …]` reply.

---

## `[[show-help]]` — what it publishes

With no argument it lists every current verb (`[[help]]` is the same command,
kept as a visible alias because it is what a player who knows nothing types):

```
[SYSTEM: 125 commands: help, creator-mode, create-playable, play, set-trait, convert-cards, set-default, roll, roll-for, name-roll, add-step, clear-steps, forget-roll, extended-roll, continue-roll, cancel-roll, attune, spend, gain, damage, clear-boosts, reset-uses, configure-resources, cancel-wizard, resist, contest, extended-contest, continue-contest, cancel-contest, story-start, advance-time, magick, cast, seal-spell, choose, extend-template, forget-template, define-resource, define-background, forget-background, grant, forget-grant, paid, flush-context, enter-sanctum, exit-sanctum, enter-library, exit-library, measure-door, leave-library, harvest, absorb, research, save-date, forget-date, scene, turn, end-scene, downtime, forget-scene, hide, define-table, forget-table, define-table-category, table-alias, forget-table-alias, define-constraint, forget-constraint, take-merit, drop-merit, define-merit, forget-merit, define-arcanum, take-arcanum, drop-arcanum, forget-arcanum, specialty, forget-specialty, define-affliction, forget-affliction, afflict, toggle, invoke, advance, lift, alias, forget-alias, player, show-help, show-character, show-template, show-clan, show-fellowship, show-cost, show-table, show-roll, show-scene, show-date, show-time-between, show-alias, show-player, show-constraint, show-sheet, show-merit, show-arcanum, show-background, show-affliction, show-specialty, show-resource, show-capability, show-health, show-budget, show-grant, show-creation, show-derived, show-supernatural, show-cray, show-eval, show-roll-status, show-contest-status, win-constraint, win-table, win-affliction, win-afflict, win-roll. [[show-help <verb>]] for one's usage. Anything named show-* only LOOKS at things, and its reply is kept out of the AI's context (add in-story=true to keep one). 39 older names still work and say what replaced them.]
```

With a verb it prints that verb's **usage line**, which is derived from the
verb's `CommandSpec` — the same declaration that builds its window. Nothing is
written twice, so help can never disagree with the parser.

**Anything named `show-*` only looks at things.** Its reply is stripped from
the AI's context before generation; `in-story=true` on any of them keeps that
one reply in the story.

---

## All 125 commands

| command | what it does |
|---|---|
| `absorb` | tear Quintessence from the cray directly: Wits + Foundation vs 10 - its rating |
| `add-step` | append a follow-up step to a saved procedure (composes named rolls) |
| `advance` | end an affliction and begin its successor, bindings carried forward |
| `advance-time` | move the story clock forward (s/m/h/d/w/mo/y); crossing midnights/full moons applies recovery |
| `afflict` | apply an affliction; extra <slot>=<name\|@alias> args fill its bindings |
| `alias` | define an alias for a character |
| `attune` | what this character can USE (a pool he cannot use is only points) |
| `cancel-contest` | cancel an extended contest |
| `cancel-roll` | cancel an extended action |
| `cancel-wizard` | abandon the running wizard |
| `cast` | @deprecated - use [[magick]] (Awakened magic); this name is wanted for Sorcery |
| `choose` | pick a clan, a fellowship, or the Attribute/Ability priorities |
| `clear-boosts` | clear trait boosts (the ST calls the duration) |
| `clear-steps` | drop all follow-up steps from a saved procedure (its entry roll stays) |
| `configure-resources` | guided resource setup; plain replies answer it |
| `contest` | contested action: higher total wins (tie = draw) |
| `continue-contest` | roll the next contest round |
| `continue-roll` | whoever is current rolls the next interval (named-only overrides) |
| `convert-cards` | rewrite any lorebook card still holding JSON in the readable format (one-shot) |
| `create-playable` | create a playable character (attributes 1, abilities 0 - allocation is opt-in) |
| `creator-mode` | toggle lorebook hand-editing; edits sync in while on |
| `damage` | mark damage on the current character |
| `define-affliction` | define/replace an affliction (overlay; may shadow a built-in) |
| `define-arcanum` | define an arcanum or taint (writes the srd:arcana overlay) |
| `define-background` | define/replace a background (a Talisman that IS a place grants that place's ratings) |
| `define-constraint` | define/replace a constraint group |
| `define-merit` | define a merit or flaw (writes the srd:merits-flaws overlay) |
| `define-resource` | define a pool or tracker a template can then grant |
| `define-table` | define/replace a success table in its category's general card |
| `define-table-category` | create a table subcategory (a real lorebook category with its general card) |
| `downtime` | close the current scene and gloss the clock forward |
| `drop-arcanum` | drop an owned arcanum or taint (its passives lift with it) |
| `drop-merit` | drop an owned merit/flaw instance |
| `end-scene` | close the current scene |
| `enter-library` | enter your library (applies in-library) |
| `enter-sanctum` | enter your sanctum (applies in-sanctum) |
| `exit-library` | leave your library (lifts in-library) |
| `exit-sanctum` | leave your sanctum (lifts in-sanctum) |
| `extend-template` | a new template from an old one: state only what differs |
| `extended-contest` | both sides accumulate; first to the goal wins (dead heat stays open) |
| `extended-roll` | start an extended action (rolls interval 1 now) |
| `flush-context` | clean the story now: strip engine notes and hidden blocks (run this if things feel slow) |
| `forget-affliction` | remove an overlay definition; built-ins can only be shadowed |
| `forget-alias` | remove an alias (bare @a = global; scoped tokens as in alias) |
| `forget-arcanum` | remove a custom arcanum/taint definition (a built-in resurfaces) |
| `forget-background` | remove a custom background (a built-in resurfaces) |
| `forget-constraint` | remove a constraint group |
| `forget-date` | delete a saved date bookmark |
| `forget-grant` | drop a grant - the thing goes back to being bought normally |
| `forget-merit` | delete a custom merit/flaw definition (built-ins resurface) |
| `forget-roll` | delete a saved roll |
| `forget-scene` | delete a scene record |
| `forget-specialty` | remove a specialty (label needed only when a trait has several) |
| `forget-table` | remove a table from its category's general card; built-ins can only be shadowed |
| `forget-table-alias` | remove a table alias |
| `forget-template` | drop a chronicle template (the shipped one, if any, resurfaces) |
| `gain` | regain a resource |
| `grant` | where something came from when it wasn't bought: a template's free dot, or a Storyteller's bonus |
| `harvest` | draw Quintessence from the cray ritually (no roll; overdrawing costs the site a dot) |
| `help` | list commands, or show one's usage |
| `hide` | write to the current scene's private plan (mirrored into the Author's Note) |
| `invoke` | use a power that OFFERS an affliction rather than applying it automatically |
| `leave-library` | step back through the measured door |
| `lift` | remove an affliction - and its mirror; spend = shrug-off |
| `magick` | work Awakened magick (Dark Ages: Mage) - pillars carry the REQUIRED levels |
| `measure-door` | the Talisman ritual: ten minutes measuring a door opens the Library of the Unseen |
| `name-roll` | save a roll under a name; @name invokes it with its spend/specialty/table baked in (extended=true makes a procedure, opposed= makes a contest) |
| `paid` | record what a purchase really cost (no expression = the Storyteller granted it) |
| `play` | switch to a character; no name selects the default |
| `player` | show or switch the current player; storyteller is always valid |
| `research` | search the library: Intelligence + Library (must be in it) |
| `reset-uses` | scene/turn change: clears effect-use counters |
| `resist` | resisted action: your margin over theirs counts (tie = fail) |
| `roll` | roll a dice pool for the current character |
| `roll-for` | roll for a named character without switching to them |
| `save-date` | bookmark the current moment (or a given date) under a name |
| `scene` | open a named scene at the current story time (one location; turn=<len> sets a Turn's length) |
| `seal-spell` | seal an ongoing spell: 5 Quintessence per highest-Pillar dot + 1 Willpower per 10 |
| `set-default` | change the default character |
| `set-trait` | set any rating the sheet holds (Attribute, Ability, Background, Discipline, Pillar, pool start) |
| `show-affliction` | afflictions on a character, or the ones the chronicle defines |
| `show-alias` | every alias, grouped by scope |
| `show-arcanum` | arcana & taints: what a character owns, or what the chronicle defines |
| `show-background` | backgrounds: what a character holds and confers, or what the chronicle defines |
| `show-budget` | what each purse allows, what is spent, what is left (advisory) |
| `show-capability` | what a character can USE (a pool he cannot use is only points) |
| `show-character` | the chronicle's playable characters (marks current/default) |
| `show-clan` | the clans and their Disciplines |
| `show-constraint` | the story's constraint groups, and what the character breaks |
| `show-contest-status` | an extended contest's progress |
| `show-cost` | what a dot costs from each purse (chronicle rules, Storyteller-applied) |
| `show-cray` | the cray's points, status and how it refills |
| `show-creation` | the creation budget: every pool against what the sheet holds (advisory) |
| `show-date` | the story date, and the bookmarks the chronicle keeps |
| `show-derived` | what the sheet implies rather than states: Road, Willpower, generation, and why |
| `show-eval` | read an expression against a character (the reference system, exposed) |
| `show-fellowship` | the mystic fellowships' Foundation & Pillars |
| `show-grant` | what a purchase really cost and where it came from |
| `show-health` | a character's health track, penalty and what soaks what |
| `show-help` | list commands, or show one's usage |
| `show-merit` | merits & flaws: what a character owns, or what the chronicle defines |
| `show-player` | the current player (the storyteller, unless somebody took a seat) |
| `show-resource` | a character's live pools and trackers (and what they cannot use) |
| `show-roll` | the chronicle's saved rolls, or one in full |
| `show-roll-status` | an extended action's progress |
| `show-scene` | the chronicle's scenes, or one in full (defaults to the open one) |
| `show-sheet` | a character's record as the engine reads it (effective values marked) |
| `show-specialty` | a character's specialties (one applies per roll, via specialty=) |
| `show-supernatural` | the families of power open to a character (disciplines, magic, sorcery, blood-sorcery) |
| `show-table` | success tables, grouped by category, or one laid out in full |
| `show-template` | the templates this chronicle knows, and what each is made of |
| `show-time-between` | measure the span between two dates (saved name, now, start, or yyyy-mm-dd-hh) |
| `specialty` | add a specialty to a trait (labels keep their case) |
| `spend` | spend a resource / fire a named effect outside a roll |
| `story-start` | set when the story begins (yyyy-mm-dd-hh) |
| `table-alias` | define a table alias, or list them (no args); table=@alias resolves it |
| `take-arcanum` | take an arcanum or taint (needs the arcana capability - [[attune]]) |
| `take-merit` | take a merit/flaw; parameterized defs take name::param instances |
| `toggle` | switch a togglable passive off, or back on (the power is not lost either way) |
| `turn` | advance the current scene by one turn (moves the clock by its turn length) |
| `win-afflict` | open a window to apply an affliction (its binding slots appear on pick) |
| `win-affliction` | open a window to define an affliction (then/mirror have pickers) |
| `win-constraint` | open a window to define a constraint group |
| `win-roll` | open a window to build, roll, and save rolls |
| `win-table` | open a window to define a success table |

---

## 39 older names that still work

Each does exactly what it always did, then says what replaced it. They are
left out of `[[show-help]]` and out of the table above: the current
vocabulary is what a player should be reading.

| old name | now |
|---|---|
| `affliction` | `show-affliction` |
| `afflictions` | `show-affliction` |
| `aliases` | `show-alias` |
| `arcana` | `show-arcanum` |
| `arcanum` | `show-arcanum` |
| `background` | `show-background` |
| `backgrounds` | `show-background` |
| `budget` | `show-budget` |
| `characters` | `show-character` |
| `check-constraints` | `show-constraint` |
| `clan` | `show-clan` |
| `clans` | `show-clan` |
| `constraint` | `show-constraint` |
| `constraints` | `show-constraint` |
| `contest-status` | `show-contest-status` |
| `costs` | `show-cost` |
| `cray` | `show-cray` |
| `creation` | `show-creation` |
| `dates` | `show-date` |
| `derived` | `show-derived` |
| `eval` | `show-eval` |
| `fellowships` | `show-fellowship` |
| `health` | `show-health` |
| `help` | `show-help` |
| `list-rolls` | `show-roll` |
| `merit` | `show-merit` |
| `merits` | `show-merit` |
| `resources` | `show-resource` |
| `roll-info` | `show-roll` |
| `roll-status` | `show-roll-status` |
| `scene-info` | `show-scene` |
| `scenes` | `show-scene` |
| `sheet` | `show-sheet` |
| `specialties` | `show-specialty` |
| `story-date` | `show-date` |
| `supernatural` | `show-supernatural` |
| `tables` | `show-table` |
| `templates` | `show-template` |
| `time-between` | `show-time-between` |

---

## Each command in detail

### `absorb`

tear Quintessence from the cray directly: Wits + Foundation vs 10 - its rating

```
[[absorb [foundation=<trait>]]]
```

| argument | kind | meaning |
|---|---|---|
| `foundation` | named | Foundation trait (default: auto) |

**`[[show-help absorb]]`** replies:

```
[SYSTEM: absorb - absorb [foundation=<trait>]  (tear Quintessence from the cray directly: Wits + Foundation vs 10 - its rating)]
```

### `add-step`

append a follow-up step to a saved procedure (composes named rolls)

```
[[add-step <procedure> roll=@<saved-roll> [when=always|on-success|on-fail|on-botch] [note=".."]  (append a follow-up step to a saved procedure (composes named rolls))]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional **required** | `<procedure>` |
| `roll` | named **required** | The follow-up roll to run |
| `when` | named `enum` | When this step applies, by the entry's outcome — one of `always`, `on-success`, `on-fail`, `on-botch` |
| `note` | named `literal` | What this step is, in fiction |

**`[[show-help add-step]]`** replies:

```
[SYSTEM: add-step - add-step <procedure> roll=@<saved-roll> [when=always|on-success|on-fail|on-botch] [note=".."]  (append a follow-up step to a saved procedure (composes named rolls))]
```

### `advance`

end an affliction and begin its successor, bindings carried forward

```
[[advance <affliction> [on=<name|@alias>]]]
```

| argument | kind | meaning |
|---|---|---|
| `affliction` | positional **required** | `<affliction>` |
| `on` | named | `<name\|@alias>` |

**`[[show-help advance]]`** replies:

```
[SYSTEM: advance - advance <affliction> [on=<name|@alias>]  (end an affliction and begin its successor, bindings carried forward)]
```

### `advance-time`

move the story clock forward (s/m/h/d/w/mo/y); crossing midnights/full moons applies recovery

```
[[advance-time <duration>  (move the story clock forward (s/m/h/d/w/mo/y); crossing midnights/full moons applies recovery)]]
```

| argument | kind | meaning |
|---|---|---|
| `duration` | positional **required** | `<duration>` <br>*e.g.* `2d 6h` |

**`[[show-help advance-time]]`** replies:

```
[SYSTEM: advance-time - advance-time <duration>  (move the story clock forward (s/m/h/d/w/mo/y); crossing midnights/full moons applies recovery)]
```

### `afflict`

apply an affliction; extra <slot>=<name|@alias> args fill its bindings

```
[[afflict <affliction> [on=<name|@alias>] [rolls=N] [with-tags="a,b"] [without-tags="a,b"] [using="melee"] [not-using="wits"] [turns=N] [scenes=N] [for=<duration>] [until=<condition>] [until-event=<text>] [from=<source>] [cooldown-for=<duration>] [cooldown-rolls=N] [cooldown-turns=N] [cooldown-scenes=N] [cooldown-until=<condition>] [waive=true] [orphan=immediately | keep | <expression>] [<key>=<value> ...]]]
```

> mirror defs also afflict the bound target

| argument | kind | meaning |
|---|---|---|
| `affliction` | positional **required** | `<affliction>` |
| `on` | named | Who (default: the current character) |
| `rolls` | named `int` | Ends after this many MATCHING rolls |
| `with-tags` | named | Only rolls carrying all of these count |
| `without-tags` | named | Rolls carrying any of these do not count |
| `using` | named | Only rolls whose pool uses one of these count |
| `not-using` | named | Rolls whose pool uses any of these do not count |
| `turns` | named `int` | Ends after this many turns ([[turn]] counts them) |
| `scenes` | named `int` | Ends after this many scenes ([[end-scene]] counts them) |
| `for` | named | Ends after this much story time <br>*e.g.* `1 hour` |
| `until` | named | Ends when this becomes true: full-moons, elapsed-days, elapsed-hours and any trait, with > < >= <= = != and and/or/not <br>*e.g.* `full-moons >= 1` |
| `until-event` | named | ADVISORY: nothing ends it but [[lift]] <br>*e.g.* `you next attend the voivode` |
| `from` | named | What inflicted it - an arcanum, a spell, a Discipline, a botch <br>*e.g.* `arcanum:sharpened-senses` |
| `cooldown-for` | named | After it ends, this long before it may be taken again <br>*e.g.* `1 day` |
| `cooldown-rolls` | named `int` | — |
| `cooldown-turns` | named `int` | — |
| `cooldown-scenes` | named `int` | — |
| `cooldown-until` | named | `<condition>` <br>*e.g.* `full-moons >= 1` |
| `waive` | named `enum` | Apply it even while cooling — one of `true` |
| `orphan` | named | What happens if its source goes: end at once, carry on unchanged, or an expression over what is left (remaining-seconds, remaining-rolls) <br>*e.g.* `immediately` |

**`[[show-help afflict]]`** replies:

```
[SYSTEM: afflict - afflict <affliction> [on=<name|@alias>] [rolls=N] [with-tags="a,b"] [without-tags="a,b"] [using="melee"] [not-using="wits"] [turns=N] [scenes=N] [for=<duration>] [until=<condition>] [until-event=<text>] [from=<source>] [cooldown-for=<duration>] [cooldown-rolls=N] [cooldown-turns=N] [cooldown-scenes=N] [cooldown-until=<condition>] [waive=true] [orphan=immediately | keep | <expression>] [<key>=<value> ...]  (apply an affliction; extra <slot>=<name|@alias> args fill its bindings; mirror defs also afflict the bound target)]
```

### `alias`

define an alias for a character

```
[[alias <@token> "Target Name"]]
```

> bare @a = global; @global::a, @player::<id|storyteller|default>::a, @char::<name|default>::a pin a scope

| argument | kind | meaning |
|---|---|---|
| `token` | positional **required** | `<@token>` |
| `target` | positional **required** | `"Target Name"` |

**`[[show-help alias]]`** replies:

```
[SYSTEM: alias - alias <@token> "Target Name"  (define an alias for a character; bare @a = global; @global::a, @player::<id|storyteller|default>::a, @char::<name|default>::a pin a scope)]
```

### `attune`

what this character can USE (a pool he cannot use is only points)

```
[[attune [[awakened|vitae|resolve]] [[off]]  (what this character can USE (a pool he cannot use is only points))]]
```

| argument | kind | meaning |
|---|---|---|
| `capability` | positional | `[awakened\|vitae\|resolve]` |
| `off` | positional | `[off]` |

**`[[show-help attune]]`** replies:

```
[SYSTEM: attune - attune [[awakened|vitae|resolve]] [[off]]  (what this character can USE (a pool he cannot use is only points))]
```

### `cancel-contest`

cancel an extended contest

```
[[cancel-contest [[id]]]]
```

| argument | kind | meaning |
|---|---|---|
| `id` | positional | `[id]` |

**`[[show-help cancel-contest]]`** replies:

```
[SYSTEM: cancel-contest - cancel-contest [[id]]  (cancel an extended contest)]
```

### `cancel-roll`

cancel an extended action

```
[[cancel-roll [[id]]]]
```

| argument | kind | meaning |
|---|---|---|
| `id` | positional | `[id]` |

**`[[show-help cancel-roll]]`** replies:

```
[SYSTEM: cancel-roll - cancel-roll [[id]]  (cancel an extended action)]
```

### `cancel-wizard`

abandon the running wizard

```
[[cancel-wizard]]
```

_No arguments._

**`[[show-help cancel-wizard]]`** replies:

```
[SYSTEM: cancel-wizard - cancel-wizard  (abandon the running wizard)]
```

### `cast`

@deprecated - use [[magick]] (Awakened magic); this name is wanted for Sorcery

```
[[cast pillars="name:level[,name:level...]" [foundation=<trait>] [quintessence=N] [label=".."] [requires=N] [extended=true] [ongoing=true] [interval=".."] [intervals=N] [on-botch=fail|lose-successes|ignore] [spend=<res[:effect][!]>] [spend-amount=N]  (@deprecated - use [[magick]] (Awakened magic); this name is wanted for Sorcery)]]
```

| argument | kind | meaning |
|---|---|---|
| `pillars` | named **required** | `"name:level[,name:level...]"` <br>*e.g.* `e.g. "warrior:4,chieftain:2"` |
| `foundation` | named | Foundation trait name (default: foundation) |
| `quintessence` | named `int` | Extra points: -1 difficulty each (min 4; 3/turn cap) |
| `label` | named | Spell name (keys the same-scene retry ledger) |
| `requires` | named `int` | Successes needed (extended/ongoing: the ST's total) |
| `extended` | named `enum` | Accrue successes over intervals — one of `true` |
| `ongoing` | named `enum` | Indefinite-duration spell (successes ×10; per-success fuel; seal at the end) — one of `true` |
| `interval` | named | Time between extended rolls (advisory) |
| `intervals` | named `int` | Max rolls for an extended casting |
| `on-botch` | named `enum` | Extended botch policy (default fail: Backlash ends it) — one of `fail`, `lose-successes`, `ignore` |
| `spend` | named | Resource to spend on the roll |
| `spend-amount` | named `int` | How many points to spend (default 1; a resource may cap it per use) |

**`[[show-help cast]]`** replies:

```
[SYSTEM: cast - cast pillars="name:level[,name:level...]" [foundation=<trait>] [quintessence=N] [label=".."] [requires=N] [extended=true] [ongoing=true] [interval=".."] [intervals=N] [on-botch=fail|lose-successes|ignore] [spend=<res[:effect][!]>] [spend-amount=N]  (@deprecated - use [[magick]] (Awakened magic); this name is wanted for Sorcery)]
```

### `choose`

pick a clan, a fellowship, or the Attribute/Ability priorities

```
[[choose [<clan|fellowship|attributes|abilities>] [<value>]]]
```

| argument | kind | meaning |
|---|---|---|
| `what` | positional | `<clan\|fellowship\|attributes\|abilities>` <br>*e.g.* `clan` |
| `value` | positional | `<value>` <br>*e.g.* `tremere` |

**`[[show-help choose]]`** replies:

```
[SYSTEM: choose - choose [<clan|fellowship|attributes|abilities>] [<value>]  (pick a clan, a fellowship, or the Attribute/Ability priorities)]
```

### `clear-boosts`

clear trait boosts (the ST calls the duration)

```
[[clear-boosts  (clear trait boosts (the ST calls the duration))]]
```

_No arguments._

**`[[show-help clear-boosts]]`** replies:

```
[SYSTEM: clear-boosts - clear-boosts  (clear trait boosts (the ST calls the duration))]
```

### `clear-steps`

drop all follow-up steps from a saved procedure (its entry roll stays)

```
[[clear-steps <procedure>  (drop all follow-up steps from a saved procedure (its entry roll stays))]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional **required** | `<procedure>` |

**`[[show-help clear-steps]]`** replies:

```
[SYSTEM: clear-steps - clear-steps <procedure>  (drop all follow-up steps from a saved procedure (its entry roll stays))]
```

### `configure-resources`

guided resource setup; plain replies answer it

```
[[configure-resources]]
```

_No arguments._

**`[[show-help configure-resources]]`** replies:

```
[SYSTEM: configure-resources - configure-resources  (guided resource setup; plain replies answer it)]
```

### `contest`

contested action: higher total wins (tie = draw)

```
[[contest <your-pool> <their-pool> [vs="Name"] [difficulty=N] [vs-difficulty=N] [table=".."] [spend=res[::effect][!]] [spend-amount=N]  (contested action: higher total wins (tie = draw))]]
```

| argument | kind | meaning |
|---|---|---|
| `your-pool` | positional **required** | `<your-pool>` |
| `their-pool` | positional **required** | `<their-pool>` |
| `vs` | named | Opposing character (stored characters roll live) |
| `difficulty` | named `int` | — |
| `vs-difficulty` | named `int` | — |
| `table` | named | Success table read with your margin |
| `spend` | named | `res[::effect][!]` <br>*e.g.* `blood  ·  blood::heal  ·  willpower!` |
| `spend-amount` | named `int` | How many points to spend (default 1) |

**`[[show-help contest]]`** replies:

```
[SYSTEM: contest - contest <your-pool> <their-pool> [vs="Name"] [difficulty=N] [vs-difficulty=N] [table=".."] [spend=res[::effect][!]] [spend-amount=N]  (contested action: higher total wins (tie = draw))]
```

### `continue-contest`

roll the next contest round

```
[[continue-contest [[id]] [difficulty=N] [vs-difficulty=N] [diff-mod=N] [dice-modifier=N] [tags="a,b"]]]
```

| argument | kind | meaning |
|---|---|---|
| `id` | positional | `[id]` |
| `difficulty` | named `int` | — |
| `vs-difficulty` | named `int` | — |
| `diff-mod` | named `int` | — |
| `dice-modifier` | named `int` | — |
| `tags` | named | `"a,b"` |

**`[[show-help continue-contest]]`** replies:

```
[SYSTEM: continue-contest - continue-contest [[id]] [difficulty=N] [vs-difficulty=N] [diff-mod=N] [dice-modifier=N] [tags="a,b"]  (roll the next contest round)]
```

### `continue-roll`

whoever is current rolls the next interval (named-only overrides)

```
[[continue-roll [[id]] [difficulty=N] [diff-mod=N] [dice-modifier=N] [tags="a,b"] [spend=res[::effect][!]] [spend-amount=N]  (whoever is current rolls the next interval (named-only overrides))]]
```

| argument | kind | meaning |
|---|---|---|
| `id` | positional | `[id]` |
| `difficulty` | named `int` | — |
| `diff-mod` | named `int` | — |
| `dice-modifier` | named `int` | — |
| `tags` | named | `"a,b"` |
| `spend` | named | `res[::effect][!]` <br>*e.g.* `blood  ·  blood::heal  ·  willpower!` |
| `spend-amount` | named `int` | How many points to spend (default 1) |

**`[[show-help continue-roll]]`** replies:

```
[SYSTEM: continue-roll - continue-roll [[id]] [difficulty=N] [diff-mod=N] [dice-modifier=N] [tags="a,b"] [spend=res[::effect][!]] [spend-amount=N]  (whoever is current rolls the next interval (named-only overrides))]
```

### `convert-cards`

rewrite any lorebook card still holding JSON in the readable format (one-shot)

```
[[convert-cards  (rewrite any lorebook card still holding JSON in the readable format (one-shot))]]
```

_No arguments._

**`[[show-help convert-cards]]`** replies:

```
[SYSTEM: convert-cards - convert-cards  (rewrite any lorebook card still holding JSON in the readable format (one-shot))]
```

### `create-playable`

create a playable character (attributes 1, abilities 0 - allocation is opt-in)

```
[[create-playable name=".." templates="a,b"  (create a playable character (attributes 1, abilities 0 - allocation is opt-in))]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | named **required** | Name <br>*e.g.* `e.g. Erik the Red` |
| `templates` | named **required** | Templates (comma-separated; hybrids legal) <br>*e.g.* `e.g. vampire` |

**`[[show-help create-playable]]`** replies:

```
[SYSTEM: create-playable - create-playable name=".." templates="a,b"  (create a playable character (attributes 1, abilities 0 - allocation is opt-in))]
```

### `creator-mode`

toggle lorebook hand-editing; edits sync in while on

```
[[creator-mode set=true|false]]
```

| argument | kind | meaning |
|---|---|---|
| `set` | named `enum` **required** | — — one of `true`, `false` |

**`[[show-help creator-mode]]`** replies:

```
[SYSTEM: creator-mode - creator-mode set=true|false  (toggle lorebook hand-editing; edits sync in while on)]
```

### `damage`

mark damage on the current character

```
[[damage <bashing|lethal|aggravated> [[n]]]]
```

| argument | kind | meaning |
|---|---|---|
| `severity` | positional `enum` **required** | `<bashing\|lethal\|aggravated>` — one of `bashing`, `lethal`, `aggravated` |
| `n` | positional | `[n]` |

**`[[show-help damage]]`** replies:

```
[SYSTEM: damage - damage <bashing|lethal|aggravated> [[n]]  (mark damage on the current character)]
```

### `define-affliction`

define/replace an affliction (overlay; may shadow a built-in)

```
[[define-affliction name=".." [bindings="target"] [duration="1 turn|until x|instant"] [then=".."] [mirror=".."] [tags="a,b"] [description=".."] [note=".."]  (define/replace an affliction (overlay; may shadow a built-in))]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | named **required** | Name <br>*e.g.* `e.g. dazed` |
| `bindings` | named | Required slots (comma-separated) <br>*e.g.* `e.g. target` |
| `duration` | named | Advisory duration |
| `then` | named | Successor affliction ([[advance]] applies it) |
| `mirror` | named | Affliction the bound target gains, bound back |
| `tags` | named | Tags joined to the afflicted character's rolls |
| `description` | named `literal` | Description |
| `note` | named | Note (optional) |

**`[[show-help define-affliction]]`** replies:

```
[SYSTEM: define-affliction - define-affliction name=".." [bindings="target"] [duration="1 turn|until x|instant"] [then=".."] [mirror=".."] [tags="a,b"] [description=".."] [note=".."]  (define/replace an affliction (overlay; may shadow a built-in))]
```

### `define-arcanum`

define an arcanum or taint (writes the srd:arcana overlay)

```
[[define-arcanum name=".." [kind=arcanum|taint] [points=<n|1,2,3>] [per-template="demon:7,thrall:5"] [param=".."] [templates="a,b"] [budget=".."] [limit-at=N] [limit-slots=N] [limit-per-kind=".."] [max-from-trait=".."] [passive=".."] [description=".."]  (define an arcanum or taint (writes the srd:arcana overlay); per-template= gives it a price per splat; kind=taint makes it GRANT points. NOT [[define-merit]] - a different list)]]
```

> per-template= gives it a price per splat; kind=taint makes it GRANT points. NOT [[define-merit]] - a different list

| argument | kind | meaning |
|---|---|---|
| `name` | named `literal` **required** | Name - BACKTICKS |
| `kind` | named `enum` | Default arcanum — one of `arcanum`, `taint` |
| `points` | named | Cost, or the ladder of allowed ratings |
| `per-template` | named | Price per template; `no` closes it to one |
| `param` | named | Instance-parameter slot (owned as name::value) |
| `templates` | named | Templates that may take it |
| `budget` | named | Which purse it trades in (default: arcana) <br>*e.g.* `arcana` |
| `limit-at` | named `int` | The rating that is rationed across instances <br>*e.g.* `3` |
| `limit-slots` | named `int` | How many instances may hold that rating (default 1) <br>*e.g.* `2` |
| `limit-per-kind` | named | And at most this many of a trait kind <br>*e.g.* `attribute:1` |
| `max-from-trait` | named | Rating ceiling is this trait <br>*e.g.* `resolve` |
| `passive` | named `literal` | Always-on ops, ";"-separated - BACKTICKS |
| `description` | named `literal` | Description - BACKTICKS |

**`[[show-help define-arcanum]]`** replies:

```
[SYSTEM: define-arcanum - define-arcanum name=".." [kind=arcanum|taint] [points=<n|1,2,3>] [per-template="demon:7,thrall:5"] [param=".."] [templates="a,b"] [budget=".."] [limit-at=N] [limit-slots=N] [limit-per-kind=".."] [max-from-trait=".."] [passive=".."] [description=".."]  (define an arcanum or taint (writes the srd:arcana overlay); per-template= gives it a price per splat; kind=taint makes it GRANT points. NOT [[define-merit]] - a different list)]
```

### `define-background`

define/replace a background (a Talisman that IS a place grants that place's ratings)

```
[[define-background name=".." [max=N] [templates="a,b"] [grants="trait:n,trait:n"] [description=".."]  (define/replace a background (a Talisman that IS a place grants that place's ratings))]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | named `literal` **required** | Name - BACKTICKS <br>*e.g.* `Talisman` |
| `max` | named `int` | Ceiling (default 5) <br>*e.g.* `5` |
| `templates` | named | Who may take it (blank = anyone) |
| `grants` | named | Other traits it confers <br>*e.g.* `cray:5,library:5,sanctum:5` |
| `description` | named `literal` | Description - BACKTICKS |

**`[[show-help define-background]]`** replies:

```
[SYSTEM: define-background - define-background name=".." [max=N] [templates="a,b"] [grants="trait:n,trait:n"] [description=".."]  (define/replace a background (a Talisman that IS a place grants that place's ratings))]
```

### `define-constraint`

define/replace a constraint group

```
[[define-constraint name=".." [relation=exclusive|restricted|forbidden] [domain=background|merit|flaw|meritflaw|arcanum|any] [members="a,b"] [max=N] [scope=".."] [note=".."]]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | named **required** | Name <br>*e.g.* `e.g. clan-only-backgrounds` |
| `relation` | named `enum` | Relation — one of `exclusive`, `restricted`, `forbidden` |
| `domain` | named `enum` | Domain — one of `background`, `merit`, `flaw`, `meritflaw`, `arcanum`, `any` |
| `members` | named | Members (comma-separated Backgrounds or Merits/Flaws) <br>*e.g.* `e.g. status, anonymity` |
| `max` | named `int` | Max to hold (exclusive only; default 1) |
| `scope` | named | Scope: templates/choices it applies to (comma-separated; empty = everyone) <br>*e.g.* `e.g. tzimisce` |
| `note` | named | Note (optional) |

**`[[show-help define-constraint]]`** replies:

```
[SYSTEM: define-constraint - define-constraint name=".." [relation=exclusive|restricted|forbidden] [domain=background|merit|flaw|meritflaw|arcanum|any] [members="a,b"] [max=N] [scope=".."] [note=".."]  (define/replace a constraint group)]
```

### `define-merit`

define a merit or flaw (writes the srd:merits-flaws overlay)

```
[[define-merit name=`<name>` [kind=merit|flaw] [points=<n|1,2,3>] [passive=`<op>[:<target>] [+N] [if=] [while=]`] [param=".."] [templates="a,b"] [budget=".."] [per-template="vampire:3,ghoul:1"] [limit-at=N] [limit-slots=N] [limit-per-kind=".."] [max-from-trait=".."] [description=`<text>`]  (define a merit or flaw (writes the srd:merits-flaws overlay); kind= takes merit or flaw ONLY - an arcanum is not a merit; use [[define-arcanum]])]]
```

> kind= takes merit or flaw ONLY - an arcanum is not a merit; use [[define-arcanum]]

| argument | kind | meaning |
|---|---|---|
| `name` | named `literal` **required** | ``<name>`` <br>*e.g.* `e.g. `Inviolate Soul`` |
| `kind` | named `enum` | Merits cost freebies, flaws grant them (default merit) — one of `merit`, `flaw` |
| `points` | named | Cost, or the ladder of allowed ratings (default 0) |
| `passive` | named `literal` | Always-on ops, ";"-separated (or a raw JSON array) - BACKTICKS |
| `param` | named | Instance-parameter slot (owned as name::value) |
| `templates` | named | Templates that may take it |
| `budget` | named | Which purse it trades in (default: freebie) <br>*e.g.* `freebie` |
| `per-template` | named | Price per template; `no` closes it to one <br>*e.g.* `vampire:3,ghoul:1` |
| `limit-at` | named `int` | The rating that is rationed across instances <br>*e.g.* `3` |
| `limit-slots` | named `int` | How many instances may hold that rating (default 1) <br>*e.g.* `2` |
| `limit-per-kind` | named | And at most this many of a trait kind <br>*e.g.* `attribute:1` |
| `max-from-trait` | named | Rating ceiling is this trait ("no more purchases than his Resolve") <br>*e.g.* `resolve` |
| `description` | named `literal` | Rules text |

**`[[show-help define-merit]]`** replies:

```
[SYSTEM: define-merit - define-merit name=`<name>` [kind=merit|flaw] [points=<n|1,2,3>] [passive=`<op>[:<target>] [+N] [if=] [while=]`] [param=".."] [templates="a,b"] [budget=".."] [per-template="vampire:3,ghoul:1"] [limit-at=N] [limit-slots=N] [limit-per-kind=".."] [max-from-trait=".."] [description=`<text>`]  (define a merit or flaw (writes the srd:merits-flaws overlay); kind= takes merit or flaw ONLY - an arcanum is not a merit; use [[define-arcanum]])]
```

### `define-resource`

define a pool or tracker a template can then grant

```
[[define-resource <name> [kind=pool|tracker] [start=N] [max=N] [roles="a,b"] [replaces="a,b"] [requires="vitae"] [per-turn=N] [description=<text>]]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional **required** | `<name>` <br>*e.g.* `Living Resolve` |
| `kind` | named `enum` | — — one of `pool`, `tracker` |
| `start` | named `int` | What it starts at |
| `max` | named `int` | Its ceiling |
| `roles` | named | Names it also answers to (blood, willpower, magic-fuel...) |
| `replaces` | named | Resources it stands in for, hiding them |
| `requires` | named | What a character must be able to USE (awakened, vitae, resolve, arcana) to spend it at all |
| `per-turn` | named `int` | Most that may be spent in one turn |
| `description` | named | `<text>` |

**`[[show-help define-resource]]`** replies:

```
[SYSTEM: define-resource - define-resource <name> [kind=pool|tracker] [start=N] [max=N] [roles="a,b"] [replaces="a,b"] [requires="vitae"] [per-turn=N] [description=<text>]  (define a pool or tracker a template can then grant)]
```

### `define-table`

define/replace a success table in its category's general card

```
[[define-table name="[sub::]name" [rows=`1:Cowed, 3:Terrified[=2]`] [value-per-success=N] [cap=N] [overflow-per=N] [overflow-value=N] [overflow-label=".."] [botch=".."] [failure=".."] [description=".."]]]
```

> a missing subcategory prompts a modal to create it

| argument | kind | meaning |
|---|---|---|
| `name` | named **required** | Name (optionally sub::name) <br>*e.g.* `e.g. combat::quick-kill` |
| `rows` | named `literal` | Ladder rows: <successes>:<label>[=<value>], separated by ; (or , when no label needs one) <br>*e.g.* `e.g. 1:Cowed, 3:Terrified` |
| `value-per-success` | named `int` | Direct numeric output per success |
| `cap` | named `int` | Successes beyond this are wasted |
| `overflow-per` | named `int` | Batch size beyond the last row |
| `overflow-value` | named `int` | Value added per overflow batch |
| `overflow-label` | named `literal` | Overflow annotation |
| `botch` | named `literal` | What a botch means here |
| `failure` | named `literal` | What failure means here |
| `description` | named `literal` | Description |

**`[[show-help define-table]]`** replies:

```
[SYSTEM: define-table - define-table name="[sub::]name" [rows=`1:Cowed, 3:Terrified[=2]`] [value-per-success=N] [cap=N] [overflow-per=N] [overflow-value=N] [overflow-label=".."] [botch=".."] [failure=".."] [description=".."]  (define/replace a success table in its category's general card; a missing subcategory prompts a modal to create it)]
```

### `define-table-category`

create a table subcategory (a real lorebook category with its general card)

```
[[define-table-category name=".."  (create a table subcategory (a real lorebook category with its general card))]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | named **required** | Category name (single segment) <br>*e.g.* `e.g. combat` |

**`[[show-help define-table-category]]`** replies:

```
[SYSTEM: define-table-category - define-table-category name=".."  (create a table subcategory (a real lorebook category with its general card))]
```

### `downtime`

close the current scene and gloss the clock forward

```
[[downtime <duration>]]
```

| argument | kind | meaning |
|---|---|---|
| `duration` | positional **required** | `<duration>` <br>*e.g.* `3d` |

**`[[show-help downtime]]`** replies:

```
[SYSTEM: downtime - downtime <duration>  (close the current scene and gloss the clock forward)]
```

### `drop-arcanum`

drop an owned arcanum or taint (its passives lift with it)

```
[[drop-arcanum <name[::param]>  (drop an owned arcanum or taint (its passives lift with it))]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional **required** | `<name[::param]>` |

**`[[show-help drop-arcanum]]`** replies:

```
[SYSTEM: drop-arcanum - drop-arcanum <name[::param]>  (drop an owned arcanum or taint (its passives lift with it))]
```

### `drop-merit`

drop an owned merit/flaw instance

```
[[drop-merit <name[::param]>]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional **required** | `<name[::param]>` |

**`[[show-help drop-merit]]`** replies:

```
[SYSTEM: drop-merit - drop-merit <name[::param]>  (drop an owned merit/flaw instance)]
```

### `end-scene`

close the current scene

```
[[end-scene]]
```

_No arguments._

**`[[show-help end-scene]]`** replies:

```
[SYSTEM: end-scene - end-scene  (close the current scene)]
```

### `enter-library`

enter your library (applies in-library)

```
[[enter-library  (enter your library (applies in-library))]]
```

_No arguments._

**`[[show-help enter-library]]`** replies:

```
[SYSTEM: enter-library - enter-library  (enter your library (applies in-library))]
```

### `enter-sanctum`

enter your sanctum (applies in-sanctum)

```
[[enter-sanctum  (enter your sanctum (applies in-sanctum))]]
```

_No arguments._

**`[[show-help enter-sanctum]]`** replies:

```
[SYSTEM: enter-sanctum - enter-sanctum  (enter your sanctum (applies in-sanctum))]
```

### `exit-library`

leave your library (lifts in-library)

```
[[exit-library  (leave your library (lifts in-library))]]
```

_No arguments._

**`[[show-help exit-library]]`** replies:

```
[SYSTEM: exit-library - exit-library  (leave your library (lifts in-library))]
```

### `exit-sanctum`

leave your sanctum (lifts in-sanctum)

```
[[exit-sanctum  (leave your sanctum (lifts in-sanctum))]]
```

_No arguments._

**`[[show-help exit-sanctum]]`** replies:

```
[SYSTEM: exit-sanctum - exit-sanctum  (leave your sanctum (lifts in-sanctum))]
```

### `extend-template`

a new template from an old one: state only what differs

```
[[extend-template <name> [extends=<template>] [description=<text>] [soak=mortal|vampire|ghoul|mage|demon|werewolf] [morality=humanity|torment|none] [awakened=true|false] [has-virtues=true|false] [resources="a,b"] [capabilities="vitae,resolve"] [budgets="arcana=role:willpower"] [creation="disciplines=4"] [disciplines="celerity,potence"]]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional **required** | `<name>` <br>*e.g.* `Ouroboros` |
| `extends` | named | The template it inherits everything else from <br>*e.g.* `mage` |
| `description` | named | Its display name |
| `soak` | named `enum` | Which soak table it uses — one of `mortal`, `vampire`, `ghoul`, `mage`, `demon`, `werewolf` |
| `morality` | named `enum` | Its Road/Humanity, or none — one of `humanity`, `torment`, `none` |
| `awakened` | named `enum` | Does it work Awakened magic? — one of `true`, `false` |
| `has-virtues` | named `enum` | — — one of `true`, `false` |
| `resources` | named | Resources to ADD (define them first with [[define-resource]]) |
| `capabilities` | named | What it can USE, added to the parent's |
| `budgets` | named | Any part of any purse: "purse=<allowance expression>", or "purse:freebie=" / "purse:experience=" for what a dot costs ("-" = cannot be bought) <br>*e.g.* `arcana=role:willpower,arcana:freebie=-` |
| `creation` | named | The creation pools: attribute-start, attribute-max, ability-start, ability-max, backgrounds, freebies, disciplines, discipline-max, virtues, virtue-start <br>*e.g.* `disciplines=4,discipline-max=5` |
| `disciplines` | named | The Disciplines that are its own; a leading = means these and no family's <br>*e.g.* `=celerity,potence` |

**`[[show-help extend-template]]`** replies:

```
[SYSTEM: extend-template - extend-template <name> [extends=<template>] [description=<text>] [soak=mortal|vampire|ghoul|mage|demon|werewolf] [morality=humanity|torment|none] [awakened=true|false] [has-virtues=true|false] [resources="a,b"] [capabilities="vitae,resolve"] [budgets="arcana=role:willpower"] [creation="disciplines=4"] [disciplines="celerity,potence"]  (a new template from an old one: state only what differs)]
```

### `extended-contest`

both sides accumulate; first to the goal wins (dead heat stays open)

```
[[extended-contest <your-pool> <their-pool> target=<n> rounds=<max> [vs="Name"] [label=".."] [interval=".."] [on-botch=fail|lose-successes|ignore] [difficulty=N] [vs-difficulty=N]  (both sides accumulate; first to the goal wins (dead heat stays open))]]
```

| argument | kind | meaning |
|---|---|---|
| `your-pool` | positional **required** | `<your-pool>` |
| `their-pool` | positional **required** | `<their-pool>` |
| `target` | named `int` **required** | Accumulated successes to win |
| `rounds` | named `int` **required** | Maximum rounds |
| `vs` | named | `"Name"` |
| `label` | named `literal` | Display label |
| `interval` | named | In-fiction spacing (ST-enforced) |
| `on-botch` | named `enum` | — — one of `fail`, `lose-successes`, `ignore` |
| `difficulty` | named `int` | — |
| `vs-difficulty` | named `int` | — |

**`[[show-help extended-contest]]`** replies:

```
[SYSTEM: extended-contest - extended-contest <your-pool> <their-pool> target=<n> rounds=<max> [vs="Name"] [label=".."] [interval=".."] [on-botch=fail|lose-successes|ignore] [difficulty=N] [vs-difficulty=N]  (both sides accumulate; first to the goal wins (dead heat stays open))]
```

### `extended-roll`

start an extended action (rolls interval 1 now)

```
[[extended-roll <pool> requires=<target> intervals=<max> [interval=".."] [label=".."] [on-botch=fail|lose-successes|ignore] [difficulty=N] [dice-modifier=N] [tags="a,b"] [spend=res[::effect][!]] [spend-amount=N]  (start an extended action (rolls interval 1 now); plus the usual roll knobs)]]
```

> plus the usual roll knobs

| argument | kind | meaning |
|---|---|---|
| `pool` | positional **required** | `<pool>` |
| `requires` | named `int` **required** | Accumulated successes to reach |
| `intervals` | named `int` **required** | Maximum rolls |
| `interval` | named | In-fiction spacing (ST-enforced) <br>*e.g.* `e.g. 1 night` |
| `label` | named `literal` | Display label |
| `on-botch` | named `enum` | — — one of `fail`, `lose-successes`, `ignore` |
| `difficulty` | named `int` | — |
| `dice-modifier` | named `int` | — |
| `tags` | named | `"a,b"` |
| `spend` | named | `res[::effect][!]` <br>*e.g.* `blood  ·  blood::heal  ·  willpower!` |
| `spend-amount` | named `int` | How many points to spend (default 1) |

**`[[show-help extended-roll]]`** replies:

```
[SYSTEM: extended-roll - extended-roll <pool> requires=<target> intervals=<max> [interval=".."] [label=".."] [on-botch=fail|lose-successes|ignore] [difficulty=N] [dice-modifier=N] [tags="a,b"] [spend=res[::effect][!]] [spend-amount=N]  (start an extended action (rolls interval 1 now); plus the usual roll knobs)]
```

### `flush-context`

clean the story now: strip engine notes and hidden blocks (run this if things feel slow)

```
[[flush-context  (clean the story now: strip engine notes and hidden blocks (run this if things feel slow))]]
```

_No arguments._

**`[[show-help flush-context]]`** replies:

```
[SYSTEM: flush-context - flush-context  (clean the story now: strip engine notes and hidden blocks (run this if things feel slow))]
```

### `forget-affliction`

remove an overlay definition; built-ins can only be shadowed

```
[[forget-affliction <name>]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional **required** | `<name>` |

**`[[show-help forget-affliction]]`** replies:

```
[SYSTEM: forget-affliction - forget-affliction <name>  (remove an overlay definition; built-ins can only be shadowed)]
```

### `forget-alias`

remove an alias (bare @a = global; scoped tokens as in alias)

```
[[forget-alias <@token>  (remove an alias (bare @a = global; scoped tokens as in alias))]]
```

| argument | kind | meaning |
|---|---|---|
| `token` | positional **required** | `<@token>` |

**`[[show-help forget-alias]]`** replies:

```
[SYSTEM: forget-alias - forget-alias <@token>  (remove an alias (bare @a = global; scoped tokens as in alias))]
```

### `forget-arcanum`

remove a custom arcanum/taint definition (a built-in resurfaces)

```
[[forget-arcanum <name>  (remove a custom arcanum/taint definition (a built-in resurfaces))]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional **required** | `<name>` |

**`[[show-help forget-arcanum]]`** replies:

```
[SYSTEM: forget-arcanum - forget-arcanum <name>  (remove a custom arcanum/taint definition (a built-in resurfaces))]
```

### `forget-background`

remove a custom background (a built-in resurfaces)

```
[[forget-background <name>  (remove a custom background (a built-in resurfaces))]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional **required** | `<name>` |

**`[[show-help forget-background]]`** replies:

```
[SYSTEM: forget-background - forget-background <name>  (remove a custom background (a built-in resurfaces))]
```

### `forget-constraint`

remove a constraint group

```
[[forget-constraint <name>]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional **required** | `<name>` |

**`[[show-help forget-constraint]]`** replies:

```
[SYSTEM: forget-constraint - forget-constraint <name>  (remove a constraint group)]
```

### `forget-date`

delete a saved date bookmark

```
[[forget-date <name>]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional **required** | `<name>` |

**`[[show-help forget-date]]`** replies:

```
[SYSTEM: forget-date - forget-date <name>  (delete a saved date bookmark)]
```

### `forget-grant`

drop a grant - the thing goes back to being bought normally

```
[[forget-grant <trait|purse>]]
```

| argument | kind | meaning |
|---|---|---|
| `what` | positional **required** | `<trait\|purse>` |

**`[[show-help forget-grant]]`** replies:

```
[SYSTEM: forget-grant - forget-grant <trait|purse>  (drop a grant - the thing goes back to being bought normally)]
```

### `forget-merit`

delete a custom merit/flaw definition (built-ins resurface)

```
[[forget-merit <name>  (delete a custom merit/flaw definition (built-ins resurface))]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional **required** | `<name>` |

**`[[show-help forget-merit]]`** replies:

```
[SYSTEM: forget-merit - forget-merit <name>  (delete a custom merit/flaw definition (built-ins resurface))]
```

### `forget-roll`

delete a saved roll

```
[[forget-roll <name>]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional **required** | `<name>` |

**`[[show-help forget-roll]]`** replies:

```
[SYSTEM: forget-roll - forget-roll <name>  (delete a saved roll)]
```

### `forget-scene`

delete a scene record

```
[[forget-scene <name>]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional **required** | `<name>` |

**`[[show-help forget-scene]]`** replies:

```
[SYSTEM: forget-scene - forget-scene <name>  (delete a scene record)]
```

### `forget-specialty`

remove a specialty (label needed only when a trait has several)

```
[[forget-specialty <trait> [[`<Label>`]]  (remove a specialty (label needed only when a trait has several))]]
```

| argument | kind | meaning |
|---|---|---|
| `trait` | positional **required** | `<trait>` |
| `label` | positional `literal` | `[`<Label>`]` |

**`[[show-help forget-specialty]]`** replies:

```
[SYSTEM: forget-specialty - forget-specialty <trait> [[`<Label>`]]  (remove a specialty (label needed only when a trait has several))]
```

### `forget-table`

remove a table from its category's general card; built-ins can only be shadowed

```
[[forget-table <[sub::]name|@alias>]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional **required** | `<[sub::]name\|@alias>` |

**`[[show-help forget-table]]`** replies:

```
[SYSTEM: forget-table - forget-table <[sub::]name|@alias>  (remove a table from its category's general card; built-ins can only be shadowed)]
```

### `forget-table-alias`

remove a table alias

```
[[forget-table-alias <@alias>]]
```

| argument | kind | meaning |
|---|---|---|
| `token` | positional **required** | `<@alias>` |

**`[[show-help forget-table-alias]]`** replies:

```
[SYSTEM: forget-table-alias - forget-table-alias <@alias>  (remove a table alias)]
```

### `forget-template`

drop a chronicle template (the shipped one, if any, resurfaces)

```
[[forget-template <name>  (drop a chronicle template (the shipped one, if any, resurfaces))]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional **required** | `<name>` |

**`[[show-help forget-template]]`** replies:

```
[SYSTEM: forget-template - forget-template <name>  (drop a chronicle template (the shipped one, if any, resurfaces))]
```

### `gain`

regain a resource

```
[[gain <resource> [[amount]]]]
```

| argument | kind | meaning |
|---|---|---|
| `resource` | positional **required** | `<resource>` |
| `amount` | positional | `[amount]` |

**`[[show-help gain]]`** replies:

```
[SYSTEM: gain - gain <resource> [[amount]]  (regain a resource)]
```

### `grant`

where something came from when it wasn't bought: a template's free dot, or a Storyteller's bonus

```
[[grant [<trait|merit|purse>] [[points]] [source=freebies|arcana|template|clan|background|storyteller|experience|maturation] [note=<text>]]]
```

| argument | kind | meaning |
|---|---|---|
| `what` | positional | `<trait\|merit\|purse>` <br>*e.g.* `potence  ·  freebie` |
| `points` | positional `int` | Given: this ADDS to that purse |
| `source` | named `enum` | Where it came from (default: storyteller) — one of `freebies`, `arcana`, `template`, `clan`, `background`, `storyteller`, `experience`, `maturation` |
| `note` | named | `<text>` <br>*e.g.* `everyone in this chronicle is Suspect` |

**`[[show-help grant]]`** replies:

```
[SYSTEM: grant - grant [<trait|merit|purse>] [[points]] [source=freebies|arcana|template|clan|background|storyteller|experience|maturation] [note=<text>]  (where something came from when it wasn't bought: a template's free dot, or a Storyteller's bonus)]
```

### `harvest`

draw Quintessence from the cray ritually (no roll; overdrawing costs the site a dot)

```
[[harvest [[points]] [time=".."]  (draw Quintessence from the cray ritually (no roll; overdrawing costs the site a dot))]]
```

| argument | kind | meaning |
|---|---|---|
| `points` | positional `int` | `[points]` <br>*e.g.* `3` |
| `time` | named | How long the ritual takes (advances the clock) <br>*e.g.* `2h` |

**`[[show-help harvest]]`** replies:

```
[SYSTEM: harvest - harvest [[points]] [time=".."]  (draw Quintessence from the cray ritually (no roll; overdrawing costs the site a dot))]
```

### `help`

list commands, or show one's usage

```
[[help [<verb>]]]
```

| argument | kind | meaning |
|---|---|---|
| `verb` | positional | `<verb>` |

**`[[show-help help]]`** replies:

```
[SYSTEM: help is now [[show-help]] - it still works. show-help - show-help [verb|@all] [in=<where>] [in-story=true]  (list commands, or show one's usage)]
```

### `hide`

write to the current scene's private plan (mirrored into the Author's Note)

```
[[hide [text=".."] [op=append|overwrite]  (write to the current scene's private plan (mirrored into the Author's Note); the AI does this automatically via <hide op=append|overwrite>...</hide> in its narration)]]
```

> the AI does this automatically via <hide op=append|overwrite>...</hide> in its narration

| argument | kind | meaning |
|---|---|---|
| `text` | named `literal` | The plan text (verbatim) |
| `op` | named `enum` | Append (default) or overwrite the plan — one of `append`, `overwrite` |

**`[[show-help hide]]`** replies:

```
[SYSTEM: hide - hide [text=".."] [op=append|overwrite]  (write to the current scene's private plan (mirrored into the Author's Note); the AI does this automatically via <hide op=append|overwrite>...</hide> in its narration)]
```

### `invoke`

use a power that OFFERS an affliction rather than applying it automatically

```
[[invoke <affliction>]]
```

| argument | kind | meaning |
|---|---|---|
| `affliction` | positional **required** | `<affliction>` |

**`[[show-help invoke]]`** replies:

```
[SYSTEM: invoke - invoke <affliction>  (use a power that OFFERS an affliction rather than applying it automatically)]
```

### `leave-library`

step back through the measured door

```
[[leave-library]]
```

_No arguments._

**`[[show-help leave-library]]`** replies:

```
[SYSTEM: leave-library - leave-library  (step back through the measured door)]
```

### `lift`

remove an affliction - and its mirror; spend = shrug-off

```
[[lift <affliction> [on=<name|@alias>] [spend=res[::effect][!]] [spend-amount=N]]]
```

| argument | kind | meaning |
|---|---|---|
| `affliction` | positional **required** | `<affliction>` |
| `on` | named | `<name\|@alias>` |
| `spend` | named | `res[::effect][!]` <br>*e.g.* `blood  ·  blood::heal  ·  willpower!` |
| `spend-amount` | named `int` | How many points to spend (default 1) |

**`[[show-help lift]]`** replies:

```
[SYSTEM: lift - lift <affliction> [on=<name|@alias>] [spend=res[::effect][!]] [spend-amount=N]  (remove an affliction - and its mirror; spend = shrug-off)]
```

### `magick`

work Awakened magick (Dark Ages: Mage) - pillars carry the REQUIRED levels

```
[[magick pillars="name:level[,name:level...]" [foundation=<trait>] [quintessence=N] [label=".."] [requires=N] [extended=true] [ongoing=true] [interval=".."] [intervals=N] [on-botch=fail|lose-successes|ignore] [spend=<res[:effect][!]>] [spend-amount=N]  (work Awakened magick (Dark Ages: Mage) - pillars carry the REQUIRED levels)]]
```

| argument | kind | meaning |
|---|---|---|
| `pillars` | named **required** | `"name:level[,name:level...]"` <br>*e.g.* `e.g. "warrior:4,chieftain:2"` |
| `foundation` | named | Foundation trait name (default: foundation) |
| `quintessence` | named `int` | Extra points: -1 difficulty each (min 4; 3/turn cap) |
| `label` | named | Spell name (keys the same-scene retry ledger) |
| `requires` | named `int` | Successes needed (extended/ongoing: the ST's total) |
| `extended` | named `enum` | Accrue successes over intervals — one of `true` |
| `ongoing` | named `enum` | Indefinite-duration spell (successes ×10; per-success fuel; seal at the end) — one of `true` |
| `interval` | named | Time between extended rolls (advisory) |
| `intervals` | named `int` | Max rolls for an extended casting |
| `on-botch` | named `enum` | Extended botch policy (default fail: Backlash ends it) — one of `fail`, `lose-successes`, `ignore` |
| `spend` | named | Resource to spend on the roll |
| `spend-amount` | named `int` | How many points to spend (default 1; a resource may cap it per use) |

**`[[show-help magick]]`** replies:

```
[SYSTEM: magick - magick pillars="name:level[,name:level...]" [foundation=<trait>] [quintessence=N] [label=".."] [requires=N] [extended=true] [ongoing=true] [interval=".."] [intervals=N] [on-botch=fail|lose-successes|ignore] [spend=<res[:effect][!]>] [spend-amount=N]  (work Awakened magick (Dark Ages: Mage) - pillars carry the REQUIRED levels)]
```

### `measure-door`

the Talisman ritual: ten minutes measuring a door opens the Library of the Unseen

```
[[measure-door]]
```

_No arguments._

**`[[show-help measure-door]]`** replies:

```
[SYSTEM: measure-door - measure-door  (the Talisman ritual: ten minutes measuring a door opens the Library of the Unseen)]
```

### `name-roll`

save a roll under a name; @name invokes it with its spend/specialty/table baked in (extended=true makes a procedure, opposed= makes a contest)

```
[[name-roll <name> <pool> [[difficulty|expr]] [[diff-mod]] [requires=N] [dice-modifier=N] [min-difficulty=N] [successes=N] [uncancelable=N] [tags="a,b"] [spend=res[::effect][!]] [spend-amount=N] [specialty=<trait|label>] [table=".."] [extended=true] [intervals=N] [interval=".."] [on-botch=fail|lose-successes|ignore] [opposed=resisted|contested] [vs-pool=".."] [vs-difficulty=N] [description=".."]  (save a roll under a name; @name invokes it with its spend/specialty/table baked in (extended=true makes a procedure, opposed= makes a contest))]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional **required** | `<name>` |
| `pool` | positional **required** | `<pool>` |
| `difficulty` | positional | `[difficulty\|expr]` |
| `diff-mod` | positional | `[diff-mod]` |
| `requires` | named `int` | Successes required |
| `dice-modifier` | named `int` | Dice added or removed |
| `min-difficulty` | named `int` | Floor the die target never drops below (overrides the chronicle's) |
| `successes` | named `int` | Automatic successes, granted before the dice (a rolled 1 can cancel these) |
| `uncancelable` | named `int` | Un-cancelable successes: certain ones no rolled 1 can ever take away |
| `tags` | named | Roll tags (fire registered modifiers) |
| `spend` | named | Resource to spend on the roll — "::effect" picks a named effect, "!" means no payment, no roll <br>*e.g.* `blood  ·  blood::heal  ·  willpower!` |
| `spend-amount` | named `int` | How many points to spend (default 1; a resource may cap it per use) |
| `specialty` | named | Apply ONE specialty (+1 die; pool must use its trait) <br>*e.g.* `Swords  ·  or its trait: melee` |
| `table` | named | Success table read when the roll is invoked |
| `extended` | named `enum` | Make it an extended procedure (target supplied at invoke) — one of `true` |
| `intervals` | named `int` | Extended: default max rolls |
| `interval` | named | Extended: advisory spacing (e.g. 1 turn) |
| `on-botch` | named `enum` | Extended: botch policy — one of `fail`, `lose-successes`, `ignore` |
| `opposed` | named `enum` | Make it a contest (opponent supplied at invoke via vs=); with extended=, a race — one of `resisted`, `contested` |
| `vs-pool` | named | Opposed: the opposition's pool (default: your own pool) |
| `vs-difficulty` | named `int` | Opposed: default difficulty for the opposition's roll |
| `description` | named `literal` | Rules prose (verbatim) |

**`[[show-help name-roll]]`** replies:

```
[SYSTEM: name-roll - name-roll <name> <pool> [[difficulty|expr]] [[diff-mod]] [requires=N] [dice-modifier=N] [min-difficulty=N] [successes=N] [uncancelable=N] [tags="a,b"] [spend=res[::effect][!]] [spend-amount=N] [specialty=<trait|label>] [table=".."] [extended=true] [intervals=N] [interval=".."] [on-botch=fail|lose-successes|ignore] [opposed=resisted|contested] [vs-pool=".."] [vs-difficulty=N] [description=".."]  (save a roll under a name; @name invokes it with its spend/specialty/table baked in (extended=true makes a procedure, opposed= makes a contest))]
```

### `paid`

record what a purchase really cost (no expression = the Storyteller granted it)

```
[[paid [<trait|merit-key>] [[expr|listed]]  (record what a purchase really cost (no expression = the Storyteller granted it))]]
```

| argument | kind | meaning |
|---|---|---|
| `key` | positional | `<trait\|merit-key>` <br>*e.g.* `mentor` |
| `expr` | positional | `[expr\|listed]` <br>*e.g.* `0` |

**`[[show-help paid]]`** replies:

```
[SYSTEM: paid - paid [<trait|merit-key>] [[expr|listed]]  (record what a purchase really cost (no expression = the Storyteller granted it))]
```

### `play`

switch to a character; no name selects the default

```
[[play [name="<name|@alias>"]]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | named | `"<name\|@alias>"` |

**`[[show-help play]]`** replies:

```
[SYSTEM: play - play [name="<name|@alias>"]  (switch to a character; no name selects the default)]
```

### `player`

show or switch the current player; storyteller is always valid

```
[[player [name="<id>"] [default=true]]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | named | `"<id>"` |
| `default` | named `enum` | Also make it the default player — one of `true` |

**`[[show-help player]]`** replies:

```
[SYSTEM: player - player [name="<id>"] [default=true]  (show or switch the current player; storyteller is always valid)]
```

### `research`

search the library: Intelligence + Library (must be in it)

```
[[research <topic> [difficulty=N] [tags="a,b"]  (search the library: Intelligence + Library (must be in it))]]
```

| argument | kind | meaning |
|---|---|---|
| `topic` | positional **required** | `<topic>` <br>*e.g.* ``the seals of Belial`` |
| `difficulty` | named `int` | How obscure the secret is (default 6) |
| `tags` | named | Roll tags (e.g. hermetic, in the rotunda) |

**`[[show-help research]]`** replies:

```
[SYSTEM: research - research <topic> [difficulty=N] [tags="a,b"]  (search the library: Intelligence + Library (must be in it))]
```

### `reset-uses`

scene/turn change: clears effect-use counters

```
[[reset-uses]]
```

_No arguments._

**`[[show-help reset-uses]]`** replies:

```
[SYSTEM: reset-uses - reset-uses  (scene/turn change: clears effect-use counters)]
```

### `resist`

resisted action: your margin over theirs counts (tie = fail)

```
[[resist <your-pool> <their-pool> [vs="Name"] [difficulty=N] [vs-difficulty=N] [table=".."] [spend=res[::effect][!]] [spend-amount=N]  (resisted action: your margin over theirs counts (tie = fail))]]
```

| argument | kind | meaning |
|---|---|---|
| `your-pool` | positional **required** | `<your-pool>` |
| `their-pool` | positional **required** | `<their-pool>` |
| `vs` | named | Opposing character (stored characters roll live) |
| `difficulty` | named `int` | — |
| `vs-difficulty` | named `int` | — |
| `table` | named | Success table read with your margin |
| `spend` | named | `res[::effect][!]` <br>*e.g.* `blood  ·  blood::heal  ·  willpower!` |
| `spend-amount` | named `int` | How many points to spend (default 1) |

**`[[show-help resist]]`** replies:

```
[SYSTEM: resist - resist <your-pool> <their-pool> [vs="Name"] [difficulty=N] [vs-difficulty=N] [table=".."] [spend=res[::effect][!]] [spend-amount=N]  (resisted action: your margin over theirs counts (tie = fail))]
```

### `roll`

roll a dice pool for the current character

```
[[roll <pool|@name> [[difficulty|expr]] [[diff-mod]] [requires=N] [dice-modifier=N] [min-difficulty=N] [successes=N] [uncancelable=N] [tags="a,b"] [spend=res[::effect][!]] [spend-amount=N] [specialty=<trait|label>] [table=".."]]]
```

| argument | kind | meaning |
|---|---|---|
| `pool` | positional **required** | `<pool\|@name>` |
| `difficulty` | positional | `[difficulty\|expr]` |
| `diff-mod` | positional | `[diff-mod]` |
| `requires` | named `int` | Successes required |
| `dice-modifier` | named `int` | Dice added or removed |
| `min-difficulty` | named `int` | Floor the die target never drops below (overrides the chronicle's) |
| `successes` | named `int` | Automatic successes, granted before the dice (a rolled 1 can cancel these) |
| `uncancelable` | named `int` | Un-cancelable successes: certain ones no rolled 1 can ever take away |
| `tags` | named | Roll tags (fire registered modifiers) |
| `spend` | named | Resource to spend on the roll — "::effect" picks a named effect, "!" means no payment, no roll <br>*e.g.* `blood  ·  blood::heal  ·  willpower!` |
| `spend-amount` | named `int` | How many points to spend (default 1; a resource may cap it per use) |
| `specialty` | named | Apply ONE specialty (+1 die; pool must use its trait) <br>*e.g.* `Swords  ·  or its trait: melee` |
| `table` | named | Success table to read the outcome |

**`[[show-help roll]]`** replies:

```
[SYSTEM: roll - roll <pool|@name> [[difficulty|expr]] [[diff-mod]] [requires=N] [dice-modifier=N] [min-difficulty=N] [successes=N] [uncancelable=N] [tags="a,b"] [spend=res[::effect][!]] [spend-amount=N] [specialty=<trait|label>] [table=".."]  (roll a dice pool for the current character)]
```

### `roll-for`

roll for a named character without switching to them

```
[[roll-for "<name|@alias>" <pool|@name> [[difficulty|expr]] [[diff-mod]] [requires=N] [dice-modifier=N] [min-difficulty=N] [successes=N] [uncancelable=N] [tags="a,b"] [spend=res[::effect][!]] [spend-amount=N] [specialty=<trait|label>] [table=".."]]]
```

| argument | kind | meaning |
|---|---|---|
| `character` | positional **required** | `"<name\|@alias>"` |
| `pool` | positional **required** | `<pool\|@name>` |
| `difficulty` | positional | `[difficulty\|expr]` |
| `diff-mod` | positional | `[diff-mod]` |
| `requires` | named `int` | Successes required |
| `dice-modifier` | named `int` | Dice added or removed |
| `min-difficulty` | named `int` | Floor the die target never drops below (overrides the chronicle's) |
| `successes` | named `int` | Automatic successes, granted before the dice (a rolled 1 can cancel these) |
| `uncancelable` | named `int` | Un-cancelable successes: certain ones no rolled 1 can ever take away |
| `tags` | named | Roll tags (fire registered modifiers) |
| `spend` | named | Resource to spend on the roll — "::effect" picks a named effect, "!" means no payment, no roll <br>*e.g.* `blood  ·  blood::heal  ·  willpower!` |
| `spend-amount` | named `int` | How many points to spend (default 1; a resource may cap it per use) |
| `specialty` | named | Apply ONE specialty (+1 die; pool must use its trait) <br>*e.g.* `Swords  ·  or its trait: melee` |
| `table` | named | Success table to read the outcome |

**`[[show-help roll-for]]`** replies:

```
[SYSTEM: roll-for - roll-for "<name|@alias>" <pool|@name> [[difficulty|expr]] [[diff-mod]] [requires=N] [dice-modifier=N] [min-difficulty=N] [successes=N] [uncancelable=N] [tags="a,b"] [spend=res[::effect][!]] [spend-amount=N] [specialty=<trait|label>] [table=".."]  (roll for a named character without switching to them)]
```

### `save-date`

bookmark the current moment (or a given date) under a name

```
[[save-date <name> [[yyyy-mm-dd-hh]]  (bookmark the current moment (or a given date) under a name)]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional **required** | `<name>` |
| `date` | positional | `[yyyy-mm-dd-hh]` <br>*e.g.* `1197-12-25-00` |

**`[[show-help save-date]]`** replies:

```
[SYSTEM: save-date - save-date <name> [[yyyy-mm-dd-hh]]  (bookmark the current moment (or a given date) under a name)]
```

### `scene`

open a named scene at the current story time (one location; turn=<len> sets a Turn's length)

```
[[scene <name> [location=".."] [turn=".."] [chapter=".."]  (open a named scene at the current story time (one location; turn=<len> sets a Turn's length))]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional **required** | `<name>` |
| `location` | named `literal` | The scene's single location |
| `turn` | named | A Turn's length here (e.g. 3s for combat); omit for freeform <br>*e.g.* `3s` |
| `chapter` | named `literal` | Optional grouping label |

**`[[show-help scene]]`** replies:

```
[SYSTEM: scene - scene <name> [location=".."] [turn=".."] [chapter=".."]  (open a named scene at the current story time (one location; turn=<len> sets a Turn's length))]
```

### `seal-spell`

seal an ongoing spell: 5 Quintessence per highest-Pillar dot + 1 Willpower per 10

```
[[seal-spell pillar=N [pay=true]]]
```

| argument | kind | meaning |
|---|---|---|
| `pillar` | named `int` **required** | Highest Pillar level involved |
| `pay` | named `enum` | Spend now (else the price is quoted as a debt) — one of `true` |

**`[[show-help seal-spell]]`** replies:

```
[SYSTEM: seal-spell - seal-spell pillar=N [pay=true]  (seal an ongoing spell: 5 Quintessence per highest-Pillar dot + 1 Willpower per 10)]
```

### `set-default`

change the default character

```
[[set-default name="<name|@alias>"]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | named **required** | `"<name\|@alias>"` |

**`[[show-help set-default]]`** replies:

```
[SYSTEM: set-default - set-default name="<name|@alias>"  (change the default character)]
```

### `set-trait`

set any rating the sheet holds (Attribute, Ability, Background, Discipline, Pillar, pool start)

```
[[set-trait <trait> <n> [group=".."] [note=".."] [paid=".."] [add=true]  (set any rating the sheet holds (Attribute, Ability, Background, Discipline, Pillar, pool start); merits use [[take-merit]]; specialties use [[specialty]])]]
```

> merits use [[take-merit]]; specialties use [[specialty]]

| argument | kind | meaning |
|---|---|---|
| `name` | positional **required** | `<trait>` <br>*e.g.* `sanctum` |
| `rating` | positional **required** | `<n>` <br>*e.g.* `8` |
| `group` | named | Which group it belongs to (inferred when the trait is already known) <br>*e.g.* `background` |
| `note` | named `literal` | Whose/which one this is - keeps it as a separate instance |
| `paid` | named | What it really cost (0 = the Storyteller granted it) |
| `add` | named `enum` | Hold ANOTHER of the same trait rather than replacing — one of `true` |

**`[[show-help set-trait]]`** replies:

```
[SYSTEM: set-trait - set-trait <trait> <n> [group=".."] [note=".."] [paid=".."] [add=true]  (set any rating the sheet holds (Attribute, Ability, Background, Discipline, Pillar, pool start); merits use [[take-merit]]; specialties use [[specialty]])]
```

### `show-affliction`

afflictions on a character, or the ones the chronicle defines

```
[[show-affliction [name|@all] [in=<where>] [in-story=true]]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional | What to show; @all means the whole list <br>*e.g.* `in-sanctum` |
| `in` | named | Where to look: campaign, current, character, scene (default current); a bare name is worked out, kind::name is explicit <br>*e.g.* `campaign · current · character` |
| `in-story` | named `enum` | Keep this reply in the story for the AI to read (default: hidden from context) — one of `true` |

**`[[show-help show-affliction]]`** replies:

```
[SYSTEM: show-affliction - show-affliction [name|@all] [in=<where>] [in-story=true]  (afflictions on a character, or the ones the chronicle defines)]
```

### `show-alias`

every alias, grouped by scope

```
[[show-alias [name|@all] [in=<where>] [in-story=true]]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional | What to show; @all means the whole list |
| `in` | named | Where to look: campaign, player, character, current (default campaign); a bare name is worked out, kind::name is explicit <br>*e.g.* `campaign · player · character` |
| `in-story` | named `enum` | Keep this reply in the story for the AI to read (default: hidden from context) — one of `true` |

**`[[show-help show-alias]]`** replies:

```
[SYSTEM: show-alias - show-alias [name|@all] [in=<where>] [in-story=true]  (every alias, grouped by scope)]
```

### `show-arcanum`

arcana & taints: what a character owns, or what the chronicle defines

```
[[show-arcanum [name|@all] [in=<where>] [in-story=true]]]
```

> Their own category - not merits, and only a demon or a demon's thrall has this list at all

| argument | kind | meaning |
|---|---|---|
| `name` | positional | What to show; @all means the whole list <br>*e.g.* `celestial-radiance` |
| `in` | named | Where to look: campaign, template, clan, fellowship, current, character (default current); a bare name is worked out, kind::name is explicit <br>*e.g.* `campaign · template · clan` |
| `in-story` | named `enum` | Keep this reply in the story for the AI to read (default: hidden from context) — one of `true` |

**`[[show-help show-arcanum]]`** replies:

```
[SYSTEM: show-arcanum - show-arcanum [name|@all] [in=<where>] [in-story=true]  (arcana & taints: what a character owns, or what the chronicle defines; Their own category - not merits, and only a demon or a demon's thrall has this list at all)]
```

### `show-background`

backgrounds: what a character holds and confers, or what the chronicle defines

```
[[show-background [name|@all] [in=<where>] [in-story=true]]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional | What to show; @all means the whole list <br>*e.g.* `fount` |
| `in` | named | Where to look: campaign, template, clan, fellowship, current, character (default current); a bare name is worked out, kind::name is explicit <br>*e.g.* `campaign · template · clan` |
| `in-story` | named `enum` | Keep this reply in the story for the AI to read (default: hidden from context) — one of `true` |

**`[[show-help show-background]]`** replies:

```
[SYSTEM: show-background - show-background [name|@all] [in=<where>] [in-story=true]  (backgrounds: what a character holds and confers, or what the chronicle defines)]
```

### `show-budget`

what each purse allows, what is spent, what is left (advisory)

```
[[show-budget [name|@all] [in=<where>] [in-story=true]  (what each purse allows, what is spent, what is left (advisory))]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional | What to show; @all means the whole list |
| `in` | named | Where to look: current, character (default current); a bare name is worked out, kind::name is explicit <br>*e.g.* `current · character` |
| `in-story` | named `enum` | Keep this reply in the story for the AI to read (default: hidden from context) — one of `true` |

**`[[show-help show-budget]]`** replies:

```
[SYSTEM: show-budget - show-budget [name|@all] [in=<where>] [in-story=true]  (what each purse allows, what is spent, what is left (advisory))]
```

### `show-capability`

what a character can USE (a pool he cannot use is only points)

```
[[show-capability [name|@all] [in=<where>] [in-story=true]  (what a character can USE (a pool he cannot use is only points))]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional | What to show; @all means the whole list |
| `in` | named | Where to look: current, character (default current); a bare name is worked out, kind::name is explicit <br>*e.g.* `current · character` |
| `in-story` | named `enum` | Keep this reply in the story for the AI to read (default: hidden from context) — one of `true` |

**`[[show-help show-capability]]`** replies:

```
[SYSTEM: show-capability - show-capability [name|@all] [in=<where>] [in-story=true]  (what a character can USE (a pool he cannot use is only points))]
```

### `show-character`

the chronicle's playable characters (marks current/default)

```
[[show-character [name|@all] [in=<where>] [in-story=true]  (the chronicle's playable characters (marks current/default))]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional | What to show; @all means the whole list |
| `in` | named | Where to look: campaign (default campaign); a bare name is worked out, kind::name is explicit <br>*e.g.* `campaign` |
| `in-story` | named `enum` | Keep this reply in the story for the AI to read (default: hidden from context) — one of `true` |

**`[[show-help show-character]]`** replies:

```
[SYSTEM: show-character - show-character [name|@all] [in=<where>] [in-story=true]  (the chronicle's playable characters (marks current/default))]
```

### `show-clan`

the clans and their Disciplines

```
[[show-clan [name|@all] [in=<where>] [in-story=true]]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional | What to show; @all means the whole list <br>*e.g.* `nosferatu` |
| `in` | named | Where to look: campaign, clan, current, character (default campaign); a bare name is worked out, kind::name is explicit <br>*e.g.* `campaign · clan · current` |
| `in-story` | named `enum` | Keep this reply in the story for the AI to read (default: hidden from context) — one of `true` |

**`[[show-help show-clan]]`** replies:

```
[SYSTEM: show-clan - show-clan [name|@all] [in=<where>] [in-story=true]  (the clans and their Disciplines)]
```

### `show-constraint`

the story's constraint groups, and what the character breaks

```
[[show-constraint [name|@all] [in=<where>] [in-story=true]]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional | What to show; @all means the whole list <br>*e.g.* `clan-only-backgrounds` |
| `in` | named | Where to look: campaign, template, clan, fellowship, current, character (default campaign); a bare name is worked out, kind::name is explicit <br>*e.g.* `campaign · template · clan` |
| `in-story` | named `enum` | Keep this reply in the story for the AI to read (default: hidden from context) — one of `true` |

**`[[show-help show-constraint]]`** replies:

```
[SYSTEM: show-constraint - show-constraint [name|@all] [in=<where>] [in-story=true]  (the story's constraint groups, and what the character breaks)]
```

### `show-contest-status`

an extended contest's progress

```
[[show-contest-status [name|@all] [in=<where>] [in-story=true]]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional | What to show; @all means the whole list |
| `in` | named | Where to look: current, character (default current); a bare name is worked out, kind::name is explicit <br>*e.g.* `current · character` |
| `in-story` | named `enum` | Keep this reply in the story for the AI to read (default: hidden from context) — one of `true` |

**`[[show-help show-contest-status]]`** replies:

```
[SYSTEM: show-contest-status - show-contest-status [name|@all] [in=<where>] [in-story=true]  (an extended contest's progress)]
```

### `show-cost`

what a dot costs from each purse (chronicle rules, Storyteller-applied)

```
[[show-cost [name|@all] [in=<where>] [in-story=true]  (what a dot costs from each purse (chronicle rules, Storyteller-applied))]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional | What to show; @all means the whole list |
| `in` | named | Where to look: campaign (default campaign); a bare name is worked out, kind::name is explicit <br>*e.g.* `campaign` |
| `in-story` | named `enum` | Keep this reply in the story for the AI to read (default: hidden from context) — one of `true` |

**`[[show-help show-cost]]`** replies:

```
[SYSTEM: show-cost - show-cost [name|@all] [in=<where>] [in-story=true]  (what a dot costs from each purse (chronicle rules, Storyteller-applied))]
```

### `show-cray`

the cray's points, status and how it refills

```
[[show-cray [name|@all] [in=<where>] [in-story=true]]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional | What to show; @all means the whole list |
| `in` | named | Where to look: current, character (default current); a bare name is worked out, kind::name is explicit <br>*e.g.* `current · character` |
| `in-story` | named `enum` | Keep this reply in the story for the AI to read (default: hidden from context) — one of `true` |

**`[[show-help show-cray]]`** replies:

```
[SYSTEM: show-cray - show-cray [name|@all] [in=<where>] [in-story=true]  (the cray's points, status and how it refills)]
```

### `show-creation`

the creation budget: every pool against what the sheet holds (advisory)

```
[[show-creation [name|@all] [in=<where>] [in-story=true]  (the creation budget: every pool against what the sheet holds (advisory))]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional | What to show; @all means the whole list |
| `in` | named | Where to look: current, character (default current); a bare name is worked out, kind::name is explicit <br>*e.g.* `current · character` |
| `in-story` | named `enum` | Keep this reply in the story for the AI to read (default: hidden from context) — one of `true` |

**`[[show-help show-creation]]`** replies:

```
[SYSTEM: show-creation - show-creation [name|@all] [in=<where>] [in-story=true]  (the creation budget: every pool against what the sheet holds (advisory))]
```

### `show-date`

the story date, and the bookmarks the chronicle keeps

```
[[show-date [name|@all] [in=<where>] [in-story=true]]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional | What to show; @all means the whole list |
| `in` | named | Where to look: campaign (default campaign); a bare name is worked out, kind::name is explicit <br>*e.g.* `campaign` |
| `in-story` | named `enum` | Keep this reply in the story for the AI to read (default: hidden from context) — one of `true` |

**`[[show-help show-date]]`** replies:

```
[SYSTEM: show-date - show-date [name|@all] [in=<where>] [in-story=true]  (the story date, and the bookmarks the chronicle keeps)]
```

### `show-derived`

what the sheet implies rather than states: Road, Willpower, generation, and why

```
[[show-derived [name|@all] [in=<where>] [in-story=true]]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional | What to show; @all means the whole list |
| `in` | named | Where to look: current, character (default current); a bare name is worked out, kind::name is explicit <br>*e.g.* `current · character` |
| `in-story` | named `enum` | Keep this reply in the story for the AI to read (default: hidden from context) — one of `true` |

**`[[show-help show-derived]]`** replies:

```
[SYSTEM: show-derived - show-derived [name|@all] [in=<where>] [in-story=true]  (what the sheet implies rather than states: Road, Willpower, generation, and why)]
```

### `show-eval`

read an expression against a character (the reference system, exposed)

```
[[show-eval [<expression>] [in=<where>] [in-story=true]  (read an expression against a character (the reference system, exposed))]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional | What to show; @all means the whole list <br>*e.g.* ``courage + 2`` |
| `in` | named | Where to look: current, character (default current); a bare name is worked out, kind::name is explicit <br>*e.g.* `current · character` |
| `in-story` | named `enum` | Keep this reply in the story for the AI to read (default: hidden from context) — one of `true` |

**`[[show-help show-eval]]`** replies:

```
[SYSTEM: show-eval - show-eval [<expression>] [in=<where>] [in-story=true]  (read an expression against a character (the reference system, exposed))]
```

### `show-fellowship`

the mystic fellowships' Foundation & Pillars

```
[[show-fellowship [name|@all] [in=<where>] [in-story=true]]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional | What to show; @all means the whole list <br>*e.g.* `valdaermen` |
| `in` | named | Where to look: campaign, fellowship, current, character (default campaign); a bare name is worked out, kind::name is explicit <br>*e.g.* `campaign · fellowship · current` |
| `in-story` | named `enum` | Keep this reply in the story for the AI to read (default: hidden from context) — one of `true` |

**`[[show-help show-fellowship]]`** replies:

```
[SYSTEM: show-fellowship - show-fellowship [name|@all] [in=<where>] [in-story=true]  (the mystic fellowships' Foundation & Pillars)]
```

### `show-grant`

what a purchase really cost and where it came from

```
[[show-grant [name|@all] [in=<where>] [in-story=true]]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional | What to show; @all means the whole list |
| `in` | named | Where to look: current, character (default current); a bare name is worked out, kind::name is explicit <br>*e.g.* `current · character` |
| `in-story` | named `enum` | Keep this reply in the story for the AI to read (default: hidden from context) — one of `true` |

**`[[show-help show-grant]]`** replies:

```
[SYSTEM: show-grant - show-grant [name|@all] [in=<where>] [in-story=true]  (what a purchase really cost and where it came from)]
```

### `show-health`

a character's health track, penalty and what soaks what

```
[[show-health [name|@all] [in=<where>] [in-story=true]]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional | What to show; @all means the whole list |
| `in` | named | Where to look: current, character (default current); a bare name is worked out, kind::name is explicit <br>*e.g.* `current · character` |
| `in-story` | named `enum` | Keep this reply in the story for the AI to read (default: hidden from context) — one of `true` |

**`[[show-help show-health]]`** replies:

```
[SYSTEM: show-health - show-health [name|@all] [in=<where>] [in-story=true]  (a character's health track, penalty and what soaks what)]
```

### `show-help`

list commands, or show one's usage

```
[[show-help [verb|@all] [in=<where>] [in-story=true]]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional | What to show; @all means the whole list <br>*e.g.* `roll` |
| `in` | named | Where to look: campaign (default campaign); a bare name is worked out, kind::name is explicit <br>*e.g.* `campaign` |
| `in-story` | named `enum` | Keep this reply in the story for the AI to read (default: hidden from context) — one of `true` |

**`[[show-help show-help]]`** replies:

```
[SYSTEM: show-help - show-help [verb|@all] [in=<where>] [in-story=true]  (list commands, or show one's usage)]
```

### `show-merit`

merits & flaws: what a character owns, or what the chronicle defines

```
[[show-merit [name|@all] [in=<where>] [in-story=true]]]
```

> in=campaign lists the definitions; a name shows one in full. NEVER lists Arcana - [[show-arcanum]] is their list

| argument | kind | meaning |
|---|---|---|
| `name` | positional | What to show; @all means the whole list <br>*e.g.* `iron-will` |
| `in` | named | Where to look: campaign, template, clan, fellowship, current, character (default current); a bare name is worked out, kind::name is explicit <br>*e.g.* `campaign · template · clan` |
| `in-story` | named `enum` | Keep this reply in the story for the AI to read (default: hidden from context) — one of `true` |

**`[[show-help show-merit]]`** replies:

```
[SYSTEM: show-merit - show-merit [name|@all] [in=<where>] [in-story=true]  (merits & flaws: what a character owns, or what the chronicle defines; in=campaign lists the definitions; a name shows one in full. NEVER lists Arcana - [[show-arcanum]] is their list)]
```

### `show-player`

the current player (the storyteller, unless somebody took a seat)

```
[[show-player [name|@all] [in=<where>] [in-story=true]  (the current player (the storyteller, unless somebody took a seat))]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional | What to show; @all means the whole list |
| `in` | named | Where to look: campaign, player (default campaign); a bare name is worked out, kind::name is explicit <br>*e.g.* `campaign · player` |
| `in-story` | named `enum` | Keep this reply in the story for the AI to read (default: hidden from context) — one of `true` |

**`[[show-help show-player]]`** replies:

```
[SYSTEM: show-player - show-player [name|@all] [in=<where>] [in-story=true]  (the current player (the storyteller, unless somebody took a seat))]
```

### `show-resource`

a character's live pools and trackers (and what they cannot use)

```
[[show-resource [name|@all] [in=<where>] [in-story=true]  (a character's live pools and trackers (and what they cannot use))]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional | What to show; @all means the whole list |
| `in` | named | Where to look: current, character (default current); a bare name is worked out, kind::name is explicit <br>*e.g.* `current · character` |
| `in-story` | named `enum` | Keep this reply in the story for the AI to read (default: hidden from context) — one of `true` |

**`[[show-help show-resource]]`** replies:

```
[SYSTEM: show-resource - show-resource [name|@all] [in=<where>] [in-story=true]  (a character's live pools and trackers (and what they cannot use))]
```

### `show-roll`

the chronicle's saved rolls, or one in full

```
[[show-roll [name|@all] [in=<where>] [in-story=true]]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional | What to show; @all means the whole list <br>*e.g.* `sword-strike` |
| `in` | named | Where to look: campaign (default campaign); a bare name is worked out, kind::name is explicit <br>*e.g.* `campaign` |
| `in-story` | named `enum` | Keep this reply in the story for the AI to read (default: hidden from context) — one of `true` |

**`[[show-help show-roll]]`** replies:

```
[SYSTEM: show-roll - show-roll [name|@all] [in=<where>] [in-story=true]  (the chronicle's saved rolls, or one in full)]
```

### `show-roll-status`

an extended action's progress

```
[[show-roll-status [name|@all] [in=<where>] [in-story=true]]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional | What to show; @all means the whole list |
| `in` | named | Where to look: current, character (default current); a bare name is worked out, kind::name is explicit <br>*e.g.* `current · character` |
| `in-story` | named `enum` | Keep this reply in the story for the AI to read (default: hidden from context) — one of `true` |

**`[[show-help show-roll-status]]`** replies:

```
[SYSTEM: show-roll-status - show-roll-status [name|@all] [in=<where>] [in-story=true]  (an extended action's progress)]
```

### `show-scene`

the chronicle's scenes, or one in full (defaults to the open one)

```
[[show-scene [name|@all] [in=<where>] [in-story=true]  (the chronicle's scenes, or one in full (defaults to the open one))]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional | What to show; @all means the whole list |
| `in` | named | Where to look: campaign, scene (default campaign); a bare name is worked out, kind::name is explicit <br>*e.g.* `campaign · scene` |
| `in-story` | named `enum` | Keep this reply in the story for the AI to read (default: hidden from context) — one of `true` |

**`[[show-help show-scene]]`** replies:

```
[SYSTEM: show-scene - show-scene [name|@all] [in=<where>] [in-story=true]  (the chronicle's scenes, or one in full (defaults to the open one))]
```

### `show-sheet`

a character's record as the engine reads it (effective values marked)

```
[[show-sheet [name|@all] [in=<where>] [in-story=true]  (a character's record as the engine reads it (effective values marked))]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional | What to show; @all means the whole list |
| `in` | named | Where to look: current, character (default current); a bare name is worked out, kind::name is explicit <br>*e.g.* `current · character` |
| `in-story` | named `enum` | Keep this reply in the story for the AI to read (default: hidden from context) — one of `true` |

**`[[show-help show-sheet]]`** replies:

```
[SYSTEM: show-sheet - show-sheet [name|@all] [in=<where>] [in-story=true]  (a character's record as the engine reads it (effective values marked))]
```

### `show-specialty`

a character's specialties (one applies per roll, via specialty=)

```
[[show-specialty [name|@all] [in=<where>] [in-story=true]  (a character's specialties (one applies per roll, via specialty=))]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional | What to show; @all means the whole list |
| `in` | named | Where to look: current, character (default current); a bare name is worked out, kind::name is explicit <br>*e.g.* `current · character` |
| `in-story` | named `enum` | Keep this reply in the story for the AI to read (default: hidden from context) — one of `true` |

**`[[show-help show-specialty]]`** replies:

```
[SYSTEM: show-specialty - show-specialty [name|@all] [in=<where>] [in-story=true]  (a character's specialties (one applies per roll, via specialty=))]
```

### `show-supernatural`

the families of power open to a character (disciplines, magic, sorcery, blood-sorcery)

```
[[show-supernatural [name|@all] [in=<where>] [in-story=true]  (the families of power open to a character (disciplines, magic, sorcery, blood-sorcery))]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional | What to show; @all means the whole list <br>*e.g.* `disciplines` |
| `in` | named | Where to look: current, character (default current); a bare name is worked out, kind::name is explicit <br>*e.g.* `current · character` |
| `in-story` | named `enum` | Keep this reply in the story for the AI to read (default: hidden from context) — one of `true` |

**`[[show-help show-supernatural]]`** replies:

```
[SYSTEM: show-supernatural - show-supernatural [name|@all] [in=<where>] [in-story=true]  (the families of power open to a character (disciplines, magic, sorcery, blood-sorcery))]
```

### `show-table`

success tables, grouped by category, or one laid out in full

```
[[show-table [name|@all] [in=<where>] [category=".."] [in-story=true]]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional | What to show; @all means the whole list |
| `in` | named | Where to look: campaign (default campaign); a bare name is worked out, kind::name is explicit <br>*e.g.* `campaign` |
| `category` | named | Only this table category |
| `in-story` | named `enum` | Keep this reply in the story for the AI to read (default: hidden from context) — one of `true` |

**`[[show-help show-table]]`** replies:

```
[SYSTEM: show-table - show-table [name|@all] [in=<where>] [category=".."] [in-story=true]  (success tables, grouped by category, or one laid out in full)]
```

### `show-template`

the templates this chronicle knows, and what each is made of

```
[[show-template [name|@all] [in=<where>] [in-story=true]]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional | What to show; @all means the whole list <br>*e.g.* `vampire` |
| `in` | named | Where to look: campaign, template, current, character (default campaign); a bare name is worked out, kind::name is explicit <br>*e.g.* `campaign · template · current` |
| `in-story` | named `enum` | Keep this reply in the story for the AI to read (default: hidden from context) — one of `true` |

**`[[show-help show-template]]`** replies:

```
[SYSTEM: show-template - show-template [name|@all] [in=<where>] [in-story=true]  (the templates this chronicle knows, and what each is made of)]
```

### `show-time-between`

measure the span between two dates (saved name, now, start, or yyyy-mm-dd-hh)

```
[[show-time-between [name|@all] [in=<where>] [<date|name>] [[date|name]] [in-story=true]  (measure the span between two dates (saved name, now, start, or yyyy-mm-dd-hh))]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional | What to show; @all means the whole list |
| `in` | named | Where to look: campaign (default campaign); a bare name is worked out, kind::name is explicit <br>*e.g.* `campaign` |
| `from` | positional | `<date\|name>` <br>*e.g.* `story-start` |
| `to` | positional | `[date\|name]` <br>*e.g.* `now` |
| `in-story` | named `enum` | Keep this reply in the story for the AI to read (default: hidden from context) — one of `true` |

**`[[show-help show-time-between]]`** replies:

```
[SYSTEM: show-time-between - show-time-between [name|@all] [in=<where>] [<date|name>] [[date|name]] [in-story=true]  (measure the span between two dates (saved name, now, start, or yyyy-mm-dd-hh))]
```

### `specialty`

add a specialty to a trait (labels keep their case)

```
[[specialty <trait> `<Label>`  (add a specialty to a trait (labels keep their case))]]
```

| argument | kind | meaning |
|---|---|---|
| `trait` | positional **required** | `<trait>` |
| `label` | positional `literal` **required** | ``<Label>`` |

**`[[show-help specialty]]`** replies:

```
[SYSTEM: specialty - specialty <trait> `<Label>`  (add a specialty to a trait (labels keep their case))]
```

### `spend`

spend a resource / fire a named effect outside a roll

```
[[spend <resource[::effect]> [[target]] [[amount]] [reason=".."]]]
```

| argument | kind | meaning |
|---|---|---|
| `resource` | positional **required** | `<resource[::effect]>` |
| `target` | positional | `[target]` |
| `amount` | positional | `[amount]` |
| `reason` | named `literal` | Why (echoed in the note) |

**`[[show-help spend]]`** replies:

```
[SYSTEM: spend - spend <resource[::effect]> [[target]] [[amount]] [reason=".."]  (spend a resource / fire a named effect outside a roll)]
```

### `story-start`

set when the story begins (yyyy-mm-dd-hh)

```
[[story-start yyyy-mm-dd-hh  (set when the story begins (yyyy-mm-dd-hh))]]
```

| argument | kind | meaning |
|---|---|---|
| `date` | positional **required** | `yyyy-mm-dd-hh` <br>*e.g.* `1197-03-15-08` |

**`[[show-help story-start]]`** replies:

```
[SYSTEM: story-start - story-start yyyy-mm-dd-hh  (set when the story begins (yyyy-mm-dd-hh))]
```

### `table-alias`

define a table alias, or list them (no args); table=@alias resolves it

```
[[table-alias [<@alias>] ["<[sub::]name>"]  (define a table alias, or list them (no args); table=@alias resolves it)]]
```

| argument | kind | meaning |
|---|---|---|
| `token` | positional | `<@alias>` |
| `target` | positional | `"<[sub::]name>"` |

**`[[show-help table-alias]]`** replies:

```
[SYSTEM: table-alias - table-alias [<@alias>] ["<[sub::]name>"]  (define a table alias, or list them (no args); table=@alias resolves it)]
```

### `take-arcanum`

take an arcanum or taint (needs the arcana capability - [[attune]])

```
[[take-arcanum <name[::param]> [[points]] [paid=".."] [waive=true]  (take an arcanum or taint (needs the arcana capability - [[attune]]))]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional **required** | `<name[::param]>` |
| `points` | positional | `[points]` |
| `paid` | named | What it REALLY cost (0 = the Storyteller granted it) |
| `waive` | named `enum` | Waive prerequisites / template limits / the capability gate — one of `true` |

**`[[show-help take-arcanum]]`** replies:

```
[SYSTEM: take-arcanum - take-arcanum <name[::param]> [[points]] [paid=".."] [waive=true]  (take an arcanum or taint (needs the arcana capability - [[attune]]))]
```

### `take-merit`

take a merit/flaw; parameterized defs take name::param instances

```
[[take-merit <name[::param]> [[points]] [paid=".."] [waive=true]]]
```

> Merits and Flaws only. Arcana and Taints are a different category - [[take-arcanum]]

| argument | kind | meaning |
|---|---|---|
| `name` | positional **required** | `<name[::param]>` |
| `points` | positional | `[points]` |
| `paid` | named | What it REALLY cost (0 = the Storyteller granted it) |
| `waive` | named `enum` | Waive unmet prerequisites — one of `true` |

**`[[show-help take-merit]]`** replies:

```
[SYSTEM: take-merit - take-merit <name[::param]> [[points]] [paid=".."] [waive=true]  (take a merit/flaw; parameterized defs take name::param instances; Merits and Flaws only. Arcana and Taints are a different category - [[take-arcanum]])]
```

### `toggle`

switch a togglable passive off, or back on (the power is not lost either way)

```
[[toggle <affliction> [on=<name|@alias>]  (switch a togglable passive off, or back on (the power is not lost either way))]]
```

| argument | kind | meaning |
|---|---|---|
| `affliction` | positional **required** | `<affliction>` |
| `on` | named | Who (default: the current character) |

**`[[show-help toggle]]`** replies:

```
[SYSTEM: toggle - toggle <affliction> [on=<name|@alias>]  (switch a togglable passive off, or back on (the power is not lost either way))]
```

### `turn`

advance the current scene by one turn (moves the clock by its turn length)

```
[[turn [[n]]  (advance the current scene by one turn (moves the clock by its turn length))]]
```

| argument | kind | meaning |
|---|---|---|
| `count` | positional `int` | How many turns (default 1) |

**`[[show-help turn]]`** replies:

```
[SYSTEM: turn - turn [[n]]  (advance the current scene by one turn (moves the clock by its turn length))]
```

### `win-afflict`

open a window to apply an affliction (its binding slots appear on pick)

```
[[win-afflict  (open a window to apply an affliction (its binding slots appear on pick))]]
```

_No arguments._

**`[[show-help win-afflict]]`** replies:

```
[SYSTEM: win-afflict - win-afflict  (open a window to apply an affliction (its binding slots appear on pick))]
```

### `win-affliction`

open a window to define an affliction (then/mirror have pickers)

```
[[win-affliction  (open a window to define an affliction (then/mirror have pickers))]]
```

_No arguments._

**`[[show-help win-affliction]]`** replies:

```
[SYSTEM: win-affliction - win-affliction  (open a window to define an affliction (then/mirror have pickers))]
```

### `win-constraint`

open a window to define a constraint group

```
[[win-constraint]]
```

_No arguments._

**`[[show-help win-constraint]]`** replies:

```
[SYSTEM: win-constraint - win-constraint  (open a window to define a constraint group)]
```

### `win-roll`

open a window to build, roll, and save rolls

```
[[win-roll]]
```

_No arguments._

**`[[show-help win-roll]]`** replies:

```
[SYSTEM: win-roll - win-roll  (open a window to build, roll, and save rolls)]
```

### `win-table`

open a window to define a success table

```
[[win-table]]
```

_No arguments._

**`[[show-help win-table]]`** replies:

```
[SYSTEM: win-table - win-table  (open a window to define a success table)]
```

