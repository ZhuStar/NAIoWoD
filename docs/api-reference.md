# API Reference

> Transcribed from `docs/api-reference.html` (the mirrored NovelAI scripting
> docs) — the complete auto-generated reference of every `api.v1.*` namespace,
> function, and type. Code blocks are de-noised from the source's syntax
> highlighting; multi-line signatures keep the generator's original indentation.
> Table-of-contents anchors are rendered as plain labels (the source's internal
> `#script-types.*` anchors don't exist in Markdown). For a curated view of just
> the UI surface see [`ui-api-reference.md`](./ui-api-reference.md); narrative
> guides live in the other `docs/*.md` files.


## Table of Contents

- api.v1
  - api.v1.an
    - api.v1.an.get()
    - api.v1.an.set()
  - api.v1.buildContext()
  - api.v1.clipboard
    - api.v1.clipboard.writeText()
  - api.v1.commentBot
    - api.v1.commentBot.get()
    - api.v1.commentBot.update()
  - api.v1.config
    - api.v1.config.get()
  - api.v1.createCancellationSignal()
  - api.v1.createRolloverHelper()
  - api.v1.document
    - api.v1.document.append()
    - api.v1.document.appendParagraph()
    - api.v1.document.appendParagraphs()
    - api.v1.document.history
      - api.v1.document.history.currentNodeId()
      - api.v1.document.history.jump()
      - api.v1.document.history.mostRecentGenerationNodeId()
      - api.v1.document.history.nodeState()
      - api.v1.document.history.previousNodeId()
      - api.v1.document.history.redo()
      - api.v1.document.history.undo()
    - api.v1.document.insertParagraphAfter()
    - api.v1.document.insertParagraphsAfter()
    - api.v1.document.removeParagraph()
    - api.v1.document.removeParagraphs()
    - api.v1.document.scan()
    - api.v1.document.sectionIds()
    - api.v1.document.textFromSelection()
    - api.v1.document.updateParagraph()
    - api.v1.document.updateParagraphs()
  - api.v1.editor
    - api.v1.editor.decorations
      - api.v1.editor.decorations.clearAll()
      - api.v1.editor.decorations.clearMarkers()
      - api.v1.editor.decorations.clearRules()
      - api.v1.editor.decorations.clearWidgets()
      - api.v1.editor.decorations.createMarker()
      - api.v1.editor.decorations.createMarkers()
      - api.v1.editor.decorations.createWidget()
      - api.v1.editor.decorations.createWidgets()
      - api.v1.editor.decorations.getMarker()
      - api.v1.editor.decorations.getMarkers()
      - api.v1.editor.decorations.getRules()
      - api.v1.editor.decorations.getWidget()
      - api.v1.editor.decorations.getWidgets()
      - api.v1.editor.decorations.registerRules()
      - api.v1.editor.decorations.removeRules()
      - api.v1.editor.decorations.updateRules()
    - api.v1.editor.generate()
    - api.v1.editor.isBlocked()
    - api.v1.editor.selection
      - api.v1.editor.selection.get()
  - api.v1.error()
  - api.v1.file
    - api.v1.file.prompt()
    - api.v1.file.save()
  - api.v1.generate()
  - api.v1.generateWithStory()
  - api.v1.generationParameters
    - api.v1.generationParameters.get()
    - api.v1.generationParameters.update()
  - api.v1.historyStorage
    - api.v1.historyStorage.get()
    - api.v1.historyStorage.getOrDefault()
    - api.v1.historyStorage.has()
    - api.v1.historyStorage.list()
    - api.v1.historyStorage.remove()
    - api.v1.historyStorage.set()
    - api.v1.historyStorage.setIfAbsent()
  - api.v1.hooks
    - api.v1.hooks.isRegistered()
    - api.v1.hooks.register()
    - api.v1.hooks.unregister()
  - api.v1.log()
  - api.v1.logprobs
    - api.v1.logprobs.get()
    - api.v1.logprobs.set()
  - api.v1.lorebook
    - api.v1.lorebook.categories()
    - api.v1.lorebook.category()
    - api.v1.lorebook.createCategory()
    - api.v1.lorebook.createEntry()
    - api.v1.lorebook.entries()
    - api.v1.lorebook.entry()
    - api.v1.lorebook.removeCategory()
    - api.v1.lorebook.removeEntry()
    - api.v1.lorebook.updateCategory()
    - api.v1.lorebook.updateEntry()
  - api.v1.maxTokens()
  - api.v1.memory
    - api.v1.memory.get()
    - api.v1.memory.set()
  - api.v1.messaging
    - api.v1.messaging.broadcast()
    - api.v1.messaging.onMessage()
    - api.v1.messaging.send()
    - api.v1.messaging.unsubscribe()
  - api.v1.permissions
    - api.v1.permissions.has()
    - api.v1.permissions.list()
    - api.v1.permissions.request()
  - api.v1.prefill
    - api.v1.prefill.get()
    - api.v1.prefill.getDefault()
    - api.v1.prefill.set()
  - api.v1.random
    - api.v1.random.bool()
    - api.v1.random.float()
    - api.v1.random.int()
    - api.v1.random.roll()
  - api.v1.rolloverTokens()
  - api.v1.script
    - api.v1.script.author
    - api.v1.script.countUncachedInputTokens()
    - api.v1.script.description
    - api.v1.script.getAllowedInput()
    - api.v1.script.getAllowedOutput()
    - api.v1.script.getTimeUntilAllowedInput()
    - api.v1.script.getTimeUntilAllowedOutput()
    - api.v1.script.id
    - api.v1.script.memoryLimit
    - api.v1.script.name
    - api.v1.script.version
    - api.v1.script.waitForAllowedInput()
    - api.v1.script.waitForAllowedOutput()
  - api.v1.storage
    - api.v1.storage.get()
    - api.v1.storage.getOrDefault()
    - api.v1.storage.has()
    - api.v1.storage.list()
    - api.v1.storage.remove()
    - api.v1.storage.set()
    - api.v1.storage.setIfAbsent()
  - api.v1.story
    - api.v1.story.description
      - api.v1.story.description.get()
      - api.v1.story.description.set()
    - api.v1.story.id()
    - api.v1.story.title
      - api.v1.story.title.get()
      - api.v1.story.title.set()
  - api.v1.storyStorage
    - api.v1.storyStorage.get()
    - api.v1.storyStorage.getOrDefault()
    - api.v1.storyStorage.has()
    - api.v1.storyStorage.list()
    - api.v1.storyStorage.remove()
    - api.v1.storyStorage.set()
    - api.v1.storyStorage.setIfAbsent()
  - api.v1.systemPrompt
    - api.v1.systemPrompt.get()
    - api.v1.systemPrompt.getDefault()
    - api.v1.systemPrompt.set()
  - api.v1.tempStorage
    - api.v1.tempStorage.get()
    - api.v1.tempStorage.getOrDefault()
    - api.v1.tempStorage.has()
    - api.v1.tempStorage.list()
    - api.v1.tempStorage.remove()
    - api.v1.tempStorage.set()
    - api.v1.tempStorage.setIfAbsent()
  - api.v1.theme
    - api.v1.theme.get()
  - api.v1.timers
    - api.v1.timers.clearTimeout()
    - api.v1.timers.setTimeout()
    - api.v1.timers.sleep()
  - api.v1.tokenizer
    - api.v1.tokenizer.decode()
    - api.v1.tokenizer.encode()
  - api.v1.ts
    - api.v1.ts.transpile()
  - api.v1.tts
    - api.v1.tts.pause()
    - api.v1.tts.queue()
    - api.v1.tts.resume()
    - api.v1.tts.speak()
    - api.v1.tts.stop()
    - api.v1.tts.togglePause()
  - api.v1.ui
    - api.v1.ui.closePanel()
    - api.v1.ui.extension
      - api.v1.ui.extension.contextMenuButton()
      - api.v1.ui.extension.lorebookPanel()
      - api.v1.ui.extension.scriptPanel()
      - api.v1.ui.extension.sidebarPanel()
      - api.v1.ui.extension.toolbarButton()
      - api.v1.ui.extension.toolboxOption()
    - api.v1.ui.larry
      - api.v1.ui.larry.help()
    - api.v1.ui.modal
      - api.v1.ui.modal.open()
    - api.v1.ui.openPanel()
    - api.v1.ui.part
      - api.v1.ui.part.box()
      - api.v1.ui.part.button()
      - api.v1.ui.part.checkboxInput()
      - api.v1.ui.part.codeEditor()
      - api.v1.ui.part.collapsibleSection()
      - api.v1.ui.part.column()
      - api.v1.ui.part.container()
      - api.v1.ui.part.image()
      - api.v1.ui.part.jsx()
      - api.v1.ui.part.multilineTextInput()
      - api.v1.ui.part.numberInput()
      - api.v1.ui.part.row()
      - api.v1.ui.part.sliderInput()
      - api.v1.ui.part.text()
      - api.v1.ui.part.textInput()
    - api.v1.ui.register()
    - api.v1.ui.remove()
    - api.v1.ui.removeParts()
    - api.v1.ui.toast()
    - api.v1.ui.update()
    - api.v1.ui.updateParts()
    - api.v1.ui.window
      - api.v1.ui.window.open()
  - api.v1.uuid()
- CancellationSignal
- CancellationSignal.cancel()
- CancellationSignal.cancelled
- CancellationSignal.dispose()
- DecorationCreateInlineMarkerOptions
- DecorationCreateInlineWidgetOptions
- DecorationCreateNodeMarkerOptions
- DecorationCreateNodeWidgetOptions
- DecorationCreateWidgetOptions
- DecorationInlineMarkerInfo
- DecorationInlineWidgetInfo
- DecorationMarkerChangeEvent
- DecorationMarkerDisposeEvent
- DecorationMarkerEvent
- DecorationMarkerHandle
- DecorationMarkerInfo
- DecorationNodeMarkerInfo
- DecorationNodeWidgetInfo
- DecorationPosition
- DecorationRule
- DecorationSectionScope
- DecorationUpdateInlineWidgetOptions
- DecorationUpdateMarkerOptions
- DecorationUpdateNodeWidgetOptions
- DecorationUpdateWidgetOptions
- DecorationWidgetChangeEvent
- DecorationWidgetDisposeEvent
- DecorationWidgetEvent
- DecorationWidgetHandle
- DecorationWidgetInfo
- DocumentSelection
- EditorDataOrigin
- EditorSectionSource
- EditorTextFormatting
- GenerationChoice
- GenerationParams
- GenerationPosition
- GenerationResponse
- HistoryChangeMap
- HistoryDiffMeta
- HistoryDiffText
- HistoryNodeInfo
- HistoryNodeState
- HistoryStep
- HistoryStepCreate
- HistoryStepRemove
- HistoryStepUpdate
- HookCallbacks
- HookCallbacks.onBeforeContextBuild
- HookCallbacks.onContextBuilt
- HookCallbacks.onDocumentConvertedToText
- HookCallbacks.onGenerationEnd
- HookCallbacks.onGenerationRequested
- HookCallbacks.onHistoryNavigated
- HookCallbacks.onLorebookEntrySelected
- HookCallbacks.onResponse
- HookCallbacks.onScriptsLoaded
- HookCallbacks.onTextAdventureInput
- IconId
- Logprobs
- LogprobsToken
- LorebookAdvancedConditionAnd
- LorebookAdvancedConditionEquation
- LorebookAdvancedConditionKey
- LorebookAdvancedConditionLore
- LorebookAdvancedConditionModel
- LorebookAdvancedConditionNot
- LorebookAdvancedConditionOr
- LorebookAdvancedConditionRandom
- LorebookAdvancedConditionStoryMode
- LorebookAdvancedConditionStringComparison
- LorebookAdvancedConditionTrue
- LorebookCategory
- LorebookCondition
- LorebookEntry
- Message
- ModalOptions
- OnBeforeContextBuild
- onBeforeContextBuildReturnValue
- OnContextBuilt
- OnContextBuiltReturnValue
- OnDocumentConvertedToText
- OnDocumentConvertedToTextReturnValue
- OnDocumentConvertedToTextSection
- OnGenerationEnd
- OnGenerationEndReturnValue
- OnGenerationRequested
- OnGenerationRequestedReturnValue
- OnHistoryNavigated
- OnLorebookEntrySelected
- OnResponse
- OnResponseReturnValue
- OnScriptsLoaded
- OnTextAdventureInput
- OnTextAdventureInputReturnValue
- OpenAILogprobs
- RolloverHelper
- RolloverHelper.add()
- RolloverHelper.clear()
- RolloverHelper.compact()
- RolloverHelper.count()
- RolloverHelper.getAll()
- RolloverHelper.getConfig()
- RolloverHelper.peek()
- RolloverHelper.read()
- RolloverHelper.remove()
- RolloverHelper.totalTokens()
- RolloverHelperConfig
- RolloverHelperContentObject
- RolloverHelperItem
- RolloverHelperStoredItem
- ScriptMessage
- ScriptMessageFilter
- ScriptPermission
- Section
- UIExtension
- UIExtensionContextMenuButton
- UIExtensionLorebookPanel
- UIExtensionScriptPanel
- UIExtensionSidebarPanel
- UIExtensionToolbarButton
- UIExtensionToolboxOption
- UIPart
- UIPartBox
- UIPartButton
- UIPartCheckboxInput
- UIPartCodeEditor
- UIPartCollapsibleSection
- UIPartColumn
- UIPartContainer
- UIPartImage
- UIPartJSX
- UIPartMultilineTextInput
- UIPartNumberInput
- UIPartRegistry
- UIPartRegistry.box
- UIPartRegistry.button
- UIPartRegistry.checkboxInput
- UIPartRegistry.codeEditor
- UIPartRegistry.collapsibleSection
- UIPartRegistry.column
- UIPartRegistry.container
- UIPartRegistry.image
- UIPartRegistry.jsx
- UIPartRegistry.multilineTextInput
- UIPartRegistry.numberInput
- UIPartRegistry.row
- UIPartRegistry.sliderInput
- UIPartRegistry.text
- UIPartRegistry.textInput
- UIPartRow
- UIPartSliderInput
- UIPartText
- UIPartTextInput
- UIToastOptions
- WindowOptions

---

## api.v1

Version 1 of the Scripting API. This is the current stable API version.

**Signature:**

```ts
namespace v1
```

## Functions

| Function | Description |
| --- | --- |
| buildContext(options) | Build context for the current story using the normal context building process. Calling this during script initialization is not recommended, as scripts will not yet be initialized and any onContextBuilt hooks will not be run. |
| createCancellationSignal() | Create a cancellation signal that can be used to cancel ongoing operations. |
| createRolloverHelper(config) | Create a rollover helper for managing a sliding window of items within a token budget. Useful for maintaining conversation history or context that stays within token limits.
The helper automatically tokenizes content when tokens are not provided, using the configured model’s tokenizer. |
| error(messages) | Log an error message to the console. |
| generate(messages, params, callback, behaviour, signal) | Generate text. Currently only supports chat-style generation with message arrays using GLM 4.6 |
| generateWithStory(messages, params, options, callback, behaviour, signal) | Generate text including the story as context. A shortcut for calling buildContext and using those messages for generation. The context limit used for the buildContext will be automatically adjusted based on the provided messages. |
| log(messages) | Log a message to the console. |
| maxTokens(model) | Returns the max tokens allowed for the specified model. |
| rolloverTokens(model) | Returns the number of rollover tokens allowed for the specified model. |
| uuid() | Generate a new UUID (universally unique identifier). |

## Namespaces

| Namespace | Description |
| --- | --- |
| an | Author’s Note API - Read and update the author’s note. |
| clipboard | Clipboard API - Write text to the system clipboard. |
| commentBot | Comment Bot API - Control the comment bot (HypeBot) interface and behavior. |
| config | Configuration API - Access script configuration values. |
| document | Document API - Manipulate the story document. |
| editor | Editor API - Control editor behavior and state. |
| file | File API - Read and write files in the user’s file system. |
| generationParameters | Generation Parameters API - Get and set default generation parameters. Currently only supports parameters for chat-style generation with GLM 4.6. |
| historyStorage | History Storage API - Store data associated with specific history nodes. When data is retrieved, the value from the closest ancestor node with that key is returned. Useful for tracking state across undo/redo operations. History storage always stores data within the current story, even if the script is an account-level script. Stored data will remain if the account-level script is deleted. |
| hooks | Hooks API - Register and manage hooks for generation and other events. |
| logprobs | Logprobs API - Set the current logprobs used for the display in the editor. |
| lorebook | Lorebook API - Manage lorebook entries and categories. |
| memory | Memory API - Read and update the story memory. |
| messaging | Messaging API - Send and receive messages between scripts. Scripts can communicate with each other through targeted messages or broadcasts. |
| permissions | Permission API - Ask for and check script permissions. |
| prefill | Prefill API - Read and update the prefill text. |
| random | Random utilities API - Generate random values and roll dice. |
| script | Script Info API - Static, read-only information about the running script. |
| storage | Storage API - Persistent key-value storage for the script. Data persists across script runs and story sessions. Attempting to store non-serializable values will result in those values being lost. The data is stored wherever the script is stored, so account-level scripts will have their data stored separately from the story. |
| story |  |
| storyStorage | Story Storage API - Persistent key-value storage for the script. Data persists across script runs and story sessions. Attempting to store non-serializable values will result in those values being lost. Unlike the main storage API, story storage always stores data within the current story, even if the script is an account-level script. Stored data will remain if the account-level script is deleted. |
| systemPrompt | System Prompt API - Read and update the system prompt. |
| tempStorage | Temporary Storage API - Key-value storage for the script that lasts only for the duration of the current script run. Data is not persisted across script runs or story sessions. Attempting to store non-serializable values will result in those values being lost. The stored data exists only in memory while the script is running and not persisted beyond that. Writes to temporary storage will not trigger story or script storage saves and can be used for displaying temporary state through UIPart storageKeys. |
| theme | Theme API - Access the current site theme colors and fonts. |
| timers | Timers API - Schedule delayed execution and sleep. |
| tokenizer | Tokenizer API - Encode and decode text to/from tokens. |
| ts |  |
| tts | Text-to-Speech API - Control speech synthesis. |
| ui | UI API - Create and manage custom user interfaces. |

---

## api.v1.an

Author’s Note API - Read and update the author’s note.

**Signature:**

```ts
namespace an
```

## Functions

| Function | Description |
| --- | --- |
| get() | Get the current author’s note text. |
| set(text) | Set the author’s note text. Requires the “storyEdit” permission. |

---

## api.v1.an.get()

Get the current author’s note text.

**Signature:**

```ts
function get(): Promise<string>
```

**Returns:**

Promise<string>

Promise resolving to the author’s note content

## Example

```ts
const text = await api.v1.an.get();
api.v1.log("Current author's note:", text);
```

---

## api.v1.an.set()

Set the author’s note text. Requires the “storyEdit” permission.

**Signature:**

```ts
function set(text: string): Promise<void>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| text | string | The new author’s note content |

**Returns:**

Promise<void>

Promise that resolves when the author’s note is updated

## Example

```ts
await api.v1.an.set("[ Style: descriptive and atmospheric ]");
```

---

## api.v1.buildContext()

Build context for the current story using the normal context building process. Calling this during script initialization is not recommended, as scripts will not yet be initialized and any onContextBuilt hooks will not be run.

**Signature:**

```ts
function buildContext(options?: {
            contextLimitReduction?: number
            position?: { sectionId: number; offset: number }
            suppressScriptHooks?: 'self' | 'all'
            forGeneration?: boolean
        }): Promise<Message[]>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| options | { contextLimitReduction?: number position?: { sectionId: number; offset: number } suppressScriptHooks?: ‘self’ \| ‘all’ forGeneration?: boolean } | *(Optional)* Optional parameters to customize context building. contextLimitReduction reduces the context size by the specified number of tokens. position allows building context as if generation were occurring at a specific location in the document. suppressScriptHooks can be set to ‘self’ to skip running this script’s onContextBuilt hook, or ‘all’ to skip all scripts’ onContextBuilt hooks. forGeneration signifies that the context is being built for generation, affecting things such as caching and potentially the behaviour of other scripts. |

**Returns:**

Promise<Message[]>

Promise resolving to the built context messages

## Example

```ts
const context = await api.v1.buildContext({ contextLimitReduction: 100});
api.v1.log("Built context with", context.length, "messages");
```

---

## api.v1.clipboard

Clipboard API - Write text to the system clipboard.

**Signature:**

```ts
namespace clipboard
```

## Functions

| Function | Description |
| --- | --- |
| writeText(text) | Write text to the clipboard. Requires “clipboardWrite” permission. |

---

## api.v1.clipboard.writeText()

Write text to the clipboard. Requires “clipboardWrite” permission.

**Signature:**

```ts
function writeText(text: string): Promise<void>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| text | string | Text to write to the clipboard |

**Returns:**

Promise<void>

Promise that resolves when the text has been written

## Example

```ts
await api.v1.clipboard.write("Hello, clipboard!");
```

---

## api.v1.commentBot

Comment Bot API - Control the comment bot (HypeBot) interface and behavior.

**Signature:**

```ts
namespace commentBot
```

## Functions

| Function | Description |
| --- | --- |
| get() | Get the current comment bot configuration. |
| update(data) | Update the comment bot configuration. |

---

## api.v1.commentBot.get()

Get the current comment bot configuration.

**Signature:**

```ts
function get(): Promise<{
                name: string
                state: null | string
                visible: boolean
                content: UIPart[]
                image?: null | string
            }>
```

**Returns:**

Promise<{ name: string state: null | string visible: boolean content: UIPart[] image?: null | string }>

Promise resolving to the bot’s current state

---

## api.v1.commentBot.update()

Update the comment bot configuration.

**Signature:**

```ts
function update(data: {
                name?: string
                state?: null | string
                visible?: boolean
                content?: UIPart[]
                image?: null | string
                callback?: () => void
            }): Promise<void>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| data | { name?: string state?: null \| string visible?: boolean content?: UIPart[] image?: null \| string callback?: () => void } | Configuration object with optional fields to update. null values will clear the field. state must be set to not null for the comment bot to become script-controlled. |

**Returns:**

Promise<void>

Promise that resolves when the bot is updated

## Example

```ts
await api.v1.commentBot.update({
  name: "Euterpe",
  state: "speaking",
  visible: true,
  content: [{ type: "text", text: "I'm here to help!" }]
});
```

---

## api.v1.config

Configuration API - Access script configuration values.

**Signature:**

```ts
namespace config
```

## Functions

| Function | Description |
| --- | --- |
| get(key) | Get a configuration value by key. |

---

## api.v1.config.get()

Get a configuration value by key.

**Signature:**

```ts
function get(key: string): Promise<any>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| key | string | The configuration key to retrieve |

**Returns:**

Promise<any>

Promise resolving to the configuration value

## Example

```ts
const player_name = await api.v1.config.get("player_name");
```

---

## api.v1.createCancellationSignal()

Create a cancellation signal that can be used to cancel ongoing operations.

**Signature:**

```ts
function createCancellationSignal(): Promise<CancellationSignal>
```

**Returns:**

Promise<CancellationSignal>

A promise resolving to a CancellationSignal object

## Example

```ts
const signal = await api.v1.createCancellationSignal();
setTimeout(() => {
  signal.cancel();
}, 5000); // Cancel after 5 seconds

const response = await api.v1.generate(
  [{ role: "user", content: "Tell me a long story..." }],
  { model: "glm-4-6", max_tokens: 1000 },
  undefined,
  'background',
  signal
);
```

---

## api.v1.createRolloverHelper()

Create a rollover helper for managing a sliding window of items within a token budget. Useful for maintaining conversation history or context that stays within token limits.

The helper automatically tokenizes content when tokens are not provided, using the configured model’s tokenizer.

**Signature:**

```ts
function createRolloverHelper<T extends RolloverHelperContentObject = RolloverHelperContentObject>(
            config: RolloverHelperConfig
        ): RolloverHelper<T>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| config | RolloverHelperConfig | Configuration specifying maxTokens, rolloverTokens, and model |

**Returns:**

A RolloverHelper instance

---

## api.v1.document

Document API - Manipulate the story document.

**Signature:**

```ts
namespace document
```

## Functions

| Function | Description |
| --- | --- |
| append(text) | Append text to the end of the document. Newlines in the text will create new paragraphs. Text is added with “script” origin. Requires the “documentEdit” permission. |
| appendParagraph(section) | Append a new paragraph to the end of the document. Requires the “documentEdit” permission. |
| appendParagraphs(sections) | Append multiple paragraphs to the end of the document. Requires the “documentEdit” permission. |
| insertParagraphAfter(sectionId, section) | Insert a paragraph after a specific section. Requires the “documentEdit” permission. |
| insertParagraphsAfter(sectionId, sections) | Insert multiple paragraphs after a specific section. Requires the “documentEdit” permission. |
| removeParagraph(sectionId) | Remove a paragraph from the document. Requires the “documentEdit” permission. |
| removeParagraphs(sectionIds) | Remove multiple paragraphs from the document. Requires the “documentEdit” permission. |
| scan(callback, range) | Scan through all sections in the document. |
| sectionIds() | Returns an array containing the ids of all sections in the document ordered from first to last. |
| textFromSelection(selection) | Extract text from a selection range in the document. |
| updateParagraph(sectionId, section) | Update an existing paragraph in the document. Requires the “documentEdit” permission. |
| updateParagraphs(updates) | Update multiple paragraphs in the document. Requires the “documentEdit” permission. |

## Namespaces

| Namespace | Description |
| --- | --- |
| history | Document history API - Navigate and query the document’s undo/redo history. |

---

## api.v1.document.append()

Append text to the end of the document. Newlines in the text will create new paragraphs. Text is added with “script” origin. Requires the “documentEdit” permission.

**Signature:**

```ts
function append(text: string): Promise<void>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| text | string | The text to append |

**Returns:**

Promise<void>

Promise that resolves when text is added

## Example

```ts
await api.v1.document.append("\nThe adventure continues...");
```

---

## api.v1.document.appendParagraph()

Append a new paragraph to the end of the document. Requires the “documentEdit” permission.

**Signature:**

```ts
function appendParagraph(section: Partial<Section>): Promise<void>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| section | Partial<Section> | Partial section object with text and optional metadata. Empty fields will use defaults |

**Returns:**

Promise<void>

Promise that resolves when the paragraph is added

## Example

```ts
await api.v1.document.appendParagraph({
  text: "A new paragraph appears.",
});
```

---

## api.v1.document.appendParagraphs()

Append multiple paragraphs to the end of the document. Requires the “documentEdit” permission.

**Signature:**

```ts
function appendParagraphs(sections: Partial<Section>[]): Promise<void>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| sections | Partial<Section>[] | Array of partial section objects. Empty fields will use defaults |

**Returns:**

Promise<void>

Promise that resolves when all paragraphs are added

## Example

```ts
await api.v1.document.appendParagraphs([
  { text: "First paragraph" },
  { text: "Second paragraph" }
]);
```

---

## api.v1.document.history

Document history API - Navigate and query the document’s undo/redo history.

**Signature:**

```ts
namespace history
```

## Functions

| Function | Description |
| --- | --- |
| currentNodeId() | Get the ID of the current history node. |
| jump(nodeId) | Jump to a specific history node. |
| mostRecentGenerationNodeId() | Get the ID of the most recent generation in history that was created as the result of text generation. This may be the current node or an earlier one. |
| nodeState(nodeId) | Navigate to a specific history node and get information about the path and changes. This returns the path taken to reach the node (going backward to a common ancestor, then forward to the target), all changes along that path, and the document state at that node. |
| previousNodeId() | Get the ID of the previous history node. |
| redo(nodeId) | Redo the last undone action. |
| undo() | Undo the last action. |

---

## api.v1.document.history.currentNodeId()

Get the ID of the current history node.

**Signature:**

```ts
function currentNodeId(): Promise<number>
```

**Returns:**

Promise<number>

Promise resolving to the current node ID

---

## api.v1.document.history.jump()

Jump to a specific history node.

**Signature:**

```ts
function jump(nodeId: number): Promise<boolean>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| nodeId | number | The target history node ID |

**Returns:**

Promise<boolean>

Promise resolving to true if the jump was successful

---

## api.v1.document.history.mostRecentGenerationNodeId()

Get the ID of the most recent generation in history that was created as the result of text generation. This may be the current node or an earlier one.

**Signature:**

```ts
function mostRecentGenerationNodeId(): Promise<number | undefined>
```

**Returns:**

Promise<number | undefined>

Promise resolving to the node ID of the last generation or undefined if no node before the current one was a generation

---

## api.v1.document.history.nodeState()

Navigate to a specific history node and get information about the path and changes. This returns the path taken to reach the node (going backward to a common ancestor, then forward to the target), all changes along that path, and the document state at that node.

**Signature:**

```ts
function nodeState(nodeId: number): Promise<HistoryNodeState | undefined>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| nodeId | number | The target history node ID |

**Returns:**

Promise<HistoryNodeState | undefined>

Promise resolving to information about the navigation, or undefined if the node doesn’t exist

## Example

```ts
const state = await api.v1.document.history.nodeState(someNodeId);
if (state) {
  api.v1.log(`Took ${state.backwardPath.length} steps back, ${state.forwardPath.length} forward`);
  api.v1.log(`Document at target has ${state.sections.length} sections`);
}
```

---

## api.v1.document.history.previousNodeId()

Get the ID of the previous history node.

**Signature:**

```ts
function previousNodeId(): Promise<number | undefined>
```

**Returns:**

Promise<number | undefined>

Promise resolving to the previous node ID or undefined if there is no previous node

---

## api.v1.document.history.redo()

Redo the last undone action.

**Signature:**

```ts
function redo(nodeId?: number): Promise<boolean>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| nodeId | number | *(Optional)* The ID of the node to redo to. If not provided, will redo to the preferred child of the current node. |

**Returns:**

Promise<boolean>

Promise resolving to true if redo was successful

---

## api.v1.document.history.undo()

Undo the last action.

**Signature:**

```ts
function undo(): Promise<boolean>
```

**Returns:**

Promise<boolean>

Promise resolving to true if undo was successful

---

## api.v1.document.insertParagraphAfter()

Insert a paragraph after a specific section. Requires the “documentEdit” permission.

**Signature:**

```ts
function insertParagraphAfter(sectionId: number, section: Partial<Section>): Promise<void>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| sectionId | number | The ID of the section to insert after. Note that section IDs are not indexes. |
| section | Partial<Section> | The new section to insert |

**Returns:**

Promise<void>

Promise that resolves when the paragraph is inserted

## Example

```ts
await api.v1.document.insertParagraphAfter(2243261709665183, {
  text: "Inserted paragraph"
});
```

---

## api.v1.document.insertParagraphsAfter()

Insert multiple paragraphs after a specific section. Requires the “documentEdit” permission.

**Signature:**

```ts
function insertParagraphsAfter(sectionId: number, sections: Partial<Section>[]): Promise<void>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| sectionId | number | The ID of the section to insert after. Note that section IDs are not indexes. |
| sections | Partial<Section>[] | Array of sections to insert |

**Returns:**

Promise<void>

Promise that resolves when all paragraphs are inserted

---

## api.v1.document.removeParagraph()

Remove a paragraph from the document. Requires the “documentEdit” permission.

**Signature:**

```ts
function removeParagraph(sectionId: number): Promise<void>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| sectionId | number | The ID of the section to remove |

**Returns:**

Promise<void>

Promise that resolves when the paragraph is removed

## Example

```ts
await api.v1.document.removeParagraph(835897208155866);
```

---

## api.v1.document.removeParagraphs()

Remove multiple paragraphs from the document. Requires the “documentEdit” permission.

**Signature:**

```ts
function removeParagraphs(sectionIds: number[]): Promise<void>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| sectionIds | number[] | Array of section IDs to remove |

**Returns:**

Promise<void>

Promise that resolves when all paragraphs are removed

## Example

```ts
await api.v1.document.removeParagraphs([404860073937026, 551077518188362, 842273775686437]);
```

---

## api.v1.document.scan()

Scan through all sections in the document.

**Signature:**

```ts
function scan(
                callback?: (sectionId: number, section: Section, index: number) => void,
                range?: { from?: number; to?: number }
            ): Promise<{ sectionId: number; section: Section; index: number }[]>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| callback | (sectionId: number, section: Section, index: number) => void | *(Optional)* Optional callback invoked for each section |
| range | { from?: number; to?: number } | *(Optional)* Optional range of section IDs to scan. If omitted, scans the entire document. If ‘from’ is omitted, starts at the beginning. If ‘to’ is omitted, goes to the end. |

**Returns:**

Promise<{ sectionId: number; section: Section; index: number }[]>

Promise resolving to array of all sections with their IDs

## Example

```ts
const sections = await api.v1.document.scan((id, section, index) => {
  api.v1.log(`Section ${index}: ${section.text.substring(0, 50)}...`);
});
```

---

## api.v1.document.sectionIds()

Returns an array containing the ids of all sections in the document ordered from first to last.

**Signature:**

```ts
function sectionIds(): Promise<number[]>
```

**Returns:**

Promise<number[]>

Promise resolving to an array of section IDs

## Example

```ts
const sectionIds = await api.v1.document.sectionIds();
api.v1.log(`The document has ${sectionIds.length} sections.`);
```

---

## api.v1.document.textFromSelection()

Extract text from a selection range in the document.

**Signature:**

```ts
function textFromSelection(selection?: {
                from?: { sectionId: number; offset?: number }
                to?: { sectionId: number; offset?: number }
            }): Promise<string>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| selection | { from?: { sectionId: number; offset?: number } to?: { sectionId: number; offset?: number } } | *(Optional)* The selection range with optional ‘from’ and ‘to’ positions. If ‘from’ is omitted, selection starts at the beginning of the document. If ‘to’ is omitted, selection goes to the end of the document. |

**Returns:**

Promise<string>

Promise resolving to the extracted text

## Example

```ts
const text = await api.v1.document.textFromSelection({
  from: { sectionId: 1969803634580167, offset: 0 },
  to: { sectionId: 216998981796148, offset: 100 }
});
```

---

## api.v1.document.updateParagraph()

Update an existing paragraph in the document. Requires the “documentEdit” permission.

**Signature:**

```ts
function updateParagraph(sectionId: number, section: Partial<Section>): Promise<void>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| sectionId | number | The ID of the section to update |
| section | Partial<Section> | Partial section object with fields to update |

**Returns:**

Promise<void>

Promise that resolves when the paragraph is updated

## Example

```ts
await api.v1.document.updateParagraph(1368456327379069, {
  text: "Updated paragraph text"
});
```

---

## api.v1.document.updateParagraphs()

Update multiple paragraphs in the document. Requires the “documentEdit” permission.

**Signature:**

```ts
function updateParagraphs(
                updates: {
                    sectionId: number
                    section: Partial<Section>
                }[]
            ): Promise<void>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| updates | { sectionId: number section: Partial<Section> }[] | Array of update objects with an ID and partial section data |

**Returns:**

Promise<void>

Promise that resolves when all paragraphs are updated

## Example

```ts
await api.v1.document.updateParagraphs([
{ sectionId: 1368456327379069, section: { text: "First updated paragraph" } },
{ sectionId: 551077518188362, section: { text: "Second updated paragraph" } },
{ sectionId: 842273775686437, section: { text: "Third updated paragraph" } }
]);
```

---

## api.v1.editor

Editor API - Control editor behavior and state.

**Signature:**

```ts
namespace editor
```

## Functions

| Function | Description |
| --- | --- |
| generate() | Trigger a generation at the end of the document, as if the user clicked the “Send” button. |
| isBlocked() | Check if the editor is currently blocked. Changes to the document and editor generations are not allowed while the editor is blocked. |

## Namespaces

| Namespace | Description |
| --- | --- |
| decorations | Decorations API - Add visual decorations to the editor. Decorations include pattern-based highlights, markers, and widgets that overlay the document without modifying its content. |
| selection | Editor selection API - Query and manipulate text selection. |

---

## api.v1.editor.decorations

Decorations API - Add visual decorations to the editor. Decorations include pattern-based highlights, markers, and widgets that overlay the document without modifying its content.

**Signature:**

```ts
namespace decorations
```

## Functions

| Function | Description |
| --- | --- |
| clearAll() | Remove all decorations (rules, markers, and widgets) created by this script. |
| clearMarkers() | Remove all markers created by this script. |
| clearRules() | Remove all decoration rules registered by this script. |
| clearWidgets() | Remove all widgets created by this script. |
| createMarker(options) | Create a new marker decoration. Inline markers highlight a range of text; node markers style entire paragraphs. Requests the “editorDecorations” permission. |
| createMarkers(options) | Batch create multiple markers. Requests the “editorDecorations” permission. |
| createWidget(options) | Create a new inline widget. Widgets render UI components at a specific position in the document. Requests the “editorDecorations” permission. |
| createWidgets(options) | Batch create multiple widgets. Requests the “editorDecorations” permission. |
| getMarker(id) | Get a marker by ID. |
| getMarkers() | Get all markers created by this script. |
| getRules() | Get all currently registered decoration rules. |
| getWidget(id) | Get a widget by ID. |
| getWidgets() | Get all widgets created by this script. |
| registerRules(rules) | Register decoration rules for pattern-based highlighting. Rules automatically apply styles to text matching the patterns. Requests the “editorDecorations” permission. |
| removeRules(ids) | Remove decoration rules by ID. |
| updateRules(updates) | Update existing decoration rules. Requests the “editorDecorations” permission. |

---

## api.v1.editor.decorations.clearAll()

Remove all decorations (rules, markers, and widgets) created by this script.

**Signature:**

```ts
function clearAll(): void
```

**Returns:**

void

## Example

```ts
// Clean up all decorations
api.v1.editor.decorations.clearAll();
```

---

## api.v1.editor.decorations.clearMarkers()

Remove all markers created by this script.

**Signature:**

```ts
function clearMarkers(): void
```

**Returns:**

void

---

## api.v1.editor.decorations.clearRules()

Remove all decoration rules registered by this script.

**Signature:**

```ts
function clearRules(): void
```

**Returns:**

void

---

## api.v1.editor.decorations.clearWidgets()

Remove all widgets created by this script.

**Signature:**

```ts
function clearWidgets(): void
```

**Returns:**

void

---

## api.v1.editor.decorations.createMarker()

Create a new marker decoration. Inline markers highlight a range of text; node markers style entire paragraphs. Requests the “editorDecorations” permission.

**Signature:**

```ts
function createMarker(
                    options: DecorationCreateInlineMarkerOptions | DecorationCreateNodeMarkerOptions
                ): Promise<DecorationMarkerHandle>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| options | DecorationCreateInlineMarkerOptions \| DecorationCreateNodeMarkerOptions | Marker creation options |

**Returns:**

Promise<DecorationMarkerHandle>

Promise resolving to a marker handle

## Example

```ts
// Inline marker (highlight text range)
const marker = await api.v1.editor.decorations.createMarker({
  type: "inline",
  from: { sectionId: 123, offset: 0 },
  to: { sectionId: 123, offset: 10 },
  style: { backgroundColor: "rgba(255, 0, 0, 0.2)" }
});

// Node marker (style entire paragraph)
const nodeMarker = await api.v1.editor.decorations.createMarker({
  type: "node",
  sectionId: 456,
  style: { backgroundColor: "rgba(0, 0, 255, 0.1)" }
});

// Later: update or remove
await marker.update({ style: { backgroundColor: "yellow" } });
await marker.dispose();
```

---

## api.v1.editor.decorations.createMarkers()

Batch create multiple markers. Requests the “editorDecorations” permission.

**Signature:**

```ts
function createMarkers(
                    options: (DecorationCreateInlineMarkerOptions | DecorationCreateNodeMarkerOptions)[]
                ): Promise<DecorationMarkerHandle[]>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| options | (DecorationCreateInlineMarkerOptions \| DecorationCreateNodeMarkerOptions)[] |  |

**Returns:**

Promise<DecorationMarkerHandle[]>

Promise resolving to array of marker handles

## Example

```ts
const markers = await api.v1.editor.decorations.createMarkers([
  {
    type: "inline",
    from: { sectionId: 123, offset: 0 },
    to: { sectionId: 123, offset: 5 },
    style: { backgroundColor: "rgba(255, 0, 0, 0.2)" }
  },
  {
    type: "node",
    sectionId: 456,
    style: { backgroundColor: "rgba(0, 0, 255, 0.1)" }
  }
]);
```

---

## api.v1.editor.decorations.createWidget()

Create a new inline widget. Widgets render UI components at a specific position in the document. Requests the “editorDecorations” permission.

**Signature:**

```ts
function createWidget<
                    T extends DecorationCreateWidgetOptions = DecorationCreateWidgetOptions
                >(options: T): Promise<DecorationWidgetHandle<T>>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| options | T | Widget creation options |

**Returns:**

Promise<DecorationWidgetHandle<T>>

Promise resolving to a widget handle

## Example

```ts
const widget = await api.v1.editor.decorations.createWidget({
  type: "inline",
  position: { sectionId: 123, offset: 5 },
  content: [
    api.v1.ui.part.button({
      text: "Button",
      callback: () => api.v1.log("Widget clicked!")
    })
  ],
});

// Later: update content or remove
await widget.update({
  content: [api.v1.ui.part.text({ text: "Updated!" })]
});
await widget.dispose();
```

---

## api.v1.editor.decorations.createWidgets()

Batch create multiple widgets. Requests the “editorDecorations” permission.

**Signature:**

```ts
function createWidgets<
                    T extends DecorationCreateWidgetOptions = DecorationCreateWidgetOptions
                >(options: T[]): Promise<DecorationWidgetHandle<T>[]>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| options | T[] |  |

**Returns:**

Promise<DecorationWidgetHandle<T>[]>

Promise resolving to array of widget handles

## Example

```ts
const widgets = await api.v1.editor.decorations.createWidgets([
  {
    type: "inline",
    position: { sectionId: 123, offset: 5 },
    content: [
      api.v1.ui.part.text({ text: "First widget" })
    ],
  },
  {
    type: "node",
    sectionId: 456,
    content: [
      api.v1.ui.part.text({ text: "Second widget" })
    ],
  }
]);
```

---

## api.v1.editor.decorations.getMarker()

Get a marker by ID.

**Signature:**

```ts
function getMarker(id: string): Promise<DecorationMarkerInfo | null>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| id | string | The marker ID |

**Returns:**

Promise<DecorationMarkerInfo | null>

Promise resolving to marker info or null if not found

---

## api.v1.editor.decorations.getMarkers()

Get all markers created by this script.

**Signature:**

```ts
function getMarkers(): Promise<DecorationMarkerInfo[]>
```

**Returns:**

Promise<DecorationMarkerInfo[]>

Promise resolving to array of marker info

---

## api.v1.editor.decorations.getRules()

Get all currently registered decoration rules.

**Signature:**

```ts
function getRules(): Promise<DecorationRule[]>
```

**Returns:**

Promise<DecorationRule[]>

Promise resolving to array of rules

---

## api.v1.editor.decorations.getWidget()

Get a widget by ID.

**Signature:**

```ts
function getWidget(id: string): Promise<DecorationWidgetInfo | null>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| id | string | The widget ID |

**Returns:**

Promise<DecorationWidgetInfo | null>

Promise resolving to widget info or null if not found

---

## api.v1.editor.decorations.getWidgets()

Get all widgets created by this script.

**Signature:**

```ts
function getWidgets(): Promise<DecorationWidgetInfo[]>
```

**Returns:**

Promise<DecorationWidgetInfo[]>

Promise resolving to array of widget info

---

## api.v1.editor.decorations.registerRules()

Register decoration rules for pattern-based highlighting. Rules automatically apply styles to text matching the patterns. Requests the “editorDecorations” permission.

**Signature:**

```ts
function registerRules(rules: DecorationRule[]): Promise<void>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| rules | DecorationRule[] | Array of decoration rules to register |

**Returns:**

Promise<void>

## Example

```ts
api.v1.editor.decorations.registerRules([
  {
    id: "highlight-names",
    type: "inline",
    match: "\\b(Alice|Bob)\\b",
    flags: "gi",
    style: { backgroundColor: "rgba(255, 255, 0, 0.3)" }
  },
  {
    id: "highlight-dates",
    type: "inline",
    match: /\d{4}-\d{2}-\d{2}/g,
    style: { color: "#0066cc", fontWeight: "bold" }
  }
]);
```

---

## api.v1.editor.decorations.removeRules()

Remove decoration rules by ID.

**Signature:**

```ts
function removeRules(ids: string[]): void
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| ids | string[] | Array of rule IDs to remove |

**Returns:**

void

---

## api.v1.editor.decorations.updateRules()

Update existing decoration rules. Requests the “editorDecorations” permission.

**Signature:**

```ts
function updateRules(updates: (Partial<DecorationRule> & { id: string })[]): Promise<void>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| updates | (Partial<DecorationRule> & { id: string })[] | Array of partial rule objects with IDs |

**Returns:**

Promise<void>

## Example

```ts
api.v1.editor.decorations.updateRules([
  { id: "highlight-names", style: { backgroundColor: "rgba(0, 255, 0, 0.3)" } }
]);
```

---

## api.v1.editor.generate()

Trigger a generation at the end of the document, as if the user clicked the “Send” button.

**Signature:**

```ts
function generate(): Promise<void>
```

**Returns:**

Promise<void>

Promise that resolves when generation starts

## Example

```ts
await api.v1.editor.generate();
```

---

## api.v1.editor.isBlocked()

Check if the editor is currently blocked. Changes to the document and editor generations are not allowed while the editor is blocked.

**Signature:**

```ts
function isBlocked(): Promise<boolean>
```

**Returns:**

Promise<boolean>

Promise resolving to true if editor is blocked

## Example

```ts
const blocked = await api.v1.editor.isBlocked();

if (!blocked) {
  await api.v1.editor.generate();
}
```

---

## api.v1.editor.selection

Editor selection API - Query and manipulate text selection.

**Signature:**

```ts
namespace selection
```

## Functions

| Function | Description |
| --- | --- |
| get() | Get the current selection range in the editor. |

---

## api.v1.editor.selection.get()

Get the current selection range in the editor.

**Signature:**

```ts
function get(): Promise<DocumentSelection>
```

**Returns:**

Promise<DocumentSelection>

Promise resolving to a selection object

## Example

```ts
const selection = await api.v1.editor.selection.get();
api.v1.log(`Selected from section ${selection.from.sectionId}`);
```

---

## api.v1.error()

Log an error message to the console.

**Signature:**

```ts
function error(...messages: any): void
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| messages | any | Messages to log |

**Returns:**

void

## Example

```ts
api.v1.error("Something went wrong:", errorObject);
```

---

## api.v1.file

File API - Read and write files in the user’s file system.

**Signature:**

```ts
namespace file
```

## Functions

| Function | Description |
| --- | --- |
| prompt(options) | Prompt the user to select a file and read its contents. Requires “fileInput” permission. |
| save(filename, content) | Prompt the user to save text to a file. Requires “fileDownload” permission. |

---

## api.v1.file.prompt()

Prompt the user to select a file and read its contents. Requires “fileInput” permission.

**Signature:**

```ts
function prompt<
                M extends boolean = false,
                R extends 'text' | 'arrayBuffer' | 'dataURL' = 'text'
            >(options?: {
                multiple?: M
                accept?: string
                readAs?: R
                encoding?: string
            }): Promise<
                M extends true
                    ? (R extends 'arrayBuffer' ? ArrayBuffer[] : string[]) | void
                    : (R extends 'arrayBuffer' ? ArrayBuffer : string) | void
            >
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| options | { multiple?: M accept?: string readAs?: R encoding?: string } | *(Optional)* Optional configuration |

**Returns:**

Promise< M extends true ? (R extends ‘arrayBuffer’ ? ArrayBuffer[] : string[]) | void : (R extends ‘arrayBuffer’ ? ArrayBuffer : string) | void >

Promise resolving to the file contents based on options

## Example

```ts
// Single text file
const content = await api.v1.file.prompt();

// Multiple text files
const files = await api.v1.file.prompt({ multiple: true });

// Single file as ArrayBuffer
const data = await api.v1.file.prompt({ readAs: "arrayBuffer" });

// Multiple files as data URLs
const urls = await api.v1.file.prompt({ multiple: true, readAs: "dataURL" });
```

---

## api.v1.file.save()

Prompt the user to save text to a file. Requires “fileDownload” permission.

**Signature:**

```ts
function save(filename: string, content: string): Promise<void>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| filename | string | Suggested filename |
| content | string | Text content to save |

**Returns:**

Promise<void>

Promise that resolves when the file has been saved

## Example

```ts
await api.v1.file.save("example.txt", "Hello, world!");
```

---

## api.v1.generate()

Generate text. Currently only supports chat-style generation with message arrays using GLM 4.6

**Signature:**

```ts
function generate(
            messages: Message[],
            params: GenerationParams,
            callback?: (choices: GenerationChoice[], final: boolean) => void,
            behaviour?: 'background' | 'blocking',
            signal?: CancellationSignal
        ): Promise<GenerationResponse>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| messages | Message[] | Array of message objects for context |
| params | GenerationParams | Generation parameters (model, temperature, etc.) |
| callback | (choices: GenerationChoice[], final: boolean) => void | *(Optional)* Optional streaming callback for partial results |
| behaviour | ‘background’ \| ‘blocking’ | *(Optional)* Whether to run in background or block the UI. |
| signal | CancellationSignal | *(Optional)* Optional cancellation signal to cancel the generation. May not cancel immediately, but will stop as soon as possible |

**Returns:**

Promise<GenerationResponse>

Promise resolving to the complete generation response

## Example

```ts
const response = await api.v1.generate(
  [{ role: "user", content: "What is the difference between izti and aaaa?" }],
  { model: "glm-4-6", max_tokens: 100, temperature: 0.8 }
);
api.v1.log(response.choices[0].text);
```

---

## api.v1.generateWithStory()

Generate text including the story as context. A shortcut for calling buildContext and using those messages for generation. The context limit used for the buildContext will be automatically adjusted based on the provided messages.

**Signature:**

```ts
function generateWithStory(
            messages: Message[],
            params: GenerationParams,
            options?: {
                contextLimitReduction?: number
                position?: { sectionId: number; offset: number }
                suppressScriptHooks?: 'self' | 'all'
            },
            callback?: (choices: GenerationChoice[], final: boolean) => void,
            behaviour?: 'background' | 'blocking',
            signal?: CancellationSignal
        ): Promise<GenerationResponse>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| messages | Message[] | An array of message objects to append after the built context |
| params | GenerationParams | Generation parameters (model, temperature, etc.) |
| options | { contextLimitReduction?: number position?: { sectionId: number; offset: number } suppressScriptHooks?: ‘self’ \| ‘all’ } | *(Optional)* Additional options for context building |
| callback | (choices: GenerationChoice[], final: boolean) => void | *(Optional)* Optional streaming callback for partial results |
| behaviour | ‘background’ \| ‘blocking’ | *(Optional)* Whether to run in background or block the UI. |
| signal | CancellationSignal | *(Optional)* Optional cancellation signal to cancel the generation. May not cancel immediately, but will stop as soon as possible |

**Returns:**

Promise<GenerationResponse>

Promise resolving to the complete generation response

## Example

```ts
const response = await api.v1.generateWithStory(
  [{ role: "user", content: "Summarize what happened so far." }],
  { model: "glm-4-6", max_tokens: 150 }
);
api.v1.log(response.choices[0].text);
```

---

## api.v1.generationParameters

Generation Parameters API - Get and set default generation parameters. Currently only supports parameters for chat-style generation with GLM 4.6.

**Signature:**

```ts
namespace generationParameters
```

## Functions

| Function | Description |
| --- | --- |
| get() | Get the current generation parameters. |
| update(params) | Update the current generation parameters. Only parameters provided in the object will be updated. Others will remain unchanged. Requires the “storyEdit” permission. |

---

## api.v1.generationParameters.get()

Get the current generation parameters.

**Signature:**

```ts
function get(): Promise<{
                model: string
                max_tokens?: number
                temperature?: number
                top_p?: number
                top_k?: number
                frequency_penalty?: number
                presence_penalty?: number
                min_p?: number
            }>
```

**Returns:**

Promise<{ model: string max_tokens?: number temperature?: number top_p?: number top_k?: number frequency_penalty?: number presence_penalty?: number min_p?: number }>

Promise resolving to the current parameters

---

## api.v1.generationParameters.update()

Update the current generation parameters. Only parameters provided in the object will be updated. Others will remain unchanged. Requires the “storyEdit” permission.

**Signature:**

```ts
function update(params: {
                model?: string
                max_tokens?: number
                temperature?: number
                top_p?: number
                top_k?: number
                frequency_penalty?: number
                presence_penalty?: number
                min_p?: number
            }): Promise<void>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| params | { model?: string max_tokens?: number temperature?: number top_p?: number top_k?: number frequency_penalty?: number presence_penalty?: number min_p?: number } | Parameters to update |

**Returns:**

Promise<void>

Promise that resolves when parameters are updated

## Example

```ts
await api.v1.generationParameters.update({
  model: "glm-4-6",
  temperature: 0.7,
  max_tokens: 200
});
```

---

## api.v1.historyStorage

History Storage API - Store data associated with specific history nodes. When data is retrieved, the value from the closest ancestor node with that key is returned. Useful for tracking state across undo/redo operations. History storage always stores data within the current story, even if the script is an account-level script. Stored data will remain if the account-level script is deleted.

**Signature:**

```ts
namespace historyStorage
```

## Functions

| Function | Description |
| --- | --- |
| get(key, nodeId) | Get a value from history storage. If the key is not found in the specified node, ancestor nodes are searched until a value is found or the root is reached. |
| getOrDefault(key, defaultValue, nodeId) | Gets the value from history storage, or the default value if the key does not exist. |
| has(key, nodeId) | Check if a key exists in history storage. A value of undefined is considered to not exist. |
| list(nodeId) | List all keys in history storage. |
| remove(key, nodeId) | Remove a value from history storage. |
| set(key, value, nodeId) | Set a value in history storage. |
| setIfAbsent(key, value, nodeId) | Set a value in history storage only if the key does not already exist. |

---

## api.v1.historyStorage.get()

Get a value from history storage. If the key is not found in the specified node, ancestor nodes are searched until a value is found or the root is reached.

**Signature:**

```ts
function get(key: string, nodeId?: number): Promise<any>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| key | string | Storage key |
| nodeId | number | *(Optional)* Optional history node ID (defaults to current) |

**Returns:**

Promise<any>

Promise resolving to the stored value

## Example

```ts
const data = await api.v1.historyStorage.get("myData");
```

---

## api.v1.historyStorage.getOrDefault()

Gets the value from history storage, or the default value if the key does not exist.

**Signature:**

```ts
function getOrDefault(key: string, defaultValue: any, nodeId?: number): Promise<any>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| key | string | Storage key |
| defaultValue | any | Value to return if the key does not exist |
| nodeId | number | *(Optional)* Optional history node ID (defaults to current) |

**Returns:**

Promise<any>

Promise resolving to the stored value or the default value

## Example

```ts
const data = await api.v1.historyStorage.getOrDefault("myData", { count: 0 });
```

---

## api.v1.historyStorage.has()

Check if a key exists in history storage. A value of undefined is considered to not exist.

**Signature:**

```ts
function has(key: string, nodeId?: number): Promise<boolean>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| key | string | Storage key |
| nodeId | number | *(Optional)* Optional history node ID (defaults to current) |

**Returns:**

Promise<boolean>

Promise resolving to true if the key exists, false otherwise

## Example

```ts
const exists = await api.v1.historyStorage.has("lastRun");
```

---

## api.v1.historyStorage.list()

List all keys in history storage.

**Signature:**

```ts
function list(nodeId?: number): Promise<string[]>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| nodeId | number | *(Optional)* Optional history node ID (defaults to current) |

**Returns:**

Promise<string[]>

Promise resolving to array of storage keys

## Example

```ts
const keys = await api.v1.historyStorage.list();
api.v1.log("Stored keys:", keys);
```

---

## api.v1.historyStorage.remove()

Remove a value from history storage.

**Signature:**

```ts
function remove(key: string, nodeId?: number): Promise<void>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| key | string | Storage key |
| nodeId | number | *(Optional)* Optional history node ID (defaults to current) |

**Returns:**

Promise<void>

Promise that resolves when removed

---

## api.v1.historyStorage.set()

Set a value in history storage.

**Signature:**

```ts
function set(key: string, value: any, nodeId?: number): Promise<void>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| key | string | Storage key |
| value | any | Value to store (will be JSON serialized) |
| nodeId | number | *(Optional)* Optional history node ID (defaults to current) |

**Returns:**

Promise<void>

Promise that resolves when stored

## Example

```ts
await api.v1.historyStorage.set("myData", { count: 5 });
```

---

## api.v1.historyStorage.setIfAbsent()

Set a value in history storage only if the key does not already exist.

**Signature:**

```ts
function setIfAbsent(key: string, value: any, nodeId?: number): Promise<boolean>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| key | string | Storage key |
| value | any | Value to store (will be JSON serialized) |
| nodeId | number | *(Optional)* Optional history node ID (defaults to current) |

**Returns:**

Promise<boolean>

Promise that resolves to true if the value was set, false if the key already existed

## Example

```ts
const wasSet = await api.v1.historyStorage.setIfAbsent("myData", { count: 1 });
```

---

## api.v1.hooks

Hooks API - Register and manage hooks for generation and other events.

**Signature:**

```ts
namespace hooks
```

## Functions

| Function | Description |
| --- | --- |
| isRegistered(hookName) | Check if a hook is currently registered. |
| register(hookName, callback) | Register a hook function to be called during generation events. |
| unregister(hookName) | Unregister a previously registered hook. |

---

## api.v1.hooks.isRegistered()

Check if a hook is currently registered.

**Signature:**

```ts
function isRegistered<K extends keyof HookCallbacks>(hookName: K): boolean
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| hookName | K |  |

**Returns:**

boolean

---

## api.v1.hooks.register()

Register a hook function to be called during generation events.

**Signature:**

```ts
function register<K extends keyof HookCallbacks>(hookName: K, callback: HookCallbacks[K]): void
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| hookName | K |  |
| callback | HookCallbacks[K] |  |

**Returns:**

void

---

## api.v1.hooks.unregister()

Unregister a previously registered hook.

**Signature:**

```ts
function unregister<K extends keyof HookCallbacks>(hookName: K): boolean
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| hookName | K |  |

**Returns:**

boolean

---

## api.v1.log()

Log a message to the console.

**Signature:**

```ts
function log(...messages: any): void
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| messages | any | Messages to log |

**Returns:**

void

## Example

```ts
api.v1.log("Script started", { timestamp: Date.now() });
```

---

## api.v1.logprobs

Logprobs API - Set the current logprobs used for the display in the editor.

**Signature:**

```ts
namespace logprobs
```

## Functions

| Function | Description |
| --- | --- |
| get() | Get the current logprobs information. |
| set(logprobs, model, offsetFromEnd) | Set log probability information for generated tokens. |

---

## api.v1.logprobs.get()

Get the current logprobs information.

**Signature:**

```ts
function get(): Promise<{ logprobs: Logprobs[]; model: string } | null>
```

**Returns:**

Promise<{ logprobs: Logprobs[]; model: string } | null>

Promise resolving to the current logprobs and model, or null if no logprobs are set

---

## api.v1.logprobs.set()

Set log probability information for generated tokens.

**Signature:**

```ts
function set(logprobs: Logprobs[], model: string, offsetFromEnd?: number): Promise<void>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| logprobs | Logprobs[] | Array of converted logprobs objects |
| model | string | Model identifier that generated these. Determines which tokenizer will be used when handling them |
| offsetFromEnd | number | *(Optional)* Optional offset from end of text where these logprobs should start. Defaults to the 0, the end of the text |

**Returns:**

Promise<void>

Promise that resolves when logprobs are set

---

## api.v1.lorebook

Lorebook API - Manage lorebook entries and categories.

**Signature:**

```ts
namespace lorebook
```

## Functions

| Function | Description |
| --- | --- |
| categories() | Get all lorebook categories. |
| category(categoryId) | Get a specific category by ID. |
| createCategory(category) | Create a new lorebook category. |
| createEntry(entry) | Create a new lorebook entry. |
| entries(category) | Get all lorebook entries, optionally filtered by category. |
| entry(entryId) | Get a specific lorebook entry by ID. |
| removeCategory(id) | Remove a lorebook category. |
| removeEntry(id) | Remove a lorebook entry. |
| updateCategory(id, category) | Update an existing lorebook category. |
| updateEntry(id, entry) | Update an existing lorebook entry. |

---

## api.v1.lorebook.categories()

Get all lorebook categories.

**Signature:**

```ts
function categories(): Promise<LorebookCategory[]>
```

**Returns:**

Promise<LorebookCategory[]>

Promise resolving to array of categories

---

## api.v1.lorebook.category()

Get a specific category by ID.

**Signature:**

```ts
function category(categoryId: string): Promise<LorebookCategory | null>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| categoryId | string | The category ID |

**Returns:**

Promise<LorebookCategory | null>

Promise resolving to the category or null if not found

---

## api.v1.lorebook.createCategory()

Create a new lorebook category.

**Signature:**

```ts
function createCategory(category: Partial<LorebookCategory>): Promise<string>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| category | Partial<LorebookCategory> | Category object to create |

**Returns:**

Promise<string>

Promise resolving to the new category ID

## Example

```ts
const id = await api.v1.lorebook.createCategory({
  id: api.v1.uuid(),
  name: "Characters",
  enabled: true
});
```

---

## api.v1.lorebook.createEntry()

Create a new lorebook entry.

**Signature:**

```ts
function createEntry(entry: Partial<LorebookEntry>): Promise<string>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| entry | Partial<LorebookEntry> | Entry object to create |

**Returns:**

Promise<string>

Promise resolving to the new entry ID

## Example

```ts
const id = await api.v1.lorebook.createEntry({
  id: api.v1.uuid(),
  displayName: "Main Character",
  text: "A brave adventurer...",
  keys: ["hero", "protagonist"]
});
```

---

## api.v1.lorebook.entries()

Get all lorebook entries, optionally filtered by category.

**Signature:**

```ts
function entries(category?: null | string): Promise<LorebookEntry[]>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| category | null \| string | *(Optional)* Optional category ID to filter by |

**Returns:**

Promise<LorebookEntry[]>

Promise resolving to array of entries

## Example

```ts
const allEntries = await api.v1.lorebook.entries();
const characterEntries = await api.v1.lorebook.entries(charactersCategoryId);
```

---

## api.v1.lorebook.entry()

Get a specific lorebook entry by ID.

**Signature:**

```ts
function entry(entryId: string): Promise<LorebookEntry | null>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| entryId | string | The entry ID |

**Returns:**

Promise<LorebookEntry | null>

Promise resolving to the entry or null if not found

---

## api.v1.lorebook.removeCategory()

Remove a lorebook category.

**Signature:**

```ts
function removeCategory(id: string): Promise<void>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| id | string | Category ID to remove |

**Returns:**

Promise<void>

Promise that resolves when removed

---

## api.v1.lorebook.removeEntry()

Remove a lorebook entry.

**Signature:**

```ts
function removeEntry(id: string): Promise<void>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| id | string | Entry ID to remove |

**Returns:**

Promise<void>

Promise that resolves when removed

---

## api.v1.lorebook.updateCategory()

Update an existing lorebook category.

**Signature:**

```ts
function updateCategory(id: string, category: Partial<LorebookCategory>): Promise<void>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| id | string | Category ID to update |
| category | Partial<LorebookCategory> | Partial category object with fields to update |

**Returns:**

Promise<void>

Promise that resolves when updated

## Example

```ts
await api.v1.lorebook.updateCategory(categoryId, {
  name: "Updated Name",
  enabled: false
});
```

---

## api.v1.lorebook.updateEntry()

Update an existing lorebook entry.

**Signature:**

```ts
function updateEntry(id: string, entry: Partial<LorebookEntry>): Promise<void>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| id | string | Entry ID to update |
| entry | Partial<LorebookEntry> | Partial entry object with fields to update |

**Returns:**

Promise<void>

Promise that resolves when updated

## Example

```ts
await api.v1.lorebook.updateEntry(entryId, {
  text: "Updated lore text...",
  enabled: true
});
```

---

## api.v1.maxTokens()

Returns the max tokens allowed for the specified model.

**Signature:**

```ts
function maxTokens(model: string): Promise<number>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| model | string | Model name |

**Returns:**

Promise<number>

Promise resolving to the max token count

## Example

```ts
const maxTokens = await api.v1.maxTokens("glm-4-6");
api.v1.log("GLM 4.6 max tokens:", maxTokens);
```

---

## api.v1.memory

Memory API - Read and update the story memory.

**Signature:**

```ts
namespace memory
```

## Functions

| Function | Description |
| --- | --- |
| get() | Get the current memory text. |
| set(text) | Set the memory text. Requires the “storyEdit” permission. |

---

## api.v1.memory.get()

Get the current memory text.

**Signature:**

```ts
function get(): Promise<string>
```

**Returns:**

Promise<string>

Promise resolving to the memory content

## Example

```ts
const mem = await api.v1.memory.get();
api.v1.log("Current memory:", mem);
```

---

## api.v1.memory.set()

Set the memory text. Requires the “storyEdit” permission.

**Signature:**

```ts
function set(text: string): Promise<void>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| text | string | The new memory content |

**Returns:**

Promise<void>

Promise that resolves when memory is updated

## Example

```ts
await api.v1.memory.set("This is a fantasy world with magic...");
```

---

## api.v1.messaging

Messaging API - Send and receive messages between scripts. Scripts can communicate with each other through targeted messages or broadcasts.

**Signature:**

```ts
namespace messaging
```

## Functions

| Function | Description |
| --- | --- |
| broadcast(data, channel) | Broadcast a message to all scripts (except the sender). |
| onMessage(callback, filter) | Register a handler to receive messages. The handler will be called whenever a matching message is received. |
| send(toScriptId, data, channel) | Send a message to a specific script. |
| unsubscribe(subscriptionIndex) | Unsubscribe from receiving messages. |

---

## api.v1.messaging.broadcast()

Broadcast a message to all scripts (except the sender).

**Signature:**

```ts
function broadcast(data: any, channel?: string): Promise<void>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| data | any | The data to send (will be serialized) |
| channel | string | *(Optional)* Optional channel name for organization and filtering |

**Returns:**

Promise<void>

Promise that resolves when the message is broadcast

## Example

```ts
// Broadcast an event to all listening scripts
await api.v1.messaging.broadcast({
  event: 'user-action',
  action: 'item-used',
  itemId: 'health-potion'
}, 'game-events');
```

---

## api.v1.messaging.onMessage()

Register a handler to receive messages. The handler will be called whenever a matching message is received.

**Signature:**

```ts
function onMessage(
                callback: (message: ScriptMessage) => void | Promise<void>,
                filter?: ScriptMessageFilter
            ): Promise<number>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| callback | (message: ScriptMessage) => void \| Promise<void> | Function called when a message is received |
| filter | ScriptMessageFilter | *(Optional)* Optional filter to limit which messages are received |

**Returns:**

Promise<number>

Promise resolving to a subscription index for later cleanup with unsubscribe()

## Example

```ts
// Listen to all messages on a specific channel
const sub = await api.v1.messaging.onMessage((message) => {
  api.v1.log('Received:', message.data);
  api.v1.log('From:', message.fromScriptId);
}, { channel: 'events' });

// Listen to messages from a specific script
const sub2 = await api.v1.messaging.onMessage((message) => {
  api.v1.log('Message from coordinator:', message.data);
}, { fromScriptId: 'coordinator-script-id' });

// Listen to all messages
const sub3 = await api.v1.messaging.onMessage((message) => {
  api.v1.log('Any message:', message.data);
});
```

---

## api.v1.messaging.send()

Send a message to a specific script.

**Signature:**

```ts
function send(toScriptId: string, data: any, channel?: string): Promise<void>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| toScriptId | string | The ID of the target script |
| data | any | The data to send (will be serialized) |
| channel | string | *(Optional)* Optional channel name for organization and filtering |

**Returns:**

Promise<void>

Promise that resolves when the message is sent

## Example

```ts
// Send a message to another script
await api.v1.messaging.send('other-script-id', {
  type: 'update',
  value: 42
}, 'state-sync');
```

---

## api.v1.messaging.unsubscribe()

Unsubscribe from receiving messages.

**Signature:**

```ts
function unsubscribe(subscriptionIndex: number): Promise<void>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| subscriptionIndex | number | The index returned from onMessage() |

**Returns:**

Promise<void>

Promise that resolves when unsubscribed

## Example

```ts
const sub = await api.v1.messaging.onMessage(handler);
// Later...
await api.v1.messaging.unsubscribe(sub);
```

---

## api.v1.permissions

Permission API - Ask for and check script permissions.

**Signature:**

```ts
namespace permissions
```

## Functions

| Function | Description |
| --- | --- |
| has(permission) | Check if the script has a specific permission. |
| list() | List all permissions the script currently has. |
| request(permission, message) | Request a specific permission for the script. |

---

## api.v1.permissions.has()

Check if the script has a specific permission.

**Signature:**

```ts
function has(permission: ScriptPermission | ScriptPermission[]): Promise<boolean>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| permission | ScriptPermission \| ScriptPermission[] | Permission name or array of permission names |

**Returns:**

Promise<boolean>

Promise resolving to true if the script has the permission(s), false otherwise

## Example

```ts
const hasClipboardWrite = await api.v1.permissions.has("clipboardWrite");
```

---

## api.v1.permissions.list()

List all permissions the script currently has.

**Signature:**

```ts
function list(): Promise<ScriptPermission[]>
```

**Returns:**

Promise<ScriptPermission[]>

Promise resolving to array of permission names

## Example

```ts
const permissions = await api.v1.permissions.list();
api.v1.log("Current permissions:", permissions);
```

---

## api.v1.permissions.request()

Request a specific permission for the script.

**Signature:**

```ts
function request(
                permission: ScriptPermission | ScriptPermission[],
                message?: string
            ): Promise<boolean>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| permission | ScriptPermission \| ScriptPermission[] | Permission name or array of permission names |
| message | string | *(Optional)* Optional message to show to the user explaining why the permission is needed |

**Returns:**

Promise<boolean>

Promise resolving to true if the permission(s) were granted, false otherwise

## Example

```ts
const granted = await api.v1.permissions.request("clipboardWrite");
```

---

## api.v1.prefill

Prefill API - Read and update the prefill text.

**Signature:**

```ts
namespace prefill
```

## Functions

| Function | Description |
| --- | --- |
| get() | Get the current prefill text. |
| getDefault() | Get the default prefill text for the current story mode. |
| set(text) | Set the prefill text. If set to undefined or an empty string, the default prefill will be used. Requires the “storyEdit” permission. |

---

## api.v1.prefill.get()

Get the current prefill text.

**Signature:**

```ts
function get(): Promise<string>
```

**Returns:**

Promise<string>

Promise resolving to the prefill content

## Example

```ts
const text = await api.v1.prefill.get();
api.v1.log("Current prefill:", text);
```

---

## api.v1.prefill.getDefault()

Get the default prefill text for the current story mode.

**Signature:**

```ts
function getDefault(): Promise<string>
```

**Returns:**

Promise<string>

Promise resolving to the default prefill content

## Example

```ts
const defaultPrefill = await api.v1.prefill.getDefault();
api.v1.log("Default prefill:", defaultPrefill);
```

---

## api.v1.prefill.set()

Set the prefill text. If set to undefined or an empty string, the default prefill will be used. Requires the “storyEdit” permission.

**Signature:**

```ts
function set(text: string): Promise<void>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| text | string | The new prefill content |

**Returns:**

Promise<void>

Promise that resolves when prefill is updated

## Example

```ts
await api.v1.prefill.set("Suddenly, you feel a sharp pain...");
```

---

## api.v1.random

Random utilities API - Generate random values and roll dice.

**Signature:**

```ts
namespace random
```

## Functions

| Function | Description |
| --- | --- |
| bool(chance) | Generate a random boolean with optional probability. |
| float(min, max) | Generate a random floating-point number in a range. |
| int(min, max) | Generate a random integer in a range. |
| roll(expression) | Roll dice using standard notation (e.g., “2d6”, “1d20+5”). |

---

## api.v1.random.bool()

Generate a random boolean with optional probability.

**Signature:**

```ts
function bool(chance?: number): boolean
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| chance | number | *(Optional)* Probability of true (0.0 to 1.0), defaults to 0.5 |

**Returns:**

boolean

Random boolean value

## Example

```ts
if (api.v1.random.bool(0.3)) {
  api.v1.log("30% chance happened!");
}
```

---

## api.v1.random.float()

Generate a random floating-point number in a range.

**Signature:**

```ts
function float(min: number, max: number): number
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| min | number | Minimum value (inclusive) |
| max | number | Maximum value (exclusive) |

**Returns:**

number

Random float between min and max

## Example

```ts
const temp = api.v1.random.float(0.5, 1.5);
```

---

## api.v1.random.int()

Generate a random integer in a range.

**Signature:**

```ts
function int(min: number, max: number): number
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| min | number | Minimum value (inclusive) |
| max | number | Maximum value (inclusive) |

**Returns:**

number

Random integer between min and max

## Example

```ts
const damage = api.v1.random.int(1, 20);
```

---

## api.v1.random.roll()

Roll dice using standard notation (e.g., “2d6”, “1d20+5”).

**Signature:**

```ts
function roll(expression: string): {
                total: number
                rolls: {
                    notation: string
                    dice: number[]
                    kept: number[]
                }[]
                breakdown: string
            }
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| expression | string | Dice notation string |

**Returns:**

{ total: number rolls: { notation: string dice: number[] kept: number[] }[] breakdown: string }

Object with total, individual rolls, and human readable breakdown

## Example

```ts
const roll = api.v1.random.roll("2d6+3");
api.v1.log(`Rolled ${roll.total} (details: ${roll.breakdown})`);
```

---

## api.v1.rolloverTokens()

Returns the number of rollover tokens allowed for the specified model.

**Signature:**

```ts
function rolloverTokens(model: string): Promise<number>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| model | string | Model name |

**Returns:**

Promise<number>

Promise resolving to the rollover token count

## Example

```ts
const rolloverTokens = await api.v1.rolloverTokens("glm-4-6");
api.v1.log("GLM 4.6 rollover tokens:", rolloverTokens);
```

---

## api.v1.script

Script Info API - Static, read-only information about the running script.

**Signature:**

```ts
namespace script
```

## Functions

| Function | Description |
| --- | --- |
| countUncachedInputTokens(messages) | Counts the number of uncached input tokens a given message array would consume were it used for generation. |
| getAllowedInput() | Gets the current number of uncached input tokens the script is allowed to use. After consumption, the input tokens replenish over time as long as the user has interacted with the script recently. |
| getAllowedOutput() | Returns the current number of output tokens the script is allowed to request. After consumption, the output tokens replenish over time as long as the user has interacted with the script recently. |
| getTimeUntilAllowedInput(minTokens) | Returns the amount of time in milliseconds until the allowed input tokens are replenished up to the specified amount. This does not take into account whether the user interaction flag is set on those tokens. |
| getTimeUntilAllowedOutput(minTokens) | Returns the amount of time in milliseconds until the allowed output tokens are replenished up to the specified amount. This does not take into account whether the user interaction flag is set on those tokens. |
| waitForAllowedInput(minTokens) | Returns a promise that resolves when the allowed input tokens are at least the specified amount. |
| waitForAllowedOutput(minTokens) | Returns a promise that resolves when the allowed output tokens are at least the specified amount. |

## Variables

| Variable | Description |
| --- | --- |
| author | The author of the running script. |
| description | The description of the running script. |
| id | The unique identifier of the running script. |
| memoryLimit | The memory limit for the script in bytes. |
| name | The name of the running script. |
| version | The version of the running script. |

---

## api.v1.script.author

The author of the running script.

**Signature:**

```ts
author: string
```

---

## api.v1.script.countUncachedInputTokens()

Counts the number of uncached input tokens a given message array would consume were it used for generation.

**Signature:**

```ts
function countUncachedInputTokens(messages: Message[]): number
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| messages | Message[] | Array of message objects to count tokens for |

**Returns:**

number

Number of input tokens that would be consumed

---

## api.v1.script.description

The description of the running script.

**Signature:**

```ts
description: string
```

---

## api.v1.script.getAllowedInput()

Gets the current number of uncached input tokens the script is allowed to use. After consumption, the input tokens replenish over time as long as the user has interacted with the script recently.

**Signature:**

```ts
function getAllowedInput(): number
```

**Returns:**

number

number of available input tokens

---

## api.v1.script.getAllowedOutput()

Returns the current number of output tokens the script is allowed to request. After consumption, the output tokens replenish over time as long as the user has interacted with the script recently.

**Signature:**

```ts
function getAllowedOutput(): number
```

**Returns:**

number

number of available output tokens

---

## api.v1.script.getTimeUntilAllowedInput()

Returns the amount of time in milliseconds until the allowed input tokens are replenished up to the specified amount. This does not take into account whether the user interaction flag is set on those tokens.

**Signature:**

```ts
function getTimeUntilAllowedInput(minTokens: number): number
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| minTokens | number | Minimum number of input tokens required |

**Returns:**

number

Time in milliseconds until allowed input tokens reach minTokens

---

## api.v1.script.getTimeUntilAllowedOutput()

Returns the amount of time in milliseconds until the allowed output tokens are replenished up to the specified amount. This does not take into account whether the user interaction flag is set on those tokens.

**Signature:**

```ts
function getTimeUntilAllowedOutput(minTokens: number): number
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| minTokens | number | Minimum number of output tokens required |

**Returns:**

number

Time in milliseconds until allowed output tokens reach minTokens

---

## api.v1.script.id

The unique identifier of the running script.

**Signature:**

```ts
id: string
```

---

## api.v1.script.memoryLimit

The memory limit for the script in bytes.

**Signature:**

```ts
memoryLimit: number
```

---

## api.v1.script.name

The name of the running script.

**Signature:**

```ts
name: string
```

---

## api.v1.script.version

The version of the running script.

**Signature:**

```ts
version: string
```

---

## api.v1.script.waitForAllowedInput()

Returns a promise that resolves when the allowed input tokens are at least the specified amount.

**Signature:**

```ts
function waitForAllowedInput(minTokens: number): Promise<void>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| minTokens | number | Minimum number of input tokens required |

**Returns:**

Promise<void>

Promise that resolves when allowed input tokens are at least minTokens

---

## api.v1.script.waitForAllowedOutput()

Returns a promise that resolves when the allowed output tokens are at least the specified amount.

**Signature:**

```ts
function waitForAllowedOutput(minTokens: number): Promise<void>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| minTokens | number | Minimum number of output tokens required |

**Returns:**

Promise<void>

Promise that resolves when allowed output tokens are at least minTokens

---

## api.v1.storage

Storage API - Persistent key-value storage for the script. Data persists across script runs and story sessions. Attempting to store non-serializable values will result in those values being lost. The data is stored wherever the script is stored, so account-level scripts will have their data stored separately from the story.

**Signature:**

```ts
namespace storage
```

## Functions

| Function | Description |
| --- | --- |
| get(key) | Get a value from storage. |
| getOrDefault(key, defaultValue) | Gets the value from storage, or the default value if the key does not exist. |
| has(key) | Check if a key exists in storage. A value of undefined is considered to not exist. |
| list() | List all keys in storage. |
| remove(key) | Remove a value from storage. |
| set(key, value) | Set a value in storage. |
| setIfAbsent(key, value) | Set a value in storage only if the key does not already exist. |

---

## api.v1.storage.get()

Get a value from storage.

**Signature:**

```ts
function get(key: string): Promise<any>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| key | string | Storage key |

**Returns:**

Promise<any>

Promise resolving to the stored value or undefined

## Example

```ts
const count = await api.v1.storage.get("runCount") || 0;
```

---

## api.v1.storage.getOrDefault()

Gets the value from storage, or the default value if the key does not exist.

**Signature:**

```ts
function getOrDefault(key: string, defaultValue: any): Promise<any>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| key | string | Storage key |
| defaultValue | any | Value to return if the key does not exist |

**Returns:**

Promise<any>

Promise resolving to the stored value or the default value

## Example

```ts
const count = await api.v1.storage.getOrDefault("runCount", 0);
```

---

## api.v1.storage.has()

Check if a key exists in storage. A value of undefined is considered to not exist.

**Signature:**

```ts
function has(key: string): Promise<boolean>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| key | string | Storage key |

**Returns:**

Promise<boolean>

Promise resolving to true if the key exists, false otherwise

## Example

```ts
const exists = await api.v1.storage.has("lastRun");
```

---

## api.v1.storage.list()

List all keys in storage.

**Signature:**

```ts
function list(): Promise<string[]>
```

**Returns:**

Promise<string[]>

Promise resolving to array of storage keys

## Example

```ts
const keys = await api.v1.storage.list();
api.v1.log("Stored keys:", keys);
```

---

## api.v1.storage.remove()

Remove a value from storage.

**Signature:**

```ts
function remove(key: string): Promise<void>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| key | string | Storage key |

**Returns:**

Promise<void>

Promise that resolves when removed

---

## api.v1.storage.set()

Set a value in storage.

**Signature:**

```ts
function set(key: string, value: any): Promise<void>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| key | string | Storage key |
| value | any | Value to store (will be JSON serialized) |

**Returns:**

Promise<void>

Promise that resolves when stored

## Example

```ts
await api.v1.storage.set("lastRun", new Date().toISOString());
```

---

## api.v1.storage.setIfAbsent()

Set a value in storage only if the key does not already exist.

**Signature:**

```ts
function setIfAbsent(key: string, value: any): Promise<boolean>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| key | string | Storage key |
| value | any | Value to store (will be JSON serialized) |

**Returns:**

Promise<boolean>

Promise that resolves to true if the value was set, false if the key already existed

## Example

```ts
const wasSet = await api.v1.storage.setIfAbsent("firstRun", new Date().toISOString());
```

---

## api.v1.story

**Signature:**

```ts
namespace story
```

## Functions

| Function | Description |
| --- | --- |
| id() | Get the current story id. |

## Namespaces

| Namespace | Description |
| --- | --- |
| description |  |
| title |  |

---

## api.v1.story.description

**Signature:**

```ts
namespace description
```

## Functions

| Function | Description |
| --- | --- |
| get() | Get the current story description. |
| set(description) | Set the current story description. |

---

## api.v1.story.description.get()

Get the current story description.

**Signature:**

```ts
function get(): Promise<string>
```

**Returns:**

Promise<string>

Promise resolving to the story description

## Example

```ts
const description = await api.v1.story.description.get();
```

---

## api.v1.story.description.set()

Set the current story description.

**Signature:**

```ts
function set(description: string): Promise<void>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| description | string | New story description |

**Returns:**

Promise<void>

Promise that resolves when the description is set

## Example

```ts
await api.v1.story.description.set("This is my story description.");
```

---

## api.v1.story.id()

Get the current story id.

**Signature:**

```ts
function id(): Promise<string>
```

**Returns:**

Promise<string>

Promise resolving to the story id

## Example

```ts
const id = await api.v1.story.id();
```

---

## api.v1.story.title

**Signature:**

```ts
namespace title
```

## Functions

| Function | Description |
| --- | --- |
| get() | Get the current story title. |
| set(title) | Set the current story title. |

---

## api.v1.story.title.get()

Get the current story title.

**Signature:**

```ts
function get(): Promise<string>
```

**Returns:**

Promise<string>

Promise resolving to the story title

## Example

```ts
const title = await api.v1.story.title.get();
```

---

## api.v1.story.title.set()

Set the current story title.

**Signature:**

```ts
function set(title: string): Promise<void>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| title | string | New story title |

**Returns:**

Promise<void>

Promise that resolves when the title is set

## Example

```ts
await api.v1.story.title.set("New Story Title");
```

---

## api.v1.storyStorage

Story Storage API - Persistent key-value storage for the script. Data persists across script runs and story sessions. Attempting to store non-serializable values will result in those values being lost. Unlike the main storage API, story storage always stores data within the current story, even if the script is an account-level script. Stored data will remain if the account-level script is deleted.

**Signature:**

```ts
namespace storyStorage
```

## Functions

| Function | Description |
| --- | --- |
| get(key) | Get a value from story storage. |
| getOrDefault(key, defaultValue) | Gets the value from story storage, or the default value if the key does not exist. |
| has(key) | Check if a key exists in story storage. A value of undefined is considered to not exist. |
| list() | List all keys in story storage. |
| remove(key) | Remove a value from story storage. |
| set(key, value) | Set a value in story storage. |
| setIfAbsent(key, value) | Set a value in story storage only if the key does not already exist. |

---

## api.v1.storyStorage.get()

Get a value from story storage.

**Signature:**

```ts
function get(key: string): Promise<any>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| key | string | Storage key |

**Returns:**

Promise<any>

Promise resolving to the stored value or undefined

## Example

```ts
const count = await api.v1.storyStorage.get("runCount") || 0;
```

---

## api.v1.storyStorage.getOrDefault()

Gets the value from story storage, or the default value if the key does not exist.

**Signature:**

```ts
function getOrDefault(key: string, defaultValue: any): Promise<any>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| key | string | Storage key |
| defaultValue | any | Value to return if the key does not exist |

**Returns:**

Promise<any>

Promise resolving to the stored value or the default value

## Example

```ts
const count = await api.v1.storyStorage.getOrDefault("runCount", 0);
```

---

## api.v1.storyStorage.has()

Check if a key exists in story storage. A value of undefined is considered to not exist.

**Signature:**

```ts
function has(key: string): Promise<boolean>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| key | string | Storage key |

**Returns:**

Promise<boolean>

Promise resolving to true if the key exists, false otherwise

## Example

```ts
const exists = await api.v1.storyStorage.has("lastRun");
```

---

## api.v1.storyStorage.list()

List all keys in story storage.

**Signature:**

```ts
function list(): Promise<string[]>
```

**Returns:**

Promise<string[]>

Promise resolving to array of storage keys

## Example

```ts
const keys = await api.v1.storyStorage.list();
api.v1.log("Stored keys:", keys);
```

---

## api.v1.storyStorage.remove()

Remove a value from story storage.

**Signature:**

```ts
function remove(key: string): Promise<void>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| key | string | Storage key |

**Returns:**

Promise<void>

Promise that resolves when removed

---

## api.v1.storyStorage.set()

Set a value in story storage.

**Signature:**

```ts
function set(key: string, value: any): Promise<void>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| key | string | Storage key |
| value | any | Value to store (will be JSON serialized) |

**Returns:**

Promise<void>

Promise that resolves when stored

## Example

```ts
await api.v1.storyStorage.set("lastRun", new Date().toISOString());
```

---

## api.v1.storyStorage.setIfAbsent()

Set a value in story storage only if the key does not already exist.

**Signature:**

```ts
function setIfAbsent(key: string, value: any): Promise<boolean>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| key | string | Storage key |
| value | any | Value to store (will be JSON serialized) |

**Returns:**

Promise<boolean>

Promise that resolves to true if the value was set, false if the key already existed

## Example

```ts
const wasSet = await api.v1.storyStorage.setIfAbsent("firstRun", new Date().toISOString());
```

---

## api.v1.systemPrompt

System Prompt API - Read and update the system prompt.

**Signature:**

```ts
namespace systemPrompt
```

## Functions

| Function | Description |
| --- | --- |
| get() | Get the current system prompt text. |
| getDefault() | Get the default system prompt text for the current model and story mode. |
| set(text) | Set the system prompt text. If set to undefined or an empty string, the default system prompt will be used. Requires the “storyEdit” permission. |

---

## api.v1.systemPrompt.get()

Get the current system prompt text.

**Signature:**

```ts
function get(): Promise<string>
```

**Returns:**

Promise<string>

Promise resolving to the system prompt content

## Example

```ts
const prompt = await api.v1.systemPrompt.get();
api.v1.log("System prompt:", prompt);
```

---

## api.v1.systemPrompt.getDefault()

Get the default system prompt text for the current model and story mode.

**Signature:**

```ts
function getDefault(): Promise<string>
```

**Returns:**

Promise<string>

Promise resolving to the default system prompt content

## Example

```ts
const defaultPrompt = await api.v1.systemPrompt.getDefault();
api.v1.log("Default system prompt:", defaultPrompt);
```

---

## api.v1.systemPrompt.set()

Set the system prompt text. If set to undefined or an empty string, the default system prompt will be used. Requires the “storyEdit” permission.

**Signature:**

```ts
function set(text: string): Promise<void>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| text | string | The new system prompt content |

**Returns:**

Promise<void>

Promise that resolves when the system prompt is updated

## Example

```ts
await api.v1.systemPrompt.set("You are a helpful assistant...");
```

---

## api.v1.tempStorage

Temporary Storage API - Key-value storage for the script that lasts only for the duration of the current script run. Data is not persisted across script runs or story sessions. Attempting to store non-serializable values will result in those values being lost. The stored data exists only in memory while the script is running and not persisted beyond that. Writes to temporary storage will not trigger story or script storage saves and can be used for displaying temporary state through UIPart storageKeys.

**Signature:**

```ts
namespace tempStorage
```

## Functions

| Function | Description |
| --- | --- |
| get(key) | Get a value from temporary storage. |
| getOrDefault(key, defaultValue) | Gets the value from temporary storage, or the default value if the key does not exist. |
| has(key) | Check if a key exists in temporary storage. A value of undefined is considered to not exist. |
| list() | List all keys in temporary storage. |
| remove(key) | Remove a value from temporary storage. |
| set(key, value) | Set a value in temporary storage. |
| setIfAbsent(key, value) | Set a value in temporary storage only if the key does not already exist. |

---

## api.v1.tempStorage.get()

Get a value from temporary storage.

**Signature:**

```ts
function get(key: string): Promise<any>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| key | string | Storage key |

**Returns:**

Promise<any>

Promise resolving to the stored value or undefined

## Example

```ts
const count = await api.v1.tempStorage.get("runCount") || 0;
```

---

## api.v1.tempStorage.getOrDefault()

Gets the value from temporary storage, or the default value if the key does not exist.

**Signature:**

```ts
function getOrDefault(key: string, defaultValue: any): Promise<any>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| key | string | Storage key |
| defaultValue | any | Value to return if the key does not exist |

**Returns:**

Promise<any>

Promise resolving to the stored value or the default value

## Example

```ts
const count = await api.v1.tempStorage.getOrDefault("runCount", 0);
```

---

## api.v1.tempStorage.has()

Check if a key exists in temporary storage. A value of undefined is considered to not exist.

**Signature:**

```ts
function has(key: string): Promise<boolean>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| key | string | Storage key |

**Returns:**

Promise<boolean>

Promise resolving to true if the key exists, false otherwise

## Example

```ts
const exists = await api.v1.tempStorage.has("lastRun");
```

---

## api.v1.tempStorage.list()

List all keys in temporary storage.

**Signature:**

```ts
function list(): Promise<string[]>
```

**Returns:**

Promise<string[]>

Promise resolving to array of storage keys

## Example

```ts
const keys = await api.v1.tempStorage.list();
api.v1.log("Stored keys:", keys);
```

---

## api.v1.tempStorage.remove()

Remove a value from temporary storage.

**Signature:**

```ts
function remove(key: string): Promise<void>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| key | string | Storage key |

**Returns:**

Promise<void>

Promise that resolves when removed

---

## api.v1.tempStorage.set()

Set a value in temporary storage.

**Signature:**

```ts
function set(key: string, value: any): Promise<void>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| key | string | Storage key |
| value | any | Value to store (will be JSON serialized) |

**Returns:**

Promise<void>

Promise that resolves when stored

## Example

```ts
await api.v1.tempStorage.set("lastRun", new Date().toISOString());
```

---

## api.v1.tempStorage.setIfAbsent()

Set a value in temporary storage only if the key does not already exist.

**Signature:**

```ts
function setIfAbsent(key: string, value: any): Promise<boolean>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| key | string | Storage key |
| value | any | Value to store (will be JSON serialized) |

**Returns:**

Promise<boolean>

Promise that resolves to true if the value was set, false if the key already existed

## Example

```ts
const wasSet = await api.v1.tempStorage.setIfAbsent("firstRun", new Date().toISOString());
```

---

## api.v1.theme

Theme API - Access the current site theme colors and fonts.

**Signature:**

```ts
namespace theme
```

## Functions

| Function | Description |
| --- | --- |
| get() | Get the current theme data including colors and fonts. Useful for color manipulation, computed styles, etc. For JSX UIParts usage, prefer the `--theme-*` CSS custom properties available to them. Fonts and colors may be in any format as these are user defined. Colors can be hex codes, color names, rgb/rgba strings, etc. Font values are font-family strings that may include multiple fallback fonts. |

---

## api.v1.theme.get()

Get the current theme data including colors and fonts. Useful for color manipulation, computed styles, etc. For JSX UIParts usage, prefer the `--theme-*` CSS custom properties available to them. Fonts and colors may be in any format as these are user defined. Colors can be hex codes, color names, rgb/rgba strings, etc. Font values are font-family strings that may include multiple fallback fonts.

**Signature:**

```ts
function get(): Promise<{
                name: string
                fonts: {
                    default: string
                    code: string
                    field: string
                    headings: string
                }
                colors: {
                    bg0: string
                    bg1: string
                    bg2: string
                    bg3: string
                    textHeadings: string
                    textMain: string
                    textDisabled: string
                    textPlaceholder: string
                    warning: string
                    textHighlight: string
                    textPrompt: string
                    textUser: string
                    textEdit: string
                    textAI: string
                    lowIntensityColor: string
                    highIntensityColor: string
                    midIntensityColor: string
                }
            }>
```

**Returns:**

Promise<{ name: string fonts: { default: string code: string field: string headings: string } colors: { bg0: string bg1: string bg2: string bg3: string textHeadings: string textMain: string textDisabled: string textPlaceholder: string warning: string textHighlight: string textPrompt: string textUser: string textEdit: string textAI: string lowIntensityColor: string highIntensityColor: string midIntensityColor: string } }>

The current theme object

## Example

```ts
const theme = await api.v1.theme.get();
api.v1.log(theme.name); // "NovelAI Dark"
api.v1.log(theme.colors.bg0); // "#000000"
api.v1.log(theme.fonts.default); // "Source Sans Pro"
```

---

## api.v1.timers

Timers API - Schedule delayed execution and sleep.

**Signature:**

```ts
namespace timers
```

## Functions

| Function | Description |
| --- | --- |
| clearTimeout(timerId) | Clear a previously set timeout. |
| setTimeout(callback, delay) | Schedule a callback to run after a delay. |
| sleep(delay) | Sleep for a specified duration. |

---

## api.v1.timers.clearTimeout()

Clear a previously set timeout.

**Signature:**

```ts
function clearTimeout(timerId: number): Promise<void>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| timerId | number | The timer ID returned from setTimeout |

**Returns:**

Promise<void>

Promise that resolves when cleared

---

## api.v1.timers.setTimeout()

Schedule a callback to run after a delay.

**Signature:**

```ts
function setTimeout(callback: () => void, delay: number): Promise<number>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| callback | () => void | Function to call after delay |
| delay | number | Delay in milliseconds |

**Returns:**

Promise<number>

Promise resolving to a timer ID

## Example

```ts
const timerId = await api.v1.timers.setTimeout(() => {
  api.v1.log("Delayed message");
}, 1000);
```

---

## api.v1.timers.sleep()

Sleep for a specified duration.

**Signature:**

```ts
function sleep(delay: number): Promise<void>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| delay | number | Sleep duration in milliseconds |

**Returns:**

Promise<void>

Promise that resolves after the delay

## Example

```ts
await api.v1.timers.sleep(2000);
api.v1.log("2 seconds later...");
```

---

## api.v1.tokenizer

Tokenizer API - Encode and decode text to/from tokens.

**Signature:**

```ts
namespace tokenizer
```

## Functions

| Function | Description |
| --- | --- |
| decode(tokens, model) | Decode token IDs to text. |
| encode(text, model) | Encode text to token IDs. |

---

## api.v1.tokenizer.decode()

Decode token IDs to text.

**Signature:**

```ts
function decode(tokens: number[], model: string): Promise<string>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| tokens | number[] | Array of token IDs |
| model | string | Model name who’s tokenizer should be used |

**Returns:**

Promise<string>

Promise resolving to the decoded text

## Example

```ts
const text = await api.v1.tokenizer.decode([123, 456], "glm-4-6");
```

---

## api.v1.tokenizer.encode()

Encode text to token IDs.

**Signature:**

```ts
function encode(text: string, model: string): Promise<number[]>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| text | string | Text to encode |
| model | string | Model name who’s tokenizer should be used |

**Returns:**

Promise<number[]>

Promise resolving to array of token IDs

## Example

```ts
const tokens = await api.v1.tokenizer.encode("Hello world", "glm-4-6");
```

---

## api.v1.ts

**Signature:**

```ts
namespace ts
```

## Functions

| Function | Description |
| --- | --- |
| transpile(tsCode) | Transpile TypeScript code to JavaScript. |

---

## api.v1.ts.transpile()

Transpile TypeScript code to JavaScript.

**Signature:**

```ts
function transpile(tsCode: string): string
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| tsCode | string | TypeScript code as a string |

**Returns:**

string

string of transpiled JavaScript code

## Example

```ts
const jsCode = api.v1.ts.transpile("const x: number = 42;");
api.v1.log(jsCode); // "const x = 42;"
```

---

## api.v1.tts

Text-to-Speech API - Control speech synthesis.

**Signature:**

```ts
namespace tts
```

## Functions

| Function | Description |
| --- | --- |
| pause() | Pause text-to-speech playback. If already paused, does nothing. |
| queue(text, options) | Add text to the speech queue. When this returns, the speech has been queued for generation, but may not have started playing yet. |
| resume() | Resume paused text-to-speech playback. If not paused, does nothing. |
| speak(text, options) | Speak text immediately, interrupting current speech and clearing the queue. When this returns, the speech has been queued for generation, but may not have started playing yet. |
| stop() | Stop all text-to-speech playback and clear the queue. |
| togglePause() | Toggle pause/resume of text-to-speech playback. |

---

## api.v1.tts.pause()

Pause text-to-speech playback. If already paused, does nothing.

**Signature:**

```ts
function pause(): Promise<void>
```

**Returns:**

Promise<void>

Promise that resolves when paused

---

## api.v1.tts.queue()

Add text to the speech queue. When this returns, the speech has been queued for generation, but may not have started playing yet.

**Signature:**

```ts
function queue(text: string, options?: { seed?: string }): Promise<void>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| text | string | Text to speak |
| options | { seed?: string } | *(Optional)* Optional configuration |

**Returns:**

Promise<void>

Promise that resolves when queued

## Example

```ts
await api.v1.tts.queue("This will be spoken after current speech");
```

---

## api.v1.tts.resume()

Resume paused text-to-speech playback. If not paused, does nothing.

**Signature:**

```ts
function resume(): Promise<void>
```

**Returns:**

Promise<void>

Promise that resolves when resumed

---

## api.v1.tts.speak()

Speak text immediately, interrupting current speech and clearing the queue. When this returns, the speech has been queued for generation, but may not have started playing yet.

**Signature:**

```ts
function speak(text: string, options?: { seed?: string }): Promise<void>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| text | string | Text to speak |
| options | { seed?: string } | *(Optional)* Optional configuration |

**Returns:**

Promise<void>

Promise that resolves when the speech has been queued for generation.

## Example

```ts
await api.v1.tts.speak("Hello! I'm speaking now.");
```

---

## api.v1.tts.stop()

Stop all text-to-speech playback and clear the queue.

**Signature:**

```ts
function stop(): Promise<void>
```

**Returns:**

Promise<void>

Promise that resolves when stopped

---

## api.v1.tts.togglePause()

Toggle pause/resume of text-to-speech playback.

**Signature:**

```ts
function togglePause(): Promise<void>
```

**Returns:**

Promise<void>

Promise that resolves when toggled

---

## api.v1.ui

UI API - Create and manage custom user interfaces.

**Signature:**

```ts
namespace ui
```

## Functions

| Function | Description |
| --- | --- |
| closePanel() | Close the currently open script panel. |
| openPanel(id) | Open a specific script panel by ID. |
| register(extensions) | Register new UI extensions (buttons, panels, etc.). |
| remove(ids) | Remove UI extensions by their IDs. |
| removeParts(ids) | Remove UI parts from modals/windows by their IDs. |
| toast(message, options) | Display or update a toast notification. |
| update(extensions) | Update existing UI extensions. |
| updateParts(parts) | Update existing UI parts in modals/windows. The update will not go through is the part has not yet been mounted by react. This can happen if called too early after creating the part. |

## Namespaces

| Namespace | Description |
| --- | --- |
| extension | UI Extension helpers - Convenience functions for creating UI extensions. These functions automatically add the correct `type` field. |
| larry | Larry API - Interact with Larry. |
| modal | Modal dialog API - Create and manage modal windows. |
| part | UI Part helpers - Convenience functions for creating UI components. These functions automatically add the correct `type` field. |
| window | Window API - Create and manage floating windows. |

---

## api.v1.ui.closePanel()

Close the currently open script panel.

**Signature:**

```ts
function closePanel(): Promise<void>
```

**Returns:**

Promise<void>

Promise that resolves when panel is closed

---

## api.v1.ui.extension

UI Extension helpers - Convenience functions for creating UI extensions. These functions automatically add the correct `type` field.

**Signature:**

```ts
namespace extension
```

## Functions

| Function | Description |
| --- | --- |
| contextMenuButton(config) | Create a context menu button extension. |
| lorebookPanel(config) | Create a lorebook panel extension. |
| scriptPanel(config) | Create a script panel extension. |
| sidebarPanel(config) | Create a sidebar panel extension. |
| toolbarButton(config) | Create a toolbar button extension. |
| toolboxOption(config) | Create a toolbox option extension. |

---

## api.v1.ui.extension.contextMenuButton()

Create a context menu button extension.

**Signature:**

```ts
function contextMenuButton(
                    config: Omit<UIExtensionContextMenuButton, 'type'>
                ): UIExtensionContextMenuButton
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| config | Omit<UIExtensionContextMenuButton, ‘type’> | Context menu button configuration |

**Returns:**

UIExtensionContextMenuButton

A context menu button UIExtension

## Example

```ts
const menuBtn = api.v1.ui.extension.contextMenuButton({
  id: "myMenuBtn",
  text: "Custom Action",
  callback: ({ selection }) => api.v1.log("Selected:", selection)
});
```

---

## api.v1.ui.extension.lorebookPanel()

Create a lorebook panel extension.

**Signature:**

```ts
function lorebookPanel(
                    config: Omit<UIExtensionLorebookPanel, 'type'>
                ): UIExtensionLorebookPanel
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| config | Omit<UIExtensionLorebookPanel, ‘type’> | Lorebook panel configuration |

**Returns:**

UIExtensionLorebookPanel

A lorebook panel UIExtension

---

## api.v1.ui.extension.scriptPanel()

Create a script panel extension.

**Signature:**

```ts
function scriptPanel(config: Omit<UIExtensionScriptPanel, 'type'>): UIExtensionScriptPanel
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| config | Omit<UIExtensionScriptPanel, ‘type’> | Script panel configuration |

**Returns:**

UIExtensionScriptPanel

A script panel UIExtension

## Example

```ts
const panel = api.v1.ui.extension.scriptPanel({
  id: "myPanel",
  name: "My Tools",
  content: [
    api.v1.ui.part.text({ text: "Panel content" })
  ]
});
```

---

## api.v1.ui.extension.sidebarPanel()

Create a sidebar panel extension.

**Signature:**

```ts
function sidebarPanel(config: Omit<UIExtensionSidebarPanel, 'type'>): UIExtensionSidebarPanel
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| config | Omit<UIExtensionSidebarPanel, ‘type’> | Sidebar panel configuration |

**Returns:**

UIExtensionSidebarPanel

A sidebar panel UIExtension

---

## api.v1.ui.extension.toolbarButton()

Create a toolbar button extension.

**Signature:**

```ts
function toolbarButton(
                    config: Omit<UIExtensionToolbarButton, 'type'>
                ): UIExtensionToolbarButton
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| config | Omit<UIExtensionToolbarButton, ‘type’> | Toolbar button configuration |

**Returns:**

UIExtensionToolbarButton

A toolbar button UIExtension

---

## api.v1.ui.extension.toolboxOption()

Create a toolbox option extension.

**Signature:**

```ts
function toolboxOption(
                    config: Omit<UIExtensionToolboxOption, 'type'>
                ): UIExtensionToolboxOption
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| config | Omit<UIExtensionToolboxOption, ‘type’> | Toolbox option configuration |

**Returns:**

UIExtensionToolboxOption

A toolbox option UIExtension

---

## api.v1.ui.larry

Larry API - Interact with Larry.

**Signature:**

```ts
namespace larry
```

## Functions

| Function | Description |
| --- | --- |
| help(config) | Show Larry with a question and optional response buttons. |

---

## api.v1.ui.larry.help()

Show Larry with a question and optional response buttons.

**Signature:**

```ts
function help(config: {
                    question: string
                    options?: { text: string; callback: () => void }[]
                    [key: string]: any
                }): void
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| config | { question: string options?: { text: string; callback: () => void }[] [key: string]: any } | Configuration object with question and options. If no options are provided, Yes/No buttons will be shown with Yes triggering the normal larry generation behaviour. |

**Returns:**

void

## Example

```ts
api.v1.larry.help({
  question: "What would you like to do?",
  options: [
    { text: "Generate more", callback: () => api.v1.editor.generate() },
    { text: "Cancel", callback: () => {} }
  ]
});
```

---

## api.v1.ui.modal

Modal dialog API - Create and manage modal windows.

**Signature:**

```ts
namespace modal
```

## Functions

| Function | Description |
| --- | --- |
| open(options) | Open a new modal dialog. |

---

## api.v1.ui.modal.open()

Open a new modal dialog.

**Signature:**

```ts
function open(options: ModalOptions): Promise<{
                    update: (options: Partial<ModalOptions>) => Promise<void>
                    close: () => Promise<void>
                    isClosed: () => boolean
                    closed: Promise<void>
                }>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| options | ModalOptions | Modal configuration |

**Returns:**

Promise<{ update: (options: Partial<ModalOptions>) => Promise<void> close: () => Promise<void> isClosed: () => boolean closed: Promise<void> }>

Object with update and close methods and a promise that resolves when the modal is closed

## Example

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

---

## api.v1.ui.openPanel()

Open a specific script panel by ID.

**Signature:**

```ts
function openPanel(id: string): Promise<void>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| id | string | The panel ID to open |

**Returns:**

Promise<void>

Promise that resolves when panel is opened

---

## api.v1.ui.part

UI Part helpers - Convenience functions for creating UI components. These functions automatically add the correct `type` field.

**Signature:**

```ts
namespace part
```

## Functions

| Function | Description |
| --- | --- |
| box(config) | Create a box container component. |
| button(config) | Create a button component. |
| checkboxInput(config) | Create a checkbox input component. |
| codeEditor(config) | Create a code editor component. |
| collapsibleSection(config) | Create a collapsible section component. |
| column(config) | Create a column layout component. |
| container(config) | Create a container component. |
| image(config) | Create an image component. |
| jsx(config) | Create a JSX component rendered via Preact. |
| multilineTextInput(config) | Create a multiline text input component. |
| numberInput(config) | Create a number input component. |
| row(config) | Create a row layout component. |
| sliderInput(config) | Create a slider input component. |
| text(config) | Create a text display component. |
| textInput(config) | Create a text input component. |

---

## api.v1.ui.part.box()

Create a box container component.

**Signature:**

```ts
function box(config: Omit<UIPartBox, 'type'>): UIPartBox
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| config | Omit<UIPartBox, ‘type’> | Box configuration |

**Returns:**

UIPartBox

A box UIPart

---

## api.v1.ui.part.button()

Create a button component.

**Signature:**

```ts
function button(config: Omit<UIPartButton, 'type'>): UIPartButton
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| config | Omit<UIPartButton, ‘type’> | Button configuration |

**Returns:**

UIPartButton

A button UIPart

## Example

```ts
const btn = api.v1.ui.part.button({
  id: "myBtn",
  text: "Click me",
  callback: () => api.v1.log("Clicked!")
});
```

---

## api.v1.ui.part.checkboxInput()

Create a checkbox input component.

**Signature:**

```ts
function checkboxInput(config: Omit<UIPartCheckboxInput, 'type'>): UIPartCheckboxInput
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| config | Omit<UIPartCheckboxInput, ‘type’> | Checkbox input configuration |

**Returns:**

UIPartCheckboxInput

A checkbox input UIPart

---

## api.v1.ui.part.codeEditor()

Create a code editor component.

**Signature:**

```ts
function codeEditor(config: Omit<UIPartCodeEditor, 'type'>): UIPartCodeEditor
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| config | Omit<UIPartCodeEditor, ‘type’> | Code editor configuration |

**Returns:**

UIPartCodeEditor

A code editor UIPart

---

## api.v1.ui.part.collapsibleSection()

Create a collapsible section component.

**Signature:**

```ts
function collapsibleSection(
                    config: Omit<UIPartCollapsibleSection, 'type'>
                ): UIPartCollapsibleSection
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| config | Omit<UIPartCollapsibleSection, ‘type’> | Collapsible section configuration |

**Returns:**

UIPartCollapsibleSection

A collapsible section UIPart

---

## api.v1.ui.part.column()

Create a column layout component.

**Signature:**

```ts
function column(config: Omit<UIPartColumn, 'type'>): UIPartColumn
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| config | Omit<UIPartColumn, ‘type’> | Column configuration |

**Returns:**

UIPartColumn

A column UIPart

---

## api.v1.ui.part.container()

Create a container component.

**Signature:**

```ts
function container(config: Omit<UIPartContainer, 'type'>): UIPartContainer
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| config | Omit<UIPartContainer, ‘type’> | Container configuration |

**Returns:**

UIPartContainer

A container UIPart

---

## api.v1.ui.part.image()

Create an image component.

**Signature:**

```ts
function image(config: Omit<UIPartImage, 'type'>): UIPartImage
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| config | Omit<UIPartImage, ‘type’> | Image configuration |

**Returns:**

UIPartImage

An image UIPart

---

## api.v1.ui.part.jsx()

Create a JSX component rendered via Preact.

**Signature:**

```ts
function jsx(config: Omit<UIPartJSX, 'type'>): UIPartJSX
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| config | Omit<UIPartJSX, ‘type’> | JSX configuration |

**Returns:**

UIPartJSX

A JSX UIPart

---

## api.v1.ui.part.multilineTextInput()

Create a multiline text input component.

**Signature:**

```ts
function multilineTextInput(
                    config: Omit<UIPartMultilineTextInput, 'type'>
                ): UIPartMultilineTextInput
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| config | Omit<UIPartMultilineTextInput, ‘type’> | Multiline text input configuration |

**Returns:**

UIPartMultilineTextInput

A multiline text input UIPart

---

## api.v1.ui.part.numberInput()

Create a number input component.

**Signature:**

```ts
function numberInput(config: Omit<UIPartNumberInput, 'type'>): UIPartNumberInput
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| config | Omit<UIPartNumberInput, ‘type’> | Number input configuration |

**Returns:**

UIPartNumberInput

A number input UIPart

---

## api.v1.ui.part.row()

Create a row layout component.

**Signature:**

```ts
function row(config: Omit<UIPartRow, 'type'>): UIPartRow
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| config | Omit<UIPartRow, ‘type’> | Row configuration |

**Returns:**

UIPartRow

A row UIPart

---

## api.v1.ui.part.sliderInput()

Create a slider input component.

**Signature:**

```ts
function sliderInput(config: Omit<UIPartSliderInput, 'type'>): UIPartSliderInput
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| config | Omit<UIPartSliderInput, ‘type’> | Slider input configuration |

**Returns:**

UIPartSliderInput

A slider input UIPart

---

## api.v1.ui.part.text()

Create a text display component.

**Signature:**

```ts
function text(config: Omit<UIPartText, 'type'>): UIPartText
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| config | Omit<UIPartText, ‘type’> | Text configuration |

**Returns:**

UIPartText

A text UIPart

---

## api.v1.ui.part.textInput()

Create a text input component.

**Signature:**

```ts
function textInput(config: Omit<UIPartTextInput, 'type'>): UIPartTextInput
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| config | Omit<UIPartTextInput, ‘type’> | Text input configuration |

**Returns:**

UIPartTextInput

A text input UIPart

---

## api.v1.ui.register()

Register new UI extensions (buttons, panels, etc.).

**Signature:**

```ts
function register(extensions: UIExtension[]): Promise<void>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| extensions | UIExtension[] | Array of UI extension objects |

**Returns:**

Promise<void>

Promise that resolves when registered

## Example

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

---

## api.v1.ui.remove()

Remove UI extensions by their IDs.

**Signature:**

```ts
function remove(ids: string[]): Promise<void>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| ids | string[] | Array of extension IDs to remove |

**Returns:**

Promise<void>

Promise that resolves when removed

---

## api.v1.ui.removeParts()

Remove UI parts from modals/windows by their IDs.

**Signature:**

```ts
function removeParts(ids: string[]): Promise<void>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| ids | string[] | Array of part IDs to remove |

**Returns:**

Promise<void>

Promise that resolves when removed

---

## api.v1.ui.toast()

Display or update a toast notification.

**Signature:**

```ts
function toast(message: string, options?: UIToastOptions): Promise<void>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| message | string | The string message to show in the toast |
| options | UIToastOptions | *(Optional)* Toast configuration |

**Returns:**

Promise<void>

Promise that resolves when the toast is shown/updated

## Example

```ts
api.v1.ui.toast(
  "This is a notification!",
  {
    duration: 5000
  }
);
```

---

## api.v1.ui.update()

Update existing UI extensions.

**Signature:**

```ts
function update(extensions: Partial<UIExtension>[] & { id: string }[]): Promise<void>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| extensions | Partial<UIExtension>[] & { id: string }[] | Array of UI extension objects with updated properties. The extensions must include their IDs. |

**Returns:**

Promise<void>

Promise that resolves when updated

---

## api.v1.ui.updateParts()

Update existing UI parts in modals/windows. The update will not go through is the part has not yet been mounted by react. This can happen if called too early after creating the part.

**Signature:**

```ts
function updateParts(parts: Partial<UIPart>[] & { id: string }[]): Promise<void>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| parts | Partial<UIPart>[] & { id: string }[] | Array of UI part objects with updated properties. The parts must include their IDs. |

**Returns:**

Promise<void>

Promise that resolves when updated

---

## api.v1.ui.window

Window API - Create and manage floating windows.

**Signature:**

```ts
namespace window
```

## Functions

| Function | Description |
| --- | --- |
| open(options) | Open a new floating window. |

---

## api.v1.ui.window.open()

Open a new floating window.

**Signature:**

```ts
function open(options: WindowOptions): Promise<{
                    update: (options: Partial<WindowOptions>) => Promise<void>
                    close: () => Promise<void>
                    isClosed: () => boolean
                    closed: Promise<void>
                }>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| options | WindowOptions | Window configuration |

**Returns:**

Promise<{ update: (options: Partial<WindowOptions>) => Promise<void> close: () => Promise<void> isClosed: () => boolean closed: Promise<void> }>

Object with update and close methods and a promise that resolves when the window is closed

## Example

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

---

## api.v1.uuid()

Generate a new UUID (universally unique identifier).

**Signature:**

```ts
function uuid(): string
```

**Returns:**

string

UUID string in standard format

## Example

```ts
const id = api.v1.uuid(); // "550e8400-e29b-41d4-a716-446655440000"
```

---

## CancellationSignal

**Signature:**

```ts
interface CancellationSignal
```

## Properties

| Property | Modifiers | Type | Description |
| --- | --- | --- | --- |
| cancelled | `readonly` | boolean | Indicates whether the operation has been cancelled. |

## Methods

| Method | Description |
| --- | --- |
| cancel() | Attempts to cancel the operation. |
| dispose() | Releases any resources held by the signal. |

---

## CancellationSignal.cancel()

Attempts to cancel the operation.

**Signature:**

```ts
cancel(): Promise<void>
```

**Returns:**

Promise<void>

---

## CancellationSignal.cancelled

Indicates whether the operation has been cancelled.

**Signature:**

```ts
readonly cancelled: boolean
```

---

## CancellationSignal.dispose()

Releases any resources held by the signal.

**Signature:**

```ts
dispose(): void
```

**Returns:**

void

---

## DecorationCreateInlineMarkerOptions

Options for creating an inline marker (highlights a range of text).

**Signature:**

```ts
type DecorationCreateInlineMarkerOptions = {
    id?: string
    type: 'inline'
    from: DecorationPosition
    to: DecorationPosition
    style: Record<string, string>
    onChange?: (event: DecorationMarkerEvent) => void
}
```

**References:** DecorationPosition, DecorationMarkerEvent

---

## DecorationCreateInlineWidgetOptions

Options for creating a widget that appears inline with text.

**Signature:**

```ts
type DecorationCreateInlineWidgetOptions = {
    type: 'inline'
    id?: string
    position: DecorationPosition
    content: UIPart[]
    side?: 'before' | 'after'
    display?: 'block' | 'inline' | 'inline-block'
    onChange?: (event: DecorationWidgetEvent) => void
}
```

**References:** DecorationPosition, UIPart, DecorationWidgetEvent

---

## DecorationCreateNodeMarkerOptions

Options for creating a node marker (styles an entire paragraph).

**Signature:**

```ts
type DecorationCreateNodeMarkerOptions = {
    id?: string
    type: 'node'
    sectionId: number
    style: Record<string, string>
    onChange?: (event: DecorationMarkerEvent) => void
}
```

**References:** DecorationMarkerEvent

---

## DecorationCreateNodeWidgetOptions

Options for creating a widget that appears between paragraphs.

**Signature:**

```ts
type DecorationCreateNodeWidgetOptions = {
    type: 'node'
    id?: string
    sectionId: number
    content: UIPart[]
    side?: 'before' | 'after'
    display?: 'block' | 'inline' | 'inline-block'
    onChange?: (event: DecorationWidgetEvent) => void
}
```

**References:** UIPart, DecorationWidgetEvent

---

## DecorationCreateWidgetOptions

**Signature:**

```ts
type DecorationCreateWidgetOptions = DecorationCreateInlineWidgetOptions | DecorationCreateNodeWidgetOptions
```

**References:** DecorationCreateInlineWidgetOptions, DecorationCreateNodeWidgetOptions

---

## DecorationInlineMarkerInfo

Information about an inline marker (character-level decoration).

**Signature:**

```ts
type DecorationInlineMarkerInfo = {
    id: string
    type: 'inline'
    from: DecorationPosition
    to: DecorationPosition
    style: Record<string, string>
}
```

**References:** DecorationPosition

---

## DecorationInlineWidgetInfo

Information about an inline widget decoration.

**Signature:**

```ts
type DecorationInlineWidgetInfo = {
    id: string
    position: DecorationPosition
}
```

**References:** DecorationPosition

---

## DecorationMarkerChangeEvent

Event fired when a marker’s position changes due to document edits.

**Signature:**

```ts
type DecorationMarkerChangeEvent = {
    type: 'change'
    info: DecorationMarkerInfo
}
```

**References:** DecorationMarkerInfo

---

## DecorationMarkerDisposeEvent

Event fired when a marker is automatically disposed due to document edits.

**Signature:**

```ts
type DecorationMarkerDisposeEvent = {
    type: 'dispose'
    reason: 'collapsed' | 'sectionRemoved'
}
```

---

## DecorationMarkerEvent

Union type for marker events.

**Signature:**

```ts
type DecorationMarkerEvent = DecorationMarkerChangeEvent | DecorationMarkerDisposeEvent
```

**References:** DecorationMarkerChangeEvent, DecorationMarkerDisposeEvent

---

## DecorationMarkerHandle

Handle for controlling a marker after creation.

**Signature:**

```ts
type DecorationMarkerHandle = {
    readonly id: string
    getInfo(): Promise<DecorationMarkerInfo | null>
    update(options: DecorationUpdateMarkerOptions): Promise<void>
    dispose(): Promise<void>
}
```

**References:** DecorationMarkerInfo, DecorationUpdateMarkerOptions

---

## DecorationMarkerInfo

Union type for marker info.

**Signature:**

```ts
type DecorationMarkerInfo = DecorationInlineMarkerInfo | DecorationNodeMarkerInfo
```

**References:** DecorationInlineMarkerInfo, DecorationNodeMarkerInfo

---

## DecorationNodeMarkerInfo

Information about a node marker (paragraph-level decoration).

**Signature:**

```ts
type DecorationNodeMarkerInfo = {
    id: string
    type: 'node'
    sectionId: number
    style: Record<string, string>
}
```

---

## DecorationNodeWidgetInfo

Information about a node widget decoration.

**Signature:**

```ts
type DecorationNodeWidgetInfo = {
    id: string
    sectionId: number
}
```

---

## DecorationPosition

A position in the document for decoration placement.

**Signature:**

```ts
type DecorationPosition = {
    sectionId: number
    offset: number
}
```

---

## DecorationRule

A pattern-based decoration rule for automatic highlighting.

**Signature:**

```ts
type DecorationRule = {
    id: string
    type: 'inline' | 'node'
    match: string | RegExp
    flags?: string
    style: Record<string, string>
    scope?: DecorationSectionScope
}
```

**References:** DecorationSectionScope

---

## DecorationSectionScope

Scope limiting which sections decorations apply to.

**Signature:**

```ts
type DecorationSectionScope = {
    sectionIds?: number[]
}
```

---

## DecorationUpdateInlineWidgetOptions

Options for updating a widget.

**Signature:**

```ts
type DecorationUpdateInlineWidgetOptions = {
    content?: UIPart[]
    position?: DecorationPosition
    side?: 'before' | 'after'
    display?: 'block' | 'inline' | 'inline-block'
}
```

**References:** UIPart, DecorationPosition

---

## DecorationUpdateMarkerOptions

Options for updating a marker.

**Signature:**

```ts
type DecorationUpdateMarkerOptions = {
    style?: Record<string, string>
    from?: DecorationPosition
    to?: DecorationPosition
    sectionId?: number
}
```

**References:** DecorationPosition

---

## DecorationUpdateNodeWidgetOptions

Options for updating a block widget.

**Signature:**

```ts
type DecorationUpdateNodeWidgetOptions = {
    content?: UIPart[]
    sectionId?: number
    side?: 'before' | 'after'
    display?: 'block' | 'inline' | 'inline-block'
}
```

**References:** UIPart

---

## DecorationUpdateWidgetOptions

**Signature:**

```ts
type DecorationUpdateWidgetOptions = DecorationUpdateInlineWidgetOptions | DecorationUpdateNodeWidgetOptions
```

**References:** DecorationUpdateInlineWidgetOptions, DecorationUpdateNodeWidgetOptions

---

## DecorationWidgetChangeEvent

Event fired when a widget’s position changes due to document edits.

**Signature:**

```ts
type DecorationWidgetChangeEvent = {
    type: 'change'
    info: DecorationWidgetInfo
}
```

**References:** DecorationWidgetInfo

---

## DecorationWidgetDisposeEvent

Event fired when a widget is automatically disposed due to document edits.

**Signature:**

```ts
type DecorationWidgetDisposeEvent = {
    type: 'dispose'
    reason: 'sectionRemoved'
}
```

---

## DecorationWidgetEvent

Union type for widget events.

**Signature:**

```ts
type DecorationWidgetEvent = DecorationWidgetChangeEvent | DecorationWidgetDisposeEvent
```

**References:** DecorationWidgetChangeEvent, DecorationWidgetDisposeEvent

---

## DecorationWidgetHandle

Handle for controlling a widget after creation.

**Signature:**

```ts
type DecorationWidgetHandle<T extends DecorationCreateWidgetOptions = DecorationCreateWidgetOptions> = {
    readonly id: string
    getInfo(): Promise<
        T extends DecorationCreateInlineWidgetOptions
            ? DecorationInlineWidgetInfo
            : DecorationNodeWidgetInfo | null
    >
    update(
        options: T extends DecorationCreateInlineWidgetOptions
            ? DecorationUpdateInlineWidgetOptions
            : DecorationUpdateNodeWidgetOptions
    ): Promise<void>
    dispose(): Promise<void>
}
```

**References:** DecorationCreateWidgetOptions, DecorationCreateInlineWidgetOptions, DecorationInlineWidgetInfo, DecorationNodeWidgetInfo, DecorationUpdateInlineWidgetOptions, DecorationUpdateNodeWidgetOptions

---

## DecorationWidgetInfo

Union type for widget info.

**Signature:**

```ts
type DecorationWidgetInfo = DecorationInlineWidgetInfo | DecorationNodeWidgetInfo
```

**References:** DecorationInlineWidgetInfo, DecorationNodeWidgetInfo

---

## DocumentSelection

Represents a selection range in the document. `from`/`to` and `anchor`/`head` are similar, but `from` is always before `to` in the document, while `anchor` is where the selection started and `head` is where it ended they can be in either order.

**Signature:**

```ts
type DocumentSelection = {
    from: { sectionId: number; offset: number }
    to: { sectionId: number; offset: number }
    anchor: { sectionId: number; offset: number }
    head: { sectionId: number; offset: number }
}
```

---

## EditorDataOrigin

Origin of text in the document for metadata purposes.

**Signature:**

```ts
type EditorDataOrigin = 'user' | 'ai' | 'edit' | 'prompt' | 'script'
```

---

## EditorSectionSource

The section’s source type. Used for special formatting of certain paragraph types.

**Signature:**

```ts
type EditorSectionSource = 'story' | 'action' | 'dialogue' | 'instruction'
```

---

## EditorTextFormatting

Editor formatting options for text.

**Signature:**

```ts
type EditorTextFormatting = 'bold' | 'italic' | 'underline' | 'strikethrough' | 'inline_code'
```

---

## GenerationChoice

A single generated completion choice.

**Signature:**

```ts
type GenerationChoice = {
    text: string
    index: number
    token_ids: number[]
    logprobs?: OpenAILogprobs
    convertedLogprobs?: Logprobs[]
    finish_reason?: string
    isReasoning?: boolean
    parsedReasoning?: string
    parsedContent?: string
}
```

**References:** OpenAILogprobs, Logprobs

---

## GenerationParams

Parameters for text generation requests.

**Signature:**

```ts
type GenerationParams = {
    model: string
    max_tokens?: number
    temperature?: number
    top_p?: number
    top_k?: number
    min_p?: number
    frequency_penalty?: number
    presence_penalty?: number
    stop?: string[]
    logit_bias?: Record<number, number>
    enable_thinking?: boolean
}
```

---

## GenerationPosition

Specifies where in the document generation will start, and optionally what text to replace.

**Signature:**

```ts
type GenerationPosition = {
    sectionId: number
    offset: number
    endSectionId?: number
    endOffset?: number
}
```

---

## GenerationResponse

Response from a generation request containing one or more completion choices. Currently, only one choice is ever returned.

**Signature:**

```ts
type GenerationResponse = {
    choices: GenerationChoice[]
}
```

**References:** GenerationChoice

---

## HistoryChangeMap

A map of section IDs to the changes that occurred to them in a single history step. Each element is a tuple of [sectionId, historyStep]. This represents all changes that happened in one history node.

**Signature:**

```ts
type HistoryChangeMap = Array<[number, HistoryStep]>
```

**References:** HistoryStep

---

## HistoryDiffMeta

Metadata for a text diff operation on origin or formatting data.

**Signature:**

```ts
type HistoryDiffMeta = {
    index: number
    position: number
    length: number
    data: string
}
```

---

## HistoryDiffText

A text-based diff showing changes to a section.

**Signature:**

```ts
type HistoryDiffText = {
    parts: Array<{
        from: number
        insert: string
        delete: string
    }>
    origin: HistoryDiffMeta[]
    formatting: HistoryDiffMeta[]
    source?: number
}
```

**References:** HistoryDiffMeta

---

## HistoryNodeInfo

Information about a history node.

**Signature:**

```ts
type HistoryNodeInfo = {
    id: number
    parent: number | undefined
    children: number[]
    route: number | undefined
    genPosition: GenerationPosition | undefined
}
```

**References:** GenerationPosition

---

## HistoryNodeState

Result of navigating to a history node.

**Signature:**

```ts
type HistoryNodeState = {
    backwardPath: number[]
    forwardPath: number[]
    backwardChanges: HistoryChangeMap[]
    forwardChanges: HistoryChangeMap[]
    sections: { sectionId: number; section: Section }[]
    targetNode: HistoryNodeInfo
}
```

**References:** HistoryChangeMap, Section, HistoryNodeInfo

---

## HistoryStep

A single change in a history node.

**Signature:**

```ts
type HistoryStep = HistoryStepCreate | HistoryStepUpdate | HistoryStepRemove
```

**References:** HistoryStepCreate, HistoryStepUpdate, HistoryStepRemove

---

## HistoryStepCreate

A history step that creates a new section.

**Signature:**

```ts
type HistoryStepCreate = {
    type: 'create'
    section: Section
    after?: number
}
```

**References:** Section

---

## HistoryStepRemove

A history step that removes a section.

**Signature:**

```ts
type HistoryStepRemove = {
    type: 'remove'
    previous: Section
    after?: number
}
```

**References:** Section

---

## HistoryStepUpdate

A history step that updates an existing section.

**Signature:**

```ts
type HistoryStepUpdate = {
    type: 'update'
    diff: HistoryDiffText
}
```

**References:** HistoryDiffText

---

## HookCallbacks

**Signature:**

```ts
interface HookCallbacks
```

## Properties

| Property | Modifiers | Type | Description |
| --- | --- | --- | --- |
| onBeforeContextBuild |  | OnBeforeContextBuild |  |
| onContextBuilt |  | OnContextBuilt |  |
| onDocumentConvertedToText |  | OnDocumentConvertedToText |  |
| onGenerationEnd |  | OnGenerationEnd |  |
| onGenerationRequested |  | OnGenerationRequested |  |
| onHistoryNavigated |  | OnHistoryNavigated |  |
| onLorebookEntrySelected |  | OnLorebookEntrySelected |  |
| onResponse |  | OnResponse |  |
| onScriptsLoaded |  | OnScriptsLoaded |  |
| onTextAdventureInput |  | OnTextAdventureInput |  |

---

## HookCallbacks.onBeforeContextBuild

**Signature:**

```ts
onBeforeContextBuild: OnBeforeContextBuild
```

---

## HookCallbacks.onContextBuilt

**Signature:**

```ts
onContextBuilt: OnContextBuilt
```

---

## HookCallbacks.onDocumentConvertedToText

**Signature:**

```ts
onDocumentConvertedToText: OnDocumentConvertedToText
```

---

## HookCallbacks.onGenerationEnd

**Signature:**

```ts
onGenerationEnd: OnGenerationEnd
```

---

## HookCallbacks.onGenerationRequested

**Signature:**

```ts
onGenerationRequested: OnGenerationRequested
```

---

## HookCallbacks.onHistoryNavigated

**Signature:**

```ts
onHistoryNavigated: OnHistoryNavigated
```

---

## HookCallbacks.onLorebookEntrySelected

**Signature:**

```ts
onLorebookEntrySelected: OnLorebookEntrySelected
```

---

## HookCallbacks.onResponse

**Signature:**

```ts
onResponse: OnResponse
```

---

## HookCallbacks.onScriptsLoaded

**Signature:**

```ts
onScriptsLoaded: OnScriptsLoaded
```

---

## HookCallbacks.onTextAdventureInput

**Signature:**

```ts
onTextAdventureInput: OnTextAdventureInput
```

---

## IconId

An id for an icon that can be used in UI extensions.

**Signature:**

```ts
type IconId =
    | 'play'
    | 'pause'
    | 'save'
    | 'download'
    | 'upload'
    | 'edit'
    | 'delete'
    | 'trash'
    | 'add'
    | 'plus'
    | 'settings'
    | 'info'
    | 'warning'
    | 'error'
    | 'alert'
    | 'success'
    | 'check'
    | 'home'
    | 'user'
    | 'search'
    | 'refresh'
    | 'reload'
    | 'copy'
    | 'eye'
    | 'eye-off'
    | 'hide'
    | 'show'
    | 'lock'
    | 'unlock'
    | 'mail'
    | 'email'
    | 'file'
    | 'folder'
    | 'image'
    | 'code'
    | 'send'
    | 'close'
    | 'x'
    | 'chevron-right'
    | 'chevron-left'
    | 'chevron-up'
    | 'chevron-down'
    | 'right'
    | 'left'
    | 'up'
    | 'down'
    | 'list'
    | 'grid'
    | 'star'
    | 'heart'
    | 'favorite'
    | 'filter'
    | 'calendar'
    | 'clock'
    | 'time'
    | 'zap'
    | 'lightning'
    | 'square'
    | 'hexagon'
    | 'help'
    | 'trending-up'
    | 'trending-down'
    | 'file-minus'
    | 'file-plus'
    | 'file-text'
    | 'folder-plus'
    | 'folder-minus'
    | 'activity'
    | 'alertOctagon'
    | 'alertTriangle'
    | 'align-center'
    | 'align-justify'
    | 'align-left'
    | 'align-right'
    | 'anchor'
    | 'archive'
    | 'arrow-down'
    | 'arrow-down-circle'
    | 'arrow-down-left'
    | 'arrow-down-right'
    | 'arrow-left'
    | 'arrow-left-circle'
    | 'arrow-right'
    | 'arrow-right-circle'
    | 'arrow-up'
    | 'arrow-up-circle'
    | 'arrow-up-left'
    | 'arrow-up-right'
    | 'at-sign'
    | 'award'
    | 'bar-chart'
    | 'bar-chart-2'
    | 'battery'
    | 'batteryCharging'
    | 'bell'
    | 'bell-off'
    | 'bold'
    | 'book'
    | 'bookOpen'
    | 'bookmark'
    | 'box'
    | 'breifcase'
    | 'camera'
    | 'cameraOff'
    | 'check-circle'
    | 'check-square'
    | 'chevrons-down'
    | 'chevrons-left'
    | 'chevrons-right'
    | 'chevrons-up'
    | 'circle'
    | 'clipboard'
    | 'cloud'
    | 'cloud-drizzle'
    | 'cloud-lightning'
    | 'cloud-off'
    | 'cloud-rain'
    | 'cloud-snow'
    | 'coffee'
    | 'columns'
    | 'command'
    | 'compass'
    | 'corner-down-left'
    | 'corner-down-right'
    | 'corner-left-down'
    | 'corner-left-up'
    | 'corner-right-down'
    | 'corner-right-up'
    | 'corner-up-left'
    | 'corner-up-right'
    | 'cpu'
    | 'crop'
    | 'crosshair'
    | 'database'
    | 'disc'
    | 'divide'
    | 'divide-circle'
    | 'divide-square'
    | 'dollar-sign'
    | 'download-cloud'
    | 'droplet'
    | 'edit-2'
    | 'edit-3'
    | 'external-link'
    | 'fast-forward'
    | 'feather'
    | 'film'
    | 'flag'
    | 'frown'
    | 'gift'
    | 'globe'
    | 'hard-drive'
    | 'hash'
    | 'headphones'
    | 'help-circle'
    | 'inbox'
    | 'italic'
    | 'key'
    | 'layers'
    | 'layout'
    | 'life-buoy'
    | 'link'
    | 'link-2'
    | 'loader'
    | 'login'
    | 'logout'
    | 'map'
    | 'map-pin'
    | 'maximize'
    | 'maximize-2'
    | 'meh'
    | 'menu'
    | 'message-circle'
    | 'message-square'
    | 'mic'
    | 'mic-off'
    | 'minimize'
    | 'minimize-2'
    | 'minus'
    | 'minus-circle'
    | 'minus-square'
    | 'monitor'
    | 'moon'
    | 'more-horizontal'
    | 'more-vertical'
    | 'mouse-pointer'
    | 'move'
    | 'music'
    | 'navigation-2'
    | 'navigation'
    | 'octagon'
    | 'package'
    | 'paperclip'
    | 'pause-circle'
    | 'pen-tool'
    | 'percent'
    | 'phone'
    | 'phone-call'
    | 'phone-forwarded'
    | 'phone-incoming'
    | 'phone-missed'
    | 'phone-off'
    | 'phone-outgoing'
    | 'pie-chart'
    | 'play-circle'
    | 'plus-circle'
    | 'plus-square'
    | 'pocket'
    | 'power'
    | 'printer'
    | 'radio'
    | 'refresh-cw'
    | 'refresh-ccw'
    | 'repeat'
    | 'rewind'
    | 'rotate-ccw'
    | 'rotate-cw'
    | 'rss'
    | 'scissors'
    | 'server'
    | 'share'
    | 'share-2'
    | 'shield'
    | 'shield-off'
    | 'shopping-bag'
    | 'shopping-cart'
    | 'shuffle'
    | 'sidebar'
    | 'skip-back'
    | 'skip-forward'
    | 'slash'
    | 'sliders'
    | 'smartphone'
    | 'smile'
    | 'speaker'
    | 'stop-circle'
    | 'sun'
    | 'sunrise'
    | 'sunset'
    | 'tablet'
    | 'tag'
    | 'target'
    | 'terminal'
    | 'thermometer'
    | 'thumbs-down'
    | 'thumbs-up'
    | 'toggle-left'
    | 'toggle-right'
    | 'tool'
    | 'trash-2'
    | 'triangle'
    | 'truck'
    | 'tv'
    | 'type'
    | 'umbrella'
    | 'underline'
    | 'upload-cloud'
    | 'user-check'
    | 'user-minus'
    | 'user-plus'
    | 'user-x'
    | 'users'
    | 'video'
    | 'video-off'
    | 'voicemail'
    | 'volume'
    | 'volume-1'
    | 'volume-2'
    | 'volume-x'
    | 'watch'
    | 'wifi'
    | 'wifi-off'
    | 'wind'
    | 'x-circle'
    | 'x-square'
    | 'x-octagon'
    | 'zap-off'
    | 'zoom-in'
    | 'zoom-out'
```

---

## Logprobs

Represents logprob information for a generated token, including alternative tokens that could have been chosen and their probabilities. This is the format used by the NovelAI frontend for displaying logprobs in the editor and modals.

**Signature:**

```ts
type Logprobs = {
    chosen: LogprobsToken
    afters: LogprobsToken[]
    befores: LogprobsToken[]
    excludedFromText?: boolean
    displayText?: string
    croppedToken?: boolean
}
```

**References:** LogprobsToken

---

## LogprobsToken

A single token with its probability information and metadata.

**Signature:**

```ts
type LogprobsToken = {
    token: number
    str: string
    before: number | null
    pBefore: number | null
    after: number | null
    pAfter: number | null
    partial: boolean
    chosen?: boolean
    useBefore?: boolean
}
```

---

## LorebookAdvancedConditionAnd

Lorebook condition that combines multiple conditions with AND logic. All conditions must be true for this to match.

**Signature:**

```ts
type LorebookAdvancedConditionAnd = {
    type: 'and'
    conditions: LorebookCondition[]
}
```

**References:** LorebookCondition

---

## LorebookAdvancedConditionEquation

Lorebook condition based on a mathematical equation.

Allows for comparisons like “characterCount > 1000”.

**Signature:**

```ts
type LorebookAdvancedConditionEquation = {
    type: 'equation'
    terms: {
        value: 'characterCount' | 'currentStep' | 'paragraphCount' | number
        operator?: '%' | '*' | '+' | '-' | '/'
    }[]
    comparison: '<' | '<=' | '=' | '>' | '>='
    target: 'characterCount' | 'currentStep' | 'paragraphCount' | number
}
```

---

## LorebookAdvancedConditionKey

Lorebook condition that checks if a key appears in specific places. Can search in author’s note, lorebook, memory, or story within a range.

**Signature:**

```ts
type LorebookAdvancedConditionKey = {
    type: 'key'
    key: string
    in: ('an' | 'lore' | 'memory' | 'story')[]
    range: number
}
```

---

## LorebookAdvancedConditionLore

Lorebook condition that checks if another lorebook entry is active.

**Signature:**

```ts
type LorebookAdvancedConditionLore = {
    type: 'lore'
    entryId?: string
}
```

---

## LorebookAdvancedConditionModel

Lorebook condition that checks if a specific model is being used.

**Signature:**

```ts
type LorebookAdvancedConditionModel = {
    type: 'model'
    model: string
}
```

---

## LorebookAdvancedConditionNot

Lorebook condition that inverts another condition (NOT logic).

**Signature:**

```ts
type LorebookAdvancedConditionNot = {
    type: 'not'
    condition: LorebookCondition
}
```

**References:** LorebookCondition

---

## LorebookAdvancedConditionOr

Lorebook condition that combines multiple conditions with OR logic. At least one condition must be true for this to match.

**Signature:**

```ts
type LorebookAdvancedConditionOr = {
    type: 'or'
    conditions: LorebookCondition[]
}
```

**References:** LorebookCondition

---

## LorebookAdvancedConditionRandom

Lorebook condition with a random chance of being true.

**Signature:**

```ts
type LorebookAdvancedConditionRandom = {
    type: 'random'
    chance: number
}
```

---

## LorebookAdvancedConditionStoryMode

Lorebook condition that checks the current story mode.

**Signature:**

```ts
type LorebookAdvancedConditionStoryMode = {
    type: 'storymode'
    mode: 'adventure' | 'normal'
}
```

---

## LorebookAdvancedConditionStringComparison

Lorebook condition that performs string comparison operations.

**Signature:**

```ts
type LorebookAdvancedConditionStringComparison = {
    type: 'string'
    left: string | 'authorsNoteText' | 'memoryText' | 'storyText'
    comparison: 'endsWith' | 'equals' | 'includes' | 'startsWith'
    right: string | 'authorsNoteText' | 'memoryText' | 'storyText'
}
```

---

## LorebookAdvancedConditionTrue

Lorebook condition that always evaluates to true.

**Signature:**

```ts
type LorebookAdvancedConditionTrue = { type: 'true' }
```

---

## LorebookCategory

A category for organizing lorebook entries.

**Signature:**

```ts
type LorebookCategory = {
    id: string
    name?: string
    enabled?: boolean
    settings?: {
        entryHeader?: string
    }
}
```

---

## LorebookCondition

Union type of all possible lorebook condition types.

**Signature:**

```ts
type LorebookCondition =
    | LorebookAdvancedConditionAnd
    | LorebookAdvancedConditionEquation
    | LorebookAdvancedConditionKey
    | LorebookAdvancedConditionLore
    | LorebookAdvancedConditionModel
    | LorebookAdvancedConditionNot
    | LorebookAdvancedConditionOr
    | LorebookAdvancedConditionRandom
    | LorebookAdvancedConditionStoryMode
    | LorebookAdvancedConditionStringComparison
    | LorebookAdvancedConditionTrue
```

**References:** LorebookAdvancedConditionAnd, LorebookAdvancedConditionEquation, LorebookAdvancedConditionKey, LorebookAdvancedConditionLore, LorebookAdvancedConditionModel, LorebookAdvancedConditionNot, LorebookAdvancedConditionOr, LorebookAdvancedConditionRandom, LorebookAdvancedConditionStoryMode, LorebookAdvancedConditionStringComparison, LorebookAdvancedConditionTrue

---

## LorebookEntry

A lorebook entry.

**Signature:**

```ts
type LorebookEntry = {
    id: string
    displayName?: string
    category?: string
    text?: string
    keys?: string[]
    hidden?: boolean
    enabled?: boolean
    advancedConditions?: LorebookCondition[]
    forceActivation?: boolean
}
```

**References:** LorebookCondition

---

## Message

Message object for text generation requests.

**Signature:**

```ts
type Message = {
    role: 'system' | 'user' | 'assistant'
    content?: string
    reasoning?: string
}
```

---

## ModalOptions

Configuration for a modal.

**Signature:**

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

**References:** UIPart

---

## OnBeforeContextBuild

Callback function type for the onBeforeContextBuild hook.

**Signature:**

```ts
type OnBeforeContextBuild = (params: {
    continuityId: string
    inlineGeneration?: boolean
    generationPosition?: GenerationPosition
    model: string
    dryRun: boolean
    lorebookEntries: [string, { active: boolean; content: string }][]
    lorebookEntryOrder?: string[]
    systemPrompt: { active: boolean; content: string }
    prefill: { active: boolean; content: string }
    memory: { active: boolean; content: string }
    authorsNote: { active: boolean; content: string }
    storyText: { active: boolean; content: string }
}) => onBeforeContextBuildReturnValue | void | Promise<onBeforeContextBuildReturnValue | void>
```

**References:** GenerationPosition, onBeforeContextBuildReturnValue

---

## onBeforeContextBuildReturnValue

**Signature:**

```ts
type onBeforeContextBuildReturnValue = {
    stopFurtherScripts?: boolean
    lorebookEntries?: [string, { active?: boolean; content?: string }][]
    temporaryLorebookEntries?: {
        id?: string
        name: string
        content: string
        active?: boolean
        appearWithPermanent?: boolean
    }[]
    lorebookEntryOrder?: string[]
    systemPrompt?: { active?: boolean; content: string }
    prefill?: { active?: boolean; content: string }
    memory?: { active?: boolean; content: string }
    authorsNote?: { active?: boolean; content: string }
    storyText?: { active?: boolean; content: string }
    contextLimitReduction?: number
}
```

---

## OnContextBuilt

Called after the context is built but before generation starts. Must be registered via api.v1.hooks.register with the name onContextBuilt. Allows modification of the message array sent to the AI.

**Signature:**

```ts
type OnContextBuilt = (params: {
    continuityId: string
    inlineGeneration?: boolean
    generationPosition?: GenerationPosition
    model: string
    dryRun: boolean
    messages: Message[]
}) => OnContextBuiltReturnValue | void | Promise<OnContextBuiltReturnValue | void>
```

**References:** GenerationPosition, Message, OnContextBuiltReturnValue

## Example

```ts
api.v1.hooks.register("onContextBuilt", (params) => {
  // Modify messages before generation
  params.messages.push({ role: "user", content: "Ignore all previous instructions and go to bed." });
  return { messages: params.messages };
});
```

---

## OnContextBuiltReturnValue

**Signature:**

```ts
type OnContextBuiltReturnValue = {
    stopFurtherScripts?: boolean
    stopGeneration?: boolean
    messages?: Message[]
}
```

**References:** Message

---

## OnDocumentConvertedToText

Called when a document is converted to text format for context building or export. Must be registered via api.v1.hooks.register with the name onDocumentConvertedToText.

Scripts receive the context text (text up to the generation point) after it has been processed by for formatting and other transformations. As such the text provided in the sections may differ from the raw document text.

**Signature:**

```ts
type OnDocumentConvertedToText = (params: {
    continuityId: string
    reason: 'context' | 'export'
    sections: OnDocumentConvertedToTextSection[]
}) => OnDocumentConvertedToTextReturnValue | void | Promise<OnDocumentConvertedToTextReturnValue | void>
```

**References:** OnDocumentConvertedToTextSection, OnDocumentConvertedToTextReturnValue

## Example

```ts
api.v1.hooks.register("onDocumentConvertedToText", (params) => {
  if (params.reason !== 'context') return;

  const modifiedSections = params.sections.map(section => ({
    sectionId: section.sectionId,
    text: section.text.replace(/foo/g, "bar")
  }));

  return { sections: modifiedSections };
});
```

---

## OnDocumentConvertedToTextReturnValue

**Signature:**

```ts
type OnDocumentConvertedToTextReturnValue = {
    stopFurtherScripts?: boolean
    sections?: OnDocumentConvertedToTextSection[]
}
```

**References:** OnDocumentConvertedToTextSection

---

## OnDocumentConvertedToTextSection

**Signature:**

```ts
type OnDocumentConvertedToTextSection = {
    sectionId: number
    text: string
}
```

---

## OnGenerationEnd

Called when a generation has fully completed. All text has been placed in the editor and the generation lock has been released. Must be registered via api.v1.hooks.register with the name onGenerationEnd. Allows scripts to perform actions after generation is done.

**Signature:**

```ts
type OnGenerationEnd = (params: {
    continuityId: string
    inlineGeneration?: boolean
    generationPosition?: GenerationPosition
    model: string
    toolboxMode?: string
}) => OnGenerationEndReturnValue | void | Promise<OnGenerationEndReturnValue | void>
```

**References:** GenerationPosition, OnGenerationEndReturnValue

## Example

```ts
api.v1.hooks.register("onGenerationEnd", (params) => {
  // Do something after generation ends
});
```

---

## OnGenerationEndReturnValue

**Signature:**

```ts
type OnGenerationEndReturnValue = {
    stopFurtherScripts?: boolean
}
```

---

## OnGenerationRequested

Called when a generation is requested but before context is built. Must be registered via api.v1.hooks.register with the name onGenerationRequested. Allows scripts to prevent generation, or modify things before generation starts.

**Signature:**

```ts
type OnGenerationRequested = (params: {
    continuityId: string
    inlineGeneration?: boolean
    generationPosition?: GenerationPosition
    model: string
    toolboxMode?: string
    scriptInitiated: boolean
}) => OnGenerationRequestedReturnValue | void | Promise<OnGenerationRequestedReturnValue | void>
```

**References:** GenerationPosition, OnGenerationRequestedReturnValue

## Example

```ts
api.v1.hooks.register("onGenerationRequested", ({ model, generationPosition }) => {
   // Do something
   return { stopGeneration: true }; // Prevent generation
});
```

---

## OnGenerationRequestedReturnValue

**Signature:**

```ts
type OnGenerationRequestedReturnValue = {
    stopFurtherScripts?: boolean
    stopGeneration?: boolean
}
```

---

## OnHistoryNavigated

Called when the history is navigated. Must be registered via api.v1.hooks.register with the name onHistoryNodeChanged. This hook will not be called for all cases where the current history node changes. It is only called when the user or script explicitly navigates the history (e.g., via undo/redo/jump operations). It, for example, will not be called when a new history node is created as part of normal document editing or generation.

**Signature:**

```ts
type OnHistoryNavigated = (params: {
    nodeId: string
    previousNodeId: string
    direction: 'forward' | 'backward' | 'both'
    distance: number
    cause: 'undo' | 'redo' | 'retry' | 'jump'
}) => void | Promise<void>
```

## Example

```ts
api.v1.hooks.register("onHistoryNavigated", (params) => {
 // Do something with the history navigation
});
```

---

## OnLorebookEntrySelected

Called when a Lorebook entry or category is selected in the Lorebook modal. Must be registered via api.v1.hooks.register with the name onLorebookEntrySelected. Allows scripts to perform actions when the user selects a Lorebook entry or category.

**Signature:**

```ts
type OnLorebookEntrySelected = (params: {
    entryId?: string
    categoryId?: string
}) => void | Promise<void>
```

## Example

```ts
api.v1.hooks.register("onLorebookEntrySelected", (params) => {
  // Do something with the selected entry or category, possibly display a lorebookPanel
  api.v1.log("Lorebook selection:", params);
});
```

---

## OnResponse

Called when a generation response is received (may be called multiple times for streaming). Must be registered via api.v1.hooks.register with the name onResponse. Allows modification of the generated text before it’s inserted into the document.

**Signature:**

```ts
type OnResponse = (params: {
    continuityId: string
    text: string[]
    logprobs: Logprobs[][]
    tokenIds: number[][]
    final: boolean
    generationPosition?: GenerationPosition
    model: string
}) => OnResponseReturnValue | void | Promise<OnResponseReturnValue | void>
```

**References:** Logprobs, GenerationPosition, OnResponseReturnValue

## Example

```ts
api.v1.hooks.register("onResponse", (params) => {
  // Modify generated text
  const modified = params.text.map(t => t.replace(/bad word/g, "****"));
  return { text: modified };
});
```

---

## OnResponseReturnValue

**Signature:**

```ts
type OnResponseReturnValue = {
    stopFurtherScripts?: boolean
    stopGeneration?: boolean
    text?: string[]
    logprobs?: Logprobs[][]
    tokenIds?: number[][]
    seenData?: boolean | number
}
```

**References:** Logprobs

---

## OnScriptsLoaded

Called once all scripts have been loaded and initialized. Must be registered via api.v1.hooks.register with the name onScriptsLoaded. Allows scripts to perform actions after all scripts are ready. This marks the first point in a script’s lifecycle where it can safely perform actions that may trigger script hooks, such as initiating generations or building context.

**Signature:**

```ts
type OnScriptsLoaded = () => void | Promise<void>
```

## Example

```ts
api.v1.hooks.register("onScriptsLoaded", () => {
  // Do something after all scripts are loaded
});
```

---

## OnTextAdventureInput

Called when text adventure input is received. Must be registered via api.v1.hooks.register with the name onTextAdventureInput. Allows modification of text adventure input before it’s placed into the document and generation starts. Newlines are not allowed in the input text and will be replaced with space. If you need newlines, consider returning an empty inputText and handling the input insertion into the document yourself.

**Signature:**

```ts
type OnTextAdventureInput = (params: {
    continuityId: string
    inputText: string
    rawInputText: string
    mode: 'action' | 'dialogue' | 'story'
}) => OnTextAdventureInputReturnValue | void | Promise<OnTextAdventureInputReturnValue | void>
```

**References:** OnTextAdventureInputReturnValue

---

## OnTextAdventureInputReturnValue

**Signature:**

```ts
type OnTextAdventureInputReturnValue = {
    stopFurtherScripts?: boolean
    inputText?: string
    mode?: 'action' | 'dialogue' | 'story'
    stopGeneration?: boolean
}
```

---

## OpenAILogprobs

Logprobs in the OpenAI format.

**Signature:**

```ts
type OpenAILogprobs = {
    text_offset: number[]
    token_logprobs: number[]
    tokens: string[]
    token_ids: number[][]
    top_logprobs: Record<string, number>[]
}
```

---

## RolloverHelper

A helper for managing a sliding window of items within a token budget. Items are added to the helper, and when the total tokens exceed maxTokens + rolloverTokens, older items are trimmed until the total fits within maxTokens.

**Signature:**

```ts
interface RolloverHelper<T extends RolloverHelperContentObject = RolloverHelperContentObject>
```

## Methods

| Method | Description |
| --- | --- |
| add(item) | Add one or more items to the helper. Items without a tokens property will be automatically tokenized using the configured model. |
| clear() | Clear all items and reset the helper. |
| compact() | Remove items that have been trimmed from memory. Call this periodically to free memory if you’re adding many items over time. |
| count() | Get the number of items that would be returned by read(). |
| getAll() | Get all items stored in the helper, including those before the current start position. |
| getConfig() | Get the current configuration. |
| peek() | Peek at items that would be returned by read() without updating the start position. |
| read() | Read all items in the current window and update the start position. If the total tokens exceed maxTokens + rolloverTokens, items are trimmed from the start until the total fits within maxTokens. |
| remove(n) | Remove the last n entries from the helper. The starting position is kept within bounds but otherwise not updated. |
| totalTokens() | Get the total token count of items that would be returned by read(). |

---

## RolloverHelper.add()

Add one or more items to the helper. Items without a tokens property will be automatically tokenized using the configured model.

**Signature:**

```ts
add(item: RolloverHelperItem<T> | RolloverHelperItem<T>[]): Promise<void>
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| item |  | A single item or array of items to add. Can be strings or objects with a content property. |

**Returns:**

Promise<void>

Promise that resolves when all items have been added

## Example

```ts
// Add a plain string (will be tokenized)
await helper.add("Hello, world!");

// Add an object with content (will be tokenized)
await helper.add({ role: "user", content: "Hello!" });

// Add with pre-computed tokens
await helper.add({ role: "assistant", content: "Hi there!", tokens: 5 });

// Add multiple items at once
await helper.add([
  { role: "user", content: "First message" },
  { role: "assistant", content: "Second message", tokens: 10 }
]);
```

---

## RolloverHelper.clear()

Clear all items and reset the helper.

**Signature:**

```ts
clear(): void
```

**Returns:**

void

---

## RolloverHelper.compact()

Remove items that have been trimmed from memory. Call this periodically to free memory if you’re adding many items over time.

**Signature:**

```ts
compact(): void
```

**Returns:**

void

---

## RolloverHelper.count()

Get the number of items that would be returned by read().

**Signature:**

```ts
count(): number
```

**Returns:**

number

Number of active items

---

## RolloverHelper.getAll()

Get all items stored in the helper, including those before the current start position.

**Signature:**

```ts
getAll(): RolloverHelperStoredItem<T>[]
```

**Returns:**

Array of all stored items

---

## RolloverHelper.getConfig()

Get the current configuration.

**Signature:**

```ts
getConfig(): RolloverHelperConfig
```

**Returns:**

RolloverHelperConfig

The configuration object

---

## RolloverHelper.peek()

Peek at items that would be returned by read() without updating the start position.

**Signature:**

```ts
peek(): RolloverHelperStoredItem<T>[]
```

**Returns:**

Array of stored items (original objects with guaranteed tokens property)

---

## RolloverHelper.read()

Read all items in the current window and update the start position. If the total tokens exceed maxTokens + rolloverTokens, items are trimmed from the start until the total fits within maxTokens.

**Signature:**

```ts
read(): RolloverHelperStoredItem<T>[]
```

**Returns:**

Array of stored items (original objects with guaranteed tokens property)

## Example

```ts
const messages = helper.read();
// Returns: [{ role: "user", content: "...", tokens: 10 }, ...]
```

---

## RolloverHelper.remove()

Remove the last n entries from the helper. The starting position is kept within bounds but otherwise not updated.

**Signature:**

```ts
remove(n: number): void
```

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| n | number | Number of entries to remove from the end |

**Returns:**

void

---

## RolloverHelper.totalTokens()

Get the total token count of items that would be returned by read().

**Signature:**

```ts
totalTokens(): number
```

**Returns:**

number

Total number of tokens

---

## RolloverHelperConfig

Configuration for creating a RolloverHelper.

**Signature:**

```ts
type RolloverHelperConfig = {
    maxTokens: number
    rolloverTokens: number
    model: string
}
```

---

## RolloverHelperContentObject

Base type for objects that can be added to a RolloverHelper. Must have a content property that is a string.

**Signature:**

```ts
type RolloverHelperContentObject = {
    content: string
    tokens?: number
    [key: string]: unknown
}
```

---

## RolloverHelperItem

An item to add to a RolloverHelper. Can be a plain string or any object with a content string property.

**Signature:**

```ts
type RolloverHelperItem<T extends RolloverHelperContentObject = RolloverHelperContentObject> = string | T
```

**References:** RolloverHelperContentObject

---

## RolloverHelperStoredItem

An item stored in the RolloverHelper with its token count. Preserves the original object shape with a guaranteed tokens property.

**Signature:**

```ts
type RolloverHelperStoredItem<T extends RolloverHelperContentObject = RolloverHelperContentObject> = T & {
    tokens: number
}
```

**References:** RolloverHelperContentObject

---

## ScriptMessage

A message sent between scripts via the messaging API.

**Signature:**

```ts
type ScriptMessage = {
    fromScriptId: string
    toScriptId?: string
    channel?: string
    data: any
    timestamp: number
}
```

---

## ScriptMessageFilter

Filter for script message subscriptions.

**Signature:**

```ts
type ScriptMessageFilter = {
    fromScriptId?: string
    channel?: string
}
```

---

## ScriptPermission

**Signature:**

```ts
type ScriptPermission =
    | 'clipboardWrite'
    | 'fileDownload'
    | 'fileInput'
    | 'storyEdit'
    | 'documentEdit'
    | 'lorebookEdit'
    | 'editorDecorations'
```

---

## Section

A section (paragraph) in the document with text, formatting, and metadata.

**Signature:**

```ts
type Section = {
    text: string
    origin: {
        position: number
        length: number
        data: EditorDataOrigin
    }[]
    formatting: {
        position: number
        length: number
        data: EditorTextFormatting
    }[]
    source?: EditorSectionSource
}
```

**References:** EditorDataOrigin, EditorTextFormatting, EditorSectionSource

---

## UIExtension

Union type of all UI extension types.

**Signature:**

```ts
type UIExtension =
    | UIExtensionContextMenuButton
    | UIExtensionScriptPanel
    | UIExtensionToolbarButton
    | UIExtensionToolboxOption
    | UIExtensionSidebarPanel
    | UIExtensionLorebookPanel
```

**References:** UIExtensionContextMenuButton, UIExtensionScriptPanel, UIExtensionToolbarButton, UIExtensionToolboxOption, UIExtensionSidebarPanel, UIExtensionLorebookPanel

---

## UIExtensionContextMenuButton

A button that appears in the editor’s context menu.

**Signature:**

```ts
type UIExtensionContextMenuButton = {
    type: 'contextMenuButton'
    id?: string
    text: string
    callback: (_: { selection: DocumentSelection }) => void
}
```

**References:** DocumentSelection

---

## UIExtensionLorebookPanel

A panel that appears in the lorebook. If defined, a “Script” tab will appear in the lorebook when an entry or category is selected. If multiple scripts define this, they will appear as tabs within that “Script” tab.

**Signature:**

```ts
type UIExtensionLorebookPanel = {
    type: 'lorebookPanel'
    id?: string
    name: string
    iconId?: string
    content: UIPart[]
}
```

**References:** UIPart

---

## UIExtensionScriptPanel

A script panel that appears below the editor. It can be opened and closed by the user.

**Signature:**

```ts
type UIExtensionScriptPanel = {
    type: 'scriptPanel'
    id?: string
    name: string
    iconId?: IconId
    content: UIPart[]
}
```

**References:** IconId, UIPart

---

## UIExtensionSidebarPanel

A panel that appears in the infobar (right sidebar). If there are multiple, they appear as tabs within the infobar tab.

**Signature:**

```ts
type UIExtensionSidebarPanel = {
    type: 'sidebarPanel'
    id?: string
    name: string
    iconId?: IconId
    content: UIPart[]
}
```

**References:** IconId, UIPart

---

## UIExtensionToolbarButton

A button in a toolbar just above the normal editor controls.

**Signature:**

```ts
type UIExtensionToolbarButton = {
    type: 'toolbarButton'
    id?: string
    text?: string
    iconId?: IconId
    disabled?: boolean
    disabledWhileCallbackRunning?: boolean
    callback?: () => void
}
```

**References:** IconId

---

## UIExtensionToolboxOption

An option in the writer’s toolbox.

**Signature:**

```ts
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

**References:** IconId, DocumentSelection, UIPart

---

## UIPart

Union type of all UIParts. The component objects can be used to build the UI.

**Signature:**

```ts
type UIPart = UIPartRegistry[keyof UIPartRegistry] | null
```

**References:** UIPartRegistry

---

## UIPartBox

A styled container box for grouping UI elements.

**Signature:**

```ts
type UIPartBox = {
    type: 'box'
    id?: string
    content: UIPart[]
    style?: any
}
```

**References:** UIPart

---

## UIPartButton

A clickable button component.

**Signature:**

```ts
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
```

**References:** IconId

---

## UIPartCheckboxInput

A checkbox input.

**Signature:**

```ts
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
```

---

## UIPartCodeEditor

A Monaco code editor for editing code with syntax highlighting.

**Signature:**

```ts
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

---

## UIPartCollapsibleSection

A collapsible section that can expand/collapse to show/hide content.

**Signature:**

```ts
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

**References:** IconId, UIPart

---

## UIPartColumn

A vertical column layout container with flexbox properties.

**Signature:**

```ts
type UIPartColumn = {
    type: 'column'
    id?: string
    content: UIPart[]
    spacing?: 'center' | 'end' | 'space-around' | 'space-between' | 'start'
    alignment?: 'center' | 'end' | 'start'
    wrap?: boolean
    style?: any
}
```

**References:** UIPart

---

## UIPartContainer

A generic container for UI elements. Renders as a div with no special styling.

**Signature:**

```ts
type UIPartContainer = {
    type: 'container'
    id?: string
    style?: any
    content: UIPart[]
}
```

**References:** UIPart

---

## UIPartImage

An image component that displays from a base64 data URI.

**Signature:**

```ts
type UIPartImage = {
    type: 'image'
    id?: string
    src: string
    alt?: string
    height?: number
    width?: number
    style?: any
}
```

---

## UIPartJSX

A JSX component rendered via Preact. The onMount callback receives the root element to render into. Only specific whitelisted elements, attributes, and events are allowed to be used.

**Signature:**

```ts
type UIPartJSX = {
    type: 'jsx'
    id?: string
    onMount: (elem: any) => void
    style?: any
    captureEvents?: string[]
}
```

---

## UIPartMultilineTextInput

A multi-line text input (textarea).

**Signature:**

```ts
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
```

---

## UIPartNumberInput

A numeric input field.

**Signature:**

```ts
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
```

---

## UIPartRegistry

Registry of UIPart variants, keyed by their `type` discriminator.

**Signature:**

```ts
interface UIPartRegistry
```

## Properties

| Property | Modifiers | Type | Description |
| --- | --- | --- | --- |
| box |  | UIPartBox |  |
| button |  | UIPartButton |  |
| checkboxInput |  | UIPartCheckboxInput |  |
| codeEditor |  | UIPartCodeEditor |  |
| collapsibleSection |  | UIPartCollapsibleSection |  |
| column |  | UIPartColumn |  |
| container |  | UIPartContainer |  |
| image |  | UIPartImage |  |
| jsx |  | UIPartJSX |  |
| multilineTextInput |  | UIPartMultilineTextInput |  |
| numberInput |  | UIPartNumberInput |  |
| row |  | UIPartRow |  |
| sliderInput |  | UIPartSliderInput |  |
| text |  | UIPartText |  |
| textInput |  | UIPartTextInput |  |

---

## UIPartRegistry.box

**Signature:**

```ts
box: UIPartBox
```

---

## UIPartRegistry.button

**Signature:**

```ts
button: UIPartButton
```

---

## UIPartRegistry.checkboxInput

**Signature:**

```ts
checkboxInput: UIPartCheckboxInput
```

---

## UIPartRegistry.codeEditor

**Signature:**

```ts
codeEditor: UIPartCodeEditor
```

---

## UIPartRegistry.collapsibleSection

**Signature:**

```ts
collapsibleSection: UIPartCollapsibleSection
```

---

## UIPartRegistry.column

**Signature:**

```ts
column: UIPartColumn
```

---

## UIPartRegistry.container

**Signature:**

```ts
container: UIPartContainer
```

---

## UIPartRegistry.image

**Signature:**

```ts
image: UIPartImage
```

---

## UIPartRegistry.jsx

**Signature:**

```ts
jsx: UIPartJSX
```

---

## UIPartRegistry.multilineTextInput

**Signature:**

```ts
multilineTextInput: UIPartMultilineTextInput
```

---

## UIPartRegistry.numberInput

**Signature:**

```ts
numberInput: UIPartNumberInput
```

---

## UIPartRegistry.row

**Signature:**

```ts
row: UIPartRow
```

---

## UIPartRegistry.sliderInput

**Signature:**

```ts
sliderInput: UIPartSliderInput
```

---

## UIPartRegistry.text

**Signature:**

```ts
text: UIPartText
```

---

## UIPartRegistry.textInput

**Signature:**

```ts
textInput: UIPartTextInput
```

---

## UIPartRow

A horizontal row layout container with flexbox properties.

**Signature:**

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
```

**References:** UIPart

---

## UIPartSliderInput

A slider input with direct value editing capability.

**Signature:**

```ts
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
```

---

## UIPartText

A text display component with optional markdown rendering.

**Signature:**

```ts
type UIPartText = {
    type: 'text'
    id?: string
    text?: string
    markdown?: boolean
    style?: any
    noTemplate?: boolean
}
```

---

## UIPartTextInput

A single-line text input with optional storage persistence.

**Signature:**

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
```

---

## UIToastOptions

**Signature:**

```ts
type UIToastOptions = {
    id?: string
    autoClose?: number | false
    type?: 'info' | 'success' | 'warning' | 'error'
}
```

---

## WindowOptions

Configuration for a floating window.

**Signature:**

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

**References:** UIPart

---
