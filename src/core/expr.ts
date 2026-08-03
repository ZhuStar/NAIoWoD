// =============================================================================
// CORE / EXPRESSIONS - the one arithmetic the engine speaks
// -----------------------------------------------------------------------------
// Every number a chronicle can WRITE instead of hard-code goes through here: a
// dice pool ("dexterity+melee"), a difficulty ("stamina + 3"), an effect cap, a
// purse budget, a trait ceiling, and a derived value ("12 - background:generation").
// One language, so there is one thing to learn and one thing to document.
//
// THE HYPHEN RULE. Trait names contain hyphens (self-control, al-ikhlas,
// assamite-sorcery) and arithmetic needs subtraction. They are told apart by
// what FOLLOWS the hyphen, not by spacing alone:
//
//     self-control          one name      (a letter follows the hyphen)
//     courage - 1           subtraction   (a space follows it)
//     12-generation         subtraction   (a number can never absorb a hyphen)
//
// So `a - b` between two NAMES needs the spaces; everywhere else the hyphen
// falls out right on its own. One sentence, and every expression written before
// this module existed still parses to the same number.
//
// A REFERENCE is a colon-separated path - `courage`, `background:generation`,
// `budget:freebie`. The scope decides what a path means; this module only
// spells them. An unanswered path is worth 0 AND is reported in `unknown`,
// which is the whole point: a typo used to silently read as zero.
//
// Nothing throws. A malformed expression comes back as value 0 with `error`
// set, because a bad card must never take the story down with it.
//
// Pure: no imports, no host access.
// =============================================================================

// One addend of an expression, for the reports that show their work.
export interface ExprTerm {
  label: string;                          // the term as written
  value: number;                          // its SIGNED contribution to the total
  kind: "literal" | "ref" | "compound";
  // Subtracted rather than added. A separate flag because a term worth ZERO is
  // still subtracted, and -0 cannot say so.
  negated?: boolean;
  from?: string;                          // where a reference's value came from
  unknown?: boolean;                      // nothing answered this reference
}

export interface ExprResult {
  value: number;
  terms: ExprTerm[];                      // the top-level addends, in order
  unknown: string[];                      // every path nothing answered
  error?: string;                         // set when the text could not be read
}

// What a path is worth, and (optionally) where that came from. `undefined` -
// not "0" - is how a scope says it does not know the name.
export interface ExprScope {
  lookup(path: string[]): { value: number; from?: string } | undefined;
  // Domain functions beyond the built-ins; `undefined` = no such function.
  call?(name: string, args: number[]): number | undefined;
}

// A scope over a plain map of numbers, for tests and for the simple callers.
export function mapScope(values: Record<string, number>): ExprScope {
  return {
    lookup: (path) => {
      const key = path.join(":");
      return key in values ? { value: values[key] } : undefined;
    },
  };
}

// --- TOKENS ------------------------------------------------------------------
type Token =
  | { t: "num"; v: number; start: number; end: number }
  | { t: "name"; v: string; start: number; end: number }
  | { t: "op"; v: string; start: number; end: number };

const isDigit = (c: string): boolean => c >= "0" && c <= "9";
const isLetter = (c: string): boolean => (c >= "a" && c <= "z") || (c >= "A" && c <= "Z");
const isNameStart = (c: string): boolean => isLetter(c) || c === "_" || c === "@";
const isNameChar = (c: string): boolean => isLetter(c) || isDigit(c) || c === "_" || c === "@" || c === "." || c === ":";

