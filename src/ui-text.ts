// =============================================================================
// UI TEXT - every user-facing string the windows show
// -----------------------------------------------------------------------------
// window.ts holds LAYOUT and BEHAVIOUR; this holds the words. Change a label,
// a button, a placeholder or a refusal here and nowhere else - a test fails the
// build if a bare string literal creeps back into a window's part tree.
//
// What is deliberately NOT here: the labels and placeholders of a field that a
// CommandSpec already describes. Those come from the spec's `desc` (the label),
// `example` (the placeholder a form shows) and `hint` (the grammar [[help]]
// prints), so the window and the help text can never drift apart - that is the
// same one-source-of-truth rule the forms themselves are built on. These
// entries are only the strings no spec can own: window chrome, buttons, the
// windows' own framing of a shared field, and their refusals.
//
// Pure: no imports, no host access.
// =============================================================================

export const UI_TEXT = {
  // Chrome every window shares.
  common: {
    create: "Create",
    close: "Close",
    cancel: "Cancel",
    clear: "(clear)",
    // The picker: a button beside a field, and the modal it opens.
    chooseButton: (key: string): string => `Choose ${key}…`,
    chooseTitle: (key: string): string => `Choose ${key}`,
    // A required field left blank, named by its own label.
    needs: (label: string): string => `Needs ${label}.`,
  },

  constraint: {
    title: "Define constraint group",
    blurb: "**Define a constraint group** (exclusive / restricted / forbidden)",
    opened: "Opened the constraint-group window. Fill it in and press Create (it runs [[define-constraint]]).",
  },

  table: {
    title: "Define success table",
    blurb: "**Define a success table** (ladder rows, numeric output, or both)",
    opened: "Opened the success-table window. Fill it in and press Create (it runs [[define-table]]).",
  },

  merit: {
    title: "Define merit / flaw",
    blurb: "**Define a Merit or Flaw.** `grants` names the affliction it turns on when taken - "
      + "pick one that exists, or type a new name and it will be defined too.",
    opened: "Opened the merit window. Fill it in and press Create (it runs [[define-merit]]).",
  },

  arcanum: {
    title: "Define arcanum / taint",
    blurb: "**Define an Arcanum or Taint** (Dark Ages: Devil's Due). Their own category, "
      + "their own purse - not merits. `per-template` gives the printed \"(7/5)\" price.",
    opened: "Opened the arcanum window. Fill it in and press Create (it runs [[define-arcanum]]).",
  },

  affliction: {
    title: "Define affliction",
    blurb: "**Define an affliction** (bindings, chains, mirrors, tags)",
    opened: "Opened the affliction window. Fill it in and press Create (it runs [[define-affliction]]).",
  },

  afflict: {
    title: "Afflict an affliction",
    blurb: "**Afflict an affliction** - pick one; its binding slots appear below.",
    afflictionLabel: "Affliction",
    afflictionPlaceholder: "e.g. feral-whispers",
    // `on` takes its label from [[afflict]]'s own spec; this is only the hint
    // inside the empty field.
    targetPlaceholder: "name or @alias",
    // One field per binding slot the chosen def declares - the def's vocabulary
    // is the Storyteller's, so the slot name is the label.
    bindingLabel: (slot: string): string => `Binding: ${slot}`,
    afflictButton: "Afflict",
    needsAffliction: "Pick an affliction first.",
    opened: "Opened the afflict window. Pick an affliction, fill its bindings, and press Afflict (it runs [[afflict]]).",
  },

  roll: {
    title: "Build a roll",
    blurb: "**Build a roll** - Roll fires it; Save stores it as a named roll.",
    // "For" and "Pool" are this window's framing of fields three verbs share
    // ([[roll]] / [[roll-for]] / [[name-roll]]), so they are its words, not a
    // spec's.
    forLabel: "For (blank = the current character)",
    forPlaceholder: "name",
    poolLabel: "Pool",
    poolPlaceholder: "e.g. dexterity+melee, or @saved",
    opposedLabel: "Opposed (Save bakes a contest; opponent supplied at play via vs=)",
    opposedNone: "none",
    vsPoolLabel: "vs-pool (opposition's pool; blank = your own pool)",
    vsPoolPlaceholder: "e.g. perception+alertness",
    vsDifficultyLabel: "vs-difficulty (opposition's difficulty; optional)",
    saveAsLabel: "Save as (optional - Save stores the roll under this name)",
    saveAsPlaceholder: "e.g. strike",
    rollButton: "Roll",
    saveButton: "Save",
    needsPool: "Needs a pool.",
    needsSaveName: "Needs a Save-as name to save.",
    opened: "Opened the roll window. Build the pool and knobs, then Roll (runs [[roll]] / [[roll-for]]) or Save (runs [[name-roll]]).",
  },
} as const;
