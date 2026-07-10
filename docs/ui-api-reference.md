# UI API Reference (`api.v1.ui`)

> The UI slice of `docs/api-reference.html`, transcribed to clean Markdown
> (signatures + types de-noised from the highlighted HTML). The full 760 KB API
> reference covers many non-UI namespaces; this file extracts only `api.v1.ui`
> and the UI types. Narrative guides: [Modals and Windows](./modals-and-windows.md),
> [UI Parts](./ui-parts.md), [UI Extensions](./ui-extensions.md).

## `api.v1.ui` — functions

| Function | Description |
| --- | --- |
| `closePanel(): Promise<void>` | Close the currently open script panel. |
| `openPanel(id: string): Promise<void>` | Open a specific script panel by ID. |
| `register(extensions: UIExtension[]): Promise<void>` | Register new UI extensions (buttons, panels, etc.). |
| `remove(ids: string[]): Promise<void>` | Remove UI extensions by their IDs. |
| `removeParts(ids: string[]): Promise<void>` | Remove UI parts from modals/windows by their IDs. |
| `toast(message: string, options?: UIToastOptions): Promise<void>` | Display or update a toast notification. |
| `update(extensions: (Partial<UIExtension> & { id: string })[]): Promise<void>` | Update existing UI extensions (must include their IDs; may also add new ones). |
| `updateParts(parts: (Partial<UIPart> & { id: string })[]): Promise<void>` | Update existing UI parts in modals/windows. The update is dropped if the part has not yet been mounted by React (e.g. called too soon after creating it). |

