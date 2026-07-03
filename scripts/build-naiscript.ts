// Builds the NovelAI deployment artifact: bundles src/main.ts into a single
// IIFE (no import/export statements survive) and prepends the .naiscript
// frontmatter. Output: dist/wod.naiscript - paste its contents into NovelAI.
//
// The script id is FIXED so re-imports update the same script instead of
// creating a new one; bump `version` in package.json per release.
const SCRIPT_ID = "50033a8a-0b47-4113-ab20-401559296ba5";

const pkg = await Bun.file(new URL("../package.json", import.meta.url)).json();

const result = await Bun.build({
  entrypoints: [new URL("../src/main.ts", import.meta.url).pathname],
  format: "iife",
  target: "browser",
  minify: false,
});
if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}
const bundled = await result.outputs[0].text();

const frontmatter = [
  "/*---",
  "compatibilityVersion: naiscript-1.0",
  `id: ${SCRIPT_ID}`,
  "name: NAIoWoD",
  `version: ${pkg.version}`,
  "author: ZhuStar",
  "description: World of Darkness (Dark Ages) Storyteller engine - characters, dice, damage, lorebook-driven rules.",
  "memoryLimit: 8",
  "---*/",
  "",
].join("\n");

const out = frontmatter + bundled;
await Bun.write(new URL("../dist/wod.naiscript", import.meta.url).pathname, out);

// Sanity: frontmatter first, and no module syntax survived the bundle.
if (!out.startsWith("/*---")) throw new Error("frontmatter missing");
if (/^(import|export)\s/m.test(bundled)) throw new Error("module syntax leaked into the bundle");
new Function(bundled); // parse check (would throw on syntax errors)

console.log(`dist/wod.naiscript written (${(out.length / 1024).toFixed(1)} KB, v${pkg.version})`);
