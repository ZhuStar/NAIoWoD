// =============================================================================
// NAIoWoD - World of Darkness (Dark Ages) engine for NovelAI scripting
// -----------------------------------------------------------------------------
// Public surface: re-exports every layer, plus init() - the one entry point
// that touches the host (registers hooks, seeds the lorebook). Importing this
// module has NO side effects; the built .naiscript artifact calls init().
// =============================================================================
export * from "./host";
export * from "./core/traits";
export * from "./core/dice";
export * from "./core/damage";
export * from "./wizard";
export * from "./rolls";
export * from "./rules";
export * from "./services";
export * from "./game";

import { api, log, OnTextAdventureInput } from "./host";
import { LorebookManager } from "./services";
import { MeritFlawRegistry } from "./services";
import { processAdventureInput, ResourceOverrides } from "./game";

// Wire the engine to the host: input hook, lorebook seed, custom merits/flaws.
// Returns the bootstrap result so the caller can surface the setup note.
export async function init(): Promise<{ setupMessage: string | null }> {
  api.v1.hooks.register("onTextAdventureInput", async (params: Parameters<OnTextAdventureInput>[0]) => {
    return processAdventureInput(params.rawInputText);
  });
  const boot = await LorebookManager.bootstrap();
  const merits = await MeritFlawRegistry.loadFromLorebook();
  const overrides = await ResourceOverrides.loadFromLorebook();
  log(`[INIT] lorebook categories created: ${boot.createdCategories.length}; custom merits/flaws: ${merits}; resource overrides: ${overrides}`);
  return { setupMessage: boot.message };
}
