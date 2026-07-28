// =============================================================================
// WINDOWS - api.v1.ui forms that EMIT commands (no separate execution path)
// -----------------------------------------------------------------------------
// This module is LAYOUT and BEHAVIOUR only: every word it shows comes from
// somewhere else. A field the verb's CommandSpec describes takes its label from
// `desc` and its placeholder from `example`, so the form and [[help]] can never
// disagree; everything a spec cannot own (titles, buttons, refusals, a window's
// own framing of a shared field) lives in ui-text.ts. A test fails the build if
// a bare string literal reappears in a part tree here.
//
// A wizard-window is a UI over the command layer: it renders a form with UI
// Parts, binds fields to tempStorage via storageKey, and on submit composes a
// [[command]] string and routes it through the SAME CommandRouter every other
// command uses. The form itself is DERIVED from the verb's CommandSpec - the
// window duplicates no grammar: enum params render as button rows (from the
// spec's options, which reference the rules vocabularies), ints as number
// inputs, everything else as text inputs; composeCommand does the one
// sanitizing composition. Windows that need DOMAIN-driven fields (an affliction
// def's binding slots) will build their part tree by hand and still submit
// through composeCommand - the spec covers the static shape (next pass).
//
// A real NovelAI window can't render off-host, so the host mock records the
// part tree and lets tests fire button callbacks (see host.ts __ui* helpers) -
// which exercises the whole window -> command -> store path without a screen.
// =============================================================================
import { UiPartHelpers } from "./host";
import { UI_TEXT } from "./ui-text";
import { CommandRouter, CommandSpec, ParamSpec, composeCommand, sys } from "./command";
import { SuccessTableRegistry } from "./rolls";
import {
  AfflictionRegistry, CharacterStore, NamedRollStore, CharacterResources,
  TableAliases, PlayableCharacter,
} from "./state";

const WKEY = (verb: string, key: string): string => `win:${verb}:${key}`;

// A field the spec describes labels itself: `desc` is the label, `example` the
// placeholder. Falling back to the bare key keeps a spec that says nothing
// from rendering an empty label.
const labelOf = (spec: CommandSpec | undefined, key: string): string => {
  const p = (spec?.params ?? []).find(x => x.key === key);
  return p?.desc ?? key;
};

// A row of buttons behaving as a single-select: the current value is marked
// with a bullet; clicking one writes it to tempStorage and re-renders.
function selectorRow(part: UiPartHelpers, verb: string, p: ParamSpec, current: string, rerender: () => Promise<void>): UIPart {
  const buttons = (p.options ?? []).map(o => part.button({
    text: o === current ? `• ${o}` : o,
    callback: async () => { await api.v1.tempStorage.set(WKEY(verb, p.key), o); await rerender(); },
  }));
  return part.row({ content: [part.text({ text: `${p.desc ?? p.key}:` }), ...buttons] });
}

// --- THE PICKER (selection-widgets mode 2, docs/ui-parts.md) -----------------
// A dropdown substitute for lists too long to inline: a text input (typing
// stays live - mode 3) next to a "Choose <key>…" button that opens a MODAL
// with one button per option; the current value's button is marked ✅;
// picking writes the field's tempStorage key, closes the modal, and
// re-renders the window. `options` is a thunk so dynamic lists (affliction
// registry, tables) are read at open time.
export interface PickerOption { value: string; label?: string }

async function openPickerModal(key: string, storageKey: string, options: () => Promise<PickerOption[]>, rerender: () => Promise<void>): Promise<void> {
  const part = api.v1.ui.part;
  const temp = api.v1.tempStorage;
  const current = String((await temp.get(storageKey)) ?? "").trim();
  const opts = await options();
  const handle = await api.v1.ui.modal.open({ title: UI_TEXT.common.chooseTitle(key), size: "small", content: [] });
  const pick = (value: string) => async (): Promise<void> => {
    await temp.set(storageKey, value);
    await handle.close();
    await rerender();
  };
  await handle.update({ content: [part.column({ content: [
    ...opts.map(o => part.button({ text: `${o.value === current ? "✅ " : ""}${o.label ?? o.value}`, callback: pick(o.value) })),
    part.button({ text: UI_TEXT.common.clear, callback: pick("") }),
    part.button({ text: UI_TEXT.common.cancel, callback: () => handle.close() }),
  ] })] });
}

