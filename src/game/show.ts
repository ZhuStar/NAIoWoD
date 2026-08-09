// Split out of the former 7941-line src/game.ts (memory §7.91). The cut points
// are the file's own section banners and SOURCE ORDER IS PRESERVED across the
// split, so dist/naiowod.ts keeps the exact declaration order it had as one
// file - the artifact's only diff is which //#region each line sits in.
import { CommandHandler, CommandRouter, IN_STORY_KEY, ParamSpec, ParsedCommand, flagOf, stripSys, sys, sysNote } from "../command";
import { StringUtil } from "../core/traits";
import { CLANS, FELLOWSHIPS, OwnedPowerDef, TEMPLATES, clanFamilies, clanFamilyOf, meritCostFor } from "../rules";
import { KEY } from "../services";
import { BackgroundRegistry, CharacterResources, CharacterAfflictions, CharacterStore, PlayableCharacter, PlayerStore, SHOW_ALL_TOKEN, SceneStore, TemplateRegistry } from "../state";
import { cmdAfflictions, cmdAliases, cmdCharacters, cmdPlayer, cmdSheet, resolveCharacterRef } from "./afflictions";
import { cmdBackground, cmdBackgrounds, cmdBudget, cmdClans, cmdCosts, cmdCreation, cmdDerived, cmdEval, cmdGrant, cmdSupernatural, cmdTemplates } from "./character";
import { disp } from "./common";
import { cmdContestStatus } from "./contests";
import { cmdAttune, cmdFellowships, cmdListRolls, cmdResources, cmdRollInfo, cmdRollStatus } from "./effects";
import { cmdTables } from "./narration";
import { cmdCray, cmdHealth } from "./places";
import { ARCANUM_FAMILY, MERIT_FAMILY, PowerFamily, cmdAfflictionInfo, cmdArcana, cmdArcanumInfo, cmdCheckConstraints, cmdConstraint, cmdConstraints, cmdMeritInfo, cmdMerits, cmdSpecialties } from "./powers";
import { cmdDates, cmdMoon, cmdSceneInfo, cmdScenes, cmdStoryDate, cmdTimeBetween } from "./time";

// =============================================================================
// SHOW - one way to look at anything, and none of it reaches the AI
// -----------------------------------------------------------------------------
// Roughly forty verbs only REPORT. They arrived one at a time, so they were
// named inconsistently (`merits` vs `merit`, `scenes` vs `scene-info`, `arcana`
// vs `arcanum`, `list-rolls` vs `roll-info`) and the singular/plural split was
// really a SCOPE distinction nobody had declared: `merit` meant "what the
// chronicle defines", `merits` meant "what this character owns". Two names for
// one question asked of two places.
//
// So: every read-only verb is `show-<thing>`, takes a NAME (`@all` = the whole
// list) and a SCOPE (`in=<where to look>`), and its reply is stripped from the
// AI's context unless the player says `in-story=true`.
//
// THE NAME IS THE POLICY. A verb is hidden from context because it is called
// `show-`, not because somebody remembered to add it to a list - the old
// QUIET_VERBS set was a hand-maintained register that a new verb was trivially
// forgotten from. What remains in that set is only the read-only verbs that are
// not listings at all (maintenance).
// =============================================================================

// Where to look. Seven kinds, because a chronicle has seven kinds of place a
// question can be asked of - and the last three are NOT reducible to a template:
// the code deliberately holds clans and fellowships apart from templates (they
// are CHOICES a character made, and exclusive merits gate on them), a scene is
// a record with its own clock, and a player is who is holding the dice.
export type ShowScopeKind =
  | "campaign"      // what the chronicle DEFINES
  | "current"       // the character being played
  | "character"     // a named character's sheet
  | "template"      // what that kind of creature may have
  | "clan"          // ...or that clan / bloodline
  | "fellowship"    // ...or that mystic fellowship
  | "scene"         // a scene's own records
  | "player";       // a player's pointers and aliases

export interface ResolvedScope {
  kind: ShowScopeKind;
  key?: string;                 // the normalized name, for every kind but campaign
  char?: PlayableCharacter;     // loaded for `current` and `character`
  label: string;                // how a reply should name it
}

