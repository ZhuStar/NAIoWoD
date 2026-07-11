# Lorebook API

> Transcribed from `docs/lorebook-api.html` (the mirrored NovelAI scripting docs).

The Lorebook API provides methods for programmatically managing Lorebook entries
and categories. Scripts can create, read, update, and delete Lorebook content.
Methods that create, modify, or delete Lorebook entries and categories require the
script to have the `lorebookEdit` permission.

## Lorebook Structure

### Entries

Lorebook entries contain information that can be inserted into generation context
when their activation keys are matched. Each entry has various settings that control
when and how it activates.

Lorebook entries are identified by a unique ID. This ID can be set freely by
scripts, but it's recommended to use `api.v1.uuid()` to generate unique IDs. If you
attempt to create two entries with the same ID an error will be thrown.

### Categories

Categories are organizational containers for entries. They're used to group related
entries together for easier browsing in the Lorebook UI.

Categories are also identified by unique IDs, which can be set freely by scripts. As
with entries, it's recommended to use `api.v1.uuid()`. If you attempt to create two
categories with the same ID an error will be thrown.

## Reading Lorebook Content

### Getting All Entries

```ts
let allEntries = await api.v1.lorebook.entries();
for (let entry of allEntries) {
  api.v1.log(`Entry: ${entry.displayName}`);
}
```

### Getting a Specific Entry

```ts
let entry = await api.v1.lorebook.entry('entry-id-here');
if (entry) {
  api.v1.log(`Found entry: ${entry.displayName}`);
}
```

### Getting All Categories

```ts
let allCategories = await api.v1.lorebook.categories();
for (let category of allCategories) {
  api.v1.log(`Category: ${category.name}`);
}
```

### Getting a Specific Category

```ts
let category = await api.v1.lorebook.category('category-id-here');
if (category) {
  api.v1.log(`Found category: ${category.name}`);
}
```

## Creating Lorebook Content

### Creating an Entry

To create a new Lorebook entry, use `api.v1.lorebook.createEntry`. If no ID is
provided, one will be generated automatically:

```ts
let entryId = await api.v1.lorebook.createEntry({
  text: 'Galena, the Witch of the Tower. Galena\'s eyes are obscured by a translucent ribbon...',
  displayName: 'Galena, the Witch of the Tower',
  keys: ['Galena', 'witch', 'ribbon', 'tower'],
  enabled: true
});
api.v1.log(`Created entry with ID: ${entryId}`);
```

### Creating a Category

To create a new Lorebook category, use `api.v1.lorebook.createCategory`. If no ID is
provided, one will be generated automatically:

```ts
let newCategory = await api.v1.lorebook.createCategory({
  name: 'Locations',
  enabled: true
});
api.v1.log(`Created category with ID: ${newCategory.id}`);
```

## Updating Lorebook Content

### Updating an Entry

```ts
await api.v1.lorebook.updateEntry('entry-id-here', {
  text: 'Galena, the Retired Witch of the Tower. Galena now...',
  enabled: false
});
```

Only the fields you provide will be updated; other fields remain unchanged.

### Updating a Category

```ts
await api.v1.lorebook.updateCategory('category-id-here', {
  name: 'World Locations',
  enabled: false
});
```

## Deleting Lorebook Content

### Deleting an Entry

```ts
await api.v1.lorebook.removeEntry('entry-id-here');
```

### Deleting a Category

```ts
await api.v1.lorebook.removeCategory('category-id-here');
```

Note that deleting a category does not delete its entries; they become
uncategorized.

## Working with Entry Selection

Scripts can respond to Lorebook entry selection through the
`onLorebookEntrySelected` hook. This is useful for displaying entry-specific UI or
performing actions when users navigate the Lorebook:

```ts
api.v1.hooks.register('onLorebookEntrySelected', async ({ entryId, categoryId }) => {
  if (entryId) {
    let entry = await api.v1.lorebook.entry(entryId);
    api.v1.log(`Selected entry: ${entry?.displayName}`);
  } else if (categoryId) {
    let category = await api.v1.lorebook.category(categoryId);
    api.v1.log(`Selected category: ${category?.name}`);
  }
});
```

## See Also

- [Hooks](./hooks.md) — responding to Lorebook selection events
- [UI Extensions](./ui-extensions.md) — creating Lorebook panel UI
- [API Reference](./api-reference.md) — complete API documentation
