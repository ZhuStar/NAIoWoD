// =============================================================================
// HOST MOCK - off-host, in-memory implementation of the NovelAI `api`.
// -----------------------------------------------------------------------------
// TEST-ONLY. This file is NOT in the single-file build (scripts/build-single.ts
// omits it), so it never enters dist/naiowod.ts. It is imported for its side
// effect (installing `globalThis.api`) by the test suite and local e2e scratch
// scripts; on-host the real `api` already exists and the install is skipped.
//
// The mock is typed loosely (assigned to globalThis through `any`): it only
// needs the RUNTIME surface the engine actually calls, not the full ambient
// `api` type. Engine code stays typed against the ambient declarations in
// types/novelai/script-types.d.ts. The `__reset*` / `__ui*` helpers below are
// the test hooks the suite uses to drive and inspect the mock.
// =============================================================================
import { log } from "./host";

// --- STORAGE MOCK (story / history / temp share one surface) -----------------
const __mockStore = new Map<string, unknown>();
const __mockHistoryStore = new Map<string, unknown>();
const __mockTempStore = new Map<string, unknown>();
let __mockCategories: { id: string; name?: string; enabled?: boolean; settings?: { entryHeader?: string } }[] = [];
let __mockEntries: Record<string, unknown>[] = [];
let __mockUuidCounter = 0;
const __mockUuid = (): string => {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  return g.crypto?.randomUUID?.() ?? `mock-uuid-${++__mockUuidCounter}`;
};
const __makeMockStore = (m: Map<string, unknown>) => ({
  get: async (key: string) => m.get(key),
  set: async (key: string, value: unknown) => { m.set(key, value); },
  remove: async (key: string) => { m.delete(key); },
  list: async () => [...m.keys()],
});

// Test/off-host helper: wipe the mock lorebook back to a fresh (empty) story.
export function __resetLorebookMock(): void { __mockCategories = []; __mockEntries = []; }
// Test/off-host helper: wipe the mock storage stores (story, history, temp) and
// the generation-side story fields (author's note, system prompt, prefill).
export function __resetStorageMock(): void {
  __mockStore.clear(); __mockHistoryStore.clear(); __mockTempStore.clear();
  __mockAuthorNote = ""; __mockSystemPrompt = ""; __mockPrefill = "";
}

// --- GENERATION MOCK (author's note / system prompt / prefill / hooks) --------
// In-memory story fields the Storyteller loop reads and writes, plus a registry
// of the generation hooks the engine registers, so tests can FIRE them off-host
// (there is no real generator here). `authorNote.set` etc. never throw - on-host
// they need the storyEdit permission, which the engine treats as best-effort.
let __mockAuthorNote = "";
let __mockSystemPrompt = "";
let __mockPrefill = "";
const __mockHooks = new Map<string, (params: unknown) => unknown>();

// Test/off-host helpers: read the mock author's note / system prompt / prefill.
export function __authorNote(): string { return __mockAuthorNote; }
export function __systemPrompt(): string { return __mockSystemPrompt; }
export function __prefill(): string { return __mockPrefill; }
// Fire the engine's onResponse hook with a fake generation and return its result
// (the modified text the host would insert). No-op if nothing is registered.
export async function __fireOnResponse(text: string[], final = true): Promise<{ text?: string[] } | undefined> {
  const h = __mockHooks.get("onResponse");
  if (!h) return undefined;
  const r = await h({ continuityId: "test", text, logprobs: [], tokenIds: [], final });
  return (r ?? undefined) as { text?: string[] } | undefined;
}

// --- UI MOCK -----------------------------------------------------------------
// Records every opened window/modal and its current UIPart tree, and lets tests
// fire button callbacks - exercising the whole window -> command path off-host.
interface MockWindow { kind: "window" | "modal"; options: { content?: (UIPart)[] } & Record<string, unknown>; closed: boolean; }
interface MockHandle { update: (options: Record<string, unknown>) => Promise<void>; close: () => Promise<void>; isClosed: () => boolean; closed: Promise<void>; }
let __mockWindows: MockWindow[] = [];
function __openMockWindow(kind: "window" | "modal", options: Record<string, unknown>): MockHandle {
  const rec: MockWindow = { kind, options: options as MockWindow["options"], closed: false };
  let resolveClosed: () => void = () => {};
  const closed = new Promise<void>(res => { resolveClosed = res; });
  __mockWindows.push(rec);
  return {
    update: async (opts) => { rec.options = { ...rec.options, ...opts } as MockWindow["options"]; },
    close: async () => { rec.closed = true; resolveClosed(); },
    isClosed: () => rec.closed,
    closed,
  };
}
const __mockPart = {
  text: (c: Record<string, unknown>) => ({ type: "text", ...c }),
  textInput: (c: Record<string, unknown>) => ({ type: "textInput", ...c }),
  numberInput: (c: Record<string, unknown>) => ({ type: "numberInput", ...c }),
  button: (c: Record<string, unknown>) => ({ type: "button", ...c }),
  row: (c: Record<string, unknown>) => ({ type: "row", ...c }),
  column: (c: Record<string, unknown>) => ({ type: "column", ...c }),
  box: (c: Record<string, unknown>) => ({ type: "box", ...c }),
  collapsibleSection: (c: Record<string, unknown>) => ({ type: "collapsibleSection", ...c }),
};
function __flattenParts(parts: UIPart[]): UIPart[] {
  const out: UIPart[] = [];
  for (const p of parts) {
    if (!p) continue;
    out.push(p);
    const kids = (p as { content?: UIPart[] }).content;
    if (Array.isArray(kids)) out.push(...__flattenParts(kids));
  }
  return out;
}