// The words that mean "the chronicle itself" and "whoever I am playing". Both
// spelled several ways on purpose: a player types what they think of first.
const SCOPE_CAMPAIGN = ["campaign", "chronicle", "story", "world", "game"];
const SCOPE_CURRENT = ["current", "me", "self", "mine", "here"];
// THE OPEN SCENE, asked for by name-of-kind rather than by its title. Retiring
// [[scene-info]] (§7.92) would otherwise have taken the only way to say "the one
// we are in" with it, leaving show-scene's own summary - "defaults to the open
// one" - promising something no spelling could reach.
const SCOPE_OPEN_SCENE = ["scene", "open", "now"];
// An explicit `kind::name` disambiguates when a name means two things. `::`
// folds to `:` at the boundary (docs/invariants.md §2), so both spellings work.
const SCOPE_PREFIXES: Record<string, ShowScopeKind> = {
  character: "character", char: "character", pc: "character",
  template: "template", splat: "template",
  clan: "clan", bloodline: "clan",
  fellowship: "fellowship",
  scene: "scene",
  player: "player",
  campaign: "campaign", chronicle: "campaign",
};

// The order a bare name is tried in. Characters first because a player names
// their own characters and types those names most; a collision is REPORTED
// rather than guessed at, so being wrong here is never silent.
const SCOPE_SEARCH: ShowScopeKind[] = ["character", "template", "clan", "fellowship", "scene", "player"];

async function scopeKindsMatching(key: string): Promise<ShowScopeKind[]> {
  const hits: ShowScopeKind[] = [];
  if ((await CharacterStore.listNames()).includes(key)) hits.push("character");
  // AN AFFLICTED NPC IS A CHARACTER for this purpose, even with no sheet. The
  // retired [[afflictions <who>]] took any name at all and read its afflictions,
  // so retiring it (§7.92) would otherwise have made every sheetless NPC
  // unaskable - a real capability lost to an alias removal rather than to a
  // decision. Note the NEW behaviour is stricter in the useful direction: a
  // misspelled name is now refused instead of being answered "no afflictions".
  else if ((await CharacterAfflictions.list(key)).length) hits.push("character");
  if (TEMPLATES[key] || TemplateRegistry.get(key)) hits.push("template");
  if (CLANS[key] || clanFamilies().some(c => c.id === key)) hits.push("clan");
  if (FELLOWSHIPS[key]) hits.push("fellowship");
  if ((await SceneStore.names()).includes(key)) hits.push("scene");
  if (key === PlayerStore.STORYTELLER || (await PlayerStore.known()).includes(key)) hits.push("player");
  return SCOPE_SEARCH.filter(k => hits.includes(k));
}

// `in=<raw>` -> where to look, or a refusal that says what would have worked.
// `allowed` is the subject's own vocabulary: health belongs to a character, and
// "health in the campaign" is a question worth answering with a correction
// rather than an empty list.
export async function resolveShowScope(
  raw: string | undefined, allowed: ShowScopeKind[], fallback: ShowScopeKind,
): Promise<ResolvedScope | { error: string }> {
  const asked = StringUtil.normalize(raw ?? "").replace(/::+/g, ":");
  const wants = (kind: ShowScopeKind): string | undefined =>
    allowed.includes(kind) ? undefined
      : `That is a ${kind}, and this one is only asked of ${allowed.join(" / ")}.`;

  // Nothing said: the subject's own default.
  if (!asked) return finishScope(fallback, undefined, allowed);

  // An explicit kind::name is never guessed at.
  const colon = asked.indexOf(":");
  if (colon > 0) {
    const kind = SCOPE_PREFIXES[asked.slice(0, colon)];
    const key = asked.slice(colon + 1);
    if (!kind) {
      return { error: `"${asked.slice(0, colon)}" is not a scope. Try ${Object.keys(SCOPE_PREFIXES).join(", ")}, `
        + `or a bare name and the engine works out which it is.` };
    }
    const no = wants(kind);
    if (no) return { error: no };
    return finishScope(kind, key, allowed);
  }

  if (SCOPE_CAMPAIGN.includes(asked)) {
    return wants("campaign") ? { error: wants("campaign")! } : finishScope("campaign", undefined, allowed);
  }
  if (SCOPE_CURRENT.includes(asked)) {
    return wants("current") ? { error: wants("current")! } : finishScope("current", undefined, allowed);
  }
  // Only where a scene IS a scope - elsewhere "scene" is just a name to look up.
  if (SCOPE_OPEN_SCENE.includes(asked) && allowed.includes("scene")) {
    return finishScope("scene", undefined, allowed);
  }

  // A bare name: ask every place that could hold it. Two answers is a real
  // ambiguity - name both explicit forms rather than picking one silently.
  const hits = await scopeKindsMatching(asked);
  const usable = hits.filter(k => allowed.includes(k));
  if (usable.length > 1) {
    return { error: `"${asked}" is a ${hits.join(" AND a ")}. Say which: `
      + usable.map(k => `in=${k}::${asked}`).join(" or ") + "." };
  }
  if (usable.length === 1) return finishScope(usable[0], asked, allowed);
  if (hits.length) {
    return { error: `"${asked}" is a ${hits.join("/")}, and this one is only asked of ${allowed.join(" / ")}.` };
  }
  return { error: `Nothing named "${asked}" - not a character, template, clan, fellowship, scene or player. `
    + `[[show-character @all]] and [[show-template @all]] list two of those.` };
}

