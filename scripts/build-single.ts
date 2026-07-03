// Concatenates the engine's ES modules (src/*) into ONE readable, editable
// TypeScript file: dist/naiowod.ts. This is NOT a bundle - nothing is minified
// or transpiled. Inter-module import/export *wiring* is stripped (a NovelAI
// script runs in one global scope, so cross-file imports are neither needed nor
// allowed), but every declaration keeps its original source text. The result
// reads like the modules laid end to end, under a NovelAI script metadata
// header.
//
// `bun run build` regenerates it; test/build.test.ts fails the suite if the
// committed dist/naiowod.ts ever drifts from src/, so the single file stays in
// sync with the modules on every change. To deploy, rename the file to
// `.naiscript` and paste it into NovelAI (or point the importer at it).
//
// The script id is FIXED so re-imports update the same NovelAI script instead
// of creating a new one; bump `version` in package.json per release.
const SCRIPT_ID = "50033a8a-0b47-4113-ab20-401559296ba5";

// Modules in dependency order: each references only names declared above it.
// (host -> core -> rules -> services -> game -> index/init -> main/bootstrap.)
const MODULES = [
  "src/host.ts",
  "src/core/traits.ts",
  "src/core/dice.ts",
  "src/core/damage.ts",
  "src/rules.ts",
  "src/services.ts",
  "src/game.ts",
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
  const pkg = await Bun.file(new URL("package.json", ROOT)).json();
  const header = [
    "/*---",
    "compatibilityVersion: naiscript-1.0",
    `id: ${SCRIPT_ID}`,
    "name: NAIoWoD",
    `version: ${pkg.version}`,
    "author: ZhuStar",
    "description: World of Darkness (Dark Ages) Storyteller engine - characters, dice, damage, lorebook-driven rules.",
    "memoryLimit: 8",
    "---*/",
    "// GENERATED - do not edit by hand. This is src/* concatenated in dependency",
    "// order with inter-module import/export wiring removed; every declaration",
    "// keeps its original source. Edit the modules under src/, then `bun run build`.",
    "// test/build.test.ts fails if this file drifts from src/.",
    "//",
    "// Order: host -> core/traits -> core/dice -> core/damage -> rules ->",
    "//        services -> game -> init (index.ts) -> bootstrap (main.ts)",
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

  // Guardrails: metadata header first, and no inter-module wiring survived
  // (in a global-scope script no line may start with `import` or `export`).
  if (!out.startsWith("/*---")) throw new Error("metadata header missing");
  const leaked = out.split("\n").filter((l) => /^(import|export)\b/.test(l));
  if (leaked.length) {
    throw new Error(`inter-module wiring leaked:\n  ${leaked.slice(0, 5).join("\n  ")}`);
  }

  await Bun.write(OUTPUT_PATH, out);
  console.log(`dist/naiowod.ts written (${(out.length / 1024).toFixed(1)} KB)`);
}
