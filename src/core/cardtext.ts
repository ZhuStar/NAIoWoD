// =============================================================================
// CORE / CARD TEXT - the readable data language of lorebook cards
// -----------------------------------------------------------------------------
// Every card the engine reads or writes (character sheets, config registries,
// merits, saved rolls, success tables) is written in THIS, not JSON. It is a
// small hand-rolled dialect - the artifact ships with zero dependencies, so a
// partial implementation of real YAML would be worse than a complete
// implementation of something smaller.
//
// The whole grammar:
//
//   # a comment                     '#' at line start or after a space
//   key: value                      the key ends at the first ": " (or a
//                                   trailing ":"), so "he said: hi" is fine
//   key:                            a block: whatever is indented below
//     inner: 1
//   key: value                      a value PLUS an annotation block; the
//     note: why                     value itself lands under `value`
//   key: a, b, c                    an inline list (commas)
//   key:                            a block list
//     - a
//     - b
//   mentor: Velia                   a REPEATED key is a list - the one thing
//   mentor: Belial                  JSON could not say at all
//   - op: immune                    a list of blocks: "- " starts an item and
//     target: fear                  the lines under it belong to that item
//
// Scalars type themselves: 3 is a number, yes/no are booleans, `none` is null,
// anything else is text with its case preserved. Quote ("...") to force text -
// the writer quotes for you whenever it would otherwise be misread.
//
// Two small tables (TEXT_KEYS, LIST_KEYS) let a human write the obvious thing:
// a comma inside a `description` is punctuation, and one `role:` is still a
// list of one. FIELD_ALIASES lets cards spell the engine's camelCase fields
// with hyphens ("difficulty-expr"). Everything else is typed by its shape.
//
// Pure: no imports from the host layer.
// =============================================================================

export interface CardMap { [key: string]: CardValue }
export type CardValue = string | number | boolean | null | CardValue[] | CardMap;

// A node's own value when it also carries an annotation block:
//   sanctum: 8
//     note: the Library of the Unseen
// reads as { value: 8, note: "..." }. The key IS the key, so nothing needs a
// separate `name:` field - that was the question this answers.
export const CARD_VALUE_KEY = "value";

// Keys whose value is prose or a single name: a comma in them is punctuation,
// and a numeric-looking value stays text. Compared case-insensitively.
export const TEXT_KEYS = new Set([
  "name", "key", "id", "description", "note", "label", "blurb", "until",
  "interval", "topic", "title", "specialty", "param", "pool", "difficultyexpr",
  "reason", "summary",
]);

// Keys the engine always wants as a list, so one item needs no special syntax
// ("roles: quintessence" is a list of one). Compared case-insensitively.
export const LIST_KEYS = new Set([
  "roles", "replaces", "tags", "templates", "meritsflaws", "targetmustbe",
  "apply", "passive", "rows", "steps", "startoptions", "members", "scope",
  "tiers", "bindings",
]);

// A comma-joined TOKEN string the engine splits itself (EffectOp.target):
// kept as text, but the spacing around the commas is squeezed out.
const TOKEN_TEXT_KEYS = new Set(["target"]);

// Wire spelling <-> engine field, for the handful of fields whose names are
// camelCase. Cards write them hyphenated; anything NOT listed passes through
// untouched, because trait names, merit keys and table names are DATA and must
// never be renamed. The camelCase spelling is also accepted on input.
const FIELD_ALIASES: Record<string, string> = {
  "difficulty-expr": "difficultyExpr",
  "difficulty-mod": "difficultyMod",
  "difficulty-cap": "difficultyCap",
  "dice-mod": "diceMod",
  "merits-flaws": "meritsFlaws",
  "pool-starts": "poolStarts",
  "start-min": "startMin",
  "start-max": "startMax",
  "start-options": "startOptions",
  "per-turn-limit": "perTurnLimit",
  "from-generation": "fromGeneration",
  "at-most-one-at": "atMostOneAt",
  "fill-to-cap": "fillToCap",
  "requires-resource": "requiresResource",
  "requires-trait": "requiresTrait",
  "requires-awakened": "requiresAwakened",
  "scales-with": "scalesWith",
  "at-least": "atLeast",
  "target-must-be": "targetMustBe",
  "max-per-use": "maxPerUse",
  "reduced-by": "reducedBy",
  "per-success": "perSuccess",
  "vs-difficulty": "vsDifficulty",
  "on-botch": "onBotch",
  "display-name": "displayName",
  "n-again": "nAgain",
};
const WIRE_ALIASES: Record<string, string> =
  Object.fromEntries(Object.entries(FIELD_ALIASES).map(([wire, field]) => [field, wire]));