// Load what the kind needs and give it a label. Split out so every path above
// returns the same shape.
async function finishScope(
  kind: ShowScopeKind, key: string | undefined, allowed: ShowScopeKind[],
): Promise<ResolvedScope | { error: string }> {
  if (!allowed.includes(kind)) {
    return { error: `This one is only asked of ${allowed.join(" / ")}.` };
  }
  if (kind === "campaign") return { kind, label: "the chronicle" };
  if (kind === "current") {
    const char = await CharacterStore.getCurrent();
    if (!char) return { error: `No current character. [[play name="..."]] picks one, or name a scope with in=.` };
    return { kind, key: StringUtil.normalize(char.name), char, label: disp(char.name) };
  }
  if (kind === "character") {
    const ref = await resolveCharacterRef(key ?? "");
    if (ref.error) return { error: ref.error };
    const char = await CharacterStore.load(ref.name!);
    // A SHEETLESS SUBJECT IS STILL A SUBJECT. An NPC can carry afflictions
    // without ever having a sheet, and [[afflict who="Grey Wolf"]] creates
    // exactly that. Refusing here would make him unaskable - the capability the
    // retired [[afflictions <who>]] used to provide (§7.92). `char` stays
    // undefined, so any subject that genuinely needs a sheet still says so.
    if (!char && !(await CharacterAfflictions.list(ref.name!)).length) {
      return { error: `No character named "${ref.name}". [[show-character @all]] lists them.` };
    }
    if (!char) return { kind, key: ref.name!, label: disp(ref.name!) };
    return { kind, key: StringUtil.normalize(char.name), char, label: disp(char.name) };
  }
  return { kind, key: key ?? "", label: `${StringUtil.toTitleCase(key ?? "")} (${kind})` };
}

// --- THE SUBJECTS ------------------------------------------------------------
// One entry per thing a player can look at. `render` mostly DELEGATES to the
// handler that already exists - this pass renames and re-scopes the surface, it
// does not rewrite thirty reports.
type ShowRender = (name: string | undefined, scope: ResolvedScope, cmd: ParsedCommand) => Promise<string>;

interface ShowSubject {
  verb: string;                       // "show-merit"
  summary: string;
  note?: string;
  nameHint?: string;                  // what a name means here (help/window)
  nameExample?: string;
  /** Old verbs that meant this, each with the scope it meant. */
  replaces?: Array<{ verb: string; scope?: ShowScopeKind }>;
  scopes: ShowScopeKind[];
  defaultScope: ShowScopeKind;
  extra?: ParamSpec[];                // knobs the old verb had that still apply
  render: ShowRender;
}

// `@all` is the wildcard, and `@` is the alias sigil - state.ts reserves the
// token so the two can never collide.
function isShowAll(name: string | undefined): boolean {
  return name !== undefined && StringUtil.normalize(name) === "all";
}
// The name a subject was asked for: undefined when absent or `@all`.
function showName(cmd: ParsedCommand): { name?: string; all: boolean } {
  const raw = (cmd.named["name"] ?? cmd.positional[0])?.trim();
  if (!raw) return { all: false };
  if (raw === SHOW_ALL_TOKEN || isShowAll(raw.replace(/^@/, ""))) return { all: true };
  return { name: raw, all: false };
}
// A synthetic command for a delegate that reads positionals/named of its own.
function asCmd(name: string | undefined, cmd: ParsedCommand, named: Record<string, string> = {}): ParsedCommand {
  return {
    ...cmd,
    positional: name === undefined ? [] : [name],
    named: { ...cmd.named, ...named },
  };
}
// The character a character-scoped subject reports on.
function scopeChar(scope: ResolvedScope): PlayableCharacter | undefined { return scope.char; }
// "this subject has nothing to say about that scope" - said once, the same way.
function notForScope(scope: ResolvedScope, what: string): string {
  return sys(`${what} is not something ${scope.label} has. Try in=campaign or in=current.`);
}

// The scopes a sheet-bound subject understands: the character being played, or
// any other by name. Written once because a dozen subjects want exactly this.
const ON_A_SHEET: ShowScopeKind[] = ["current", "character"];
// ...and what the chronicle defines, which a template/clan/fellowship narrows.
const IN_THE_BOOKS: ShowScopeKind[] = ["campaign", "template", "clan", "fellowship", "current", "character"];

