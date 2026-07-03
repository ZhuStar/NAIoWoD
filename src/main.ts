// Runtime entry point: boot the engine on the host. In the single-file build
// (dist/naiowod.ts) this is the last code to run, after every module.
import { init } from "./index";

init().catch((e) => console.error("[NAIoWoD] init failed:", e));
