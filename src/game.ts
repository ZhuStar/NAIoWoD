// The former src/game.ts. Its 7941 lines now live in src/game/*, cut at the
// file's own section banners. This keeps the PUBLIC SURFACE it always had -
// the same 19 names, not one more. Everything that had to become `export` so a
// sibling could import it stays internal to src/game/.
//
// Types go through `export type`: a bare `export { SomeInterface }` type-checks
// and then fails at RUNTIME, because once types are stripped there is no
// binding left to re-export.

export { RESOURCES_WIZARD } from "./game/common";
export { processAdventureInput, processContextBuilt, processGenerationEnd, stripAgedCtxSkip, stripCtxSkip } from "./game/context";
export { extractHideBlocks, processGeneratedText, reconcileLorebook } from "./game/narration";
export { registerSystemHandlers } from "./game/powers";
export { SHOW_SUBJECT_VERBS, SHOW_VERB_PREFIX, isQuietVerb, resolveShowScope, wantsInStory } from "./game/show";
export type { HideDirective } from "./game/narration";
export type { ResolvedScope, ShowScopeKind } from "./game/show";

// The show-* verbs register HERE rather than in their own module body, so they
// land after afflictions.ts's 129 - the order the single file had. See the note
// on installShowVerbs. Everything imported above has finished evaluating by the
// time this line runs, in both the ESM build and the concatenated artifact.
import { installShowVerbs } from "./game/show";
installShowVerbs();