const SHOW_SUBJECTS: ShowSubject[] = [
  // --- THE CHRONICLE'S OWN VOCABULARY ---------------------------------------
  {
    verb: "show-character", summary: "the chronicle's playable characters (marks current/default)", scopes: ["campaign"], defaultScope: "campaign",
    render: async () => cmdCharacters(),
  },
  {
    verb: "show-template", summary: "the templates this chronicle knows, and what each is made of", scopes: ["campaign", "template", "current", "character"],
    defaultScope: "campaign", nameExample: "vampire",
    render: async (name, scope, cmd) =>
      cmdTemplates(asCmd(name ?? (scope.kind === "template" ? scope.key : scope.char?.templates[0]), cmd)),
  },
  {
    verb: "show-clan", summary: "the clans and their Disciplines", scopes: ["campaign", "clan", "current", "character"],
    defaultScope: "campaign", nameExample: "nosferatu",
    render: async (name, scope, cmd) =>
      cmdClans(asCmd(name ?? (scope.kind === "clan" ? scope.key : scope.char?.choices?.["clan"]), cmd)),
  },
  {
    verb: "show-fellowship", summary: "the mystic fellowships' Foundation & Pillars", scopes: ["campaign", "fellowship", "current", "character"],
    defaultScope: "campaign", nameExample: "valdaermen",
    render: async (name, scope, cmd) =>
      cmdFellowships(asCmd(name ?? (scope.kind === "fellowship" ? scope.key : scope.char?.choices?.["fellowship"]), cmd)),
  },
  {
    verb: "show-cost", summary: "what a dot costs from each purse (chronicle rules, Storyteller-applied)", scopes: ["campaign"], defaultScope: "campaign",
    render: async (name, _scope, cmd) => cmdCosts(asCmd(name, cmd)),
  },
  {
    verb: "show-table", summary: "success tables, grouped by category, or one laid out in full", scopes: ["campaign"], defaultScope: "campaign",
    extra: [{ key: "category", kind: "named", desc: "Only this table category" }],
    render: async (name, _scope, cmd) => cmdTables(asCmd(name, cmd)),
  },
  {
    verb: "show-roll", summary: "the chronicle's saved rolls, or one in full", scopes: ["campaign"], defaultScope: "campaign",
    nameExample: "sword-strike",
    render: async (name, _scope, cmd) => (name ? cmdRollInfo(asCmd(name, cmd)) : cmdListRolls()),
  },
  {
    verb: "show-scene", summary: "the chronicle's scenes, or one in full (defaults to the open one)",
    scopes: ["campaign", "scene"], defaultScope: "campaign",
    render: async (name, scope, cmd) => {
      const which = name ?? (scope.kind === "scene" ? scope.key : undefined);
      // Bare + campaign means the list; anything that names one means that one.
      return which || scope.kind === "scene" ? cmdSceneInfo(asCmd(which, cmd)) : cmdScenes();
    },
  },
  {
    verb: "show-date", summary: "the story date, and the bookmarks the chronicle keeps", scopes: ["campaign"], defaultScope: "campaign",
    // Bare: where we are, and every bookmark. Named: how far that one is from now.
    render: async (name, _scope, cmd) => (name
      ? cmdTimeBetween({ ...cmd, positional: [name, "now"] })
      : sysNote(await cmdStoryDate(), stripSys(await cmdDates()))),
  },
  {
    verb: "show-moon", summary: "the moon's phase, how far into it we are, and when it turns",
    scopes: ["campaign"], defaultScope: "campaign",
    nameHint: "a phase to ask when it next begins", nameExample: "full",
    note: "Eight phases, each centred on its instant, so the full moon lasts the ~3.7 nights it looks full. "
        + "In a condition: `moon-phase = moon:full`, `moon-illumination >= 90`, `weekday = day:friday`.",
    render: async (name, _scope, cmd) => cmdMoon(asCmd(name, cmd)),
  },
  {
    verb: "show-time-between", summary: "measure the span between two dates (saved name, now, start, or yyyy-mm-dd-hh)", scopes: ["campaign"], defaultScope: "campaign",
    extra: [
      { key: "from", kind: "positional", hint: "<date|name>", example: "story-start" },
      { key: "to", kind: "positional", hint: "[date|name]", example: "now" },
    ],
    render: async (_name, _scope, cmd) => cmdTimeBetween(cmd),
  },
  {
    verb: "show-alias", summary: "every alias, grouped by scope", scopes: ["campaign", "player", "character", "current"],
    defaultScope: "campaign",
    render: async () => cmdAliases(),
  },
  {
    verb: "show-player", summary: "the current player (the storyteller, unless somebody took a seat)",
    scopes: ["campaign", "player"], defaultScope: "campaign",
    render: async (_name, _scope, cmd) => cmdPlayer({ ...cmd, positional: [], named: {} }),
  },
  {
    verb: "show-constraint", summary: "the story's constraint groups, and what the character breaks",
    scopes: IN_THE_BOOKS, defaultScope: "campaign", nameExample: "clan-only-backgrounds",
    render: async (name, scope, cmd) => {
      if (name) return cmdConstraint(asCmd(name, cmd));
      // Asked of a CHARACTER, the question is "what do I break", which is the
      // report [[show-constraint]] used to be.
      return scopeChar(scope) ? cmdCheckConstraints(scopeChar(scope)) : cmdConstraints();
    },
  },

  // --- WHAT A CHARACTER HAS -------------------------------------------------
  {
    verb: "show-sheet", summary: "a character's record as the engine reads it (effective values marked)", scopes: ON_A_SHEET, defaultScope: "current",
    render: async (_name, scope, cmd) => cmdSheet(asCmd(scope.key, cmd)),
  },
  {
    verb: "show-merit", summary: "merits & flaws: what a character owns, or what the chronicle defines",
    note: "in=campaign lists the definitions; a name shows one in full. NEVER lists Arcana - [[show-arcanum]] is their list",
    scopes: IN_THE_BOOKS, defaultScope: "current", nameExample: "iron-will",
    // A NAME shows one; a SHEET scope shows what that character owns; anything
    // else (campaign, template, clan, fellowship) shows what is open there.
    render: async (name, scope, cmd) =>
      name ? cmdMeritInfo(asCmd(name, cmd))
        : scopeChar(scope) ? cmdMerits(scopeChar(scope))
          : scopedPowerDefs(MERIT_FAMILY, scope),
  },
  {
    verb: "show-arcanum", summary: "arcana & taints: what a character owns, or what the chronicle defines",
    note: "Their own category - not merits, and only a demon or a demon's thrall has this list at all",
    scopes: IN_THE_BOOKS, defaultScope: "current", nameExample: "celestial-radiance",
    render: async (name, scope, cmd) =>
      name ? cmdArcanumInfo(asCmd(name, cmd))
        : scopeChar(scope) ? cmdArcana(asCmd(undefined, cmd), scopeChar(scope))
          : scopedPowerDefs(ARCANUM_FAMILY, scope),
  },
  {
    verb: "show-background", summary: "backgrounds: what a character holds and confers, or what the chronicle defines",
    scopes: IN_THE_BOOKS, defaultScope: "current", nameExample: "fount",
    render: async (name, scope, cmd) =>
      name ? cmdBackground(asCmd(name, cmd), scopeChar(scope))
        : scopeChar(scope) ? cmdBackgrounds(scopeChar(scope)) : scopedBackgroundDefs(scope),
  },
  {
    verb: "show-affliction", summary: "afflictions on a character, or the ones the chronicle defines",
    scopes: ["campaign", "current", "character", "scene"], defaultScope: "current",
    nameExample: "in-sanctum",
    render: async (name, scope, cmd) =>
      name ? cmdAfflictionInfo(asCmd(name, cmd))
        : scope.kind === "campaign" ? cmdAfflictionInfo(asCmd(undefined, cmd))
          : cmdAfflictions(asCmd(scope.key, cmd)),
  },
  {
    verb: "show-specialty", summary: "a character's specialties (one applies per roll, via specialty=)", scopes: ON_A_SHEET, defaultScope: "current",
    render: async (_name, scope) => cmdSpecialties(scopeChar(scope)),
  },
  {
    verb: "show-resource", summary: "a character's live pools and trackers (and what they cannot use)", scopes: ON_A_SHEET, defaultScope: "current",
    render: async (_name, scope) => cmdResources(scopeChar(scope)),
  },
  {
    verb: "show-capability", summary: "what a character can USE (a pool he cannot use is only points)",
    scopes: ON_A_SHEET, defaultScope: "current",
    render: async (_name, scope, cmd) => cmdAttune({ ...cmd, positional: [], named: {} }, scopeChar(scope)),
  },
  {
    verb: "show-health", summary: "a character's health track, penalty and what soaks what", scopes: ON_A_SHEET, defaultScope: "current",
    render: async (_name, scope) => cmdHealth(scopeChar(scope)),
  },
  {
    verb: "show-budget", summary: "what each purse allows, what is spent, what is left (advisory)", scopes: ON_A_SHEET, defaultScope: "current",
    render: async (_name, scope, cmd) => cmdBudget(asCmd(scope.key, cmd)),
  },
  {
    verb: "show-grant", summary: "what a purchase really cost and where it came from",
    scopes: ON_A_SHEET, defaultScope: "current",
    render: async (_name, scope, cmd) => cmdGrant({ ...cmd, positional: [], named: {} }, scopeChar(scope)),
  },
  {
    verb: "show-creation", summary: "the creation budget: every pool against what the sheet holds (advisory)", scopes: ON_A_SHEET, defaultScope: "current",
    render: async (_name, scope, cmd) => cmdCreation(asCmd(scope.key, cmd)),
  },
  {
    verb: "show-derived", summary: "what the sheet implies rather than states: Road, Willpower, generation, and why", scopes: ON_A_SHEET, defaultScope: "current",
    render: async (_name, scope, cmd) => cmdDerived(asCmd(scope.key, cmd)),
  },
  {
    verb: "show-supernatural", summary: "the families of power open to a character (disciplines, magic, sorcery, blood-sorcery)", scopes: ON_A_SHEET, defaultScope: "current",
    nameExample: "disciplines",
    render: async (name, scope, cmd) => cmdSupernatural(asCmd(name, cmd), scopeChar(scope)),
  },
  {
    verb: "show-cray", summary: "the cray's points, status and how it refills", scopes: ON_A_SHEET, defaultScope: "current",
    render: async (_name, scope) => cmdCray(scopeChar(scope)),
  },
  {
    verb: "show-eval", summary: "read an expression against a character (the reference system, exposed)", scopes: ON_A_SHEET, defaultScope: "current",
    nameHint: "<expression>", nameExample: "`courage + 2`",
    render: async (_name, scope, cmd) => cmdEval(cmd, scopeChar(scope)),
  },
  // These two take an ID, not a character: the NAME is the extended action or
  // contest to look at, and bare means "the one that is running". (Passing the
  // scope's character here read the character name as an id and found nothing.)
  {
    verb: "show-roll-status", summary: "an extended action's progress (bare: the one that is running)", scopes: ON_A_SHEET, defaultScope: "current",
    nameHint: "[id]",
    render: async (name, _scope, cmd) => cmdRollStatus(asCmd(name, cmd)),
  },
  {
    verb: "show-contest-status", summary: "an extended contest's progress (bare: the one that is running)", scopes: ON_A_SHEET, defaultScope: "current",
    nameHint: "[id]",
    render: async (name, _scope, cmd) => cmdContestStatus(asCmd(name, cmd)),
  },
];