function tokenize(src: string): { tokens: Token[]; error?: string } {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === " " || c === "\t" || c === "\n" || c === "\r") { i++; continue; }
    const start = i;
    if (isDigit(c)) {
      while (i < src.length && isDigit(src[i])) i++;
      if (src[i] === "." && isDigit(src[i + 1])) { i++; while (i < src.length && isDigit(src[i])) i++; }
      tokens.push({ t: "num", v: parseFloat(src.slice(start, i)), start, end: i });
      continue;
    }
    if (isNameStart(c)) {
      i++;
      // A hyphen belongs to the NAME only when a letter follows it; otherwise it
      // is the subtraction operator. See THE HYPHEN RULE above.
      while (i < src.length && (isNameChar(src[i]) || (src[i] === "-" && isLetter(src[i + 1] ?? "")))) i++;
      // `::` is the path separator everywhere else in the engine and folds to a
      // single `:` internally. The boundary normalizer does that for ordinary
      // arguments - but an expression inside BACKTICKS skips normalization by
      // design, so it has to be done here too or `system::time::now` would be a
      // different name from `system:time:now`.
      tokens.push({ t: "name", v: src.slice(start, i).toLowerCase().replace(/::+/g, ":"), start, end: i });
      continue;
    }
    // Two-character comparisons before one-character ones, or ">=" reads as ">".
    const two = src.slice(i, i + 2);
    if ([">=", "<=", "==", "!="].includes(two)) { tokens.push({ t: "op", v: two, start, end: i += 2 }); continue; }
    if ("+-*/(),><=".includes(c)) { tokens.push({ t: "op", v: c, start, end: ++i }); continue; }
    return { tokens, error: `unexpected "${c}" at position ${i + 1}` };
  }
  return { tokens };
}

// --- BUILT-IN FUNCTIONS ------------------------------------------------------
// Variadic where variadic is what you mean; a scope may add domain functions
// (trait-max, road-virtues, ...) through ExprScope.call.
const BUILTINS: Record<string, (args: number[]) => number> = {
  min: (a) => (a.length ? Math.min(...a) : 0),
  max: (a) => (a.length ? Math.max(...a) : 0),
  sum: (a) => a.reduce((x, y) => x + y, 0),
  abs: (a) => Math.abs(a[0] ?? 0),
  floor: (a) => Math.floor(a[0] ?? 0),
  ceil: (a) => Math.ceil(a[0] ?? 0),
  round: (a) => Math.round(a[0] ?? 0),
};
export const BUILTIN_FUNCTIONS: string[] = Object.keys(BUILTINS);

// --- THE PARSER / EVALUATOR --------------------------------------------------
// Recursive descent, evaluating as it goes: there is no tree to keep, because
// nothing re-runs an expression against a different scope.
//
//   condition := disjunction                       (evaluateCondition only)
//   disjunction := conjunction ('or' conjunction)*
//   conjunction := negation ('and' negation)*
//   negation    := 'not' negation | comparison
//   comparison  := expr (('>'|'>='|'<'|'<='|'='|'=='|'!=') expr)?
//   expr    := term (('+' | '-') term)*
//   term    := factor (('*' | '/') factor)*
//   factor  := '-' factor | primary
//   primary := number | name '(' args ')' | name | '(' expr ')'
//
// The comparison layer exists for one reason: an affliction that lasts "until
// the next full moon" or "until his blood runs out" is a CONDITION, not a sum.
// It is reached only through evaluateCondition, so every existing arithmetic
// expression parses exactly as it did - a difficulty or a budget never sees it.
// Truth is 1 and falsehood is 0, so a condition is still a number and still
// composes with the rest of the language.
class Evaluator {
  private pos = 0;
  readonly unknown: string[] = [];
  readonly terms: ExprTerm[] = [];
  error?: string;

  constructor(private readonly src: string, private readonly tokens: Token[], private readonly scope: ExprScope) {}

  private peek(): Token | undefined { return this.tokens[this.pos]; }
  private isOp(v: string): boolean { const t = this.peek(); return !!t && t.t === "op" && t.v === v; }
  private take(): Token | undefined { return this.tokens[this.pos++]; }
  private fail(msg: string): number { this.error ??= msg; return 0; }

  // --- THE CONDITION LAYER (evaluateCondition only) --------------------------
  // `and` / `or` / `not` are NAME tokens, so they are recognised here by value
  // rather than by the tokenizer - which means a trait may still be called
  // "order" or "android" without colliding.
  condition(): number { return this.disjunction(); }

  private isWord(w: string): boolean { const t = this.peek(); return !!t && t.t === "name" && t.v === w; }

  private disjunction(): number {
    let value = this.conjunction();
    while (this.isWord("or")) { this.take(); const rhs = this.conjunction(); value = (value || rhs) ? 1 : 0; }
    return value;
  }

  private conjunction(): number {
    let value = this.negation();
    while (this.isWord("and")) { this.take(); const rhs = this.negation(); value = (value && rhs) ? 1 : 0; }
    return value;
  }

