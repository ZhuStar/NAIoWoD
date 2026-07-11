# Hooks

> Transcribed from `docs/hooks.html` (the mirrored NovelAI scripting docs).

Hooks allow your scripts to respond to events in the generation pipeline, enabling
you to modify context, alter responses, and control generation behavior. All the
hooks receive their parameters as a single object.

Hooks are registered by calling `api.v1.hooks.register` with the name of the hook
and a callback function. The callback function will be called whenever the
corresponding event occurs. You can only have a single callback per hook per
script. If you register a hook that already exists for the script, it will replace
the existing one.

## Available Hooks

### onGenerationRequested

The first hook that triggers when a user generates text. The generation has not
yet happened and context has not yet been built. This hook could be used to
prevent generation and take full control over the generation flow, or to prepare
things for later hooks. Changes to generation settings at this time will affect
the generation that's about to happen.

### onBeforeContextBuild

Happens just before context is built. This may be as part of a generation but
doesn't have to be — context is also built under other circumstances, such as the
context viewer being opened. Look at the `dryRun` parameter to determine if this
is a context that will be used for generation or not. It provides an opportunity
to temporarily modify or disable context objects like Lorebook entries, Memory,
etc. for the context build.

### onContextBuilt

Happens whenever context is built (again, not only during generation — check
`dryRun`). You can return a modified array of messages to alter the context that
will be used for the generation.

Note: This hook will only happen when generating with models that use the
OpenAI-like completions endpoint.

### onResponse

Happens when response data is received for a generation request. You can return
modified text to alter what will be placed in the editor. You can also provide
altered token ids and logprobs if you want to maintain the functionality of editor
logprobs.

The text, logprobs, and tokenIds are provided as arrays. The index of an item in
the text array corresponds to the items with the same index in the other arrays.

If streaming is enabled there will be multiple onResponse calls for each
generation. When writing scripts it's recommended that you always treat it as if
streaming is enabled. The final onResponse will have the `final` param set to
true. It is possible that no `final` response will ever be sent, such as if the
generation errors.

If you want to hold part or all of a response from being sent up the chain and
placed into the editor, you can set `seenData` on the return object. If set to a
number, only that number of text/logprobs/tokenIds will be considered "seen" and
others will be resent on the next onResponse call. If `final` is true the response
will be sent up the chain regardless of the value of `seenData`.

Note: This hook will only happen when generating with models that use the
OpenAI-like completions endpoint.

### onGenerationEnd

Triggers after a generation has successfully completed or been cancelled. When
this hook is called, the generation is fully finished, the editor is unlocked, and
generation is no longer blocked.

### onScriptsLoaded

Triggers once after all scripts have been loaded and initialized. This is a good
place to perform any setup that would fail if done at the top level of the script,
such as calling `buildContext`.

### onLorebookEntrySelected

Triggers whenever a Lorebook entry or category is selected in the Lorebook. The
hook is provided the id of the selected entry or category. The primary use is to
allow scripts to modify `lorebookPanel` UIExtensions based on the selection.

### onTextAdventureInput

Triggers whenever input is submitted via the Text Adventure input box. You can
return modified text to alter what will be placed in the editor (including an empty
string to prevent any text from being added) and prevent generation by setting
`stopGeneration` to true.

### onHistoryNavigated

Triggers whenever the user or a script navigates the document history through
undo/redo/retry/jump-to-history-node. This hook can be used to keep track of when
state should be reverted or updated based on history changes.

### onDocumentConvertedToText

Triggers whenever a document is converted to text format. This is generally for
the purposes of generation context building. You can return modified sections to
alter the text that will be used for context. The `reason` parameter indicates why
the document is being converted, such as for 'context' building.

## Hook Execution Order

Scripts execute their hooks in the same order as they are listed in the User
Scripts modal. All account scripts are executed in order, then all story scripts.

## Controlling Hook Propagation

### stopFurtherScripts

You can set `stopFurtherScripts` to true to prevent a hook from being called for
any scripts after this one.

### stopGeneration

For `onGenerationRequested`, `onContextBuilt`, and `onResponse` you can set
`stopGeneration` to true to immediately prevent or cancel a generation. It will be
immediately halted and no further hooks will trigger for any script.

## See Also

- [Generation API](./generation-api.md) — triggering generation programmatically
- [API Reference](./api-reference.md) — complete API documentation