// Test/off-host helpers (no-op concerns on-host):
export function __resetUiMock(): void { __mockWindows = []; }
export function __uiWindows(): { kind: string; options: { content?: UIPart[] } & Record<string, unknown> }[] {
  return __mockWindows.filter(w => !w.closed).map(w => ({ kind: w.kind, options: w.options }));
}
// Find a button by its text across all open windows and run its callback.
export async function __uiClickButton(text: string): Promise<boolean> {
  for (const w of __mockWindows) {
    if (w.closed) continue;
    const btn = __flattenParts((w.options.content ?? []) as UIPart[]).find(
      (p): p is Extract<UIPart, { type: "button" }> => !!p && (p as { type?: string }).type === "button" && (p as { text?: string }).text === text
    );
    if (btn) { await Promise.resolve((btn as { callback: () => void }).callback()); return true; }
  }
  return false;
}

// --- INSTALL -----------------------------------------------------------------
// Yield to a real host-provided `api` when one exists; otherwise install the
// mock. The mock lorebook starts EMPTY, like a fresh NovelAI story: it is the
// script's job to create its categories and seed them (LorebookManager.bootstrap).
const __g = globalThis as unknown as { api?: unknown };
if (!__g.api) {
  __g.api = {
    v1: {
      script: { id: "a1b2c3d4-script-uuid" },
      uuid: __mockUuid,
      log: (...args: unknown[]) => console.log(...args),
      error: (...args: unknown[]) => console.error(...args),
      storyStorage: __makeMockStore(__mockStore),
      // The mock is not history-aware (no document history off-host); it just
      // gives historyStorage its own bucket with the same surface.
      historyStorage: __makeMockStore(__mockHistoryStore),
      tempStorage: __makeMockStore(__mockTempStore), // session-scoped; cleared when the story closes
      lorebook: {
        entry: async (entryId: string) => __mockEntries.find(e => e["id"] === entryId) ?? null,
        categories: async () => __mockCategories,
        entries: async (categoryId?: string | null) =>
          categoryId == null ? __mockEntries : __mockEntries.filter(e => e["category"] === categoryId),
        // Mirror the host: generate a uuid when the caller doesn't supply one,
        // and resolve to the new ID (a string), per the API reference.
        createCategory: async (data: Record<string, unknown>) => { const c = { ...data, id: (data["id"] as string) ?? __mockUuid() }; __mockCategories.push(c as MockWindow["options"] as never); return c.id; },
        createEntry: async (data: Record<string, unknown>) => { const e = { ...data, id: (data["id"] as string) ?? __mockUuid() }; __mockEntries.push(e); return e.id; },
        updateEntry: async (id: string, entry: Record<string, unknown>) => {
          const i = __mockEntries.findIndex(e => e["id"] === id);
          if (i !== -1) __mockEntries[i] = { ...__mockEntries[i], ...entry, id };
        },
        removeEntry: async (id: string) => { __mockEntries = __mockEntries.filter(e => e["id"] !== id); },
      },
      // Off-host there is no engine to fire hooks; registering records the
      // handler so tests can fire it (see __fireOnResponse) and logs it.
      hooks: { register: (event: string, handler: (params: unknown) => unknown) => { __mockHooks.set(event, handler); log(`[HOOK REGISTER] ${event}`); } },
      // Generation-side story fields. an (author's note) / systemPrompt / prefill
      // mirror the real get/set surface; the set methods never throw off-host.
      an: {
        get: async () => __mockAuthorNote,
        set: async (text: string) => { __mockAuthorNote = text ?? ""; },
      },
      systemPrompt: {
        get: async () => __mockSystemPrompt,
        set: async (text: string) => { __mockSystemPrompt = text ?? ""; },
        getDefault: async () => "",
      },
      prefill: {
        get: async () => __mockPrefill,
        set: async (text: string) => { __mockPrefill = text ?? ""; },
        getDefault: async () => "",
      },
      ui: {
        window: { open: async (options: Record<string, unknown>) => __openMockWindow("window", options) },
        modal: { open: async (options: Record<string, unknown>) => __openMockWindow("modal", options) },
        part: __mockPart,
        toast: async (_message: string) => { /* off-host: no toast surface */ },
      },
    },
  };
}