// The key as the engine knows it (hyphenated wire spelling -> camelCase field).
export function canonicalKey(key: string): string {
  const k = key.trim();
  return FIELD_ALIASES[k.toLowerCase()] ?? k;
}
// The key as a card spells it (the inverse; unlisted keys are unchanged).
export function wireKey(key: string): string {
  return WIRE_ALIASES[key] ?? key;
}

const lookupKey = (key: string | undefined): string => (key ?? "").toLowerCase();
const isTextKey = (key?: string): boolean => TEXT_KEYS.has(lookupKey(key)) || TOKEN_TEXT_KEYS.has(lookupKey(key));
const isListKey = (key?: string): boolean => LIST_KEYS.has(lookupKey(key));

// =============================================================================
// READING
// =============================================================================

// Everything from an unquoted '#' (line start, or after whitespace) onward.
function stripComment(line: string): string {
  let out = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === "\\" && i + 1 < line.length) { out += ch + line[i + 1]; i++; continue; }
      if (ch === '"') quoted = false;
      out += ch;
      continue;
    }
    if (ch === '"') { quoted = true; out += ch; continue; }
    if (ch === "#" && (i === 0 || /\s/.test(line[i - 1]))) return out;
    out += ch;
  }
  return out;
}

// Leading whitespace width; a tab counts as two spaces.
function indentOf(line: string): number {
  let n = 0;
  for (const ch of line) {
    if (ch === " ") n++;
    else if (ch === "\t") n += 2;
    else break;
  }
  return n;
}

// "key: rest" -> the pair. The key ends at the FIRST colon followed by a space
// or end of line, so "trait-affinity:melee: 3" keys on the whole instance name
// and "he said: hi" is a value with a colon in it.
function splitKey(text: string): { key: string; inline: string } | undefined {
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== ":") continue;
    const next = text[i + 1];
    if (next === undefined || next === " " || next === "\t") {
      const key = text.slice(0, i).trim();
      return key.length ? { key, inline: text.slice(i + 1).trim() } : undefined;
    }
  }
  return undefined;
}

// Split on a separator at the top level - inside "..." doesn't count.
function splitTopLevel(text: string, sep: string): string[] {
  const parts: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === "\\" && i + 1 < text.length) { cur += ch + text[i + 1]; i++; continue; }
      if (ch === '"') quoted = false;
      cur += ch;
      continue;
    }
    if (ch === '"') { quoted = true; cur += ch; continue; }
    if (ch === sep) { parts.push(cur); cur = ""; continue; }
    cur += ch;
  }
  parts.push(cur);
  return parts;
}

// A "..." literal: backslash escapes, closing quote ends it, trailing junk ignored.
function unquote(text: string): string {
  let out = "";
  for (let i = 1; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\\") {
      const n = text[i + 1];
      out += n === "n" ? "\n" : n === "t" ? "\t" : n ?? "";
      i++;
      continue;
    }
    if (ch === '"') break;
    out += ch;
  }
  return out;
}

const NUMBER_RE = /^[+-]?\d+$/;
const DECIMAL_RE = /^[+-]?(?:\d+\.\d*|\.\d+)$/;

// One written value -> a typed scalar (or an inline list). The key matters:
// TEXT_KEYS never split and never auto-type.
function readScalar(raw: string, key?: string): CardValue {
  const t = raw.trim();
  if (!t.length) return "";
  if (t.startsWith('"')) return unquote(t);
  if (TOKEN_TEXT_KEYS.has(lookupKey(key))) return t.replace(/\s*,\s*/g, ",");
  if (isTextKey(key)) return t;
  if (NUMBER_RE.test(t)) return parseInt(t, 10);
  if (DECIMAL_RE.test(t)) return parseFloat(t);
  const low = t.toLowerCase();
  if (low === "true" || low === "yes" || low === "on") return true;
  if (low === "false" || low === "no" || low === "off") return false;
  if (low === "none" || low === "null") return null;
  if (t.includes(",")) {
    const parts = splitTopLevel(t, ",").map(p => readScalar(p)).filter(p => p !== "");
    return parts.length === 1 ? parts[0] : parts;
  }
  return t;
}

