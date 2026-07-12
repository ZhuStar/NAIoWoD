// =============================================================================
// COMMAND LAYER - the engine's one bus: parse, describe, compose, dispatch
// -----------------------------------------------------------------------------
// Everything that acts on the game speaks [[commands]]: typed input, windows,
// and (later) the AI Storyteller itself. This module is that bus and knows
// NOTHING about stores or rules: registration carries a declarative
// CommandSpec, so a verb's grammar lives in exactly one place - [[help]] text
// is DERIVED from it and windows COMPOSE from it (composeCommand is the only
// place that quotes/sanitizes). Anything the game layer must do before a
// command runs (creator-mode lorebook sync) registers a beforeRoute hook -
// the router dispatches, the game decides.
// =============================================================================
import { StringUtil } from "./core/traits";
import { Rng } from "./core/dice";

// --- PARSER ------------------------------------------------------------------
// A command body -> { name, positional[], named{}, raw }. Pure and
// dispatch-agnostic: it only tokenizes (respecting quotes). A token
// `key=value` (or key="quoted") is a named argument; any other bare or quoted
// token is positional, in order.
export interface ParsedCommand {
  name: string;
  positional: string[];
  named: Record<string, string>;
  raw: string;
}

export class CommandParser {
  static parse(body: string): ParsedCommand {
    const raw = body.trim();
    const name = (raw.match(/^[A-Za-z][\w-]*/)?.[0] ?? "").toLowerCase();
    // BODY-LEVEL gluing, before tokenization (backtick literals excluded):
    // spaces after `@` and around `::` vanish, so "@char :: default :: sire"
    // is ONE token. Tokenization would otherwise split them apart.
    const rest = raw.slice(name.length)
      .split(/(`[^`]*`)/g)
      .map((seg, i) => i % 2 === 1 ? seg : seg.replace(/@\s+/g, "@").replace(/\s*::\s*/g, "::"))
      .join("");
    const positional: string[] = [];
    const named: Record<string, string> = {};
    // key=value | key="v" | key='v' | key=`literal` | "quoted" | 'quoted' |
    // `literal` | bareword. Every value passes through the BOUNDARY normalizer
    // (lowercase, @-space stripping, ::->:, list/pool space stripping,
    // whitespace->hyphen) EXCEPT backtick literals, which stay verbatim -
    // that's the escape hatch for display text (labels, notes, echoes).
    const tokenRe = /([A-Za-z][\w-]*)\s*=\s*("([^"]*)"|'([^']*)'|`([^`]*)`|\S+)|"([^"]*)"|'([^']*)'|`([^`]*)`|(\S+)/g;
    for (const m of rest.matchAll(tokenRe)) {
      if (m[1] !== undefined) {
        const key = m[1].toLowerCase();
        named[key] = m[5] !== undefined ? m[5] : StringUtil.normalizeInput(m[3] ?? m[4] ?? m[2]);
      } else if (m[8] !== undefined) {
        positional.push(m[8]);   // backtick literal: verbatim
      } else {
        positional.push(StringUtil.normalizeInput(m[6] ?? m[7] ?? m[9]));
      }
    }
    return { name, positional, named, raw };
  }
}

// --- COMMAND SPECS -----------------------------------------------------------
// The declarative description of a verb's arguments. Handlers remain the
// validators (a spec never rejects input); the spec is the SHARED knowledge:
// derived help, window forms, and command composition all read it.
export type ParamType = "string" | "int" | "enum" | "literal";

export interface ParamSpec {
  key: string;                       // named key, or the positional's label
  kind: "positional" | "named";
  type?: ParamType;                  // default "string"; "literal" composes with backticks
  required?: boolean;
  options?: string[];                // enum vocabulary (reference exported arrays)
  default?: string;                  // window pre-seed AND compose fallback
  hint?: string;                     // help display, e.g. res[::effect][!] or "1 turn|until x|instant"
  desc?: string;                     // window field label / long description
  example?: string;                  // window placeholder, e.g. "e.g. status, anonymity"
}

export interface CommandSpec {
  summary: string;                   // the parenthetical in help
  params?: ParamSpec[];
  openNamed?: boolean;               // accepts arbitrary extra named args (afflict's slots)
  note?: string;                     // extra help remark, appended to the summary
}

