# Modals and Windows

> Transcribed from `docs/modals-and-windows.html` (the mirrored NovelAI scripting
> docs), with the exact option/return types folded in from `docs/api-reference.html`.
> See also [UI Parts](./ui-parts.md), [UI Extensions](./ui-extensions.md), and the
> full [UI API reference](./ui-api-reference.md).

Modals and Windows provide a way to create custom dialog boxes and floating
windows in NovelAI. They can be used to display information, gather user input,
or provide additional functionality for your scripts. **Modals** are centered
dialog boxes that block interaction with the rest of the UI until closed, while
**Windows** are floating panels that can be moved around and allow interaction
with other parts of the UI. They are created using the `api.v1.ui.modal.open`
and `api.v1.ui.window.open` functions respectively.

Other than their positioning and interaction model, Modals and Windows share
similar structure and capabilities. Both can contain arbitrary UI content
defined using UI Parts — see the [UI Parts documentation](./ui-parts.md).

## Creating a Modal

To create a modal, use the `api.v1.ui.modal.open` function. It takes a
`ModalOptions` object (title, content, size) and returns a Promise resolving to
a handle for controlling the modal afterwards.

```ts
const modal = await api.v1.ui.modal.open({
  title: 'Example Modal',
  content: [
    {
      type: 'text',
      text: 'This is an example modal created by a script.'
    },
  ],
  size: 'small'
});
// Later: modal.close();
```

`ModalOptions`:

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

## Creating a Window

To create a window, use the `api.v1.ui.window.open` function. It takes a
`WindowOptions` object (title, content, size hints) and returns a Promise
resolving to a control handle.

```ts
const wndw = await api.v1.ui.window.open({
  title: 'Example Window',
  content: [
    {
      type: 'text',
      text: 'This is an example window created by a script.'
    },
  ],
  defaultHeight: 300,
  defaultWidth: 400
});
```

`WindowOptions`:

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

## The control handle

Both `modal.open` and `window.open` resolve to an object you can use to interact
with the modal/window after it has been created:

```ts
{
  update: (options: Partial<ModalOptions | WindowOptions>) => Promise<void>
  close: () => Promise<void>
  isClosed: () => boolean
  closed: Promise<void>   // resolves when the modal/window is closed
}
```

- `update(...)` re-renders with new options (e.g. swap `content` to reflect new
  state).
- `close()` closes it programmatically.
- `closed` is a promise you can `await` to run code after it is closed.

## Disable This Script?

All modals and windows created by scripts have a **"Disable This Script?"**
button — in the bottom right of modals and in the title bar of windows. Clicking
it immediately disables the script that created the modal or window and closes
it (and any other modals or windows created by that script).

## See Also

- [UI Parts](./ui-parts.md) — building content for modals and windows
- [UI Extensions](./ui-extensions.md) — other ways to create UI
- [UI API reference](./ui-api-reference.md) — the full `api.v1.ui` surface