interface CardNode { key?: string; inline: string; children: CardNode[] }

// Text -> the indentation tree. Never throws: unreadable lines become items.
function readNodes(text: string): CardNode {
  const root: CardNode = { inline: "", children: [] };
  const stack: { indent: number; node: CardNode }[] = [{ indent: -1, node: root }];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = stripComment(rawLine);
    const body = line.trim();
    if (!body.length) continue;
    const indent = indentOf(line);
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
    const parent = stack[stack.length - 1].node;
    let node: CardNode;
    if (body === "-" || body.startsWith("- ")) {
      // A list item. "- key: value" opens a block whose first pair is inline.
      const rest = body === "-" ? "" : body.slice(2).trim();
      node = { inline: "", children: [] };
      const pair = rest.startsWith('"') ? undefined : splitKey(rest);
      if (pair) node.children.push({ key: pair.key, inline: pair.inline, children: [] });
      else node.inline = rest;
    } else {
      const pair = body.startsWith('"') ? undefined : splitKey(body);
      node = pair ? { key: pair.key, inline: pair.inline, children: [] } : { inline: body, children: [] };
    }
    parent.children.push(node);
    stack.push({ indent, node });
  }
  return root;
}

// Add a key, turning a REPEATED key into a list (the format's whole reason for
// existing: two Mentors, three passives).
function addKey(map: CardMap, key: string, value: CardValue): void {
  if (!Object.prototype.hasOwnProperty.call(map, key)) { map[key] = value; return; }
  const cur = map[key];
  if (Array.isArray(cur)) cur.push(value);
  else map[key] = [cur, value];
}

function nodeValue(node: CardNode): CardValue {
  if (!node.children.length) return readScalar(node.inline, node.key);
  const keyed = node.children.filter(c => c.key !== undefined);
  const items = node.children.filter(c => c.key === undefined);
  // No keys below: a plain list block. A stray inline value is the first item.
  if (!keyed.length) {
    const list = items.map(nodeValue);
    return node.inline ? [readScalar(node.inline, node.key), ...list] : list;
  }
  // Keys below: a block. The node's OWN value (inline, else the loose items)
  // lands under `value`; the keys are its annotations.
  const map: CardMap = {};
  if (node.inline) map[CARD_VALUE_KEY] = readScalar(node.inline, node.key);
  else if (items.length) map[CARD_VALUE_KEY] = items.map(nodeValue);
  for (const child of keyed) {
    const key = canonicalKey(child.key as string);
    let value = nodeValue({ ...child, key });
    if (isListKey(key) && !Array.isArray(value)) value = value === "" ? [] : [value];
    addKey(map, key, value);
  }
  return map;
}

// Read a card body. Undefined when there is nothing there; a map when the body
// has keys, a list when it is all "- " items. Never throws - a malformed card
// yields whatever could be read, and the player's text is never destroyed.
export function parseCardText(text: string | undefined): CardValue | undefined {
  if (!text || !text.trim().length) return undefined;
  const root = readNodes(text);
  if (!root.children.length) return undefined;
  return nodeValue(root);
}

// =============================================================================
// WRITING
// =============================================================================

const BOOLEAN_WORDS = new Set(["true", "yes", "on", "false", "no", "off", "none", "null"]);

function looksTyped(s: string): boolean {
  return NUMBER_RE.test(s) || DECIMAL_RE.test(s) || BOOLEAN_WORDS.has(s.toLowerCase());
}