export function pickerField(part: UiPartHelpers, opts: {
  key: string;                                  // short name: labels the Choose button
  label: string;                                // field label above the input
  storageKey: string;
  options: () => Promise<PickerOption[]>;
  rerender: () => Promise<void>;
  placeholder?: string;
}): UIPart {
  return part.column({ content: [
    part.text({ text: opts.label }),
    part.row({ content: [
      part.textInput({ storageKey: opts.storageKey, placeholder: opts.placeholder }),
      part.button({ text: UI_TEXT.common.chooseButton(opts.key), callback: () => openPickerModal(opts.key, opts.storageKey, opts.options, opts.rerender) }),
    ] }),
  ] });
}

// Read the form's tempStorage fields, compose the command, route it, and show
// the OOC reply in-window.
async function submitCommand(verb: string, spec: CommandSpec, rerender: (result?: string) => Promise<void>): Promise<void> {
  const values: Record<string, string> = {};
  for (const p of spec.params ?? []) {
    values[p.key] = String((await api.v1.tempStorage.get(WKEY(verb, p.key))) ?? "").trim();
  }
  const required = (spec.params ?? []).find(p => p.required && !values[p.key] && !p.default);
  if (required) { await rerender(UI_TEXT.common.needs(required.desc ?? required.key)); return; }
  const reply = await CommandRouter.route(composeCommand(verb, values, spec));
  await rerender(reply);
}

// Open a window whose form is the verb's CommandSpec. Returns whether a spec
// existed to render.
export async function openCommandWindow(verb: string, opts?: {
  title?: string; blurb?: string; submitLabel?: string;
  // Per-param option pickers: a param key listed here renders a pickerField
  // (typing + Choose-modal) instead of a bare text input - same temp key, so
  // composeCommand is untouched.
  pickers?: Record<string, () => Promise<PickerOption[]>>;
}): Promise<boolean> {
  const spec = CommandRouter.specFor(verb);
  if (!spec) return false;
  const part = api.v1.ui.part;
  const temp = api.v1.tempStorage;

  // Pre-seed enum defaults so the selector rows show a selection immediately.
  for (const p of spec.params ?? []) {
    if (p.default !== undefined && (await temp.get(WKEY(verb, p.key))) == null) {
      await temp.set(WKEY(verb, p.key), p.default);
    }
  }

  const handle = await api.v1.ui.window.open({ title: opts?.title ?? `[[${verb}]]`, content: [], defaultWidth: 480, defaultHeight: 600 });

  const render = async (result?: string): Promise<void> => {
    const content: UIPart[] = [];
    if (opts?.blurb) content.push(part.text({ text: opts.blurb, markdown: true }));
    for (const p of spec.params ?? []) {
      if (p.type === "enum" && p.options?.length) {
        const current = String((await temp.get(WKEY(verb, p.key))) ?? p.default ?? "");
        content.push(selectorRow(part, verb, p, current, () => render()));
      } else if (p.type === "int") {
        content.push(part.text({ text: p.desc ?? p.key }));
        content.push(part.numberInput({ storageKey: WKEY(verb, p.key) }));
      } else if (opts?.pickers?.[p.key]) {
        content.push(pickerField(part, {
          key: p.key, label: p.desc ?? p.key, storageKey: WKEY(verb, p.key),
          options: opts.pickers[p.key], rerender: () => render(), placeholder: p.example,
        }));
      } else {
        content.push(part.text({ text: p.desc ?? p.key }));
        content.push(part.textInput({ storageKey: WKEY(verb, p.key), placeholder: p.example }));
      }
    }
    content.push(part.row({ content: [
      part.button({ text: opts?.submitLabel ?? UI_TEXT.common.create, callback: () => submitCommand(verb, spec, render) }),
      part.button({ text: UI_TEXT.common.close, callback: () => handle.close() }),
    ] }));
    if (result) content.push(part.box({ content: [part.text({ text: result })] }));
    await handle.update({ content });
  };

  await render();
  return true;
}

