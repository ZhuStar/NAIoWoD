# Command reference

> **GENERATED — do not edit.** `bun run docs:commands` rewrites this file from
> the live `CommandRouter`, and a test asserts the committed copy matches. If a
> verb is here it exists; if it exists it is here.

Commands are written `[[like this]]` in the Text Adventure input box. Several
may share one line; each is replaced by its `[SYSTEM: …]` reply.

---

## `[[help]]` — what it publishes

With no argument it lists every verb:

```
[SYSTEM: 131 commands: help, creator-mode, create-playable, play, characters, sheet, set-trait, convert-cards, set-default, roll, roll-for, name-roll, list-rolls, roll-info, add-step, clear-steps, forget-roll, extended-roll, continue-roll, roll-status, cancel-roll, resources, attune, spend, gain, damage, health, clear-boosts, reset-uses, configure-resources, cancel-wizard, resist, contest, extended-contest, continue-contest, contest-status, cancel-contest, story-start, advance-time, magick, cast, seal-spell, creation, derived, eval, choose, clans, clan, templates, extend-template, forget-template, define-resource, backgrounds, background, define-background, forget-background, supernatural, budget, grant, forget-grant, paid, costs, fellowships, flush-context, enter-sanctum, exit-sanctum, enter-library, exit-library, measure-door, leave-library, cray, harvest, absorb, research, story-date, save-date, forget-date, dates, time-between, scene, turn, end-scene, downtime, scenes, scene-info, forget-scene, hide, tables, define-table, forget-table, define-table-category, table-alias, forget-table-alias, define-constraint, constraints, constraint, forget-constraint, check-constraints, take-merit, drop-merit, merits, define-merit, merit, forget-merit, arcana, arcanum, define-arcanum, take-arcanum, drop-arcanum, forget-arcanum, specialty, forget-specialty, specialties, define-affliction, affliction, forget-affliction, afflict, toggle, invoke, advance, lift, afflictions, alias, aliases, forget-alias, player, win-constraint, win-table, win-affliction, win-afflict, win-roll. [[help <verb>]] for one's usage.]
```

With a verb it prints that verb's **usage line**, which is derived from the
verb's `CommandSpec` — the same declaration that builds its window. Nothing is
written twice, so help can never disagree with the parser.

---

## All 131 commands

