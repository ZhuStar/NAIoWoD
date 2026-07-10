// =============================================================================
// WINDOWS - api.v1.ui forms that EMIT commands (no separate execution path)
// -----------------------------------------------------------------------------
// A wizard-window is just a UI over the command layer: it renders a form with
// UI Parts, binds fields to tempStorage via storageKey, and on submit composes a
// [[command]] string and routes it through the SAME CommandRouter every other
// command uses. So there is one path; the window is an abstraction over it.
//
// This first window builds a constraint group (it emits [[define-constraint]]).
// A real NovelAI window can't render off-host, so the host mock records the part
// tree and lets tests fire button callbacks (see host.ts __ui* helpers) - which
// exercises the whole window -> command -> store path without a screen.
// =============================================================================
import { api, UIPart, UiPartHelpers } from "./host";
import { CommandRouter } from "./game";

const CKEY = (k: string): string => `win:constraint:${k}`;
const RELATIONS = ["exclusive", "restricted", "forbidden"];
const DOMAINS = ["background", "merit", "flaw", "meritflaw", "any"];

// A row of buttons behaving as a single-select: the current value is marked with
// a bullet; clicking one writes it to tempStorage and re-renders.
function selectorRow(part: UiPartHelpers, label: string, key: string, options: string[], current: string, rerender: () => Promise<void>): UIPart {
  const buttons = options.map(o => part.button({
    text: o === current ? `• ${o}` : o,
    callback: async () => { await api.v1.tempStorage.set(CKEY(key), o); await rerender(); },
  }));
  return part.row({ content: [part.text({ text: `${label}:` }), ...buttons] });
}

// Read the form's tempStorage fields, compose a define-constraint command, route
// it, and show the OOC reply in-window.
async function submitConstraint(rerender: (result?: string) => Promise<void>): Promise<void> {
  const get = async (k: string): Promise<string> => String((await api.v1.tempStorage.get(CKEY(k))) ?? "").trim();
  const name = await get("name");
  if (!name) { await rerender("Needs a name."); return; }
  const parts = [
    "define-constraint",
    `name="${name}"`,
    `relation=${(await get("relation")) || "exclusive"}`,
    `domain=${(await get("domain")) || "background"}`,
  ];
  const members = await get("members"); if (members) parts.push(`members="${members}"`);
  const max = await get("max"); if (max) parts.push(`max=${max}`);
  const scope = await get("scope"); if (scope) parts.push(`scope="${scope}"`);
  const note = await get("note"); if (note) parts.push(`note="${note}"`);
  const reply = await CommandRouter.route(parts.join(" "));
  await rerender(reply);
}

// Open the constraint-group window and render its form.
export async function openConstraintWindow(): Promise<void> {
  const part = api.v1.ui.part;
  const temp = api.v1.tempStorage;
  if ((await temp.get(CKEY("relation"))) == null) await temp.set(CKEY("relation"), "exclusive");
  if ((await temp.get(CKEY("domain"))) == null) await temp.set(CKEY("domain"), "background");

  const handle = await api.v1.ui.window.open({ title: "Define constraint group", content: [], defaultWidth: 480, defaultHeight: 600 });

  const render = async (result?: string): Promise<void> => {
    const relation = String((await temp.get(CKEY("relation"))) ?? "exclusive");
    const domain = String((await temp.get(CKEY("domain"))) ?? "background");
    const content: UIPart[] = [
      part.text({ text: "**Define a constraint group** (exclusive / restricted / forbidden)", markdown: true }),
      part.text({ text: "Name" }),
      part.textInput({ storageKey: CKEY("name"), placeholder: "e.g. clan-only-backgrounds" }),
      selectorRow(part, "Relation", "relation", RELATIONS, relation, () => render()),
      selectorRow(part, "Domain", "domain", DOMAINS, domain, () => render()),
      part.text({ text: "Members (comma-separated Backgrounds or Merits/Flaws)" }),
      part.textInput({ storageKey: CKEY("members"), placeholder: "e.g. status, anonymity" }),
      part.text({ text: "Max to hold (exclusive only; default 1)" }),
      part.numberInput({ storageKey: CKEY("max") }),
      part.text({ text: "Scope: templates/choices it applies to (comma-separated; empty = everyone)" }),
      part.textInput({ storageKey: CKEY("scope"), placeholder: "e.g. tzimisce" }),
      part.text({ text: "Note (optional)" }),
      part.textInput({ storageKey: CKEY("note") }),
      part.row({ content: [
        part.button({ text: "Create", callback: () => submitConstraint(render) }),
        part.button({ text: "Close", callback: () => handle.close() }),
      ] }),
    ];
    if (result) content.push(part.box({ content: [part.text({ text: result })] }));
    await handle.update({ content });
  };

  await render();
}

// [[win-constraint]] - a UI over [[define-constraint]].
async function cmdWinConstraint(): Promise<string> {
  await openConstraintWindow();
  return `((OOC-Storyteller: Opened the constraint-group window. Fill it in and press Create (it runs [[define-constraint]]).))`;
}

CommandRouter.register("win-constraint", cmdWinConstraint, "win-constraint (open a window to define a constraint group)");