// --- ASKING A LIST OF A PLACE ------------------------------------------------
// The point of a scope on a DEFINITION list: "what may a Nosferatu take" was
// unaskable before, because clan-exclusive merits gate on a CHOICE and nothing
// filtered by one. `in=clan::nosferatu` now means it.
//
// The rule is the same one [[take-merit]] enforces at the door: a definition is
// open to a place if the place meets its `requires` and its per-template price
// admits it. Advisory, like everything creation-side - this REPORTS what is
// open, it does not stop anyone.
function scopeTemplates(scope: ResolvedScope): string[] {
  if (scope.kind === "template") return [scope.key!];
  return scope.char?.templates ?? [];
}
function scopeChoices(scope: ResolvedScope): Record<string, string> {
  if (scope.kind === "clan") return { clan: scope.key! };
  if (scope.kind === "fellowship") return { fellowship: scope.key! };
  return scope.char?.choices ?? {};
}
// Does this definition's `requires` admit the place? Only the parts the place
// can answer are checked - a clan scope knows nothing about tags, and refusing
// on what it cannot know would hide everything.
function openToScope(def: OwnedPowerDef, scope: ResolvedScope): boolean {
  if (scope.kind === "campaign") return true;
  const templates = scopeTemplates(scope);
  const choices = scopeChoices(scope);
  const req = def.requires;
  if (req?.templates?.length && templates.length
    && !req.templates.some(t => templates.includes(StringUtil.normalize(t)))) return false;
  for (const [what, want] of Object.entries(req?.choices ?? {})) {
    const key = StringUtil.normalize(what);
    const has = StringUtil.normalize(choices[key] ?? "");
    if (!has) return false;                      // gated on a choice this place has not made
    const asked = StringUtil.normalize(want);
    const met = key === "clan" ? clanFamilyOf(has) === clanFamilyOf(asked) : has === asked;
    if (!met) return false;
  }
  // A printed "(7/5)" names everyone who may have it; a place outside that list
  // is not admitted (meritCostFor is the same call take-merit makes).
  if (templates.length && !meritCostFor(def, templates).available) return false;
  return true;
}