Namespaces: [`extension`](#apiv1uiextension), `larry`, [`modal`](#apiv1uimodal),
[`part`](#apiv1uipart), [`window`](#apiv1uiwindow).

### register / update examples

```ts
await api.v1.ui.register([
  {
    type: "toolbarButton",
    id: "myButton",
    text: "Click Me",
    callback: () => api.v1.log("Clicked!")
  }
]);
```

```ts
api.v1.ui.toast("This is a notification!", { duration: 5000 });
```

## `api.v1.ui.modal`

### `api.v1.ui.modal.open()`

Open a new modal dialog.

```ts
function open(options: ModalOptions): Promise<{
  update: (options: Partial<ModalOptions>) => Promise<void>
  close: () => Promise<void>
  isClosed: () => boolean
  closed: Promise<void>
}>
```

```ts
const modal = await api.v1.ui.modal.open({
  type: "modal",
  title: "Settings",
  size: "medium",
  content: [
    { type: "text", text: "Configure your settings" }
  ]
});
// Later: modal.close();
```

## `api.v1.ui.window`

### `api.v1.ui.window.open()`

Open a new floating window.

```ts
function open(options: WindowOptions): Promise<{
  update: (options: Partial<WindowOptions>) => Promise<void>
  close: () => Promise<void>
  isClosed: () => boolean
  closed: Promise<void>
}>
```

```ts
const win = await api.v1.ui.window.open({
  type: "window",
  title: "My Tool",
  defaultWidth: 400,
  defaultHeight: 300,
  content: [
    { type: "text", text: "Window content here" }
  ]
});
```

## `api.v1.ui.part`

Convenience helpers that create a UI part with the correct `type` field filled
in. Each is `function name(config: Omit<UIPartX, 'type'>): UIPartX`.

`box`, `button`, `checkboxInput`, `codeEditor`, `collapsibleSection`, `column`,
`container`, `image`, `jsx`, `multilineTextInput`, `numberInput`, `row`,
`sliderInput`, `text`, `textInput`.

```ts
const panel = api.v1.ui.extension.scriptPanel({
  id: "myPanel",
  name: "My Tools",
  content: [
    api.v1.ui.part.text({ text: "Panel content" })
  ]
});
```

## `api.v1.ui.extension`

Convenience helpers that create a UI extension with the correct `type`. Each is
`function name(config: Omit<UIExtensionX, 'type'>): UIExtensionX`.

`contextMenuButton`, `lorebookPanel`, `scriptPanel`, `sidebarPanel`,
`toolbarButton`, `toolboxOption`.

```ts
const menuBtn = api.v1.ui.extension.contextMenuButton({
  id: "myMenuBtn",
  text: "Custom Action",
  callback: ({ selection }) => api.v1.log("Selected:", selection)
});
```

## `api.v1.ui.larry`

### `api.v1.ui.larry.help()`

Show Larry with a question and optional response buttons.

```ts
function help(config: {
  question: string
  options?: { text: string; callback: () => void }[]
  [key: string]: any
}): void
```

---

# Types

## Options

```ts
type ModalOptions = {
  id?: string
  title?: string
  size?: 'full' | 'large' | 'medium' | 'small'
  hasMinimumHeight?: boolean
  fillWidth?: boolean
  content: UIPart[]
}
```

```ts
type WindowOptions = {
  id?: string
  defaultWidth?: number | string
  defaultHeight?: number | string
  defaultX?: number | string
  defaultY?: number | string
  minWidth?: number | string
  minHeight?: number | string
  maxWidth?: number | string
  maxHeight?: number | string
  resizable?: boolean
  title?: string
  content: UIPart[]
}
```

```ts
type UIToastOptions = {
  id?: string
  autoClose?: number | false
  type?: 'info' | 'success' | 'warning' | 'error'
}
```

## UIExtension

```ts
type UIExtension =
  | UIExtensionContextMenuButton
  | UIExtensionScriptPanel
  | UIExtensionToolbarButton
  | UIExtensionToolboxOption
  | UIExtensionSidebarPanel
  | UIExtensionLorebookPanel
```

```ts
type UIExtensionContextMenuButton = {
  type: 'contextMenuButton'
  id?: string
  text: string
  callback: (_: { selection: DocumentSelection }) => void
}

type UIExtensionLorebookPanel = {
  type: 'lorebookPanel'
  id?: string
  name: string
  iconId?: string
  content: UIPart[]
}

type UIExtensionScriptPanel = {
  type: 'scriptPanel'
  id?: string
  name: string
  iconId?: IconId
  content: UIPart[]
}

type UIExtensionSidebarPanel = {
  type: 'sidebarPanel'
  id?: string
  name: string
  iconId?: IconId
  content: UIPart[]
}

type UIExtensionToolbarButton = {
  type: 'toolbarButton'
  id?: string
  text?: string
  iconId?: IconId
  disabled?: boolean
  disabledWhileCallbackRunning?: boolean
  callback?: () => void
}

type UIExtensionToolboxOption = {
  type: 'toolboxOption'
  id?: string
  name: string
  description?: string
  iconId?: IconId
  callback?: ((_: { selection: DocumentSelection; text: string }) => void) | string
  content?: UIPart[]
}
```

## UIPart

```ts
type UIPart = UIPartRegistry[keyof UIPartRegistry] | null
```

The union members (each carries an optional `id` and, on most, an optional
`style?: any`):

### Layout

```ts
type UIPartRow = {
  type: 'row'
  id?: string
  content: UIPart[]
  spacing?: 'center' | 'end' | 'space-around' | 'space-between' | 'start'
  alignment?: 'center' | 'end' | 'start'
  wrap?: boolean
  style?: any
}

type UIPartColumn = {
  type: 'column'
  id?: string
  content: UIPart[]
  spacing?: 'center' | 'end' | 'space-around' | 'space-between' | 'start'
  alignment?: 'center' | 'end' | 'start'
  wrap?: boolean
  style?: any
}

type UIPartBox = {
  type: 'box'
  id?: string
  content: UIPart[]
  style?: any
}

type UIPartContainer = {
  type: 'container'
  id?: string
  style?: any
  content: UIPart[]
}

type UIPartCollapsibleSection = {
  type: 'collapsibleSection'
  id?: string
  title: string
  initialCollapsed?: boolean
  storageKey?: string
  iconId?: IconId
  content: UIPart[]
  style?: any
}
```

### Inputs

```ts
type UIPartTextInput = {
  type: 'textInput'
  id?: string
  initialValue?: string
  storageKey?: string
  onChange?: (value: string) => void
  onSubmit?: (value: string) => void
  disabled?: boolean
  label?: string
  placeholder?: string
  style?: any
}

type UIPartMultilineTextInput = {
  type: 'multilineTextInput'
  id?: string
  initialValue?: string
  storageKey?: string
  onChange?: (value: string) => void
  onSubmit?: (value: string) => void
  disabled?: boolean
  label?: string
  placeholder?: string
  style?: any
}

// Note: numberInput's onChange/onSubmit receive the value as a string.
type UIPartNumberInput = {
  type: 'numberInput'
  id?: string
  initialValue?: number
  storageKey?: string
  onChange?: (value: string) => void
  onSubmit?: (value: string) => void
  disabled?: boolean
  label?: string
  placeholder?: string
  style?: any
}

type UIPartCheckboxInput = {
  type: 'checkboxInput'
  id?: string
  initialValue?: boolean
  storageKey?: string
  onChange?: (value: boolean) => void
  disabled?: boolean
  label?: string
  style?: any
}

type UIPartSliderInput = {
  type: 'sliderInput'
  id?: string
  initialValue?: number
  storageKey?: string
  onChange?: (value: number) => void
  label?: string
  min: number
  max: number
  step?: number
  preventDecimal?: boolean
  uncapMin?: boolean
  uncapMax?: boolean
  prefix?: string
  suffix?: string
  changeDelay?: number
  disabled?: boolean
  defaultValue?: number
  style?: any
}

type UIPartCodeEditor = {
  type: 'codeEditor'
  id: string
  initialValue?: string
  storageKey?: string
  onChange?: (value: string) => void
  language?: 'typescript' | 'javascript' | 'json' | 'markdown' | 'html' | 'css' | 'plaintext'
  height?: number | string
  readOnly?: boolean
  lineNumbers?: boolean
  wordWrap?: boolean
  fontSize?: number
  diagnosticCodesToIgnore?: number[]
  style?: any
}
```

### Display

```ts
type UIPartText = {
  type: 'text'
  id?: string
  text?: string
  markdown?: boolean
  style?: any
  noTemplate?: boolean
}

type UIPartImage = {
  type: 'image'
  id?: string
  src: string        // data: URL only
  alt?: string
  height?: number
  width?: number
  style?: any
}

type UIPartButton = {
  type: 'button'
  id?: string
  text?: string
  iconId?: IconId
  callback: () => void
  disabled?: boolean
  disabledWhileCallbackRunning?: boolean
  style?: any
}

type UIPartJSX = {
  type: 'jsx'
  id?: string
  onMount: (elem: any) => void   // receives the root element (Preact)
  style?: any
  captureEvents?: string[]
}
```

> **No native select / dropdown / radio part.** Render mutually-exclusive choices
> as a `row`/`column` of `button`s (each sets a `storageKey` and re-renders via
> the modal/window handle's `update(...)`), or use a `textInput`.