| command | what it does |
|---|---|
| `absorb` | tear Quintessence from the cray directly: Wits + Foundation vs 10 - its rating |
| `add-step` | append a follow-up step to a saved procedure (composes named rolls) |
| `advance` | end an affliction and begin its successor, bindings carried forward |
| `advance-time` | move the story clock forward (s/m/h/d/w/mo/y); crossing midnights/full moons applies recovery |
| `afflict` | apply an affliction; extra <slot>=<name\|@alias> args fill its bindings |
| `affliction` | list defined afflictions, or show one in full |
| `afflictions` | active afflictions; NPCs work too |
| `alias` | define an alias for a character |
| `aliases` | list every alias, grouped by scope |
| `arcana` | the Arcana & Taints this character owns (bare), or one in detail |
| `arcanum` | inspect an arcanum/taint definition (bare: list them) |
| `attune` | what this character can USE (a pool he cannot use is only points) |
| `background` | one background in full: ceiling, ladder, and what it grants |
| `backgrounds` | the backgrounds this chronicle defines, what you hold, and what they confer |
| `budget` | what each purse allows, what is spent, what is left (advisory) |
| `cancel-contest` | cancel an extended contest |
| `cancel-roll` | cancel an extended action |
| `cancel-wizard` | abandon the running wizard |
| `cast` | @deprecated - use [[magick]] (Awakened magic); this name is wanted for Sorcery |
| `characters` | list playable characters; marks current/default |
| `check-constraints` | flag the current character's constraint conflicts (incl. merit-instance caps) |
| `choose` | pick a clan, a fellowship, or the Attribute/Ability priorities |
| `clan` | one clan: its Disciplines and what it bounds |
| `clans` | the clans and their Disciplines |
| `clear-boosts` | clear trait boosts (the ST calls the duration) |
| `clear-steps` | drop all follow-up steps from a saved procedure (its entry roll stays) |
| `configure-resources` | guided resource setup; plain replies answer it |
| `constraint` | show one constraint group in full |
| `constraints` | list the story's constraint groups |
| `contest` | contested action: higher total wins (tie = draw) |
| `contest-status` | show an extended contest's progress |
| `continue-contest` | roll the next contest round |
| `continue-roll` | whoever is current rolls the next interval (named-only overrides) |
| `convert-cards` | rewrite any lorebook card still holding JSON in the readable format (one-shot) |
| `costs` | what a dot costs from each purse (chronicle rules, Storyteller-applied) |
| `cray` | the cray's points, status and how it refills |
| `create-playable` | create a playable character (attributes 1, abilities 0 - allocation is opt-in) |
| `creation` | the creation budget: every pool against what the sheet holds (advisory) |
| `creator-mode` | toggle lorebook hand-editing; edits sync in while on |
| `damage` | mark damage on the current character |
| `dates` | list the saved date bookmarks |
| `define-affliction` | define/replace an affliction (overlay; may shadow a built-in) |
| `define-arcanum` | define an arcanum or taint (writes the srd:arcana overlay) |
| `define-background` | define/replace a background (a Talisman that IS a place grants that place's ratings) |
| `define-constraint` | define/replace a constraint group |
| `define-merit` | define a merit or flaw (writes the srd:merits-flaws overlay) |
| `define-resource` | define a pool or tracker a template can then grant |
| `define-table` | define/replace a success table in its category's general card |
| `define-table-category` | create a table subcategory (a real lorebook category with its general card) |
| `derived` | what the sheet implies rather than states: Road, Willpower, generation, and why |
| `downtime` | close the current scene and gloss the clock forward |
| `drop-arcanum` | drop an owned arcanum or taint (its passives lift with it) |
| `drop-merit` | drop an owned merit/flaw instance |
| `end-scene` | close the current scene |
| `enter-library` | enter your library (applies in-library) |
| `enter-sanctum` | enter your sanctum (applies in-sanctum) |
| `eval` | read an expression against the current character (the reference system, exposed) |
| `exit-library` | leave your library (lifts in-library) |
| `exit-sanctum` | leave your sanctum (lifts in-sanctum) |
| `extend-template` | a new template from an old one: state only what differs |
| `extended-contest` | both sides accumulate; first to the goal wins (dead heat stays open) |
| `extended-roll` | start an extended action (rolls interval 1 now) |
| `fellowships` | the mystic fellowships' Foundation & Pillars (bare: list them) |
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
| `health` | show the current character's health track |
| `help` | list commands, or show one's usage |
| `hide` | write to the current scene's private plan (mirrored into the Author's Note) |
| `invoke` | use a power that OFFERS an affliction rather than applying it automatically |
| `leave-library` | step back through the measured door |
| `lift` | remove an affliction - and its mirror; spend = shrug-off |
| `list-rolls` | list the chronicle's saved rolls |
| `magick` | work Awakened magick (Dark Ages: Mage) - pillars carry the REQUIRED levels |
| `measure-door` | the Talisman ritual: ten minutes measuring a door opens the Library of the Unseen |
| `merit` | inspect a merit/flaw definition (bare: list them) |
| `merits` | list owned merits/flaws, enhancement totals and advisory issues |
| `name-roll` | save a roll under a name; @name invokes it with its spend/specialty/table baked in (extended=true makes a procedure, opposed= makes a contest) |
| `paid` | record what a purchase really cost (no expression = the Storyteller granted it) |
| `play` | switch to a character; no name selects the default |
| `player` | show or switch the current player; storyteller is always valid |
| `research` | search the library: Intelligence + Library (must be in it) |
| `reset-uses` | scene/turn change: clears effect-use counters |
| `resist` | resisted action: your margin over theirs counts (tie = fail) |
| `resources` | list the current character's resources |
| `roll` | roll a dice pool for the current character |
| `roll-for` | roll for a named character without switching to them |
| `roll-info` | show a saved roll's full spec, sidecars, procedure steps, and description |
| `roll-status` | show an extended action's progress |
| `save-date` | bookmark the current moment (or a given date) under a name |
| `scene` | open a named scene at the current story time (one location; turn=<len> sets a Turn's length) |
| `scene-info` | show a scene in full (defaults to the open one) |
| `scenes` | list the chronicle's scenes |
| `seal-spell` | seal an ongoing spell: 5 Quintessence per highest-Pillar dot + 1 Willpower per 10 |
| `set-default` | change the default character |
| `set-trait` | set any rating the sheet holds (Attribute, Ability, Background, Discipline, Pillar, pool start) |
| `sheet` | show a character's record as the engine reads it (effective values marked) |
| `specialties` | list the current character's specialties |
| `specialty` | add a specialty to a trait (labels keep their case) |
| `spend` | spend a resource / fire a named effect outside a roll |
| `story-date` | show the current story date and how long since it began |
| `story-start` | set when the story begins (yyyy-mm-dd-hh) |
| `supernatural` | the families of power open to this character (disciplines, magic, sorcery, blood-sorcery) |
| `table-alias` | define a table alias, or list them (no args); table=@alias resolves it |
| `tables` | list success tables (grouped by category), or lay one out in full |
| `take-arcanum` | take an arcanum or taint (needs the arcana capability - [[attune]]) |
| `take-merit` | take a merit/flaw; parameterized defs take name::param instances |
| `templates` | the templates this chronicle knows, and what each one is made of |
| `time-between` | measure the span between two dates (saved name, now, start, or yyyy-mm-dd-hh) |
| `toggle` | switch a togglable passive off, or back on (the power is not lost either way) |
| `turn` | advance the current scene by one turn (moves the clock by its turn length) |
| `win-afflict` | open a window to apply an affliction (its binding slots appear on pick) |
| `win-affliction` | open a window to define an affliction (then/mirror have pickers) |
| `win-constraint` | open a window to define a constraint group |
| `win-roll` | open a window to build, roll, and save rolls |
| `win-table` | open a window to define a success table |

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

**`[[help absorb]]`** replies:

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

**`[[help add-step]]`** replies:

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

**`[[help advance]]`** replies:

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

**`[[help advance-time]]`** replies:

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

**`[[help afflict]]`** replies:

```
[SYSTEM: afflict - afflict <affliction> [on=<name|@alias>] [rolls=N] [with-tags="a,b"] [without-tags="a,b"] [using="melee"] [not-using="wits"] [turns=N] [scenes=N] [for=<duration>] [until=<condition>] [until-event=<text>] [from=<source>] [cooldown-for=<duration>] [cooldown-rolls=N] [cooldown-turns=N] [cooldown-scenes=N] [cooldown-until=<condition>] [waive=true] [orphan=immediately | keep | <expression>] [<key>=<value> ...]  (apply an affliction; extra <slot>=<name|@alias> args fill its bindings; mirror defs also afflict the bound target)]
```

### `affliction`

list defined afflictions, or show one in full

```
[[affliction [[name]]]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional | `[name]` |

**`[[help affliction]]`** replies:

```
[SYSTEM: affliction - affliction [[name]]  (list defined afflictions, or show one in full)]
```

### `afflictions`

active afflictions; NPCs work too

```
[[afflictions [<name|@alias>]]]
```

| argument | kind | meaning |
|---|---|---|
| `who` | positional | `<name\|@alias>` |

**`[[help afflictions]]`** replies:

```
[SYSTEM: afflictions - afflictions [<name|@alias>]  (active afflictions; NPCs work too)]
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

**`[[help alias]]`** replies:

```
[SYSTEM: alias - alias <@token> "Target Name"  (define an alias for a character; bare @a = global; @global::a, @player::<id|storyteller|default>::a, @char::<name|default>::a pin a scope)]
```

### `aliases`

list every alias, grouped by scope

```
[[aliases]]
```

_No arguments._

**`[[help aliases]]`** replies:

```
[SYSTEM: aliases - aliases  (list every alias, grouped by scope)]
```

### `arcana`

the Arcana & Taints this character owns (bare), or one in detail

```
[[arcana [[name]]  (the Arcana & Taints this character owns (bare), or one in detail; They trade in the ARCANA purse, never freebies, and only a demon or a demon's thrall has this list at all)]]
```

> They trade in the ARCANA purse, never freebies, and only a demon or a demon's thrall has this list at all

| argument | kind | meaning |
|---|---|---|
| `name` | positional | `[name]` <br>*e.g.* `celestial-radiance` |

**`[[help arcana]]`** replies:

```
[SYSTEM: arcana - arcana [[name]]  (the Arcana & Taints this character owns (bare), or one in detail; They trade in the ARCANA purse, never freebies, and only a demon or a demon's thrall has this list at all)]
```

### `arcanum`

inspect an arcanum/taint definition (bare: list them)

```
[[arcanum [[name]]  (inspect an arcanum/taint definition (bare: list them))]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional | `[name]` <br>*e.g.* `celestial-radiance` |

**`[[help arcanum]]`** replies:

```
[SYSTEM: arcanum - arcanum [[name]]  (inspect an arcanum/taint definition (bare: list them))]
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

**`[[help attune]]`** replies:

```
[SYSTEM: attune - attune [[awakened|vitae|resolve]] [[off]]  (what this character can USE (a pool he cannot use is only points))]
```

### `background`

one background in full: ceiling, ladder, and what it grants

```
[[background [[name]]]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional | `[name]` <br>*e.g.* `fount` |

**`[[help background]]`** replies:

```
[SYSTEM: background - background [[name]]  (one background in full: ceiling, ladder, and what it grants)]
```

### `backgrounds`

the backgrounds this chronicle defines, what you hold, and what they confer

```
[[backgrounds]]
```

_No arguments._

**`[[help backgrounds]]`** replies:

```
[SYSTEM: backgrounds - backgrounds  (the backgrounds this chronicle defines, what you hold, and what they confer)]
```

### `budget`

what each purse allows, what is spent, what is left (advisory)

```
[[budget ["[name|@alias]"]  (what each purse allows, what is spent, what is left (advisory))]]
```

| argument | kind | meaning |
|---|---|---|
| `character` | positional | `"[name\|@alias]"` |

**`[[help budget]]`** replies:

```
[SYSTEM: budget - budget ["[name|@alias]"]  (what each purse allows, what is spent, what is left (advisory))]
```

### `cancel-contest`

cancel an extended contest

```
[[cancel-contest [[id]]]]
```

| argument | kind | meaning |
|---|---|---|
| `id` | positional | `[id]` |

**`[[help cancel-contest]]`** replies:

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

**`[[help cancel-roll]]`** replies:

```
[SYSTEM: cancel-roll - cancel-roll [[id]]  (cancel an extended action)]
```

### `cancel-wizard`

abandon the running wizard

```
[[cancel-wizard]]
```

_No arguments._

**`[[help cancel-wizard]]`** replies:

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

**`[[help cast]]`** replies:

```
[SYSTEM: cast - cast pillars="name:level[,name:level...]" [foundation=<trait>] [quintessence=N] [label=".."] [requires=N] [extended=true] [ongoing=true] [interval=".."] [intervals=N] [on-botch=fail|lose-successes|ignore] [spend=<res[:effect][!]>] [spend-amount=N]  (@deprecated - use [[magick]] (Awakened magic); this name is wanted for Sorcery)]
```

### `characters`

list playable characters; marks current/default

```
[[characters]]
```

_No arguments._

**`[[help characters]]`** replies:

```
[SYSTEM: characters - characters  (list playable characters; marks current/default)]
```

### `check-constraints`

flag the current character's constraint conflicts (incl. merit-instance caps)

```
[[check-constraints  (flag the current character's constraint conflicts (incl. merit-instance caps))]]
```

_No arguments._

**`[[help check-constraints]]`** replies:

```
[SYSTEM: check-constraints - check-constraints  (flag the current character's constraint conflicts (incl. merit-instance caps))]
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

**`[[help choose]]`** replies:

```
[SYSTEM: choose - choose [<clan|fellowship|attributes|abilities>] [<value>]  (pick a clan, a fellowship, or the Attribute/Ability priorities)]
```

### `clan`

one clan: its Disciplines and what it bounds

```
[[clan [<name>]]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional | `<name>` <br>*e.g.* `nosferatu` |

**`[[help clan]]`** replies:

```
[SYSTEM: clan - clan [<name>]  (one clan: its Disciplines and what it bounds)]
```

### `clans`

the clans and their Disciplines

```
[[clans [[name]]]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional | `[name]` <br>*e.g.* `nosferatu` |

**`[[help clans]]`** replies:

```
[SYSTEM: clans - clans [[name]]  (the clans and their Disciplines)]
```

### `clear-boosts`

clear trait boosts (the ST calls the duration)

```
[[clear-boosts  (clear trait boosts (the ST calls the duration))]]
```

_No arguments._

**`[[help clear-boosts]]`** replies:

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

**`[[help clear-steps]]`** replies:

```
[SYSTEM: clear-steps - clear-steps <procedure>  (drop all follow-up steps from a saved procedure (its entry roll stays))]
```

### `configure-resources`

guided resource setup; plain replies answer it

```
[[configure-resources]]
```

_No arguments._

**`[[help configure-resources]]`** replies:

```
[SYSTEM: configure-resources - configure-resources  (guided resource setup; plain replies answer it)]
```

### `constraint`

show one constraint group in full

```
[[constraint <name>]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional **required** | `<name>` |

**`[[help constraint]]`** replies:

```
[SYSTEM: constraint - constraint <name>  (show one constraint group in full)]
```

### `constraints`

list the story's constraint groups

```
[[constraints]]
```

_No arguments._

**`[[help constraints]]`** replies:

```
[SYSTEM: constraints - constraints  (list the story's constraint groups)]
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

**`[[help contest]]`** replies:

```
[SYSTEM: contest - contest <your-pool> <their-pool> [vs="Name"] [difficulty=N] [vs-difficulty=N] [table=".."] [spend=res[::effect][!]] [spend-amount=N]  (contested action: higher total wins (tie = draw))]
```

### `contest-status`

show an extended contest's progress

```
[[contest-status [[id]]]]
```

| argument | kind | meaning |
|---|---|---|
| `id` | positional | `[id]` |

**`[[help contest-status]]`** replies:

```
[SYSTEM: contest-status - contest-status [[id]]  (show an extended contest's progress)]
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

**`[[help continue-contest]]`** replies:

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

**`[[help continue-roll]]`** replies:

```
[SYSTEM: continue-roll - continue-roll [[id]] [difficulty=N] [diff-mod=N] [dice-modifier=N] [tags="a,b"] [spend=res[::effect][!]] [spend-amount=N]  (whoever is current rolls the next interval (named-only overrides))]
```

### `convert-cards`

rewrite any lorebook card still holding JSON in the readable format (one-shot)

```
[[convert-cards  (rewrite any lorebook card still holding JSON in the readable format (one-shot))]]
```

_No arguments._

**`[[help convert-cards]]`** replies:

```
[SYSTEM: convert-cards - convert-cards  (rewrite any lorebook card still holding JSON in the readable format (one-shot))]
```

### `costs`

what a dot costs from each purse (chronicle rules, Storyteller-applied)

```
[[costs [[kind]]  (what a dot costs from each purse (chronicle rules, Storyteller-applied))]]
```

| argument | kind | meaning |
|---|---|---|
| `kind` | positional | `[kind]` <br>*e.g.* `discipline` |

**`[[help costs]]`** replies:

```
[SYSTEM: costs - costs [[kind]]  (what a dot costs from each purse (chronicle rules, Storyteller-applied))]
```

### `cray`

the cray's points, status and how it refills

```
[[cray]]
```

_No arguments._

**`[[help cray]]`** replies:

```
[SYSTEM: cray - cray  (the cray's points, status and how it refills)]
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

**`[[help create-playable]]`** replies:

```
[SYSTEM: create-playable - create-playable name=".." templates="a,b"  (create a playable character (attributes 1, abilities 0 - allocation is opt-in))]
```

### `creation`

the creation budget: every pool against what the sheet holds (advisory)

```
[[creation ["[name|@alias]"]  (the creation budget: every pool against what the sheet holds (advisory))]]
```

| argument | kind | meaning |
|---|---|---|
| `character` | positional | `"[name\|@alias]"` |

**`[[help creation]]`** replies:

```
[SYSTEM: creation - creation ["[name|@alias]"]  (the creation budget: every pool against what the sheet holds (advisory))]
```

### `creator-mode`

toggle lorebook hand-editing; edits sync in while on

```
[[creator-mode set=true|false]]
```

| argument | kind | meaning |
|---|---|---|
| `set` | named `enum` **required** | — — one of `true`, `false` |

**`[[help creator-mode]]`** replies:

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

**`[[help damage]]`** replies:

```
[SYSTEM: damage - damage <bashing|lethal|aggravated> [[n]]  (mark damage on the current character)]
```

### `dates`

list the saved date bookmarks

```
[[dates]]
```

_No arguments._

**`[[help dates]]`** replies:

```
[SYSTEM: dates - dates  (list the saved date bookmarks)]
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

**`[[help define-affliction]]`** replies:

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

**`[[help define-arcanum]]`** replies:

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

**`[[help define-background]]`** replies:

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

**`[[help define-constraint]]`** replies:

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

**`[[help define-merit]]`** replies:

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

**`[[help define-resource]]`** replies:

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

**`[[help define-table]]`** replies:

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

**`[[help define-table-category]]`** replies:

```
[SYSTEM: define-table-category - define-table-category name=".."  (create a table subcategory (a real lorebook category with its general card))]
```

### `derived`

what the sheet implies rather than states: Road, Willpower, generation, and why

```
[[derived ["[name|@alias]"]]]
```

| argument | kind | meaning |
|---|---|---|
| `character` | positional | `"[name\|@alias]"` |

**`[[help derived]]`** replies:

```
[SYSTEM: derived - derived ["[name|@alias]"]  (what the sheet implies rather than states: Road, Willpower, generation, and why)]
```

### `downtime`

close the current scene and gloss the clock forward

```
[[downtime <duration>]]
```

| argument | kind | meaning |
|---|---|---|
| `duration` | positional **required** | `<duration>` <br>*e.g.* `3d` |

**`[[help downtime]]`** replies:

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

**`[[help drop-arcanum]]`** replies:

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

**`[[help drop-merit]]`** replies:

```
[SYSTEM: drop-merit - drop-merit <name[::param]>  (drop an owned merit/flaw instance)]
```

### `end-scene`

close the current scene

```
[[end-scene]]
```

_No arguments._

**`[[help end-scene]]`** replies:

```
[SYSTEM: end-scene - end-scene  (close the current scene)]
```

### `enter-library`

enter your library (applies in-library)

```
[[enter-library  (enter your library (applies in-library))]]
```

_No arguments._

**`[[help enter-library]]`** replies:

```
[SYSTEM: enter-library - enter-library  (enter your library (applies in-library))]
```

### `enter-sanctum`

enter your sanctum (applies in-sanctum)

```
[[enter-sanctum  (enter your sanctum (applies in-sanctum))]]
```

_No arguments._

**`[[help enter-sanctum]]`** replies:

```
[SYSTEM: enter-sanctum - enter-sanctum  (enter your sanctum (applies in-sanctum))]
```

### `eval`

read an expression against the current character (the reference system, exposed)

```
[[eval [<expression>]  (read an expression against the current character (the reference system, exposed))]]
```

| argument | kind | meaning |
|---|---|---|
| `expression` | positional | `<expression>` <br>*e.g.* `12 - background:generation` |

**`[[help eval]]`** replies:

```
[SYSTEM: eval - eval [<expression>]  (read an expression against the current character (the reference system, exposed))]
```

### `exit-library`

leave your library (lifts in-library)

```
[[exit-library  (leave your library (lifts in-library))]]
```

_No arguments._

**`[[help exit-library]]`** replies:

```
[SYSTEM: exit-library - exit-library  (leave your library (lifts in-library))]
```

### `exit-sanctum`

leave your sanctum (lifts in-sanctum)

```
[[exit-sanctum  (leave your sanctum (lifts in-sanctum))]]
```

_No arguments._

**`[[help exit-sanctum]]`** replies:

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

**`[[help extend-template]]`** replies:

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

**`[[help extended-contest]]`** replies:

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

**`[[help extended-roll]]`** replies:

```
[SYSTEM: extended-roll - extended-roll <pool> requires=<target> intervals=<max> [interval=".."] [label=".."] [on-botch=fail|lose-successes|ignore] [difficulty=N] [dice-modifier=N] [tags="a,b"] [spend=res[::effect][!]] [spend-amount=N]  (start an extended action (rolls interval 1 now); plus the usual roll knobs)]
```

### `fellowships`

the mystic fellowships' Foundation & Pillars (bare: list them)

```
[[fellowships [[name]]  (the mystic fellowships' Foundation & Pillars (bare: list them))]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional | `[name]` <br>*e.g.* `order-of-hermes` |

**`[[help fellowships]]`** replies:

```
[SYSTEM: fellowships - fellowships [[name]]  (the mystic fellowships' Foundation & Pillars (bare: list them))]
```

### `flush-context`

clean the story now: strip engine notes and hidden blocks (run this if things feel slow)

```
[[flush-context  (clean the story now: strip engine notes and hidden blocks (run this if things feel slow))]]
```

_No arguments._

**`[[help flush-context]]`** replies:

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

**`[[help forget-affliction]]`** replies:

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

**`[[help forget-alias]]`** replies:

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

**`[[help forget-arcanum]]`** replies:

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

**`[[help forget-background]]`** replies:

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

**`[[help forget-constraint]]`** replies:

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

**`[[help forget-date]]`** replies:

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

**`[[help forget-grant]]`** replies:

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

**`[[help forget-merit]]`** replies:

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

**`[[help forget-roll]]`** replies:

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

**`[[help forget-scene]]`** replies:

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

**`[[help forget-specialty]]`** replies:

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

**`[[help forget-table]]`** replies:

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

**`[[help forget-table-alias]]`** replies:

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

**`[[help forget-template]]`** replies:

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

**`[[help gain]]`** replies:

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

**`[[help grant]]`** replies:

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

**`[[help harvest]]`** replies:

```
[SYSTEM: harvest - harvest [[points]] [time=".."]  (draw Quintessence from the cray ritually (no roll; overdrawing costs the site a dot))]
```

### `health`

show the current character's health track

```
[[health]]
```

_No arguments._

**`[[help health]]`** replies:

```
[SYSTEM: health - health  (show the current character's health track)]
```

### `help`

list commands, or show one's usage

```
[[help [<verb>]]]
```

| argument | kind | meaning |
|---|---|---|
| `verb` | positional | `<verb>` |

**`[[help help]]`** replies:

```
[SYSTEM: help - help [<verb>]  (list commands, or show one's usage)]
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

**`[[help hide]]`** replies:

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

**`[[help invoke]]`** replies:

```
[SYSTEM: invoke - invoke <affliction>  (use a power that OFFERS an affliction rather than applying it automatically)]
```

### `leave-library`

step back through the measured door

```
[[leave-library]]
```

_No arguments._

**`[[help leave-library]]`** replies:

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

**`[[help lift]]`** replies:

```
[SYSTEM: lift - lift <affliction> [on=<name|@alias>] [spend=res[::effect][!]] [spend-amount=N]  (remove an affliction - and its mirror; spend = shrug-off)]
```

### `list-rolls`

list the chronicle's saved rolls

```
[[list-rolls]]
```

_No arguments._

**`[[help list-rolls]]`** replies:

```
[SYSTEM: list-rolls - list-rolls  (list the chronicle's saved rolls)]
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

**`[[help magick]]`** replies:

```
[SYSTEM: magick - magick pillars="name:level[,name:level...]" [foundation=<trait>] [quintessence=N] [label=".."] [requires=N] [extended=true] [ongoing=true] [interval=".."] [intervals=N] [on-botch=fail|lose-successes|ignore] [spend=<res[:effect][!]>] [spend-amount=N]  (work Awakened magick (Dark Ages: Mage) - pillars carry the REQUIRED levels)]
```

### `measure-door`

the Talisman ritual: ten minutes measuring a door opens the Library of the Unseen

```
[[measure-door]]
```

_No arguments._

**`[[help measure-door]]`** replies:

```
[SYSTEM: measure-door - measure-door  (the Talisman ritual: ten minutes measuring a door opens the Library of the Unseen)]
```

### `merit`

inspect a merit/flaw definition (bare: list them)

```
[[merit [[name]]  (inspect a merit/flaw definition (bare: list them))]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional | `[name]` <br>*e.g.* `inviolate-soul` |

**`[[help merit]]`** replies:

```
[SYSTEM: merit - merit [[name]]  (inspect a merit/flaw definition (bare: list them))]
```

### `merits`

list owned merits/flaws, enhancement totals and advisory issues

```
[[merits]]
```

> Never lists Arcana - they are not merits. [[arcana]] is their list

_No arguments._

**`[[help merits]]`** replies:

```
[SYSTEM: merits - merits  (list owned merits/flaws, enhancement totals and advisory issues; Never lists Arcana - they are not merits. [[arcana]] is their list)]
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

**`[[help name-roll]]`** replies:

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

**`[[help paid]]`** replies:

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

**`[[help play]]`** replies:

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

**`[[help player]]`** replies:

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

**`[[help research]]`** replies:

```
[SYSTEM: research - research <topic> [difficulty=N] [tags="a,b"]  (search the library: Intelligence + Library (must be in it))]
```

### `reset-uses`

scene/turn change: clears effect-use counters

```
[[reset-uses]]
```

_No arguments._

**`[[help reset-uses]]`** replies:

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

**`[[help resist]]`** replies:

```
[SYSTEM: resist - resist <your-pool> <their-pool> [vs="Name"] [difficulty=N] [vs-difficulty=N] [table=".."] [spend=res[::effect][!]] [spend-amount=N]  (resisted action: your margin over theirs counts (tie = fail))]
```

### `resources`

list the current character's resources

```
[[resources]]
```

_No arguments._

**`[[help resources]]`** replies:

```
[SYSTEM: resources - resources  (list the current character's resources)]
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

**`[[help roll]]`** replies:

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

**`[[help roll-for]]`** replies:

```
[SYSTEM: roll-for - roll-for "<name|@alias>" <pool|@name> [[difficulty|expr]] [[diff-mod]] [requires=N] [dice-modifier=N] [min-difficulty=N] [successes=N] [uncancelable=N] [tags="a,b"] [spend=res[::effect][!]] [spend-amount=N] [specialty=<trait|label>] [table=".."]  (roll for a named character without switching to them)]
```

### `roll-info`

show a saved roll's full spec, sidecars, procedure steps, and description

```
[[roll-info <name>]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional **required** | `<name>` |

**`[[help roll-info]]`** replies:

```
[SYSTEM: roll-info - roll-info <name>  (show a saved roll's full spec, sidecars, procedure steps, and description)]
```

### `roll-status`

show an extended action's progress

```
[[roll-status [[id]]]]
```

| argument | kind | meaning |
|---|---|---|
| `id` | positional | `[id]` |

**`[[help roll-status]]`** replies:

```
[SYSTEM: roll-status - roll-status [[id]]  (show an extended action's progress)]
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

**`[[help save-date]]`** replies:

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

**`[[help scene]]`** replies:

```
[SYSTEM: scene - scene <name> [location=".."] [turn=".."] [chapter=".."]  (open a named scene at the current story time (one location; turn=<len> sets a Turn's length))]
```

### `scene-info`

show a scene in full (defaults to the open one)

```
[[scene-info [[name]]  (show a scene in full (defaults to the open one))]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional | `[name]` |

**`[[help scene-info]]`** replies:

```
[SYSTEM: scene-info - scene-info [[name]]  (show a scene in full (defaults to the open one))]
```

### `scenes`

list the chronicle's scenes

```
[[scenes]]
```

_No arguments._

**`[[help scenes]]`** replies:

```
[SYSTEM: scenes - scenes  (list the chronicle's scenes)]
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

**`[[help seal-spell]]`** replies:

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

**`[[help set-default]]`** replies:

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

**`[[help set-trait]]`** replies:

```
[SYSTEM: set-trait - set-trait <trait> <n> [group=".."] [note=".."] [paid=".."] [add=true]  (set any rating the sheet holds (Attribute, Ability, Background, Discipline, Pillar, pool start); merits use [[take-merit]]; specialties use [[specialty]])]
```

### `sheet`

show a character's record as the engine reads it (effective values marked)

```
[[sheet ["<name|@alias>"]  (show a character's record as the engine reads it (effective values marked))]]
```

| argument | kind | meaning |
|---|---|---|
| `character` | positional | `"<name\|@alias>"` |

**`[[help sheet]]`** replies:

```
[SYSTEM: sheet - sheet ["<name|@alias>"]  (show a character's record as the engine reads it (effective values marked))]
```

### `specialties`

list the current character's specialties

```
[[specialties]]
```

_No arguments._

**`[[help specialties]]`** replies:

```
[SYSTEM: specialties - specialties  (list the current character's specialties)]
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

**`[[help specialty]]`** replies:

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

**`[[help spend]]`** replies:

```
[SYSTEM: spend - spend <resource[::effect]> [[target]] [[amount]] [reason=".."]  (spend a resource / fire a named effect outside a roll)]
```

### `story-date`

show the current story date and how long since it began

```
[[story-date]]
```

_No arguments._

**`[[help story-date]]`** replies:

```
[SYSTEM: story-date - story-date  (show the current story date and how long since it began)]
```

### `story-start`

set when the story begins (yyyy-mm-dd-hh)

```
[[story-start yyyy-mm-dd-hh  (set when the story begins (yyyy-mm-dd-hh))]]
```

| argument | kind | meaning |
|---|---|---|
| `date` | positional **required** | `yyyy-mm-dd-hh` <br>*e.g.* `1197-03-15-08` |

**`[[help story-start]]`** replies:

```
[SYSTEM: story-start - story-start yyyy-mm-dd-hh  (set when the story begins (yyyy-mm-dd-hh))]
```

### `supernatural`

the families of power open to this character (disciplines, magic, sorcery, blood-sorcery)

```
[[supernatural [[category]]  (the families of power open to this character (disciplines, magic, sorcery, blood-sorcery))]]
```

| argument | kind | meaning |
|---|---|---|
| `category` | positional | `[category]` <br>*e.g.* `blood-sorcery` |

**`[[help supernatural]]`** replies:

```
[SYSTEM: supernatural - supernatural [[category]]  (the families of power open to this character (disciplines, magic, sorcery, blood-sorcery))]
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

**`[[help table-alias]]`** replies:

```
[SYSTEM: table-alias - table-alias [<@alias>] ["<[sub::]name>"]  (define a table alias, or list them (no args); table=@alias resolves it)]
```

### `tables`

list success tables (grouped by category), or lay one out in full

```
[[tables [<name|sub|sub::name|@alias>]  (list success tables (grouped by category), or lay one out in full)]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional | `<name\|sub\|sub::name\|@alias>` |

**`[[help tables]]`** replies:

```
[SYSTEM: tables - tables [<name|sub|sub::name|@alias>]  (list success tables (grouped by category), or lay one out in full)]
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

**`[[help take-arcanum]]`** replies:

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

**`[[help take-merit]]`** replies:

```
[SYSTEM: take-merit - take-merit <name[::param]> [[points]] [paid=".."] [waive=true]  (take a merit/flaw; parameterized defs take name::param instances; Merits and Flaws only. Arcana and Taints are a different category - [[take-arcanum]])]
```

### `templates`

the templates this chronicle knows, and what each one is made of

```
[[templates [[name]]]]
```

| argument | kind | meaning |
|---|---|---|
| `name` | positional | `[name]` <br>*e.g.* `ouroboros` |

**`[[help templates]]`** replies:

```
[SYSTEM: templates - templates [[name]]  (the templates this chronicle knows, and what each one is made of)]
```

### `time-between`

measure the span between two dates (saved name, now, start, or yyyy-mm-dd-hh)

```
[[time-between <date> <date>  (measure the span between two dates (saved name, now, start, or yyyy-mm-dd-hh))]]
```

| argument | kind | meaning |
|---|---|---|
| `a` | positional **required** | `<date>` <br>*e.g.* `start` |
| `b` | positional **required** | `<date>` <br>*e.g.* `now` |

**`[[help time-between]]`** replies:

```
[SYSTEM: time-between - time-between <date> <date>  (measure the span between two dates (saved name, now, start, or yyyy-mm-dd-hh))]
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

**`[[help toggle]]`** replies:

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

**`[[help turn]]`** replies:

```
[SYSTEM: turn - turn [[n]]  (advance the current scene by one turn (moves the clock by its turn length))]
```

### `win-afflict`

open a window to apply an affliction (its binding slots appear on pick)

```
[[win-afflict  (open a window to apply an affliction (its binding slots appear on pick))]]
```

_No arguments._

**`[[help win-afflict]]`** replies:

```
[SYSTEM: win-afflict - win-afflict  (open a window to apply an affliction (its binding slots appear on pick))]
```

### `win-affliction`

open a window to define an affliction (then/mirror have pickers)

```
[[win-affliction  (open a window to define an affliction (then/mirror have pickers))]]
```

_No arguments._

**`[[help win-affliction]]`** replies:

```
[SYSTEM: win-affliction - win-affliction  (open a window to define an affliction (then/mirror have pickers))]
```

### `win-constraint`

open a window to define a constraint group

```
[[win-constraint]]
```

_No arguments._

**`[[help win-constraint]]`** replies:

```
[SYSTEM: win-constraint - win-constraint  (open a window to define a constraint group)]
```

### `win-roll`

open a window to build, roll, and save rolls

```
[[win-roll]]
```

_No arguments._

**`[[help win-roll]]`** replies:

```
[SYSTEM: win-roll - win-roll  (open a window to build, roll, and save rolls)]
```

### `win-table`

open a window to define a success table

```
[[win-table]]
```

_No arguments._

**`[[help win-table]]`** replies:

```
[SYSTEM: win-table - win-table  (open a window to define a success table)]
```

