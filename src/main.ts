// Bundle entry for the NovelAI deployment artifact (dist/wod.naiscript).
import { init } from "./index";

init().catch((e) => console.error("[NAIoWoD] init failed:", e));
