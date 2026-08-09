// Guards that the committed single-file artifact (dist/naiowod.ts) is exactly
// what `bun run build` produces from the current src/. If you edit a module and
// forget to rebuild, this test fails - so the readable single file can never
// silently drift from the modules it is generated from.
import { test, expect } from "bun:test";
import { buildSingleFile, OUTPUT_PATH, MODULES } from "../scripts/build-single";
import { renderCommandReference, COMMANDS_DOC_PATH } from "../scripts/command-reference";

test("dist/naiowod.ts is in sync with src/ (run `bun run build`)", async () => {
  const committed = await Bun.file(OUTPUT_PATH).text();
  const fresh = await buildSingleFile();
  expect(committed).toBe(fresh);
});

test("the single file is plain import-free TypeScript (no naiscript frontmatter)", async () => {
  const out = await buildSingleFile();
  expect(out.startsWith("//")).toBe(true);      // a comment, ready to paste as-is
  expect(out.startsWith("/*---")).toBe(false);  // no YAML frontmatter / embedded id
  const wiring = out.split("\n").filter((l) => /^(import|export)\b/.test(l));
  expect(wiring).toEqual([]);
});

test("the release redefines NO NovelAI type and no `api` (they are ambient on-host)", async () => {
  const out = await buildSingleFile();
  // The host provides `api` and every UI/lorebook type; the artifact must not
  // redeclare them or it collides when pasted into an editor that knows them.
  expect(out).not.toMatch(/\bdeclare namespace api\b/);
  expect(out).not.toMatch(/^(const|let|var)\s+api\b/m);
  for (const name of ["UIPart", "UIPartButton", "WindowOptions", "ModalOptions", "LorebookCondition", "LorebookEntry", "OnTextAdventureInput"]) {
    expect(out).not.toMatch(new RegExp(`^(interface|type)\\s+${name}\\b`, "m"));
  }
  // The off-host mock and its test hooks must never ship in the release
  // (the header comments may name the file; the mock CODE must be absent).
  expect(out).not.toMatch(/__uiClickButton|__resetStorageMock|__openMockWindow|__mockStore/);
});

// window.ts is layout and behaviour; the words live in ui-text.ts (or on the
// verb's CommandSpec, for a field the spec already describes). This fails the
// build if a bare string literal creeps back into a window's part tree, which
// is the only way the two can drift apart.
test("window.ts holds no user-facing copy of its own", async () => {
  const src = await Bun.file(new URL("../src/window.ts", import.meta.url).pathname).text();
  const offenders: string[] = [];
  for (const line of src.split("\n")) {
    if (line.trim().startsWith("//")) continue;
    // `text:` / `placeholder:` / `label:` / `title:` followed by a quoted
    // literal. Template literals are fine: they interpolate data or UI_TEXT.
    for (const m of line.matchAll(/\b(text|placeholder|label|title)\s*:\s*(['"])(.*?)\2/g)) {
      if (m[3].trim().length) offenders.push(`${m[1]}: "${m[3]}"`);
    }
  }
  expect(offenders).toEqual([]);
});

// docs/commands.md is GENERATED from the live CommandRouter, for the same
// reason dist/ is generated from src/: a hand-written list of 131 verbs drifts
// the first time somebody adds one. Add or rename a command without running
// `bun run docs:commands` and this fails.
test("docs/commands.md is in sync with the registry (run `bun run docs:commands`)", async () => {
  const committed = await Bun.file(COMMANDS_DOC_PATH).text();
  const fresh = await renderCommandReference();
  expect(committed).toBe(fresh);
});


// The rule the storage counter exists to enforce (§7.88). Everything else in the
// engine asks StorageDesk for a key; if any other module reaches straight for
// api.v1.*Storage, the counter is decoration. A rule nothing checks is a wish,
// and this is the check - scanning exactly the modules the artifact is built
// from, so a new file cannot bypass the counter by not being looked at.
test("nothing but StorageDesk names api.v1.*Storage", async () => {
  const NAMES = /api\.v1\.(story|temp|history)Storage/g;
  const offenders: string[] = [];
  for (const rel of MODULES) {
    const raw = await Bun.file(new URL(`../${rel}`, import.meta.url).pathname).text();
    // CODE, not prose: the comments deliberately NAME these APIs to explain
    // which store the host files a window field under, and documenting the rule
    // must not count as breaking it.
    const body = raw.split("\n").map(l => l.replace(/\/\/.*$/, "")).join("\n");
    const hits = body.match(NAMES)?.length ?? 0;
    if (!hits) continue;
    if (rel === "src/services.ts") {
      // Even here, only StorageDesk.fulfil may name them.
      const fulfil = body.slice(body.indexOf("private static async fulfil"), body.indexOf("static open()"));
      const inside = fulfil.match(NAMES)?.length ?? 0;
      if (inside !== hits) offenders.push(`${rel}: ${hits - inside} outside StorageDesk.fulfil`);
      continue;
    }
    offenders.push(`${rel}: ${hits}`);
  }
  expect(offenders).toEqual([]);
});


// H2, measured on-host 2026-08-08: `stopFurtherScripts` REALLY DOES halt the
// chain - probe two logged nothing at all after probe one set it. That makes it
// the one return value that can silence a sibling unit, and this engine is
// heading for several units that must all see the input. It sets it nowhere
// today; this is what keeps that true, because the failure mode is invisible -
// no error, no test failure, just another script mysteriously not running.
// If a future change genuinely needs it, delete this test deliberately and say
// why in the commit.
test("the engine never halts the hook chain (it would silence sibling units)", async () => {
  const offenders: string[] = [];
  for (const rel of MODULES) {
    const raw = await Bun.file(new URL(`../${rel}`, import.meta.url).pathname).text();
    const body = raw.split("\n").map(l => l.replace(/\/\/.*$/, "")).join("\n");
    if (body.includes("stopFurtherScripts")) offenders.push(rel);
  }
  expect(offenders).toEqual([]);
});