// The constraint-group window: [[define-constraint]]'s spec rendered as a form.
export async function openConstraintWindow(): Promise<void> {
  await openCommandWindow("define-constraint", {
    title: UI_TEXT.constraint.title,
    blurb: UI_TEXT.constraint.blurb,
  });
}

// [[win-constraint]] - a UI over [[define-constraint]], derived from its spec.
async function cmdWinConstraint(): Promise<string> {
  await openConstraintWindow();
  return sys(UI_TEXT.constraint.opened);
}

CommandRouter.register("win-constraint", cmdWinConstraint, {
  summary: "open a window to define a constraint group",
});

// [[win-table]] - a UI over [[define-table]], derived from its spec.
async function cmdWinTable(): Promise<string> {
  await openCommandWindow("define-table", {
    title: UI_TEXT.table.title,
    blurb: UI_TEXT.table.blurb,
  });
  return sys(UI_TEXT.table.opened);
}

CommandRouter.register("win-table", cmdWinTable, {
  summary: "open a window to define a success table",
});

// --- AFFLICTION WINDOWS --------------------------------------------------------
// The defined afflictions, as picker options (description shown when present).
const afflictionOptions = async (): Promise<PickerOption[]> =>
  AfflictionRegistry.all().map(d => ({ value: d.name, label: d.description ? `${d.name} - ${d.description}` : d.name }));

// [[win-affliction]] - define-affliction's spec as a form; the `then` and
// `mirror` fields get pickers over the existing afflictions (typing still works).
async function cmdWinAffliction(): Promise<string> {
  await openCommandWindow("define-affliction", {
    title: UI_TEXT.affliction.title,
    blurb: UI_TEXT.affliction.blurb,
    pickers: { then: afflictionOptions, mirror: afflictionOptions },
  });
  return sys(UI_TEXT.affliction.opened);
}

// [[win-afflict]] - the first DOMAIN-driven window: pick an affliction and its
// def's binding slots appear as fields; Afflict composes and routes the real
// [[afflict]] command (openNamed carries the slots). The window duplicates no
// grammar - the def drives the form.
const AKEY = (k: string): string => `win:afflict:${k}`;

export async function openAfflictWindow(): Promise<void> {
  const part = api.v1.ui.part;
  const temp = api.v1.tempStorage;
  const spec = CommandRouter.specFor("afflict")!;
  const handle = await api.v1.ui.window.open({ title: UI_TEXT.afflict.title, content: [], defaultWidth: 480, defaultHeight: 480 });

  const render = async (result?: string): Promise<void> => {
    const chosen = String((await temp.get(AKEY("affliction"))) ?? "").trim();
    const def = chosen ? AfflictionRegistry.get(chosen) : undefined;
    const content: UIPart[] = [
      part.text({ text: UI_TEXT.afflict.blurb, markdown: true }),
      pickerField(part, {
        key: "affliction", label: UI_TEXT.afflict.afflictionLabel, storageKey: AKEY("affliction"),
        options: afflictionOptions, rerender: () => render(), placeholder: UI_TEXT.afflict.afflictionPlaceholder,
      }),
      // `on` is [[afflict]]'s own param, so its label is the spec's.
      part.text({ text: labelOf(spec, "on") }),
      part.textInput({ storageKey: AKEY("on"), placeholder: UI_TEXT.afflict.targetPlaceholder }),
    ];
    for (const slot of def?.bindings ?? []) {
      content.push(part.text({ text: UI_TEXT.afflict.bindingLabel(slot) }));
      content.push(part.textInput({ storageKey: AKEY(`bind:${slot}`), placeholder: UI_TEXT.afflict.targetPlaceholder }));
    }
    content.push(part.row({ content: [
      part.button({ text: UI_TEXT.afflict.afflictButton, callback: async () => {
        const affliction = String((await temp.get(AKEY("affliction"))) ?? "").trim();
        if (!affliction) { await render(UI_TEXT.afflict.needsAffliction); return; }
        const values: Record<string, string> = {
          affliction,
          on: String((await temp.get(AKEY("on"))) ?? "").trim(),
        };
        // A slot named like a declared param would be skipped by compose; the
        // def vocabulary is the ST's, so just read what the def declares.
        for (const slot of AfflictionRegistry.get(affliction)?.bindings ?? []) {
          values[slot] = String((await temp.get(AKEY(`bind:${slot}`))) ?? "").trim();
        }
        const reply = await CommandRouter.route(composeCommand("afflict", values, spec));
        await render(reply);
      } }),
      part.button({ text: UI_TEXT.common.close, callback: () => handle.close() }),
    ] }));
    if (result) content.push(part.box({ content: [part.text({ text: result })] }));
    await handle.update({ content });
  };
  await render();
}

