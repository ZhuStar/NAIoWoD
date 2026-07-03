// Guards that the committed single-file artifact (dist/naiowod.ts) is exactly
// what `bun run build` produces from the current src/. If you edit a module and
// forget to rebuild, this test fails - so the readable single file can never
// silently drift from the modules it is generated from.
import { test, expect } from "bun:test";
import { buildSingleFile, OUTPUT_PATH } from "../scripts/build-single";

test("dist/naiowod.ts is in sync with src/ (run `bun run build`)", async () => {
  const committed = await Bun.file(OUTPUT_PATH).text();
  const fresh = await buildSingleFile();
  expect(committed).toBe(fresh);
});

test("the single file carries the metadata header and no import/export wiring", async () => {
  const out = await buildSingleFile();
  expect(out.startsWith("/*---")).toBe(true);
  const wiring = out.split("\n").filter((l) => /^(import|export)\b/.test(l));
  expect(wiring).toEqual([]);
});
