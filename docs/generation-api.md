# Generation API

> Transcribed from `docs/generation-api.html` (the mirrored NovelAI scripting
> docs).

Scripts can generate text to use for whatever purpose they need. This is done
through the `api.v1.generate` function. Currently generation is only supported with
models that use the OpenAI-like completions endpoint.

## Text Generation

### Basic Generation

To generate text, call `api.v1.generate` with an array of messages that form the
prompt. Each message should be an object with a `role` property (either "user",
"assistant", or "system") and a `content` property containing the text of the
message.

The parameters object can also include generation settings such as `model`,
`temperature`, `max_tokens`, and others. `model` is required and must be set to a
valid model ID.

```ts
let response = await api.v1.generate(
  [
    { role: 'system', content: 'You are a not-very-helpful assistant.' },
    { role: 'user', content: 'Where am I?' }
  ],
  {
    model: 'glm-4-6',
  }
);
api.v1.log('Generated text: ' + response.choices[0].text);
```

### Generation Parameters

The list of available generation parameters includes:

- `model` (string, required)
- `temperature` (number)
- `max_tokens` (number)
- `top_p` (number)
- `top_k` (number)
- `frequency_penalty` (number)
- `presence_penalty` (number)
- `stop` (array of strings)

### Streaming Generation

All requests to `api.v1.generate` stream the response by default. These streamed
values can be accessed by providing a callback function as the third parameter to
`api.v1.generate`. This callback will be called multiple times as new data is
received from the generation endpoint.

```ts
await api.v1.generate(
  [
    { role: 'user', content: 'aaaa, nslx, bjal, abcd, or izti?' }
  ],
  {
    model: 'glm-4-6',
  },
  (choices, final) => {
    for (let choice of choices) {
      api.v1.log('Received text chunk: ' + choice.text);
    }
    if (final) {
      api.v1.log('Generation complete.');
    }
  }
);
```

### Blocking and Background Generation

By default, calls to `api.v1.generate` are considered 'blocking' and will prevent
interaction with the editor and user-initiated generation until the generation is
complete. To allow user interaction during generation, set the fourth parameter,
`behaviour`, to `'background'`.

### Generation Limits

Scripts have several limits on how frequently and how much they can generate. These
limits are shown in the script diagnostics tab in the UI for debugging purposes.

#### Output Token Limits

Scripts are only able to generate a certain number of output tokens over a period
of time. The current limit is 2048 output tokens every 4 minutes. This limit is per
script. When you generate text, the number of output tokens generated is deducted
from your available tokens and placed in a "bucket". The tokens in that bucket are
added back to your available tokens once two conditions are met:

1. 4 minutes have passed since the generation that used those tokens.
2. The user has interacted with UI created by the script or generated in the editor
   manually.

#### Input Token Limits

Scripts also have a limit on input tokens. The current limit is double the maximum
allowed context size for the model and current subscription tier every 6 minutes.
Input tokens are counted from the prompt messages you provide to `api.v1.generate`.
Only new input tokens that haven't been used in previous generations are counted
against your limit. Building your context in a way that's likely to reuse previous
input tokens will help you stay within your limits.

Like output tokens, input tokens are placed in a bucket when used and returned to
your available tokens after 6 minutes and user interaction.

Tokens are counted as cached when they match the start of the prompt for a previous
generation. If you provide a prompt that starts with the same tokens as a previous
generation, those tokens will not count against your input token limit. Tokens are
only measured against the cache to a resolution of 64 tokens. A very common way to
ensure caching is to implement "rollover" logic: keep the context deliberately
below the upper limit and only add new messages until you reach the limit, at which
point you remove the oldest messages to make room. This way the start of your prompt
will match previous generations as much as possible. A helper object for
implementing rollover logic can be created using `api.v1.createRolloverHelper`. An
example of its usage follows, though its specific use will depend heavily on your
use case.

```ts
/**
 * Simple Chat Window - Rollover Helper Example
 * This script creates a simple chat window that uses a rollover helper to manage context size.
 */

const MODEL = "glm-4-6";
const MAX_TOKENS = 2000;
const ROLLOVER_TOKENS = 500;

const SYSTEM_MESSAGE: Message = {
    role: "system",
    content: "You are a helpful assistant. Keep responses brief."
};

type ChatMessage = {
    role: "user" | "assistant";
    content: string;
};

const rollover = api.v1.createRolloverHelper<ChatMessage>({
    maxTokens: MAX_TOKENS,
    rolloverTokens: ROLLOVER_TOKENS,
    model: MODEL
});

async function sendMessage(userInput: string) {
    if (!userInput.trim()) return;

    await rollover.add({ role: "user", content: userInput });
    updateDisplay();

    const messages: Message[] = [SYSTEM_MESSAGE, ...rollover.read()];

    const response = await api.v1.generate(messages, {
        model: MODEL,
        max_tokens: 200,
        temperature: 0.7
    });

    const assistantContent = response.choices[0]?.text ?? "(no response)";
    await rollover.add({ role: "assistant", content: assistantContent });
    updateDisplay();
}

function updateDisplay() {
    const history = rollover.read();
    const chatText = history
        .map(m => `**${m.role}:** ${m.content}`)
        .join("\n\n");

    win.update({
        content: [
            { type: "text", id: "chat", markdown: true, text: chatText || "*No messages yet*" },
            {
                type: "textInput",
                id: "input",
                placeholder: "Type a message...",
                onSubmit: sendMessage
            },
            {
                type: "text",
                id: "status",
                text: `${rollover.count()} messages, ~${rollover.totalTokens()} tokens`,
                style: { opacity: 0.6, fontSize: "0.85em" }
            }
        ]
    });
}

const win = await api.v1.ui.window.open({
    title: "Chat (Rollover Demo)",
    defaultWidth: 400,
    defaultHeight: 300,
    resizable: true,
    content: []
});

updateDisplay();
```

#### Utility Functions

`api.v1.script.getAllowedOutput` and `api.v1.script.getAllowedInput` can be used to
determine how many tokens are currently available for generation.

`api.v1.script.getTimeUntilAllowedOutput` and
`api.v1.script.getTimeUntilAllowedInput` can be used to determine how long until the
script will have available tokens again.

`api.v1.script.waitForAllowedOutput` and `api.v1.script.waitForAllowedInput` can be
used to get a promise that resolves when tokens are available again.

`countUncachedInputTokens` can be used to determine how many input tokens in a given
prompt would count against your input token limit, taking caching into account.

## Editor Generate

Scripts can also trigger text generation directly into the editor using the
`api.v1.editor.generate` function. This functions as if the user had clicked the
"Send" button in the editor, generating text based on the current document content
and appending the result to the document.

Only three editor generation calls are allowed without user interaction in between.
After three generations, further calls to `api.v1.editor.generate` will be rejected
until the user generates manually or interacts with UI created by the script.

## See Also

- [Hooks](./hooks.md) — responding to user generation events
- [Context Building API](./context-building-api.md) — getting a built context of the document
- [Story Settings API](./story-settings-api.md) — configuring generation parameters
- [API Reference](./api-reference.md) — complete API documentation