async function cmdWinAfflict(): Promise<string> {
  await openAfflictWindow();
  return sys(UI_TEXT.afflict.opened);
}

CommandRouter.register("win-affliction", cmdWinAffliction, {
  summary: "open a window to define an affliction (then/mirror have pickers)",
});
CommandRouter.register("win-afflict", cmdWinAfflict, {
  summary: "open a window to apply an affliction (its binding slots appear on pick)",
});

// --- THE ROLL WINDOW ---------------------------------------------------------
// [[win-roll]] - build a roll from every knob the engine has, fire it (for the
// current character or any named one), and optionally save it as a named roll.
// One window multiplexes THREE verbs: Roll composes [[roll]] (For blank) or
// [[roll-for]] (For filled); Save composes [[name-roll]] (For ignored - saved
// rolls are chronicle-global). The knob fields are WALKED from [[roll]]'s own
// CommandSpec so the window duplicates no grammar; `diff-mod` is skipped (with
// difficulty blank, a lone modifier would slide into the difficulty positional
// slot - and a form user types the final difficulty anyway).
const RKEY = (k: string): string => `win:roll:${k}`;

// The character the option lists describe: the For field's name when filled,
// else the current character. An unknown name just yields empty picker lists -
// the options are a convenience, never a gate (typing stays live).
async function rollWindowChar(): Promise<PlayableCharacter | undefined> {
  const forName = String((await api.v1.tempStorage.get(RKEY("for"))) ?? "").trim();
  return forName ? CharacterStore.load(forName) : CharacterStore.getCurrent();
}

const characterOptions = async (): Promise<PickerOption[]> =>
  (await CharacterStore.listNames()).map(n => ({ value: n }));
const savedRollOptions = async (): Promise<PickerOption[]> =>
  (await NamedRollStore.names()).map(n => ({ value: `@${n}` }));
const spendOptions = async (): Promise<PickerOption[]> => {
  const char = await rollWindowChar();
  return char ? CharacterResources.defsFor(char).map(d => ({ value: d.name })) : [];
};
const specialtyOptions = async (): Promise<PickerOption[]> => {
  const char = await rollWindowChar();
  return Object.entries(char?.specialties ?? {}).flatMap(([trait, labels]) =>
    labels.map(l => ({ value: l, label: `${l} (${trait})` })));
};
const tableOptions = async (): Promise<PickerOption[]> => [
  ...SuccessTableRegistry.all().map(t => ({ value: t.name })),
  ...Object.keys(await TableAliases.all()).map(a => ({ value: `@${a}` })),
];

