// =============================================================================
// GENERATE docs/commands.md - every verb, from the registry itself
// -----------------------------------------------------------------------------
//   bun run docs:commands
//
// The reference is GENERATED rather than written, for the same reason
// dist/naiowod.ts is: a hand-written list of 100+ verbs drifts the first time
// somebody adds one. Everything here comes from the live CommandRouter, so the
// document cannot describe a command that does not exist or miss one that does.
//
// A test (test/build.test.ts) asserts the committed file matches what this
// prints, so a verb added without regenerating fails the suite.
// =============================================================================
import "../src/host-mock";
import { init } from "../src/index";
import { CommandRouter } from "../src/command";

export const COMMANDS_DOC_PATH = new URL("../docs/commands.md", import.meta.url).pathname;

// The bare [[help]] reply and every [[help <verb>]] reply, exactly as a player
// sees them - routed, not reconstructed, so the document shows the real thing.
export async function renderCommandReference(): Promise<string> {
  await init();
  const verbs = CommandRouter.verbs().slice().sort();
  const deprecated = CommandRouter.deprecatedVerbs().slice().sort((a, b) => a.verb.localeCompare(b.verb));
  const bareHelp = await CommandRouter.route("help");

  const rows: string[] = [];
  const detail: string[] = [];
  for (const verb of verbs) {
    const spec = CommandRouter.specFor(verb);
    // A pipe must be escaped inside a TABLE cell and left ALONE inside a fenced
    // block - they are different contexts and the same string cannot serve
    // both. `cell()` is the table form; everything else stays verbatim, so the
    // usage a reader copies is the usage they can type.
    const cell = (t: string): string => t.replace(/\|/g, "\\|");
    const summary = spec?.summary ?? "";
    const usage = CommandRouter.helpFor(verb) ?? "";
    // The usage line is "<grammar>  (summary)"; the fenced block wants the
    // grammar on its own.
    const grammar = usage.replace(/\s*\([^()]*\)\s*$/, "").trim();
    rows.push(`| \`${verb}\` | ${cell(summary) || "—"} |`);

    const params = (spec?.params ?? []).map(p => {
      const kind = p.kind === "positional" ? "positional" : "named";
      const req = p.required ? " **required**" : "";
      const opts = p.options?.length ? ` — one of \`${p.options.join("`, `")}\`` : "";
      const type = p.type ? ` \`${p.type}\`` : "";
      // A param with no `desc` still has a `hint` - its grammar - which is more
      // use to a reader than an empty cell.
      const meaning = cell(p.desc ?? "") || (p.hint ? `\`${cell(p.hint)}\`` : "—");
      const ex = p.example ? ` <br>*e.g.* \`${cell(String(p.example))}\`` : "";
      return `| \`${p.key}\` | ${kind}${type}${req} | ${meaning}${opts}${ex} |`;
    });

    detail.push(
      `### \`${verb}\`\n`,
      summary ? `${summary}\n` : "",
      "```\n" + `[[${grammar || verb}]]` + "\n```\n",
      spec?.note ? `> ${spec.note}\n` : "",
      params.length
        ? `| argument | kind | meaning |\n|---|---|---|\n${params.join("\n")}\n`
        : "_No arguments._\n",
      "**`[[help " + verb + "]]`** replies:\n",
      "```\n" + (await CommandRouter.route(`help ${verb}`)) + "\n```\n",
    );
  }

  return [
    "# Command reference",
    "",
    "> **GENERATED — do not edit.** `bun run docs:commands` rewrites this file from",
    "> the live `CommandRouter`, and a test asserts the committed copy matches. If a",
    "> verb is here it exists; if it exists it is here.",
    "",
    "Commands are written `[[like this]]` in the Text Adventure input box. Several",
    "may share one line; each is replaced by its `[SYSTEM: …]` reply.",
    "",
    "---",
    "",
    "## `[[help]]` — what it publishes",
    "",
    "With no argument it lists every current verb. `[[help]]` KEEPS its name —",
    "every other read-only verb was renamed `show-*`, but this is the one command",
    "a player types before they know anything at all. `[[show-help]]` is an alias.",
    "",
    "```",
    bareHelp,
    "```",
    "",
    "With a verb it prints that verb's **usage line**, which is derived from the",
    "verb's `CommandSpec` — the same declaration that builds its window. Nothing is",
    "written twice, so help can never disagree with the parser.",
    "",
    "**Anything named `show-*` only looks at things.** Its reply is stripped from",
    "the AI's context before generation; `in-story=true` on any of them keeps that",
    "one reply in the story.",
    "",
    "---",
    "",
    `## All ${verbs.length} commands`,
    "",
    "| command | what it does |",
    "|---|---|",
    ...rows,
    "",
    "---",
    "",
    // Old names still route, and a reader who finds one in an old card or an
    // old habit needs to be told where it went - but they are not the surface,
    // so they are a footnote rather than rows in the table above.
    `## ${deprecated.length} older names that still work`,
    "",
    "Each does exactly what it always did, then says what replaced it. They are",
    "left out of `[[help]]` and out of the table above: the current",
    "vocabulary is what a player should be reading.",
    "",
    "| old name | now |",
    "|---|---|",
    ...deprecated.map(d => `| \`${d.verb}\` | \`${d.replacedBy}\` |`),
    "",
    "---",
    "",
    "## Each command in detail",
    "",
    ...detail,
  ].join("\n").replace(/\n{3,}/g, "\n\n") + "\n";
}

if (import.meta.main) {
  const text = await renderCommandReference();
  await Bun.write(COMMANDS_DOC_PATH, text);
  const verbs = CommandRouter.verbs().length;
  console.log(`[docs] wrote docs/commands.md - ${verbs} commands, ${text.split("\n").length} lines`);
}
