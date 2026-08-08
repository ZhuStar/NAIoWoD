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

// --- OUTPUT VOICE ------------------------------------------------------------
// The engine's ONE reply formatter. Every command reply is the SYSTEM speaker
// in the player's wider scheme (Player / OOC-Player / ST / OOC-ST /
// <character-name>). Centralized here so re-tagging or re-wrapping the engine's
// output is a one-line change - never a find-and-replace across the handlers.
// If a general `speak(speaker, body)` lands later, `sys` becomes its SYSTEM
// specialization. Callers pass the already-composed body (interpolated string).
// The format (bracket style, label) lives HERE and nowhere else.
export function sys(body: string): string {
  return `[SYSTEM: ${body}]`;
}

// The body of a [SYSTEM: …] reply, so two replies can be folded into one block
// rather than shown as two. Returns the text unchanged if it is not one.
export function stripSys(reply: string): string {
  const m = /^\[SYSTEM: ([\s\S]*)\]$/.exec(reply.trim());
  return m ? m[1] : reply.trim();
}

// Add a note INSIDE the [SYSTEM: …] envelope, so a reply carries one block and
// not two. Falls back to appending for anything that isn't one (a handler may
// return several blocks, or plain text).
export function sysNote(reply: string, note: string): string {
  const m = /^\[SYSTEM: ([\s\S]*)\]$/.exec(reply.trim());
  return m ? sys(`${m[1]} ${note}`) : `${reply} ${sys(note)}`;
}

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

// =============================================================================
// A COMMAND ON THE WIRE - the formalized shape a distributed engine passes around
// -----------------------------------------------------------------------------
// The goal is one script per concern (one that owns time, one that owns the
// sheet, one that owns rolls) instead of one 15,000-line file. What crosses
// between them has to be PLAIN DATA, because api.v1.messaging serializes - and
// that is why everything has been pushed toward data for the last several
// passes. ParsedCommand was already there: four fields, no methods, no classes.
// It crosses a wire unchanged.
//
// An ENVELOPE is that, plus the three things a second script cannot work out
// for itself: who it is about, who asked, and which reply answers which ask.
//
// CHANNEL CONVENTION. Two per command, because the bus filters by channel and
// has no wildcards (docs/api-reference.md §messaging: the only filters are
// `channel` and `fromScriptId`):
//   `command`            - every command; where a logger or a ledger listens
//   `command:<verb>`     - one verb; where its OWNER listens
// So a time script subscribes to `command:advance-time` and hears exactly what
// it is for, while a monitor subscribes to `command` and hears everything.
// =============================================================================
export const COMMAND_CHANNEL = "command";
export const COMMAND_RESULT_CHANNEL = "command:result";
export function commandChannel(verb: string): string {
  return `${COMMAND_CHANNEL}:${verb.trim().toLowerCase()}`;
}

export interface CommandEnvelope {
  // Correlation id: a result names the command it answers. The host hands out
  // a `continuityId` on the input hook that is ideal for this - it is already
  // shared by every hook called in continuation of the same input.
  id: string;
  verb: string;                       // the command name, normalized
  positional: string[];
  named: Record<string, string>;
  raw: string;                        // what the player actually typed
  character?: string;                 // whose sheet this is about
  player?: string;
  at: number;
}

// What a script sends back when it has handled (or refused) a command.
// `handled: false` is a real answer, not a failure: it means "this verb is not
// mine", which is how a router learns nobody owns it.
export interface CommandResult {
  id: string;
  handled: boolean;
  by?: string;                        // the script id that answered
  text?: string;                      // the [SYSTEM: ...] note, ready to show
  error?: string;
}

// A parsed command, addressed. Pure: no host, no clock beyond `at`, so it is
// as testable as the parser it follows.
export function commandEnvelope(
  cmd: ParsedCommand,
  meta: { id: string; character?: string; player?: string; at?: number },
): CommandEnvelope {
  return {
    id: meta.id,
    verb: cmd.name,
    positional: [...cmd.positional],
    named: { ...cmd.named },
    raw: cmd.raw,
    ...(meta.character ? { character: meta.character } : {}),
    ...(meta.player ? { player: meta.player } : {}),
    at: meta.at ?? Date.now(),
  };
}

