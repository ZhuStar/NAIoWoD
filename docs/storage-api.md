# Storage API

> Transcribed from `docs/storage-api.html` (the mirrored NovelAI scripting docs).

The Storage API provides persistent data storage for scripts at both the story and
account level. Each script gets its own storage separate from other scripts. Data
is stored as key-value pairs.

## Overview

There are four different storage APIs for scripts: `api.v1.storage`,
`api.v1.storyStorage`, `api.v1.historyStorage`, and `api.v1.tempStorage`.

- **`api.v1.storage`** is the standard storage for scripts. It stores data with the
  script, so where data lives depends on whether the script is an account or story
  script. Account scripts may store only a limited amount of data (currently 4 MB)
  per script in regular storage, because account scripts must be loaded on login.
- **`api.v1.storyStorage`** always stores data in the current story regardless of
  script type. For story scripts this is separate from its `api.v1.storage`.
- **`api.v1.historyStorage`** functions like storyStorage (always stored in the
  current story) but is also aware of the document history. When a value is set,
  it's set at a specific point in the document history; if the document is undone
  to before that history node, the value reverts to its previous value.
- **`api.v1.tempStorage`** is temporary storage that persists only for the current
  session and is cleared when the story is closed. Use this for displaying
  temporary UI state via storage keys in UI Parts.

## Basic Operations

All the storage APIs share the same basic structure. They have `set`, `get`,
`remove`, and `list` functions. `set` writes values to storage, `get` retrieves
them, and `remove` deletes them. `list` returns an array of all currently set
keys.

## History-Aware Storage

History storage is unique because it's tied to specific points in the document
history tree. When you undo or redo, values revert to their state at that point in
history.

### Basic Usage

```ts
// Set a value at the current history point
await api.v1.historyStorage.set('character-state', {
  health: 100,
  location: 'town'
});

// Get the value
let state = await api.v1.historyStorage.get('character-state');
```

### History-Aware Behavior

When the document history changes, history storage values automatically update:

```ts
// At history point A
await api.v1.historyStorage.set('turn-count', 1);

// User generates some text, moving to point B
await api.v1.historyStorage.set('turn-count', 2);

// User generates more text, moving to point C
await api.v1.historyStorage.set('turn-count', 3);

let count = await api.v1.historyStorage.get('turn-count'); // Returns 3

// User undoes back to point B
// Now get returns 2 automatically!
count = await api.v1.historyStorage.get('turn-count'); // Returns 2

// User undoes back to point A
count = await api.v1.historyStorage.get('turn-count'); // Returns 1
```

### Limitations

History-aware storage has some limitations. Notably, it can only handle cases
where undo/redo are used. If the user manually edits the document to delete
content, history storage will not automatically revert values. Additionally,
history storage only marks history points when a generation occurs — edits to the
document without generation will not create new history points for storage.

## Temporary Storage

Temporary storage is useful for displaying data in the UI using storageKeys in UI
Parts. Unlike other storage types, temporary storage does not cause anything to be
saved to disk or remotely.

### Using Temporary Storage Together With UI Parts

```ts
// Set a temporary value
await api.v1.tempStorage.set('example-string', 'Alice gives meaning to character strings that are devoid of meaning.');
// Register a UI Part that displays the temporary value
await api.v1.ui.register([
  {
    type: 'scriptPanel',
    name: 'Temporary Storage Example',
    content: [
      {
        type: 'text',
        text: '{{temp:example-string}}'
      }
    ]
  }
]);
// We can update the temporary storage value later and the UI will reflect the change.
// This saves no data permanently and re-renders the minimum amount of the UI.
await api.v1.tempStorage.set('example-string', 'Bob considers character strings to be meaningless without context.');
```

## Data Types

Stored data is immediately serialized as JSON, so anything not serializable will
be lost or altered. For more information see the
[JSON.stringify description](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#description)
from the MDN Web Docs.

## See Also

- [UI Parts](./ui-parts.md) — using `storageKey` in UI components
- [API Reference](./api-reference.md) — complete API documentation