// What a place can USE - the capability roster, so a list that is closed to a
// kind of creature says so instead of pricing things for someone who cannot
// have any of them. A clan or fellowship is NOT a template and settles nothing
// here (a Nosferatu may perfectly well be a demon's thrall), so it is skipped.
function scopeCapabilities(scope: ResolvedScope): string[] | undefined {
  if (scope.char) return CharacterResources.capabilities(scope.char);
  if (scope.kind === "template") return [...(TEMPLATES[scope.key!]?.Capabilities ?? [])];
  return undefined;
}

// The definition list of one owned-power family, narrowed to a place.
function scopedPowerDefs<T extends OwnedPowerDef>(family: PowerFamily<T>, scope: ResolvedScope): string {
  // Is the LIST open to this place at all? Asked first, because "a vampire has
  // no Arcana" is a truer answer than a priced catalogue he can never buy from.
  const caps = family.requires ? scopeCapabilities(scope) : undefined;
  if (family.requires && caps && !caps.includes(family.requires)) {
    return sys(`${scope.label} has no ${family.many} at all. ${family.requiresNote ?? ""} `
      + `[[${family.verbs.list} @all in=campaign]] lists them anyway.`);
  }
  const open = family.registry.all().filter(d => openToScope(d, scope));
  if (!open.length) {
    return sys(`Nothing in ${family.many} is open to ${scope.label}. `
      + `[[${family.verbs.list} @all in=campaign]] lists every definition.`);
  }
  const items = open.map(d => `${StringUtil.normalize(d.name)}${d.kind === family.defaultKind ? "" : ` (${d.kind})`}`);
  const heading = scope.kind === "campaign"
    ? `Defined ${family.many}`
    : `${family.many} open to ${scope.label}`;
  return sys(`${heading}: ${items.join(", ")}. `
    + `[[${family.verbs.info} <name>]] for detail; [[${family.verbs.define}]] adds one.`);
}

