// =============================================================================
// WIZARD - a medium-agnostic engine for guided, multi-step configuration
// -----------------------------------------------------------------------------
// A wizard definition is a small state machine over PLAIN-JSON state: start()
// yields the first prompt, answer(state, reply) consumes a normalized reply and
// yields the next prompt (or done). Prompts are STRUCTURED (kind, options with
// value+label, default, progress) so any medium can render them: the text
// "prompt -> reply" renderer below is one medium; a future api.v1.ui renderer
// can map the same prompts to windows with buttons and feed replies to the same
// answer(). The engine knows nothing about storage or the host - sessions are
// persisted by the caller (game layer).
// =============================================================================

export interface WizardOption { value: string; label: string; description?: string }

export interface WizardPrompt {
  step: string;                                   // step id (stable per prompt)
  title: string;
  body: string;
  kind: "choice" | "number" | "text" | "confirm";
  options?: WizardOption[];                       // for kind "choice"
  default?: string;                               // "keep" / empty accepts this
  progress?: { at: number; of: number };
}

export type WizardStateData = Record<string, unknown>;

export interface WizardResult {
  state?: WizardStateData;   // updated state (present while the wizard runs)
  prompt?: WizardPrompt;     // next prompt (absent when done)
  error?: string;            // reply rejected; re-ask the same prompt
  done?: boolean;
  summary?: string;          // closing message when done
}

export interface WizardDefinition {
  id: string;
  title: string;
  start(ctx: unknown): WizardResult | Promise<WizardResult>;
  answer(state: WizardStateData, reply: string): WizardResult | Promise<WizardResult>;
}

// Normalize a raw reply against a prompt: option number/value/label for a
// choice, integer for a number, yes/no for a confirm, verbatim for text.
// "keep" (or an empty reply) accepts the prompt's default when one exists.
// "cancel" is NOT handled here - the session layer owns exiting.
export function resolveReply(prompt: WizardPrompt, raw: string): { value: string } | { error: string } {
  const t = raw.trim();
  if ((t === "" || /^keep$/i.test(t)) && prompt.default !== undefined) return { value: prompt.default };
  switch (prompt.kind) {
    case "choice": {
      const opts = prompt.options ?? [];
      const i = parseInt(t, 10);
      if (!Number.isNaN(i) && i >= 1 && i <= opts.length) return { value: opts[i - 1].value };
      const hit = opts.find(o => o.value.toLowerCase() === t.toLowerCase() || o.label.toLowerCase() === t.toLowerCase());
      return hit ? { value: hit.value } : { error: `reply with an option (1-${opts.length})` };
    }
    case "number": {
      const v = parseInt(t, 10);
      return Number.isNaN(v) ? { error: "reply with a number" } : { value: String(v) };
    }
    case "confirm": {
      if (/^(y|yes|true)$/i.test(t)) return { value: "yes" };
      if (/^(n|no|false)$/i.test(t)) return { value: "no" };
      return { error: 'reply "yes" or "no"' };
    }
    default:
      return { value: t };
  }
}

// The text medium: one prompt -> one single-line message (the host forbids
// newlines in inputText anyway).
export function renderPromptText(p: WizardPrompt): string {
  const prog = p.progress ? `[${p.progress.at}/${p.progress.of}] ` : "";
  const opts = (p.options ?? []).map((o, i) => `${i + 1}) ${o.label}${o.description ? ` - ${o.description}` : ""}`).join("  ");
  const hint = p.kind === "number" ? "reply with a number"
    : p.kind === "confirm" ? 'reply "yes" or "no"'
    : p.kind === "choice" ? "reply with an option number"
    : "reply with text";
  const keep = p.default !== undefined ? `; "keep" = ${p.default === "" ? "skip" : p.default}` : "";
  return `${prog}${p.title} - ${p.body}${opts ? ` ${opts}.` : ""} (${hint}${keep}; "cancel" exits)`;
}
