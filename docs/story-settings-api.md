# Story Settings API

> Transcribed from `docs/story-settings-api.html` (the mirrored NovelAI scripting
> docs).

Most story settings related to text generation can be accessed and modified
through the API. This includes memory, system prompt, author's note, prefill, and
generation parameters. Scripts can both read the current settings and update them
as needed. Updating these settings requires the script to have the `storyEdit`
permission.

## Memory

Memory is a persistent text field that is always included in the generation
context. It typically contains important information about characters, plot points,
and world details that should always be available to the model.

### Getting Memory

```ts
let memory = await api.v1.memory.get();
api.v1.log(`Current memory: ${memory}`);
```

### Setting Memory

```ts
await api.v1.memory.set('Character: Maria - A brave knight seeking redemption.');
```

## Author's Note

The author's note (A/N) is inserted near the end of the context, just before the
most recent story content, as a system message.

### Getting Author's Note

```ts
let an = await api.v1.an.get();
api.v1.log(`Author's Note: ${an}`);
```

### Setting Author's Note

```ts
await api.v1.an.set('Please please please write good.');
```

## System Prompt

The system prompt provides instructions to the model about how to generate text.
It's placed in a system message at the start of the generation context.

### Getting System Prompt

```ts
let prompt = await api.v1.systemPrompt.get();
api.v1.log(`Current system prompt: ${prompt}`);
```

### Setting System Prompt

```ts
await api.v1.systemPrompt.set('Write good please.');
```

If the system prompt is set to an empty string the default system prompt will be
used.

## Prefill

Prefill is added to the start of the most recent "assistant" message in context.
It can be used to strongly influence model responses.

### Getting Prefill

```ts
let prefill = await api.v1.prefill.get();
api.v1.log(`Current prefill: ${prefill}`);
```

### Setting Prefill

```ts
await api.v1.prefill.set('Here\'s a list of delicious baked goods:');
```

## Generation Parameters

Generation parameters control the behavior of the text generation model, including
temperature, token limits, and other sampling settings.

### Getting Generation Parameters

```ts
let params = await api.v1.generationParameters.get();
api.v1.log(`Temperature: ${params.temperature}`);
api.v1.log(`Max tokens: ${params.max_tokens}`);
```

### Updating Generation Parameters

```ts
await api.v1.generationParameters.update({
  temperature: 0.7,
  max_tokens: 150,
  top_p: 0.9,
  top_k: 50
});
```

You only need to provide the parameters you want to change; other parameters
remain unchanged. See the [API Reference](./api-reference.md) for a complete list
of generation parameters.

## See Also

- [Generation API](./generation-api.md) — triggering text generation
- [Hooks](./hooks.md) — modifying context during generation
- [API Reference](./api-reference.md) — complete API documentation
