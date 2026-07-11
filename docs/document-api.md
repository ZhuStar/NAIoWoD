# Document API

> Transcribed from `docs/document-api.html` (the mirrored NovelAI scripting docs).

The Document API provides methods for reading and manipulating the story document.
Any methods that modify the document require the script to have the `documentEdit`
permission.

## Understanding Document Structure

### Sections

The document is divided into sections, which represent paragraphs. The only current
section type is "text", but future updates may add more types. The terms "section"
and "paragraph" are used interchangeably.

Sections have the following structure:

```ts
{
  text: string
  origin: { position: number; length: number; data: string }[]
  formatting: { position: number; length: number; data: string }[]
  source: string | undefined
}
```

The `text` property contains the raw text of the section. The `origin` and
`formatting` properties contain arrays of objects that describe the origin and
formatting of different parts of the section's text. The `source` property defines
the type of paragraph it is — used for special sections like text adventure inputs
and instructions.

### Selections

Document selections represent a range of text within the document. They are an
object that looks like this:

```ts
{
  from: { sectionId: number; offset: number }
  to: { sectionId: number; offset: number }
  anchor: { sectionId: number; offset: number }
  head: { sectionId: number; offset: number }
}
```

The `from` and `to` properties represent the start and end of the selection, while
`anchor` and `head` represent the fixed and moving ends of the selection
respectively. For most purposes you'll only need to use `from` and `to`.

The `sectionId` represents the numeric ID of the section in the document, and
`offset` represents the character offset within that section.

## Reading Document Content

### Getting Text

To read the text content of the document, use the `api.v1.document.scan` function.
This function accepts a callback that will be called for each section in the
document. The callback is provided the section object, its ID, and the index of the
section in the document. The function also returns a promise that resolves to an
array of all sections in the document.

```ts
let allSections = await api.v1.document.scan((sectionId, section, index) => {
  api.v1.log(`Section ${index} (ID: ${sectionId}): ${section.text}`);
});
```

### Working with Selections

You can get text from a selection object using the `textFromSelection` method. This
method accepts an object with a `from` and `to` position and returns the text
within that range.

```ts
let selectionText = await api.v1.document.textFromSelection({
  from: selection.from,
  to: selection.to
});
api.v1.log(`Selected text: ${selectionText}`);
```

## Modifying Document Content

### Appending Text

To append text to the end of the document, use `append`, `appendParagraph`, or
`appendParagraphs`.

`append` is simplest and takes a string of text to add:

```ts
api.v1.document.append('This text will be added to the end of the document.');
```

It will automatically create a new paragraph if needed. You cannot specify
formatting or origin with this method.

`appendParagraph` and `appendParagraphs` allow you to add one or more complete
section objects, giving you full control over the text, formatting, origin, and
source.

```ts
api.v1.document.appendParagraph({
  text: 'This is a new paragraph with custom formatting.',
  origin: [{ position: 0, length: 4, data: 'user' }],
  formatting: [{ position: 10, length: 4, data: 'bold' }],
  source: undefined
});
```

### Inserting Text

To insert text at a specific position in the document, use the
`insertParagraphAfter` or `insertParagraphsAfter` methods. These methods take a
section ID to insert after and one or more section objects to insert.

`0` is a special case that represents inserting at the start of the document.

```ts
api.v1.document.insertParagraphAfter(0, {
  text: 'This paragraph was inserted at the start of the document.',
});
```

### Deleting Paragraphs

To delete sections from the document, use the `removeParagraph` or
`removeParagraphs` methods. These methods take one or more section IDs to remove.

```ts
api.v1.document.removeParagraph(2115805536300901);
```

### Updating Paragraphs

To update an existing section in the document, use the `updateParagraph` or
`updateParagraphs` methods. These methods take one or more partial section objects
and ids to update. Only the provided fields will be updated; other fields remain
unchanged.

```ts
api.v1.document.updateParagraphs([
  {
    sectionId: 2115805536300901,
    section: {
      text: 'This paragraph has been updated with new text.',
    }
  }
])
```

## History

The Document API also provides access to the document history through the
`api.v1.document.history` object. This object has methods for undoing and redoing
changes, as well as querying the history state.

## See Also

- [API Reference](./api-reference.md) — complete API documentation
- [Permissions API](./permissions-api.md) — explaining script permissions
