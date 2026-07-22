// Runtime entry point: boot the engine on the host. In the single-file build
// (dist/naiowod.ts) this is the last code to run, after every module.
// Errors route through the host's own `api.v1.error` (ambient), so the release
// depends only on the documented API - no `console`/DOM assumption.
import { init } from "./index";

init().catch((e) => api.v1.error("[NAIoWoD] init failed:", e));