// The other direction: an envelope read back as the parser's own shape, so a
// receiving script routes it through exactly the machinery a local command
// takes. This is the "match the interface" half - the METHODS are rebuilt from
// the registry on the receiving side; only the data travels.
export function envelopeToCommand(env: CommandEnvelope): ParsedCommand {
  return { name: env.verb, positional: [...env.positional], named: { ...env.named }, raw: env.raw };
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
  // A NAME THAT STILL WORKS BUT IS NOT THE NAME ANY MORE - the verb that
  // replaced it. A deprecated verb routes exactly as before (nothing a player
  // typed last week breaks) but is kept OUT of [[help]]'s listing and filed in
  // its own section of docs/commands.md, so the visible surface is the current
  // one. `hidden: false` keeps it listed anyway - [[help]] itself is deprecated
  // in favour of [[show-help]] and must still be findable by a player who knows
  // nothing else.
  deprecated?: string;
  hidden?: boolean;                  // default: whatever `deprecated` implies
}
// Is this verb kept out of the listings? Deprecated implies hidden unless the
// spec says otherwise.
export function specHidden(spec: CommandSpec): boolean {
  return spec.hidden ?? spec.deprecated !== undefined;
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
  // The CURRENT vocabulary. Deprecated aliases still route; they are simply not
  // what anyone should be told to type, so every listing asks for them by name.
  static verbs(opts: { includeHidden?: boolean } = {}): string[] {
    return [...CommandRouter._registry.entries()]
      .filter(([, def]) => opts.includeHidden || !specHidden(def.spec))
      .map(([verb]) => verb);
  }
  // Mark an ALREADY REGISTERED verb as replaced by another. Used so the list of
  // what-replaced-what lives in ONE table (game.ts SHOW_SUBJECTS) rather than
  // being restated at forty scattered registration sites. Returns false when
  // the verb or its replacement is not registered - a typo in that table is a
  // test failure, not a silently dead pointer.
  static deprecate(verb: string, replacedBy: string, opts: { hidden?: boolean } = {}): boolean {
    const def = CommandRouter._registry.get(verb.toLowerCase());
    if (!def || !CommandRouter._registry.has(replacedBy.toLowerCase())) return false;
    def.spec.deprecated = replacedBy.toLowerCase();
    if (opts.hidden !== undefined) def.spec.hidden = opts.hidden;
    return true;
  }
  // Every verb whose spec names a replacement, with it.
  static deprecatedVerbs(): Array<{ verb: string; replacedBy: string }> {
    return [...CommandRouter._registry.entries()]
      .filter(([, def]) => def.spec.deprecated !== undefined)
      .map(([verb, def]) => ({ verb, replacedBy: def.spec.deprecated! }));
  }
  static specFor(verb: string): CommandSpec | undefined { return CommandRouter._registry.get(verb.toLowerCase())?.spec; }
  // Registered verb -> its one-line usage, derived from the spec (drives [[help]]).
  static helpFor(verb: string): string | undefined {
    const def = CommandRouter._registry.get(verb.toLowerCase());
    return def && describeCommandSpec(verb.toLowerCase(), def.spec);
  }
  static help(opts: { includeHidden?: boolean } = {}): { verb: string; help: string }[] {
    return [...CommandRouter._registry.entries()]
      .filter(([, def]) => opts.includeHidden || !specHidden(def.spec))
      .map(([verb, def]) => ({ verb, help: describeCommandSpec(verb, def.spec) }));
  }

  // Routes one command body to its handler; returns the OOC replacement text
  // (always a single line - the host strips newlines from inputText).
  static async route(body: string, ctx: CommandContext = {}): Promise<string> {
    const cmd = CommandParser.parse(body);
    for (const hook of CommandRouter._beforeRoute) await hook();
    const def = CommandRouter._registry.get(cmd.name);
    if (!def) return sys(`Unknown command "${cmd.name}". Available: ${CommandRouter.verbs().join(", ")}.`);
    const reply = await def.handler(cmd, ctx);
    // A deprecated verb still does its job and then says what it is called now.
    // Done HERE so a deprecation can never be declared without the pointer.
    return def.spec.deprecated
      ? sysNote(reply, `⚠ [[${cmd.name}]] is now [[${def.spec.deprecated}]].`)
      : reply;
  }
}