// ...and the backgrounds, whose gate is a plain template list.
function scopedBackgroundDefs(scope: ResolvedScope): string {
  const templates = scopeTemplates(scope).map(t => StringUtil.normalize(t));
  const open = BackgroundRegistry.all().filter(d => {
    if (scope.kind === "campaign" || !d.templates?.length || !templates.length) return true;
    return d.templates.some(t => templates.includes(StringUtil.normalize(t)));
  });
  if (!open.length) return sys(`No backgrounds are open to ${scope.label}.`);
  const where = scope.kind === "campaign" ? "" : ` open to ${scope.label}`;
  return sys(`Backgrounds${where}: ${open.map(d => d.name).join(", ")}. `
    + `[[show-background <name>]] for one; [[set-trait <name> <n>]] rates one; [[define-background]] adds one.`);
}

// --- REGISTRATION ------------------------------------------------------------
// Every show verb, and every old name that meant it, from the one table. A
// subject cannot be half-wired: declaring it registers the verb, its `in=` and
// `in-story=` knobs, and the deprecation pointer on each name it replaces.
export const SHOW_VERB_PREFIX = "show-";
// The verbs the subject table owns. Exported so a test can check the real list
// rather than guessing from the prefix - `show-help` wears the prefix but is an
// alias of [[help]], not a subject.
export const SHOW_SUBJECT_VERBS: string[] = [];
const SHOW_ALL_HINT = "name|@all";

function showParams(subject: ShowSubject): ParamSpec[] {
  return [
    { key: "name", kind: "positional", hint: subject.nameHint ?? SHOW_ALL_HINT,
      example: subject.nameExample,
      desc: `What to show; ${SHOW_ALL_TOKEN} means the whole list` },
    { key: "in", kind: "named", hint: "<where>", example: subject.scopes.slice(0, 3).join(" · "),
      desc: `Where to look: ${subject.scopes.join(", ")} (default ${subject.defaultScope}); `
        + `a bare name is worked out, kind::name is explicit` },
    ...(subject.extra ?? []),
    // `in-story` is NOT listed here: CommandRouter.register attaches it to every
    // verb, show or not (src/command.ts IN_STORY_PARAM).
  ];
}

// DEFERRED ON PURPOSE - the ONE place in src/game/* where registration order is
// not simply "wherever the module body ran". All 130 registrations live in just
// two modules: 129 top-level ones in afflictions.ts and this loop. In the old
// single file this loop came AFTER those 129, so [[help]] listed the show-*
// verbs last. Splitting created a cycle (show imports afflictions, which reaches
// back here through context), and ESM resolves that cycle by running THIS module
// first - which silently moved 33 show-* verbs to the head of every listing.
//
// Calling it from the barrel instead puts it back where it was: module bodies
// all finish before the barrel's own body runs, so afflictions' 129 are always
// registered first. dist/naiowod.ts concatenates the barrel last, so the
// artifact agrees - one order, both paths, and it is the order the file had.

