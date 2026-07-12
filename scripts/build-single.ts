// Concatenates the engine's ES modules (src/*) into ONE readable, editable
// TypeScript file: dist/naiowod.ts. This is NOT a bundle - nothing is minified
// or transpiled. Inter-module import/export *wiring* is stripped (a NovelAI
// script runs in one global scope, so cross-file imports are neither needed nor
// allowed), but every declaration keeps its original source text. The result
// reads like the modules laid end to end.
//
// `bun run build` regenerates it; test/build.test.ts fails the suite if the
// committed dist/naiowod.ts ever drifts from src/, so the single file stays in
// sync with the modules on every change. To use it, paste the TypeScript below
// into NovelAI's script editor - no metadata header needed. (The `.naiscript`
// YAML frontmatter is only for exporting/importing scripts, which embeds a
// script id; pasting plain TypeScript does not need it.)

// Modules in dependency order: each references only names declared above it.
// (host -> core -> rules -> command -> services -> state -> game ->
//  window -> index/init -> main/bootstrap.)
const MODULES = [
  "src/host.ts",
  "src/core/traits.ts",
  "src/core/dice.ts",
  "src/core/damage.ts",
  "src/wizard.ts",
  "src/rolls.ts",
  "src/rules.ts",
  "src/command.ts",
  "src/services.ts",
  "src/state.ts",
  "src/game.ts",
  "src/window.ts",
  "src/index.ts",
  "src/main.ts",
] as const;

const ROOT = new URL("../", import.meta.url);
export const OUTPUT_PATH = new URL("dist/naiowod.ts", ROOT).pathname;

// Strip a module's inter-file wiring, leaving stand-alone declarations. Order
// matters: remove whole re-export / import statements first, THEN the leading
// `export ` keyword from the declarations that remain.
export function stripModule(src: string): string {
  return src
    // whole-line re-exports: `export * from "./x";`
    .replace(/^export\s+\*\s+from\s*['"][^'"]+['"];?[ \t]*\r?\n/gm, "")
    // whole-statement re-exports: `export { A, B } from "./x";` (single/multi-line)
    .replace(/^export\s*\{[\s\S]*?\}\s*from\s*['"][^'"]+['"];?[ \t]*\r?\n/gm, "")
    // import statements, single- or multi-line: `import … from "./x";`
    .replace(/^import\b[\s\S]*?from\s*['"][^'"]+['"];?[ \t]*\r?\n/gm, "")
    // leading `export ` on the surviving declarations (const/class/interface/…)
    .replace(/^export[ \t]+/gm, "")
    .trim();
}

export async function buildSingleFile(): Promise<string> {
  const header = [
    "// NAIoWoD - World of Darkness (Dark Ages) engine for NovelAI scripting.",
    "// GENERATED - do not edit by hand. This is src/* concatenated in dependency",
    "// order with inter-module import/export wiring removed; every declaration",
    "// keeps its original source. Edit the modules under src/, then `bun run build`.",
    "// test/build.test.ts fails if this file drifts from src/.",
    "//",
    "// Paste this TypeScript into NovelAI's script editor as-is - no header needed.",
    "//",
    "// Order: host -> core/traits -> core/dice -> core/damage -> wizard ->",
    "//        rolls -> rules -> command -> services -> state -> game ->",
    "//        window -> init (index.ts) -> bootstrap (main.ts)",
  ].join("\n");

  const sections = [header];
  for (const rel of MODULES) {
    const body = stripModule(await Bun.file(new URL(rel, ROOT)).text());
    sections.push(`//#region ${rel}\n${body}\n//#endregion ${rel}`);
  }
  return sections.join("\n\n") + "\n";
}

if (import.meta.main) {
  const out = await buildSingleFile();

  // Guardrails: starts with the generated comment (NOT naiscript frontmatter),
  // and no inter-module wiring survived (no line may start with import/export).
  if (!out.startsWith("//")) throw new Error("generated header comment missing");
  if (out.startsWith("/*---")) throw new Error("naiscript frontmatter should not be emitted");
  const leaked = out.split("\n").filter((l) => /^(import|export)\b/.test(l));
  if (leaked.length) {
    throw new Error(`inter-module wiring leaked:\n  ${leaked.slice(0, 5).join("\n  ")}`);
  }

  await Bun.write(OUTPUT_PATH, out);
  console.log(`dist/naiowod.ts written (${(out.length / 1024).toFixed(1)} KB)`);
}
