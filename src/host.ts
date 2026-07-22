// =============================================================================
// HOST - release-safe glue over the NovelAI scripting API.
// -----------------------------------------------------------------------------
// The API's TYPES are NOT declared here. They are ambient, vendored from
// NovelAI at `types/novelai/script-types.d.ts` (the single source of truth):
// `api` (the global namespace), `UIPart`, `WindowOptions`, `ModalOptions`,
// `LorebookEntry`, `LorebookCondition`, `OnTextAdventureInput`, etc. are all
// global there, so no file in src/ redefines them - and the single-file
// release (dist/naiowod.ts) carries zero NovelAI type definitions. At runtime
// inside NovelAI the host injects the global `api`; off-host (tests, local
// e2e) `src/host-mock.ts` installs an in-memory `globalThis.api` - but that
// mock is NOT part of the release build.
//
// This module holds only what the RELEASE needs: the project logger and two
// aliases over ambient types (our own names, not NovelAI redefinitions).
// =============================================================================

// The part-builder bundle (`api.v1.ui.part`), named for window.ts params.
export type UiPartHelpers = typeof api.v1.ui.part;

// The handle returned by opening a window/modal, named where an annotation helps.
export type UIHandle = Awaited<ReturnType<typeof api.v1.ui.window.open>>;

// Project-wide logger: routes through the host's logger (console.log off-host).
export function log(...args: unknown[]): void { api.v1.log(...args); }
