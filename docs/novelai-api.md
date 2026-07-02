# NovelAI Scripting API — working reference for this project

Audience: Claude (or any model/dev) working on `src/wod.ts`. This is the API
surface we need, distilled from NovelAI's **official example scripts**
([NovelAI/novelai-script-examples](https://github.com/NovelAI/novelai-script-examples))
— every signature below appears verbatim in a shipped example unless marked
*(inferred)*. The prose docs live at
[docs.novelai.net/en/scripting](https://docs.novelai.net/en/scripting/introduction/)
(ui-extensions, ui-parts, modals-and-windows, storage-api, lorebook-api) and the
complete machine-readable truth is `https://novelai.net/scripting/types/script-types.d.ts`.

Ground rules:

- A script is a **`.naiscript`** file: a YAML frontmatter block between
  `/*---` and `---*/`, then TypeScript. Frontmatter keys seen:
  `compatibilityVersion: naiscript-1.0`, `id` (uuid), `name`, `version`,
  `author`, `description`, `memoryLimit` (MB), `createdAt`/`updatedAt`, and
  `config:` — a list of `{ name, prettyName, type, default }` options the user
  can set; read them with `await api.v1.config.get("name")`.
- The host injects a global **`api`** (everything under `api.v1.*`) and ambient
  types (`UIPart`, `OnContextBuilt`, `OnResponse`, `HistoryNodeState`,
  `DocumentSelection`, `GenerationChoice`, …). No imports.
- **Almost everything is async.** Top-level `await` is used via an async IIFE.
- Diagnostics: `api.v1.log(...)`, `api.v1.error(...)`, `api.v1.uuid()`,
  `api.v1.random.int(min, max)`.

## 1. Storage (three stores + a UI binding)

All three stores share one surface: `get(key)`, `set(key, value)`,
`remove(key)` (and `setIfAbsent` per the storage docs). Values are
JSON-serializable.

| Store | Scope / lifetime |
| --- | --- |
| `api.v1.storage` | per **account/script** — survives across stories |
| `api.v1.storyStorage` | per **story** — travels with the story file |
| `api.v1.tempStorage` | volatile — cleared whenever the script unloads (refresh, toggle, session end); for UI sync & deliberately-unsaved state |

**`storageKey` binding:** input parts (`textInput`, `multilineTextInput`,
`checkboxInput`) accept `storageKey: "someKey"` — the host then persists the
control's value automatically, no `onChange` needed. Prefix with `"story:"`
(e.g. `storageKey: "story:auto_read_enabled"`) to bind to **story** storage
instead of account storage. Read the current value back with
`api.v1.storage.get("someKey")` / `api.v1.storyStorage.get(...)`.

`api.v1.story.id()` → current story's id (useful to detect story switches).

## 2. Lorebook (already wrapped in `src/wod.ts`)

`api.v1.lorebook`: `entries(categoryId?)`, `categories()`, `entry(entryId)`,
`category(categoryId)`, `createCategory(Partial<LorebookCategory>)` →
**`Promise<string>` (the new id)**, `createEntry(Partial<LorebookEntry>)` →
**`Promise<string>`**, `updateEntry(id, Partial<LorebookEntry>)`,
`updateCategory(id, …)`, `removeEntry(id)`, `removeCategory(id)`.
Entries are filtered by category **id**, not name — resolve names via
`categories()` first. The host generates a uuid when `id` is omitted; pass
`api.v1.uuid()` when you want to keep/reuse it. Our `LorebookManager` handles
all of this; don't call these raw.

## 3. UI extensions — `api.v1.ui.register([...])`

`register` takes an array of **top-level extensions**. Each has a `type`, an
`id` (needed for later updates), and type-specific fields. Re-registering (or
updating) with the same `id` **replaces that extension's content wholesale**.

| Extension type | Where it appears | Fields (verbatim from examples) |
| --- | --- | --- |
| `scriptPanel` | panel below the editor | `{ type, id, name, iconId, content: UIPart[] }` |
| `sidebarPanel` | tab in the right sidebar | `{ type, id, name, iconId, content: UIPart[] }` |
| `toolbarButton` | editor toolbar | `{ type, id, text, iconId, callback }` |
| `contextMenuButton` | right-click menu on selected text | `{ type, id, text, callback: ({ selection }) => … }` |

Updating:

- `api.v1.ui.update([{ type, id, …full extension… }])` — replace a registered
  extension (same shape as `register`).
- `api.v1.ui.updateParts([{ type, id, …changed fields… }])` — update
  **individual parts by their `id`** anywhere in a tree (e.g. change one
  `text` part's `text` without re-sending the panel).
- `api.v1.ui.toast("message")` — transient notification.

`iconId` examples seen: `"file-text"`, `"refresh"`.

## 4. UI parts (the building blocks inside `content`)

Common to all: optional `id` (for `updateParts`), optional `style` — a
**CSS-in-JS object** (`{ display: "flex", flexDirection: "column", flex: 1,
padding: "12px", overflowY: "auto", gridTemplateColumns: … }` all seen working).

| Part `type` | Fields seen in examples |
| --- | --- |
| `text` | `text`, `style` |
| `button` | `text`, `callback` (may be async), `style` |
| `textInput` | `label`, `placeholder`, `initialValue`, `storageKey`, `onChange(value)`, `onSubmit()` |
| `multilineTextInput` | `storageKey`, `placeholder`, `style` (textarea-like; `resize`, `flex`) |
| `checkboxInput` | `label`, `initialValue`, `storageKey`, `onChange(value)` |
| `container` | `content: UIPart[]`, `style` (generic div; used for flex/grid layouts) |
| `row` | `content`, `spacing` (e.g. `"space-between"`), `alignment` (e.g. `"center"`), `style` |
| `column` | `content`, `style` (e.g. `{ alignItems: "stretch" }`) |
| `box` | `content`, `style` (bordered/card-like grouping) |

No dropdown/select appears in any official example — if we need one, emulate
with buttons or check `script-types.d.ts` first.

## 5. Windows & modals

```ts
const win = await api.v1.ui.window.open({
  title, defaultWidth, defaultHeight, minWidth, minHeight, resizable,
  content: UIPart[],
});
// WindowHandle:
win.update({ title: "New title" });   // Partial<WindowOptions>
win.close();
await win.closed;                      // resolves when user (or code) closes it

const modal = await api.v1.ui.modal.open({ title, content: UIPart[] });
// ModalHandle: close(), closed: Promise<void>
```

Pattern from the Notes example: a modal `textInput` uses `onChange` to capture
the value and `onSubmit: () => modal.close()`; the caller `await modal.closed`
then acts on the captured value. Windows/modals are how scripts do dialogs —
there is no `prompt()`/`confirm()`.

## 6. Hooks — `api.v1.hooks.register(name, handler)`

| Hook | Handler shape (verbatim) |
| --- | --- |
| `onTextAdventureInput` | `({ continuityId, inputText, rawInputText, mode }) => { inputText?, mode?, stopGeneration?, stopFurtherScripts? } \| void \| Promise<…>` — rewrite adventure-mode input (our `[[…]]` entry point). **Newlines in the returned `inputText` are replaced with spaces** by the host; return `inputText: ""` and write the document yourself if you need them. `stopGeneration: true` suppresses the AI turn. |
| `onContextBuilt` | `(params: { messages: {role, content}[] }) => { messages, stopGeneration?, stopFurtherScripts? } \| void` — mutate/extend the prompt right before generation |
| `onResponse` | `(params: { text: string[] }) => { text } \| void` — transform streamed output batches (called incrementally, not just at the end) |

Handlers may be async. Other hooks exist (`onBeforeContextBuild`,
`onGenerationRequested`/`onGenerationEnd`, `onHistoryNavigated`,
`onDocumentConvertedToText`, `onLorebookEntrySelected`, `onScriptsLoaded`);
see `docs/hooks.html`.

## 7. Generation, document & editor (for the Storyteller loop later)

- `await api.v1.generate(messages, params, (choices, final) => { … })` —
  direct LLM call; `messages` = `{role, content}[]`, `params` includes
  `model`, `max_tokens`, `temperature`, `top_p`, `top_k`; streamed via callback
  (`choices[0].text` per batch, `final` flag on the last).
- `await api.v1.buildContext({ contextLimitReduction, suppressScriptHooks: 'self' })`
  — pre-build the story context, reserving token space.
- `api.v1.generationParameters.get()` → current story settings (incl. `model`).
- **Token budgets** (scripts are rate-limited):
  `api.v1.script.countUncachedInputTokens(messages)`,
  `getAllowedInput()` / `getAllowedOutput()` (numbers),
  `waitForAllowedInput(n)` / `waitForAllowedOutput(n)` (throwing waits).
- `api.v1.tokenizer.encode(text, model)` / `decode(tokens, model)`.
- Document: `scan()` → `[{ sectionId, section: { text, origin, formatting } }]`;
  `updateParagraphs(sections)`; `append(text)`;
  `textFromSelection({ from, to })`. Section `origin`/`formatting` are
  `[{ position, length, data }]` and must be re-mapped if you change text length
  (see Find & Replace for the algorithm).
- History: `document.history.currentNodeId()` / `previousNodeId()` /
  `nodeState(id)` → `HistoryNodeState { sections, forwardChanges,
  targetNode: { genPosition: { sectionId, offset }, children } }`;
  `undo()`, `jump(nodeId)`.
- Editor: `api.v1.editor.isBlocked()`, `api.v1.editor.generate()` (the normal
  "send" action).
- **Permissions:** editing the document needs
  `await api.v1.permissions.request('documentEdit')` (check with
  `permissions.has(...)`); it returns `false` if the user refuses — handle it.
- Misc: `api.v1.timers.sleep(ms)` / `setTimeout(fn, ms)` / `clearTimeout(id)`;
  `api.v1.clipboard.writeText(text)`; `api.v1.tts.queue(text, { seed: voice })`.

## 8. Gotchas

1. `ui.register`/`ui.update` replace content **wholesale** — for frequent small
   changes give parts stable `id`s and use `ui.updateParts`.
2. `storageKey` silently writes to **account** storage unless prefixed
   `"story:"`. Pick deliberately; our sheets are story-scoped.
3. `tempStorage` is the only store that self-clears; never put anything there
   you can't recompute.
4. Everything is a Promise — a missed `await` (esp. `storage.get` in a
   callback) is the classic bug.
5. Callbacks in parts can be async; errors inside them vanish unless you
   try/catch and surface via `toast`/window (see Retry Harder's error window).
6. Respect the token budget APIs before `generate`, or long operations die
   mid-flight.
7. `memoryLimit` in the frontmatter is real (examples use 8 MB) — keep big data
   in storage/lorebook, not module globals.

**Full local mirror:** the complete official documentation now lives in this
repo as `docs/*.html` (`api-reference.html` is the whole API index with exact
signatures; plus per-topic pages: hooks, lorebook, storage, story-settings,
generation, context-building, document, permissions, ui-extensions, ui-parts,
modals-and-windows). When anything here is in doubt, grep those. Also in the
reference but not summarized above: `api.v1.memory`, `api.v1.messaging`
(cross-script), `api.v1.prefill`, `api.v1.random.roll()`, `api.v1.maxTokens()`,
`rolloverTokens`/`RolloverHelper`.