function needsQuote(s: string, key?: string): boolean {
  if (!s.length) return true;
  if (s !== s.trim()) return true;
  if (/["\n\r\t]/.test(s)) return true;
  if (/(^|\s)#/.test(s)) return true;
  if (s === "-" || s.startsWith("- ")) return true;
  if (isTextKey(key)) return false;      // text keys neither split nor auto-type
  return s.includes(",") || looksTyped(s);
}

function quote(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\t/g, "\\t")}"`;
}

function writeScalar(value: CardValue, key?: string): string {
  if (value === null) return "none";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "none";
  const s = TOKEN_TEXT_KEYS.has(lookupKey(key)) ? String(value).split(",").join(", ") : String(value);
  return needsQuote(s, key) ? quote(s) : s;
}

const isScalar = (v: CardValue | undefined): boolean => v !== undefined && (v === null || typeof v !== "object");
const isMap = (v: CardValue | undefined): v is CardMap => !!v && typeof v === "object" && !Array.isArray(v);

const INLINE_LIST_WIDTH = 88;

function writeBlock(value: CardValue, indent: number, out: string[]): void {
  const pad = " ".repeat(indent);
  if (Array.isArray(value)) {
    for (const item of value) {
      if (isScalar(item)) { out.push(`${pad}- ${writeScalar(item)}`); continue; }
      if (isMap(item)) {
        const entries = Object.entries(item);
        const first = entries.find(([, v]) => isScalar(v));
        if (first) {
          out.push(`${pad}- ${wireKey(first[0])}: ${writeScalar(first[1], first[0])}`);
          for (const [k, v] of entries) if (k !== first[0]) writeEntry(k, v, indent + 2, out);
        } else {
          out.push(`${pad}-`);
          writeBlock(item, indent + 2, out);
        }
        continue;
      }
      out.push(`${pad}-`);
      writeBlock(item, indent + 2, out);
    }
    return;
  }
  if (isMap(value)) {
    for (const [k, v] of Object.entries(value)) writeEntry(k, v, indent, out);
    return;
  }
  out.push(`${pad}${writeScalar(value)}`);
}

function writeEntry(rawKey: string, value: CardValue, indent: number, out: string[]): void {
  const pad = " ".repeat(indent);
  const key = wireKey(rawKey);
  if (value === undefined) return;
  if (isScalar(value)) {
    const written = writeScalar(value, rawKey);
    out.push(value === "" ? `${pad}${key}:` : `${pad}${key}: ${written}`);
    return;
  }
  if (Array.isArray(value)) {
    if (!value.length) { out.push(`${pad}${key}:`); return; }
    if (value.every(isScalar)) {
      const inline = value.map(v => writeScalar(v)).join(", ");
      if (pad.length + key.length + 2 + inline.length <= INLINE_LIST_WIDTH) {
        out.push(`${pad}${key}: ${inline}`);
        return;
      }
    }
    // Every element an annotated value -> write it the way a human would: the
    // key REPEATED, once per value ("mentor: 4" twice, each with its own note).
    if (value.every(v => isMap(v) && CARD_VALUE_KEY in v && isScalar(v[CARD_VALUE_KEY]))) {
      for (const item of value) writeEntry(rawKey, item, indent, out);
      return;
    }
    out.push(`${pad}${key}:`);
    writeBlock(value, indent + 2, out);
    return;
  }
  // A block. When it carries the reserved `value` key, that scalar goes back on
  // the key's own line and the rest becomes the annotation block.
  const entries = Object.entries(value as CardMap);
  const own = entries.find(([k]) => k === CARD_VALUE_KEY);
  const rest = entries.filter(([k]) => k !== CARD_VALUE_KEY);
  if (own && isScalar(own[1])) {
    out.push(`${pad}${key}: ${writeScalar(own[1], rawKey)}`);
    for (const [k, v] of rest) writeEntry(k, v, indent + 2, out);
    return;
  }
  if (!entries.length) { out.push(`${pad}${key}:`); return; }
  out.push(`${pad}${key}:`);
  writeBlock(value, indent + 2, out);
}

// A value -> card text. Top-level blocks are separated by a blank line so a
// long sheet reads as sections rather than one wall.
export function formatCardText(value: CardValue | undefined): string {
  if (value === undefined) return "";
  const out: string[] = [];
  if (isMap(value)) {
    for (const [k, v] of Object.entries(value)) {
      const before = out.length;
      writeEntry(k, v, 0, out);
      const multiline = out.length - before > 1;
      if (multiline && before > 0 && out[before - 1] !== "") out.splice(before, 0, "");
    }
  } else {
    writeBlock(value, 0, out);
  }
  return out.join("\n");
}

// One-line rendering, for replies and confirmations that can't spare a block.
export function inlineCardText(value: CardValue | undefined): string {
  return formatCardText(value).split("\n").map(l => l.trim()).filter(l => l.length > 0).join("; ");
}

// =============================================================================
// COERCIONS - the schema-directed half
// -----------------------------------------------------------------------------
// The reader is deliberately untyped: it reports what was written, and the
// consumer says what it wants. That is what lets a human write `templates: mage`
// for a list, or a comma inside a sentence, without a syntax for either.
// =============================================================================

// The scalar under a node, digging through an annotation block's `value`.
function ownValue(v: CardValue | undefined): CardValue | undefined {
  return isMap(v) && CARD_VALUE_KEY in v ? v[CARD_VALUE_KEY] : v;
}

export function asNumber(v: CardValue | undefined): number | undefined {
  const own = ownValue(v);
  if (typeof own === "number") return own;
  if (typeof own === "boolean") return own ? 1 : 0;
  if (typeof own === "string" && own.trim().length && !isNaN(Number(own))) return Number(own);
  return undefined;
}

export function asBool(v: CardValue | undefined): boolean | undefined {
  const own = ownValue(v);
  if (typeof own === "boolean") return own;
  if (typeof own === "number") return own !== 0;
  if (typeof own === "string") {
    const low = own.trim().toLowerCase();
    if (low === "true" || low === "yes" || low === "on") return true;
    if (low === "false" || low === "no" || low === "off") return false;
  }
  return undefined;
}

// Text, re-joining a value a comma made into a list ("immune to fear, and to
// mind control" reads back as the sentence it was written as).
export function asText(v: CardValue | undefined, sep = ", "): string | undefined {
  const own = ownValue(v);
  if (own === undefined || own === null) return undefined;
  if (Array.isArray(own)) {
    const parts = own.map(p => asText(p, sep)).filter((p): p is string => p !== undefined);
    return parts.length ? parts.join(sep) : undefined;
  }
  if (isMap(own)) return undefined;
  const s = String(own);
  return s.length ? s : undefined;
}

// A list, wrapping a lone value ("one item" needs no syntax).
export function asList(v: CardValue | undefined): CardValue[] {
  if (v === undefined || v === null || v === "") return [];
  if (Array.isArray(v)) return v;
  return [v];
}

export function asStringList(v: CardValue | undefined): string[] {
  return asList(v).map(x => asText(x)).filter((x): x is string => x !== undefined && x.length > 0);
}

export function asMap(v: CardValue | undefined): CardMap {
  return isMap(v) ? v : {};
}

// name -> number, reading a rating written with an annotation block under it.
export function asNumberMap(v: CardValue | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, raw] of Object.entries(asMap(v))) {
    const n = asNumber(raw);
    if (n !== undefined) out[k] = n;
  }
  return out;
}

