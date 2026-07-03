// =============================================================================
// HOST - the NovelAI scripting API: contract types, the off-host mock, log()
// -----------------------------------------------------------------------------
// At runtime inside NovelAI the host injects a global `api`; locally (and in
// tests) the mock below implements the same surface in memory so the engine
// behaves identically off-host. Nothing else in src/ may touch globalThis.
// =============================================================================

// --- API CONTRACT ---
// Mirrors the real NovelAI scripting API (docs.novelai.net/en/scripting):
// storage & lorebook calls are async; lorebook entries are filtered by category
// *id* (categories() resolves names to ids); storyStorage offers setIfAbsent;
// the host also provides uuid() and log(). The mock below implements the same
// surface in memory so the engine behaves identically off-host and in tests.
// Exact host shape (docs/api-reference.html): the handler may be async, may
// rewrite the input and mode, and may stop generation. Newlines in the
// returned inputText are NOT allowed (the host replaces them with spaces).
export interface OnTextAdventureInputReturnValue {
  stopFurtherScripts?: boolean;
  inputText?: string;
  mode?: "action" | "dialogue" | "story";
  stopGeneration?: boolean;
}
export type OnTextAdventureInput = (params: {
  continuityId?: string;
  inputText?: string;
  rawInputText: string;
  mode?: "action" | "dialogue" | "story";
}) => OnTextAdventureInputReturnValue | void | Promise<OnTextAdventureInputReturnValue | void>;

export interface LorebookCondition { [k: string]: unknown }
export interface LorebookEntryData {
  id: string;
  displayName?: string;
  category?: string;   // owning category id (undefined = uncategorized)
  text?: string;
  keys?: string[];
  hidden?: boolean;
  enabled?: boolean;
  advancedConditions?: LorebookCondition[];
  forceActivation?: boolean;
}
export interface LorebookCategoryData {
  id: string;
  name?: string;
  enabled?: boolean;
  settings?: { entryHeader?: string };
}

// All four stores share this surface (docs/storage-api.html): set, get,
// remove, and list (all currently-set keys).
interface StorageApi {
  get: (key: string) => Promise<unknown>;
  set: (key: string, value: unknown) => Promise<void>;
  remove: (key: string) => Promise<void>;
  list: () => Promise<string[]>;
}

interface WodApi {
  v1: {
    script: { id: string; name?: string; version?: string; author?: string };
    uuid: () => string;
    log: (...args: unknown[]) => void;
    // Story-scoped storage: travels with the story file.
    storyStorage: StorageApi;
    // Story-scoped AND history-aware: a value is set at a point in the document
    // history, and undoing past that node reverts it. The natural home for
    // mechanical state (damage, pool spends) - adoption is a planned follow-up.
    historyStorage: StorageApi;
    // Session-scoped scratch: persists for the current session and is cleared
    // when the story is closed. For UI sync via storage keys and any state we
    // deliberately don't want to keep.
    tempStorage: StorageApi;
    lorebook: {
      entry: (entryId: string) => Promise<LorebookEntryData | null>;
      entries: (categoryId?: string) => Promise<LorebookEntryData[]>;
      categories: () => Promise<LorebookCategoryData[]>;
      // Per the API reference: create* take Partial objects and resolve to the
      // NEW ID (a string). Pass id: api.v1.uuid() to control/reuse the id.
      createCategory: (data: Partial<LorebookCategoryData>) => Promise<string>;
      createEntry: (data: Partial<LorebookEntryData>) => Promise<string>;
      updateEntry: (id: string, entry: Partial<LorebookEntryData>) => Promise<void>;
      removeEntry: (id: string) => Promise<void>;
    };
    hooks: { register: (event: "onTextAdventureInput", handler: OnTextAdventureInput) => void };
  };
}

// --- API MOCK (yields to a real host-provided `api` when one exists) ---
// The mock lorebook starts EMPTY, like a fresh NovelAI story: it is the script's
// job to create its categories and seed them (see LorebookManager.bootstrap).
const __host = globalThis as unknown as { api?: WodApi };
const __mockStore = new Map<string, unknown>();
const __mockHistoryStore = new Map<string, unknown>();
const __mockTempStore = new Map<string, unknown>();
let __mockCategories: LorebookCategoryData[] = [];
let __mockEntries: LorebookEntryData[] = [];
let __mockUuidCounter = 0;
const __mockUuid = (): string => {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  return g.crypto?.randomUUID?.() ?? `mock-uuid-${++__mockUuidCounter}`;
};
const __makeMockStore = (m: Map<string, unknown>): StorageApi => ({
  get: async (key) => m.get(key),
  set: async (key, value) => { m.set(key, value); },
  remove: async (key) => { m.delete(key); },
  list: async () => [...m.keys()],
});

// Test/off-host helper: wipe the mock lorebook back to a fresh (empty) story.
// A no-op concern on-host, where the real `api` (not this mock) is used.
export function __resetLorebookMock(): void { __mockCategories = []; __mockEntries = []; }

export const api: WodApi = __host.api ?? {
  v1: {
    script: { id: "a1b2c3d4-script-uuid" },
    uuid: __mockUuid,
    log: (...args: unknown[]) => console.log(...args),
    storyStorage: __makeMockStore(__mockStore),
    // The mock is not history-aware (no document history off-host); it just
    // gives historyStorage its own bucket with the same surface.
    historyStorage: __makeMockStore(__mockHistoryStore),
    tempStorage: __makeMockStore(__mockTempStore), // session-scoped; cleared when the story closes
    lorebook: {
      entry: async (entryId: string) => __mockEntries.find(e => e.id === entryId) ?? null,
      categories: async () => __mockCategories,
      entries: async (categoryId?: string) =>
        categoryId === undefined ? __mockEntries : __mockEntries.filter(e => e.category === categoryId),
      // Mirror the host: generate a uuid when the caller doesn't supply one,
      // and resolve to the new ID (a string), per the API reference.
      createCategory: async (data) => { const c = { ...data, id: data.id ?? __mockUuid() }; __mockCategories.push(c); return c.id; },
      createEntry: async (data) => { const e = { ...data, id: data.id ?? __mockUuid() }; __mockEntries.push(e); return e.id; },
      updateEntry: async (id, entry) => {
        const i = __mockEntries.findIndex(e => e.id === id);
        if (i !== -1) __mockEntries[i] = { ...__mockEntries[i], ...entry, id };
      },
      removeEntry: async (id) => { __mockEntries = __mockEntries.filter(e => e.id !== id); },
    },
    // Off-host there is no engine to fire hooks; registering just records that a
    // handler exists (and keeps `hooks.register(...)` from throwing).
    hooks: {
      register: (event: "onTextAdventureInput", _handler: OnTextAdventureInput) => {
        log(`[HOOK REGISTER] ${event}`);
      }
    }
  }
};

// --- UTILITIES & CONSTANTS ---
// Project-wide logger: routes through the host's logger (console.log off-host).
export function log(...args: unknown[]): void { api.v1.log(...args); }
