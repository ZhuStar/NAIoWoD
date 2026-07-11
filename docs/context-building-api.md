# Context Building

> Transcribed from `docs/context-building-api.html` (the mirrored NovelAI
> scripting docs).

The `buildContext` method allows scripts to generate the same kind of context
that would be used for a standard editor generation. If you just want a quick and
easy way to mimic the normal generation logic, this is the API to use.

## What Does "Context" Mean?

Context is the string of text that gets sent to the language model during
generation. It's built based on the current document content, story settings, and
lorebook entries.

## Basic Usage

To build context for the current document state, use the `api.v1.buildContext`
function:

```ts
let context = await api.v1.buildContext();

for (let message of context) {
  api.v1.log(`Role: ${message.role}`);
  api.v1.log(`Content: ${message.content}`);
}
```

The context is returned as an array of message objects, where each message has a
`role` (such as "user", "assistant", or "system") and `content` (the text of the
message). The same format is used for generating with `api.v1.generate`.

## Unsafe Usage

The `buildContext` function should not be called during the initialization of
scripts, as it triggers the `onContextBuilt` hook which other scripts will not yet
be able to respond to. Instead, use the `onScriptsLoaded` hook to ensure all
scripts are initialized before building context.

Example:

```ts
api.v1.hooks.register('onScriptsLoaded', async () => {
  let context = await api.v1.buildContext();
  api.v1.log(`Context has ${context.length} messages`);
});
```

## See Also

- [Hooks](./hooks.md) — modifying context during generation
- [Generation API](./generation-api.md) — triggering text generation
- [API Reference](./api-reference.md) — complete API documentation