  private negation(): number {
    if (this.isWord("not")) { this.take(); return this.negation() ? 0 : 1; }
    return this.comparison();
  }

  private comparison(): number {
    const left = this.expr(true);
    for (const op of [">=", "<=", "==", "!=", ">", "<", "="] as const) {
      if (!this.isOp(op)) continue;
      this.take();
      const right = this.expr(true);
      switch (op) {
        case ">": return left > right ? 1 : 0;
        case "<": return left < right ? 1 : 0;
        case ">=": return left >= right ? 1 : 0;
        case "<=": return left <= right ? 1 : 0;
        case "!=": return left !== right ? 1 : 0;
        default: return left === right ? 1 : 0;   // "=" and "=="
      }
    }
    return left;
  }

  // The TOP level is where terms are recorded, so `a + b - 3` reports three
  // addends the way the roll report has always shown a pool.
  expr(top = false): number {
    let value = this.termAt(top, 1);
    for (;;) {
      if (this.isOp("+")) { this.take(); value += this.termAt(top, 1); continue; }
      if (this.isOp("-")) { this.take(); value -= this.termAt(top, -1); continue; }
      return value;
    }
  }

  private termAt(top: boolean, sign: number): number {
    const start = this.peek()?.start ?? this.src.length;
    const before = this.terms.length;
    const value = this.term();
    if (!top) return value;
    const label = this.src.slice(start, this.tokens[this.pos - 1]?.end ?? start).trim();
    // A term that recorded exactly one leaf, and IS that leaf, keeps its
    // identity: a bare reference stays a reference. Anything bigger - a
    // product, a parenthesised sum - collapses into a single compound addend.
    const leaf = this.terms.length === before + 1 ? this.terms[before] : undefined;
    this.terms.length = before;
    const negated = sign < 0 ? { negated: true } : {};
    this.terms.push(leaf && leaf.label === label
      ? { ...leaf, value: sign * value, ...negated }
      : { label, value: sign * value, kind: "compound", ...negated });
    return value;
  }

  private term(): number {
    let value = this.factor();
    for (;;) {
      if (this.isOp("*")) { this.take(); value *= this.factor(); continue; }
      if (this.isOp("/")) { this.take(); const d = this.factor(); value = d === 0 ? this.fail("division by zero") : value / d; continue; }
      return value;
    }
  }

  private factor(): number {
    if (this.isOp("-")) { this.take(); return -this.factor(); }
    if (this.isOp("+")) { this.take(); return this.factor(); }
    return this.primary();
  }

  private primary(): number {
    const tok = this.take();
    if (!tok) return this.fail("the expression ends early");
    if (tok.t === "num") {
      this.terms.push({ label: this.src.slice(tok.start, tok.end), value: tok.v, kind: "literal" });
      return tok.v;
    }
    if (tok.t === "op" && tok.v === "(") {
      const value = this.expr();
      if (!this.isOp(")")) return this.fail("a ( is never closed");
      this.take();
      return value;
    }
    if (tok.t !== "name") return this.fail(`"${tok.v}" is not a value`);
    if (this.isOp("(")) return this.callFunction(tok.v);
    const path = tok.v.split(":").filter(p => p.length > 0);
    const hit = this.scope.lookup(path);
    if (!hit) this.unknown.push(tok.v);
    this.terms.push({ label: tok.v, value: hit?.value ?? 0, kind: "ref", from: hit?.from, unknown: !hit });
    return hit?.value ?? 0;
  }

  private callFunction(name: string): number {
    this.take();                                  // the (
    const args: number[] = [];
    const before = this.terms.length;
    if (!this.isOp(")")) {
      for (;;) {
        args.push(this.expr());
        if (this.isOp(",")) { this.take(); continue; }
        break;
      }
    }
    if (!this.isOp(")")) return this.fail(`${name}( is never closed`);
    this.take();
    this.terms.length = before;                   // the arguments are not addends
    const domain = this.scope.call?.(name, args);
    if (domain !== undefined) return domain;
    const builtin = BUILTINS[name];
    if (!builtin) return this.fail(`no function "${name}" (known: ${BUILTIN_FUNCTIONS.join(", ")})`);
    return builtin(args);
  }