// Derive the one-line usage string [[help]] shows for a verb.
export function describeCommandSpec(verb: string, spec: CommandSpec): string {
  const parts: string[] = [verb];
  for (const p of spec.params ?? []) {
    let core: string;
    if (p.kind === "positional") core = p.hint ?? `<${p.key}>`;
    else if (p.type === "enum" && p.options?.length) core = `${p.key}=${p.options.join("|")}`;
    else if (p.type === "int") core = `${p.key}=${p.hint ?? "N"}`;
    else core = `${p.key}=${p.hint ?? '".."'}`;
    parts.push(p.required ? core : `[${core}]`);
  }
  if (spec.openNamed) parts.push("[<key>=<value> ...]");
  const tail = spec.note ? `${spec.summary}; ${spec.note}` : spec.summary;
  return `${parts.join(" ")}  (${tail})`;
}

// Compose a routable command body from per-param values. THE one place that
// quotes: the grammar has no escape syntax (players type these), so characters
// that would break tokenization are stripped - double quotes from quoted
// values, backticks from literals. Empty values are omitted (the handler's
// own validation speaks); declared params compose in order, then openNamed
// extras. `literal` params compose in backticks and stay verbatim at parse.
export function composeCommand(verb: string, values: Record<string, string | undefined>, spec: CommandSpec): string {
  const parts: string[] = [verb];
  const emit = (p: ParamSpec, raw: string): string | undefined => {
    let v = raw.trim();
    if (!v) return undefined;
    if (p.type === "literal") {
      v = v.replace(/`/g, "");
      return p.kind === "named" ? `${p.key}=\`${v}\`` : `\`${v}\``;
    }
    v = v.replace(/"/g, "");
    const quoted = /\s/.test(v) ? `"${v}"` : v;
    return p.kind === "named" ? `${p.key}=${quoted}` : quoted;
  };
  const declared = new Set<string>();
  for (const p of spec.params ?? []) {
    declared.add(p.key);
    const out = emit(p, values[p.key] ?? p.default ?? "");
    if (out) parts.push(out);
  }
  if (spec.openNamed) {
    for (const [k, v] of Object.entries(values)) {
      if (declared.has(k) || v === undefined) continue;
      const clean = v.trim().replace(/"/g, "");
      if (clean) parts.push(`${k}="${clean}"`);
    }
  }
  return parts.join(" ");
}

// --- ROUTER ------------------------------------------------------------------
// A registry maps a verb to its handler + spec, so a new command is just a
// register() call (and could one day be defined from a lorebook entry).
// beforeRoute hooks run before every dispatch - the game layer's seam for
// creator-mode syncing, and later the turn system's.
export interface CommandContext { rng?: Rng; }
export type CommandHandler = (cmd: ParsedCommand, ctx: CommandContext) => Promise<string>;

export class CommandRouter {
  private static _registry = new Map<string, { handler: CommandHandler; spec: CommandSpec }>();
  private static _beforeRoute: Array<() => Promise<void>> = [];

  static register(verb: string, handler: CommandHandler, spec: CommandSpec): void {
    CommandRouter._registry.set(verb.toLowerCase(), { handler, spec });
  }
  static beforeRoute(hook: () => Promise<void>): void { CommandRouter._beforeRoute.push(hook); }
  static verbs(): string[] { return [...CommandRouter._registry.keys()]; }
  static specFor(verb: string): CommandSpec | undefined { return CommandRouter._registry.get(verb.toLowerCase())?.spec; }
  // Registered verb -> its one-line usage, derived from the spec (drives [[help]]).
  static helpFor(verb: string): string | undefined {
    const def = CommandRouter._registry.get(verb.toLowerCase());
    return def && describeCommandSpec(verb.toLowerCase(), def.spec);
  }
  static help(): { verb: string; help: string }[] {
    return [...CommandRouter._registry.entries()].map(([verb, def]) => ({ verb, help: describeCommandSpec(verb, def.spec) }));
  }

  // Routes one command body to its handler; returns the OOC replacement text
  // (always a single line - the host strips newlines from inputText).
  static async route(body: string, ctx: CommandContext = {}): Promise<string> {
    const cmd = CommandParser.parse(body);
    for (const hook of CommandRouter._beforeRoute) await hook();
    const def = CommandRouter._registry.get(cmd.name);
    if (!def) return `((OOC-Storyteller: Unknown command "${cmd.name}". Available: ${CommandRouter.verbs().join(", ")}.))`;
    return def.handler(cmd, ctx);
  }
}