// DEFERRED ON PURPOSE - the ONE place in src/game/* where registration order is
// not just "wherever the module body ran". All 130 registrations live in two
// modules: 129 top-level ones in afflictions.ts, and these. In the single file
// this loop came AFTER those 129, so [[help]] listed the show-* verbs last.
// Splitting created a cycle (show imports afflictions, which reaches back here
// through context) and ESM breaks that cycle by running THIS module first -
// silently moving 33 show-* verbs to the head of every listing.
//
// Calling it from the barrel instead puts them back: every module body finishes
// before the barrel's own body runs, so afflictions' 129 are always registered
// first. dist/naiowod.ts concatenates the barrel last, so the artifact agrees.
// One order, both paths, and it is the order the file always had.
export function installShowVerbs(): void {
  for (const subject of SHOW_SUBJECTS) {
    const handler: CommandHandler = async (cmd) => {
      const { name } = showName(cmd);
      const scope = await resolveShowScope(cmd.named["in"] ?? cmd.named["from"], subject.scopes, subject.defaultScope);
      if ("error" in scope) return sys(scope.error);
      return subject.render(name, scope, cmd);
    };
    CommandRouter.register(subject.verb, handler, {
      summary: subject.summary,
      note: subject.note,
      params: showParams(subject),
    });
    SHOW_SUBJECT_VERBS.push(subject.verb);
  }
  // Deferred with its siblings for the same reason: registered in the module
  // body it would land ahead of afflictions.ts's 129 and lead every listing.
  CommandRouter.register("show-help",
    (cmd, ctx) => CommandRouter.route(`help ${cmd.positional.join(" ")}`.trim(), ctx), {
      summary: "alias of [[help]], which keeps its name - it is the one command everybody already knows",
      params: [{ key: "verb", kind: "positional", hint: "[verb]", example: "show-merit" }],
    });
}

// HELP IS THE EXCEPTION, and it runs the other way. Everything else that only
// reports was renamed to `show-*`, but [[help]] is what a player types before
// they know anything at all - in this engine and in every other one - so it
// KEEPS its name and is not deprecated. `show-help` is registered as the alias,
// for the players who will now reasonably guess it. Both are quiet.

export const COMMAND_PATTERN = /\[\[([\s\S]*?)\]\]/g;

// QUIET: a verb whose reply is for the PLAYER, not the AI. Issuing one
// suppresses generation for the turn even amid prose - the player is querying
// the system, not narrating an action the Storyteller should continue.
// (Generation belongs to in-fiction ACTIONS: rolls, spends, damage, afflicting.)
//
// THE NAME IS THE POLICY. Every `show-*` verb is quiet by construction, so a
// new listing cannot be forgotten from a register - which is exactly what the
// old hand-maintained set kept happening to. What is left below is the handful
// of read-only verbs that are not listings at all, plus the deprecated aliases,
// which are quiet because the verb they now point at is.
//
// This is the game-layer "quiet the turn" policy; it stays OUT of the pure
// CommandSpec (which describes grammar).
const QUIET_VERBS = new Set<string>([
  // [[help]] keeps its name (see the registration after SHOW_SUBJECTS): it is
  // the one command a player already knows before they know anything, so it is
  // named for discovery rather than for this scheme - and listed here instead.
  "help", "show-help",
  // Maintenance: the player operating the machine, never a story beat.
  "flush-context", "convert-cards",
]);

export function isQuietVerb(verb: string): boolean {
  const v = verb.toLowerCase();
  if (v.startsWith(SHOW_VERB_PREFIX)) return true;
  return QUIET_VERBS.has(v);
}

// DOES THIS REPLY BELONG IN THE STORY? Three answers, in order:
//   1. what the player said on THIS call - `in-story`, `in-story=false`
//   2. what the verb declares (CommandSpec.inStory)
//   3. its name: a quiet verb is for the player, so no; anything else, yes
//
// Both directions matter. `[[show-sheet in-story]]` lets the Storyteller read
// the sheet; `[[roll stealth in-story=false]]` is a roll behind the screen.
//
// It does NOT change generation for the turn: looking something up is still not
// an action, so a show reply sits in the story and is read on the NEXT
// generation rather than prompting one now.
export function wantsInStory(cmd: ParsedCommand): boolean {
  const said = flagOf(cmd, IN_STORY_KEY);
  if (said !== undefined) return said;
  const declared = CommandRouter.specFor(cmd.name)?.inStory;
  if (declared !== undefined) return declared;
  return !isQuietVerb(cmd.name);
}
