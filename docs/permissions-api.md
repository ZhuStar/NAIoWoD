# Permissions API

> Transcribed from `docs/permissions-api.html` (the mirrored NovelAI scripting
> docs).

Certain methods in the scripting API require explicit permission from the user to
use. This is to ensure that scripts cannot perform potentially sensitive actions
without the user's consent.

## Checking Permissions

To check if your script has a specific permission, use `api.v1.permissions.has`:

```ts
let canEditDocument = await api.v1.permissions.has('documentEdit');

if (canEditDocument) {
  api.v1.log('Can edit document');
} else {
  api.v1.log('Cannot edit document');
}
```

## Requesting Permissions

To request a permission from the user, use `api.v1.permissions.request`:

```ts
let granted = await api.v1.permissions.request('storyEdit');

if (granted) {
  api.v1.log('Permission granted!');
  // Proceed with image generation
} else {
  api.v1.log('Permission denied');
  api.v1.ui.toast('Story edit permission is required', { type: 'error' });
}
```

The user will be shown a permission dialog explaining what the script is
requesting with the option to allow or deny the request. The promise resolves to
`true` if the user grants the permission, or `false` if they deny it. It will also
resolve to `true` if the permission was already granted.

## Listing All Permissions

To get a list of all granted permissions for your script, use
`api.v1.permissions.list`:

```ts
let grantedPermissions = await api.v1.permissions.list();
api.v1.log(`Granted permissions: ${grantedPermissions.join(', ')}`);
```

## See Also

- [API Reference](./api-reference.md) — complete API documentation
