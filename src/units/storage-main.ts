// THE STORAGE SATELLITE's runtime entry point - the first script cut out of the
// kernel (§7.95).
//
// WHY THIS SCRIPT EXISTS AT ALL. `api.v1.storyStorage` is PER SCRIPT (§7.90):
// there is no prefix and no shared store that lets two scripts see one game.
// So exactly one script must own the state and serve everybody else, and this
// is it. That constraint is not a preference - probe S1/S2 measured it, and it
// reversed the architecture.
//
// WHAT MAKES IT A SATELLITE rather than a second engine: it registers NO hooks.
// It never sees the story, never parses a command, never writes narration. It
// waits home for letters, serves what it is asked, and answers.
//
// HOW IT SPECIALIZES, and the rule it obeys: by CONFIG, not by forked code.
// The PostOffice compiled into this artifact is byte-for-byte the kernel's; the
// single difference is the `declareService` call below. `ourChannels()` leaves
// STORAGE_CHANNEL out by default precisely because a script serving its own
// storage should not invite others to route reads through it - declaring it is
// how this one says "that is exactly my job".
import { PostOffice, STORAGE_CHANNEL, StorageDesk } from "../services";

export async function initStorageUnit(): Promise<void> {
  // ORDER MATTERS. Declare BEFORE opening: `open()` announces us to the room,
  // and an announcement that did not yet know we serve storage would describe
  // a script nobody has any reason to write to. The kernel would then fall
  // through to its own local handler and quietly own the state itself - which
  // is the exact bug this whole split exists to prevent, and it would look like
  // everything working.
  PostOffice.declareService(STORAGE_CHANNEL);
  // Idempotent, and `PostOffice.open()` would call it anyway; said out loud
  // because in THIS artifact the desk is the entire point rather than a detail.
  StorageDesk.open();
  await PostOffice.open();
}

initStorageUnit().catch((e) => api.v1.error("[NAIoWoD:storage] init failed:", e));