  atEnd(): boolean { return this.pos >= this.tokens.length; }
  // What is left over when the parse stopped early - "3 4" and "a b" are not
  // expressions, and saying WHICH text confused it beats "syntax error".
  rest(): string { return this.src.slice(this.peek()?.start ?? this.src.length).trim(); }
}

// Read an expression against a scope. Never throws: a malformed expression is
// worth 0 and says why.
export function evaluateExpr(expr: string, scope: ExprScope): ExprResult {
  const src = (expr ?? "").trim();
  if (!src) return { value: 0, terms: [], unknown: [] };
  const { tokens, error } = tokenize(src);
  if (error) return { value: 0, terms: [], unknown: [], error };
  const ev = new Evaluator(src, tokens, scope);
  const value = ev.expr(true);
  if (!ev.error && !ev.atEnd()) ev.error = `nothing joins "${ev.rest()}" to what comes before it`;
  return {
    value: ev.error ? 0 : value,
    terms: ev.error ? [] : ev.terms,
    unknown: ev.error ? [] : ev.unknown,
    ...(ev.error ? { error: ev.error } : {}),
  };
}

// A CONDITION: the same language with comparisons and and/or/not on top,
// answering true or false. This is what "until X" is written in - an affliction
// that lasts "until the next full moon" (`full-moons >= 1`) or "until his blood
// runs out" (`blood <= 0`) or both (`full-moons >= 1 or blood <= 0`).
//
// An empty condition is FALSE, not true: "no condition" must never read as
// "already over", or an affliction with a malformed card would end instantly.
export interface ConditionResult extends ExprResult { truth: boolean }
export function evaluateCondition(expr: string, scope: ExprScope): ConditionResult {
  const src = (expr ?? "").trim();
  if (!src) return { value: 0, terms: [], unknown: [], truth: false };
  const { tokens, error } = tokenize(src);
  if (error) return { value: 0, terms: [], unknown: [], error, truth: false };
  const ev = new Evaluator(src, tokens, scope);
  const value = ev.condition();
  if (!ev.error && !ev.atEnd()) ev.error = `nothing joins "${ev.rest()}" to what comes before it`;
  return {
    value: ev.error ? 0 : value,
    terms: ev.error ? [] : ev.terms,
    unknown: ev.error ? [] : ev.unknown,
    ...(ev.error ? { error: ev.error } : {}),
    // A condition the engine could not read is FALSE and says why, rather than
    // quietly ending something.
    truth: !ev.error && value !== 0,
  };
}

// A number, or an expression that yields one. Every rules field that a
// chronicle might want to write in terms of the character uses this type.
export type Numeric = number | string;

// Resolve one. A malformed or empty expression falls back to the DEFAULT rather
// than to zero, so a bad card degrades to the ordinary rule.
export function evalNumeric(value: Numeric | undefined, scope: ExprScope, fallback: number): number {
  if (value === undefined) return fallback;
  if (typeof value === "number") return value;
  const out = evaluateExpr(value, scope);
  return out.error ? fallback : out.value;
}

// Every reference an expression makes, without evaluating it - what a cycle
// check and a "where did this number come from" report are built on.
export function exprRefs(expr: string): string[] {
  const { tokens, error } = tokenize((expr ?? "").trim());
  if (error) return [];
  const out: string[] = [];
  tokens.forEach((tok, i) => {
    const next = tokens[i + 1];
    const isCall = next && next.t === "op" && next.v === "(";
    if (tok.t === "name" && !isCall && !out.includes(tok.v)) out.push(tok.v);
  });
  return out;
}

// "Strength 4 + Brawl 3 - 1" - the addends with their values, for a report that
// shows its work. Unknown references are marked, never hidden.
export function describeTerms(terms: ExprTerm[]): string {
  return terms.map((t, i) => {
    // The sign is the term's own contribution; a label that already carries a
    // unary sign ("-3") must not print it twice.
    const bare = t.label.replace(/^[-+]\s*/, "");
    const body = t.kind === "literal"
      ? `${Math.abs(t.value)}`
      : `${bare} ${Math.abs(t.value)}${t.unknown ? " (unknown)" : t.from ? ` (${t.from})` : ""}`;
    const minus = t.negated || t.value < 0;
    if (i === 0) return minus ? `-${body}` : body;
    return `${minus ? "-" : "+"} ${body}`;
  }).join(" ");
}