// A list of blocks that carry their own name: written either as a name-keyed
// map (the readable form) or as "- name: x" items.
export function asNamedList(v: CardValue | undefined): Array<{ name: string; body: CardMap }> {
  const out: Array<{ name: string; body: CardMap }> = [];
  if (Array.isArray(v)) {
    for (const item of v) {
      const body = asMap(item);
      const name = asText(body["name"]);
      if (name) out.push({ name, body });
    }
    return out;
  }
  for (const [name, raw] of Object.entries(asMap(v))) {
    if (!name.trim().length) continue;
    out.push({ name, body: isMap(raw) ? raw : { [CARD_VALUE_KEY]: raw } });
  }
  return out;
}

// A stable, order-independent digest of a card's DATA (used to tell a card that
// was merely re-created from one that was edited): keys sorted, lists kept in
// order, formatting and comments gone.
export function canonicalCardText(value: CardValue | undefined): string {
  const canon = (v: CardValue | undefined): string => {
    if (v === undefined) return "~";
    if (Array.isArray(v)) return `[${v.map(canon).join(",")}]`;
    if (isMap(v)) {
      return `{${Object.keys(v).sort().map(k => `${k}=${canon(v[k])}`).join(",")}}`;
    }
    return v === null ? "none" : String(v).replace(/\s+/g, " ");
  };
  return canon(value);
}
