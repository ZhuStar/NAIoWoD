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
// api.v1.storage - the script's OWN store, separate from the story's. It was
// missing here entirely, which is part of why the window-field bug was
// invisible off-host: nothing modelled the store the host actually syncs to.
const __mockScriptStore = new Map<string, unknown>();
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
  __mockStore.clear(); __mockHistoryStore.clear(); __mockTempStore.clear(); __mockScriptStore.clear();
  __mockAuthorNote = ""; __mockSystemPrompt = ""; __mockPrefill = ""; __mockSections = [];
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

// A minimal document: a list of paragraphs (sections) with numeric ids, enough
// to exercise scan / removeParagraph / updateParagraph.
let __mockSections: { id: number; text: string }[] = [];
let __mockSectionCounter = 1000;
// Test/off-host helpers: seed / read the document paragraphs.
export function __seedDocument(texts: string[]): void { __mockSections = texts.map(t => ({ id: ++__mockSectionCounter, text: t })); }
export function __document(): { id: number; text: string }[] { return __mockSections.map(s => ({ ...s })); }

// Test/off-host helpers: read the mock author's note / system prompt / prefill.
export function __authorNote(): string { return __mockAuthorNote; }
// Fire the engine's onResponse hook with a fake generation and return its result
// (the modified text the host would insert). No-op if nothing is registered.
export async function __fireOnResponse(text: string[], final = true): Promise<{ text?: string[] } | undefined> {
  const h = __mockHooks.get("onResponse");
  if (!h) return undefined;
  const r = await h({ continuityId: "test", text, logprobs: [], tokenIds: [], final });
  return (r ?? undefined) as { text?: string[] } | undefined;
}
// Fire the engine's onContextBuilt hook (dryRun=false is a real generation) and
// return its result (the modified message array the host would send).
export async function __fireOnContextBuilt(messages: Message[], dryRun = false): Promise<{ messages?: Message[] } | undefined> {
  const h = __mockHooks.get("onContextBuilt");
  if (!h) return undefined;
  const r = await h({ continuityId: "test", model: "mock", dryRun, messages });
  return (r ?? undefined) as { messages?: Message[] } | undefined;
}
// Fire the engine's onGenerationEnd hook (post-generation document cleanup).
export async function __fireOnGenerationEnd(): Promise<void> {
  const h = __mockHooks.get("onGenerationEnd");
  if (h) await h({ continuityId: "test", model: "mock" });
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
// Type into a form field the way the HOST does, which is the whole point of
// having it here: an input's `storageKey` names the store its value is synced
// to - unprefixed goes to the script's own `storage`, "story:" to storyStorage,
// "history:" to historyStorage. MEASURED on-host by
// scripts/probe-window-field.ts, not inferred from the docs. The mock modelled
// none of it, so a window could read its fields out of a store the host never
// wrote to and every test still passed. Route test input through here and that
// mismatch fails loudly instead.
export async function __uiTypeInto(storageKey: string, value: string): Promise<void> {
  const [store, key] = storageKey.startsWith("story:") ? [__mockStore, storageKey.slice(6)]
    : storageKey.startsWith("history:") ? [__mockHistoryStore, storageKey.slice(8)]
    : [__mockScriptStore, storageKey];
  store.set(key, value);
}

// Every field the open windows expose, as `storageKey -> current value`. Lets a
// test discover what a window actually binds rather than guessing its keys.
export function __uiFields(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const w of __mockWindows) {
    if (w.closed) continue;
    for (const p of __flattenParts((w.options.content ?? []) as UIPart[])) {
      const sk = (p as { storageKey?: string }).storageKey;
      if (sk) out[sk] = String(__uiReadField(sk) ?? "");
    }
  }
  return out;
}
// Read one field the way the host stores it (prefix selects the store).
export function __uiFieldValue(storageKey: string): string {
  return String(__uiReadField(storageKey) ?? "");
}
function __uiReadField(storageKey: string): unknown {
  if (storageKey.startsWith("story:")) return __mockStore.get(storageKey.slice(6));
  if (storageKey.startsWith("history:")) return __mockHistoryStore.get(storageKey.slice(8));
  return __mockScriptStore.get(storageKey);
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

// --- MESSAGING MOCK ----------------------------------------------------------
// Faithful to the DOCUMENTED contract and no more (docs/api-reference.md
// §api.v1.messaging). The two rules that shape everything built on it:
//
//   * `broadcast` goes to all scripts EXCEPT the sender, so this mock never
//     delivers a broadcast back to the script that sent it. Code that expects
//     to hear its own event must not go through the wire - that is exactly the
//     trap core/bus.ts's direct dispatch avoids.
//   * every call is a Promise, so delivery is a LATER TICK, never the current
//     one. The mock keeps that: `__deliverMessage` is how a test plays the part
//     of the other script.
//
// What the docs do NOT promise - ordering, retries, what happens when nobody is
// listening - this mock does not invent. Off-host green here is not proof of
// on-host behaviour, and scripts/probe-messaging.ts is how to find out for real.
const __mockSubs: { index: number; cb: (m: unknown) => unknown; filter?: { fromScriptId?: string; channel?: string } }[] = [];
let __mockSubIndex = 0;
const __mockSent: { toScriptId?: string; data: unknown; channel?: string }[] = [];
const __mockMessaging = {
  send: async (toScriptId: string, data: unknown, channel?: string) => { __mockSent.push({ toScriptId, data, channel }); },
  broadcast: async (data: unknown, channel?: string) => { __mockSent.push({ data, channel }); },
  onMessage: async (cb: (m: unknown) => unknown, filter?: { fromScriptId?: string; channel?: string }) => {
    const index = ++__mockSubIndex;
    __mockSubs.push({ index, cb, filter });
    return index;
  },
  unsubscribe: async (index: number) => {
    const at = __mockSubs.findIndex(s => s.index === index);
    if (at >= 0) __mockSubs.splice(at, 1);
  },
};
// Test hook: what this script has put on the wire (in order), and a reset.
export function __sentMessages(): { toScriptId?: string; data: unknown; channel?: string }[] {
  return __mockSent.map(m => ({ ...m }));
}
export function __resetMessagingMock(): void {
  __mockSubs.length = 0; __mockSent.length = 0; __mockSubIndex = 0;
}
// Test hook: play the part of ANOTHER script and deliver a message inward,
// honouring each subscription's filter exactly as the documented API would.
export async function __deliverMessage(message: { fromScriptId: string; toScriptId?: string; data: unknown; channel?: string; timestamp?: number }): Promise<void> {
  const full = { timestamp: Date.now(), ...message };
  for (const sub of [...__mockSubs]) {
    if (sub.filter?.channel !== undefined && sub.filter.channel !== full.channel) continue;
    if (sub.filter?.fromScriptId !== undefined && sub.filter.fromScriptId !== full.fromScriptId) continue;
    await sub.cb(full);
  }
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
      storage: __makeMockStore(__mockScriptStore),   // per-script (docs/storage-api.md)
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
      // Minimal document API: scan/remove/update by section id (the surface the
      // onGenerationEnd cleanup uses). Sections are passed with a `.text`.
      document: {
        scan: async (cb?: (id: number, section: { text: string }, index: number) => void) => {
          const res = __mockSections.map((s, index) => ({ sectionId: s.id, section: { text: s.text, origin: [], formatting: [] }, index }));
          if (cb) for (const r of res) cb(r.sectionId, r.section, r.index);
          return res;
        },
        removeParagraph: async (id: number) => { __mockSections = __mockSections.filter(s => s.id !== id); },
        removeParagraphs: async (ids: number[]) => { const set = new Set(ids); __mockSections = __mockSections.filter(s => !set.has(s.id)); },
        updateParagraph: async (id: number, section: { text?: string }) => { const s = __mockSections.find(x => x.id === id); if (s && typeof section?.text === "string") s.text = section.text; },
        append: async (text: string) => { for (const part of String(text).split("\n")) __mockSections.push({ id: ++__mockSectionCounter, text: part }); },
        appendParagraph: async (section: { text?: string }) => { __mockSections.push({ id: ++__mockSectionCounter, text: String(section?.text ?? "") }); },
      },
      ui: {
        window: { open: async (options: Record<string, unknown>) => __openMockWindow("window", options) },
        modal: { open: async (options: Record<string, unknown>) => __openMockWindow("modal", options) },
        part: __mockPart,
        toast: async (_message: string) => { /* off-host: no toast surface */ },
      },
      messaging: __mockMessaging,
    },
  };
}
