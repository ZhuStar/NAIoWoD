// THE UNIT MANIFEST - what artifacts exist, and what goes in each.
//
// One declaration with THREE consumers (§7.95, §8.25):
//   1. THE BUILD    - which modules concatenate into which paste-ready file.
//   2. SANTA        - which channels a unit serves, i.e. the hub's routing
//                     table and what the unit's bootstrap announces.
//   3. THE AI       - the vocabulary a unit contributes. RESERVED, nothing
//                     populates it yet; when it does it is DERIVED from the
//                     CommandSpec registry rather than hand-written, because
//                     that registry already carries summary/params/examples and
//                     the "does this reply belong in the story?" flag.
//
// ORDER IS NOT COMPUTED HERE, AND DELIBERATELY SO. `MODULES` in build-single.ts
// is a MEASURED total order ("ORDER MEASURED, NOT ASSUMED"), and a unit is that
// list FILTERED to its dependency closure. Two consequences worth the trade:
// any subset comes out correctly ordered by construction, and the kernel stays
// byte-identical to the file that has always been committed. A topological sort
// would have to re-derive an order somebody already measured, and could pick a
// different valid one - which would rewrite dist/naiowod.ts for no reason.

import { MODULES } from "./build-single";

export interface UnitDef {
  /** Artifact id. The kernel writes dist/naiowod.ts; others dist/naiowod-<id>.ts. */
  id: string;
  /** One line, and it becomes the artifact's header comment. */
  summary: string;
  /**
   * The modules this unit is FOR. Everything they import comes along - state
   * what the unit IS, not what it needs.
   */
  entries: string[];
  /**
   * Channels this unit serves for everybody else: Santa's routing table, and
   * what the bootstrap passes to `PostOffice.declareService`.
   */
  serves?: string[];
  /**
   * RESERVED for capability publishing (§8.25). Deliberately unused: the owner
   * is explicit that publishing is a later feature, and the format reserving
   * the field now is what keeps it from being a breaking change later.
   */
  capabilities?: readonly never[];
}

export const UNITS: readonly UnitDef[] = [
  {
    id: "kernel",
    summary: "the engine: rules, sheets, dice, lorebook, and the hooks NovelAI calls",
    entries: ["src/main.ts"],
    // The kernel serves storage to ITSELF (StorageDesk's priority-`last` local
    // handler) and so declares nothing: announcing it would invite the others
    // to route their reads here, which is the storage unit's job.
    serves: [],
  },
  {
    id: "storage",
    summary: "the storage satellite: owns the story's state and serves it to the others",
    entries: ["src/units/storage-main.ts"],
    serves: ["naiowod:storage"],
    // OVER-INCLUDES FOR NOW, and knowingly. StorageDesk is 56 lines needing only
    // core/bus + host, but it lives inside services.ts, so its closure drags
    // rules.ts and command.ts along. Extracting the post office + desk into
    // their own module is the next step and shrinks this artifact by ~90%; it
    // is a pure refactor, and keeping the fat version working first means that
    // refactor can be verified against a known-good artifact instead of being
    // the thing that has to be right the first time.
  },
] as const;

const ROOT = new URL("../", import.meta.url);
// `import ... from "./x"` and `export ... from "./x"`, single- or multi-line.
const IMPORT_RE = /(?:^|\n)\s*(?:import|export)\b[\s\S]*?from\s*['"](\.[^'"]+)['"]/g;

/** The src/ modules a file imports, as MODULES-relative paths. */
async function directDeps(rel: string): Promise<string[]> {
  const text = await Bun.file(new URL(rel, ROOT)).text();
  const out: string[] = [];
  for (const m of text.matchAll(IMPORT_RE)) {
    const abs = new URL(m[1], new URL(rel, ROOT)).pathname;
    const relative = abs.slice(new URL(ROOT).pathname.length);
    // A specifier may name the file, the file without .ts, or a directory.
    for (const candidate of [`${relative}.ts`, `${relative}/index.ts`, relative]) {
      if ((MODULES as readonly string[]).includes(candidate)) { out.push(candidate); break; }
    }
  }
  return out;
}

/**
 * Every module a unit needs, in MODULES order. Breadth-first over the import
 * graph from the entries; a module already seen is not walked again, so an
 * import cycle terminates instead of hanging.
 */
export async function modulesFor(unit: UnitDef): Promise<string[]> {
  const seen = new Set<string>();
  const queue = [...unit.entries];
  while (queue.length) {
    const current = queue.shift()!;
    if (seen.has(current)) continue;
    seen.add(current);
    queue.push(...await directDeps(current));
  }
  const unknown = [...seen].filter(m => !(MODULES as readonly string[]).includes(m));
  if (unknown.length) {
    throw new Error(`unit "${unit.id}" reaches modules missing from MODULES: ${unknown.join(", ")}`);
  }
  return (MODULES as readonly string[]).filter(m => seen.has(m));
}

export function unitById(id: string): UnitDef {
  const found = UNITS.find(u => u.id === id);
  if (!found) throw new Error(`no unit "${id}" (have: ${UNITS.map(u => u.id).join(", ")})`);
  return found;
}

/** Where a unit's artifact is written. The kernel keeps its historical name. */
export function outputPathFor(unit: UnitDef): string {
  return new URL(unit.id === "kernel" ? "dist/naiowod.ts" : `dist/naiowod-${unit.id}.ts`, ROOT).pathname;
}
