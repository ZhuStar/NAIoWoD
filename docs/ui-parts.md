# UI Parts

> Transcribed from `docs/ui-parts.html` (the mirrored NovelAI scripting docs).
> Exact per-part property types are in the [UI API reference](./ui-api-reference.md);
> where a part has more props than the narrative below shows, that reference is
> authoritative. See also [Modals and Windows](./modals-and-windows.md) and
> [UI Extensions](./ui-extensions.md). Project-specific design notes for the
> planned `[[win-roll]]` window are at the [bottom of this file](#design-notes--the-future-win-roll-window).

UI Parts are the building blocks for creating user interfaces in your scripts.
They provide a way to display information and get user input. UI Parts can be
used in various UI Extensions such as Sidebar Panels, Script Panels, and Toolbox
Options as well as in Modals and Windows.

All UI Parts are defined as objects with a `type` property that specifies the
kind of UI Part it is. Each type has its own set of properties that define its
behavior and appearance. Convenience helpers on `api.v1.ui.part.*` create each
part with the correct `type` filled in.

The full registry of part types: `row`, `column`, `box`, `container`,
`collapsibleSection`, `textInput`, `multilineTextInput`, `numberInput`,
`checkboxInput`, `sliderInput`, `codeEditor`, `text`, `image`, `button`, `jsx`.
**There is no native select / dropdown / radio part** — present a set of choices
as a row/column of `button`s (or a `textInput`).

## Layout Components

### Row

A row layout arranges its child components horizontally in a single line. It
accepts a `content` array of UI Parts. It is a flex container with row direction
and has `spacing` and `alignment` properties to control spacing between items and
their vertical alignment (plus optional `wrap`).

```ts
{
  type: 'row',
  content: [
    { type: 'text', text: 'First Item' },
    { type: 'text', text: 'Second Item' }
  ]
}
```

### Column

A column layout arranges its child components vertically in a single column. It
accepts a `content` array of UI Parts. It is a flex container with column
direction and has `spacing` and `alignment` properties to control spacing
between items and their horizontal alignment (plus optional `wrap`).

```ts
{
  type: 'column',
  content: [
    { type: 'text', text: 'First Item' },
    { type: 'text', text: 'Second Item' }
  ]
}
```

### Box

A box layout places its child components in a bordered box with a background
color. It accepts a `content` array of UI Parts. For a custom-styled box, use a
Container with the `style` property instead.

```ts
{
  type: 'box',
  content: [
    { type: 'text', text: 'This is inside a box.' }
  ]
}
```

### Container

A container is a simple wrapper that wraps its child components in a plain div.
It accepts a `content` array of UI Parts. Containers are useful for applying
custom styles to a group of UI Parts using the `style` property.

```ts
{
  type: 'container',
  style: {
    border: '1px solid #ff0000',
    padding: '10px'
  },
  content: [
    { type: 'text', text: 'This is inside a custom-styled container.' }
  ]
}
```

### Collapsible Section

A collapsible section can expand/collapse to show/hide its `content`. It has a
`title`, an optional `initialCollapsed`, and an optional `storageKey` to persist
the open/closed state. (Full props in the [reference](./ui-api-reference.md#uipartcollapsiblesection).)

```ts
{
  type: 'collapsibleSection',
  title: 'Advanced options',
  initialCollapsed: true,
  content: [
    { type: 'text', text: 'Hidden until expanded.' }
  ]
}
```

## Input Components

Each input part has a `storageKey` property that binds the value to persistent
storage (see [State Management](#state-management)). Callbacks respond to user
input. Note: `numberInput`'s `onChange`/`onSubmit` receive the value as a
**string**.

### Text Input

A single-line text input. `onChange` fires on every edit; `onSubmit` fires when
the user submits (e.g. presses Enter).

```ts
{
  type: 'textInput',
  storageKey: 'user-value',
  onChange: (value) => {
    api.v1.log('User changed input to: ' + value)
  },
  onSubmit: (value) => {
    api.v1.log('User submitted input: ' + value)
  }
}
```

### Multiline Text Input

A multiline text input for larger blocks of text. `onSubmit` fires on
Ctrl+Enter.

```ts
{
  type: 'multilineTextInput',
  storageKey: 'user-multiline-value',
  onChange: (value) => {
    api.v1.log('User changed multiline input to: ' + value)
  },
  onSubmit: (value) => {
    api.v1.log('User submitted multiline input: ' + value)
  }
}
```

### Number Input

A number input for numeric values.

```ts
{
  type: 'numberInput',
  storageKey: 'user-number-value',
  onChange: (value) => {
    api.v1.log('User changed number input to: ' + value)
  },
  onSubmit: (value) => {
    api.v1.log('User submitted number input: ' + value)
  }
}
```

### Checkbox Input

A checkbox input toggles a boolean value.

```ts
{
  type: 'checkboxInput',
  storageKey: 'user-checkbox-value',
  onChange: (value) => {
    api.v1.log('User changed checkbox to: ' + value)
  }
}
```

### Slider Input

A slider input with direct value editing. Requires `min` and `max`; supports
`step`, `prefix`/`suffix`, `preventDecimal`, and more (see the
[reference](./ui-api-reference.md#uipartsliderinput)).

```ts
{
  type: 'sliderInput',
  storageKey: 'user-slider-value',
  min: 1,
  max: 10,
  step: 1
}
```

### Code Editor

A Monaco code editor with syntax highlighting. Requires an `id`; supports
`language` (`'typescript' | 'javascript' | 'json' | 'markdown' | 'html' | 'css'
| 'plaintext'`), `readOnly`, `lineNumbers`, and more.

```ts
{
  type: 'codeEditor',
  id: 'my-editor',
  language: 'json',
  storageKey: 'user-code'
}
```

## Display Components

### Text

A text display component. `text` holds the content; set `markdown: true` to
enable markdown formatting. URLs do not become clickable links (security/privacy).

Text within `{{curly braces}}` is treated as a storage key and replaced with the
stored value. Disable this with `noTemplate: true`. To target a specific store,
use `{{history:key}}`, `{{story:key}}`, or `{{temp:key}}`.

```ts
{
  type: 'text',
  text: `# Heading
This is **bold** text and this is *italic* text.`,
  markdown: true
}
```

### Image

An image display component. `src` supports **Data URLs only** (e.g.
`data:image/png;base64,…`) — external URLs are not allowed (security/privacy).
It is recommended to set explicit `height` and `width`.

```ts
{
  type: 'image',
  src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
  alt: 'Example Image',
  height: 200,
  width: 200
}
```

### Button

A clickable button. `text` is the label and `callback` runs on click. Disable it
with `disabled: true`, or disable it while its callback runs with
`disabledWhileCallbackRunning: true`.

```ts
{
  type: 'button',
  text: 'Click Me',
  callback: () => {
    api.v1.log('Button was clicked!')
  }
}
```

## Styling

Most UI Parts accept a `style` property to customize their appearance. It takes
an object of CSS properties/values in **camelCase** (e.g. `backgroundColor`, not
`background-color`).

These are inline styles, so pseudo-classes and media queries are unavailable.
URLs are stripped from style properties (security/privacy).

If you use the key of a theme color (e.g. `bg0`, `textHeadings`, `warning`) or
font family (e.g. `default`, `headings`) as a value, it is replaced with the
actual value from the current theme.

## State Management

### Storage Keys

Many input UI Parts support a `storageKey` property that binds the input value to
persistent storage. When the user changes the input, it is saved to storage under
that key. If the stored value changes (from another UI Part or script), the input
automatically updates to reflect it. `tempStorage` is the documented home for UI
state that should not persist beyond the session (`{{temp:key}}`).

## See Also

- [UI Extensions](./ui-extensions.md) — where to use UI parts
- [Modals and Windows](./modals-and-windows.md) — using UI parts in modals/windows
- [UI API reference](./ui-api-reference.md) — full `api.v1.ui` + every part type

---

## Design notes — the future `[[win-roll]]` window

> Not part of the NovelAI docs. These are project decisions for NAIoWoD's planned
> roll-builder window, recorded here so the build pass has them. The window itself
> is **not built yet**. (The `api.v1.ui` contract + off-host mock DO exist now in
> `src/host.ts`, and spec-driven windows/modals are live — see `src/window.ts`
> and the modal helpers in `src/game.ts`.) This section is the spec.

**What it is.** A floating **window** (not a modal), opened by the `[[win-roll]]`
command via `api.v1.ui.window.open`. It is a **form** — every field visible at
once — for building either a **named roll** (saved to `NamedRollStore`) or an
**immediate roll** (executed now). It is the intended **basis for all future
wizards** (character creation, etc. render the same form machinery).

**Interaction model.** Field state binds to **`tempStorage`** via `storageKey`s;
the window reads that state on submit and assembles the target object. The window
is **callback-driven** (`button.callback`, input `onChange`/`onSubmit`) — it does
**not** go through the `onTextAdventureInput` text seam the text wizard uses. An
**immediate roll's result is shown in-window** (rebuild `content` via the handle's
`update(...)`), since scripts cannot inject story text directly.

**Fields to represent** (everything a simple *or* extended roll needs — mirrors
`RollSpec`/`ExtendedRoll` in `src/rolls.ts`):

| Field | UI | Notes |
| --- | --- | --- |
| Named vs immediate | button row | two submit buttons: "Save named" / "Roll now" |
| Name | `textInput` | only when saving a named roll |
| Pool | `textInput` | trait(s) or raw dice — a pool expression (`strength+brawl`, `7`) |
| Difficulty | `textInput` | number **or trait or calculation** — evaluate via `parsePoolExpression` (reuse `src/rolls.ts`) |
| Difficulty mod | `numberInput` | `difficultyMod` |
| Dice mod | `numberInput` | `diceMod` |
| Requires | `numberInput` | success threshold |
| Tags | `textInput` | comma-separated |
| Table | button row | pick from `SuccessTableRegistry` (`table=`) |
| Extended? | `checkboxInput` | reveals the block below |
| — target | `numberInput` | accumulated goal |
| — intervals | `numberInput` | max rolls |
| — interval label | `textInput` | advisory spacing |
| — on-botch | button row | `fail` / `lose-successes` / `ignore` |
| Spend | `textInput` | optional `resource[:effect][!]` |

Wrap the extended block in a `collapsibleSection`. Since there is **no native
select/radio**, render every choice (table, on-botch, named/immediate) as a
**row of `button`s** that set a `tempStorage` key and re-render via `update`.

**Difficulty as an expression** (model change, deferred to the build pass):
`RollSpec.difficulty` is currently `number`. Add an optional expression path
(evaluate with `parsePoolExpression(expr, resolver)` → base difficulty) so the
window's difficulty field can be a number, a trait, or a calculation.

**Reserved cross-entity prefixes.** In pool/difficulty expressions, a token may
carry a prefix naming whose trait it is: `self:` / `ally:` / `target:` /
`opposition:`. `self:` (and any unprefixed token) means the **current
character**. **Decision (locked with the user): advisory resolution** — `self:`/
unprefixed resolve now; `ally:` / `target:` / `opposition:` are parsed, stored,
surfaced, and **ST-supplied (or 0)** until a targeting subsystem lands (the
project's "store it, mark ST-enforced, never block" pattern). This pairs with the
resisted/contested `vs="Name"` machinery and roadmap item #4 (Targeting others).
Implementation note: the parser (`parsePoolExpression`) is unchanged — only the
**resolver** interprets prefixes, because each `+`-separated token is handed to
the resolver as-is.

**Reuse for the build pass:** `parsePoolExpression` / `RollSpec` / `makeRollSpec`
/ `executeRoll` / `SuccessTableRegistry` (`src/rolls.ts`); `NamedRollStore` /
`rollAndReport` / `characterRollEnv` (`src/game.ts`); the host contract
(`src/host.ts` — where `api.v1.ui` must be added, contract + mock); the
medium-agnostic `WizardDefinition` (`src/wizard.ts`), whose header already
anticipates "a future `api.v1.ui` renderer."

## Design notes — selection widgets (radio / dropdown substitutes)

> Not part of the NovelAI docs. The UI registry has **no native select part**,
> so choices are simulated. Three modes, all driven by the same `CommandSpec`
> enum param; pick by option-count:
>
> 1. **Few options (≤ ~5): inline button row** (`selectorRow`, live in
>    `src/window.ts`) — every option is a button, the current one is marked
>    with a bullet; one click selects and re-renders. This IS a radio group.
> 2. **Many options: the picker modal** (user idea, 2026-07-16; not built yet)
>    — the window shows the options (or just the current value) as text with
>    the selected one marked ✅, next to a **Choose…** button; the button opens
>    a **modal with one button per option** (modals take an arbitrary part
>    tree — any number of buttons, stacked in rows/columns); clicking one
>    writes the selection to the field's tempStorage key, closes the modal,
>    and re-renders the window. A dropdown substitute for lists too long to
>    inline (conditions, templates, abilities).
> 3. **Open vocabularies: a text input** — typing the value stays the escape
>    hatch when the option set is unbounded or the user knows what they want.
>
> When built, mode 2 should be a third rendering branch of
> `openCommandWindow`'s enum handling (option-count threshold), not a separate
> system.