export async function openRollWindow(): Promise<void> {
  const part = api.v1.ui.part;
  const temp = api.v1.tempStorage;
  const field = async (k: string): Promise<string> => String((await temp.get(RKEY(k))) ?? "").trim();
  const pickers: Record<string, () => Promise<PickerOption[]>> = {
    spend: spendOptions, specialty: specialtyOptions, table: tableOptions,
  };
  const handle = await api.v1.ui.window.open({ title: UI_TEXT.roll.title, content: [], defaultWidth: 480, defaultHeight: 640 });

  // Compose+route `verb`, reading each of ITS spec params from the form (the
  // field keys ARE the param keys); `extra` pre-binds cross-verb params.
  const submit = async (verb: string, extra: Record<string, string>): Promise<void> => {
    const spec = CommandRouter.specFor(verb)!;
    const values: Record<string, string> = {};
    for (const p of spec.params ?? []) values[p.key] = extra[p.key] ?? (await field(p.key));
    const reply = await CommandRouter.route(composeCommand(verb, values, spec));
    await render(reply);
  };

  const render = async (result?: string): Promise<void> => {
    const knobs = (CommandRouter.specFor("roll")?.params ?? []).filter(p => p.key !== "pool" && p.key !== "diff-mod");
    const content: UIPart[] = [
      part.text({ text: UI_TEXT.roll.blurb, markdown: true }),
      pickerField(part, {
        key: "for", label: UI_TEXT.roll.forLabel, storageKey: RKEY("for"),
        options: characterOptions, rerender: () => render(), placeholder: UI_TEXT.roll.forPlaceholder,
      }),
      pickerField(part, {
        key: "pool", label: UI_TEXT.roll.poolLabel, storageKey: RKEY("pool"),
        options: savedRollOptions, rerender: () => render(), placeholder: UI_TEXT.roll.poolPlaceholder,
      }),
    ];
    for (const p of knobs) {
      if (p.type === "int") {
        content.push(part.text({ text: p.desc ?? p.key }));
        content.push(part.numberInput({ storageKey: RKEY(p.key) }));
      } else if (pickers[p.key]) {
        content.push(pickerField(part, {
          key: p.key, label: p.desc ?? p.key, storageKey: RKEY(p.key),
          options: pickers[p.key], rerender: () => render(), placeholder: p.example ?? p.hint,
        }));
      } else {
        content.push(part.text({ text: p.desc ?? p.key }));
        content.push(part.textInput({ storageKey: RKEY(p.key), placeholder: p.example ?? p.hint }));
      }
    }
    // Contest knobs - Save bakes these into [[name-roll]] as an OPPOSED saved roll
    // (the opponent is play-time vs=); Roll ignores them. These are name-roll's own
    // params, so submit("name-roll") reads them straight from these fields by key.
    // vs-pool / vs-difficulty only show once a mode is chosen (collapse when off).
    const opposedNow = await field("opposed");
    content.push(part.text({ text: UI_TEXT.roll.opposedLabel }));
    content.push(part.row({ content: (["", "resisted", "contested"] as const).map(o => part.button({
      text: `${o === opposedNow ? "• " : ""}${o === "" ? UI_TEXT.roll.opposedNone : o}`,
      callback: async () => {
        await temp.set(RKEY("opposed"), o);
        if (o === "") { await temp.set(RKEY("vs-pool"), ""); await temp.set(RKEY("vs-difficulty"), ""); }
        await render();
      },
    })) }));
    if (opposedNow === "resisted" || opposedNow === "contested") {
      content.push(part.text({ text: UI_TEXT.roll.vsPoolLabel }));
      content.push(part.textInput({ storageKey: RKEY("vs-pool"), placeholder: UI_TEXT.roll.vsPoolPlaceholder }));
      content.push(part.text({ text: UI_TEXT.roll.vsDifficultyLabel }));
      content.push(part.numberInput({ storageKey: RKEY("vs-difficulty") }));
    }
    content.push(part.text({ text: UI_TEXT.roll.saveAsLabel }));
    content.push(part.textInput({ storageKey: RKEY("save-as"), placeholder: UI_TEXT.roll.saveAsPlaceholder }));
    content.push(part.row({ content: [
      part.button({ text: UI_TEXT.roll.rollButton, callback: async () => {
        const pool = await field("pool");
        if (!pool) { await render(UI_TEXT.roll.needsPool); return; }
        const forName = await field("for");
        await submit(forName ? "roll-for" : "roll", forName ? { character: forName } : {});
      } }),
      part.button({ text: UI_TEXT.roll.saveButton, callback: async () => {
        const name = await field("save-as");
        if (!name) { await render(UI_TEXT.roll.needsSaveName); return; }
        if (!(await field("pool"))) { await render(UI_TEXT.roll.needsPool); return; }
        await submit("name-roll", { name });
      } }),
      part.button({ text: UI_TEXT.common.close, callback: () => handle.close() }),
    ] }));
    if (result) content.push(part.box({ content: [part.text({ text: result })] }));
    await handle.update({ content });
  };
  await render();
}

async function cmdWinRoll(): Promise<string> {
  await openRollWindow();
  return sys(UI_TEXT.roll.opened);
}

CommandRouter.register("win-roll", cmdWinRoll, {
  summary: "open a window to build, roll, and save rolls",
});
