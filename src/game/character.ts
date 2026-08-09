// Split out of the former 7941-line src/game.ts (memory §7.91). The cut points
// are the file's own section banners and SOURCE ORDER IS PRESERVED across the
// split, so dist/naiowod.ts keeps the exact declaration order it had as one
// file - the artifact's only diff is which //#region each line sits in.
import { ParsedCommand, sys } from "../command";
import { BUILTIN_FUNCTIONS, Numeric, describeTerms, evaluateCondition, evaluateExpr } from "../core/expr";
import { StringUtil } from "../core/traits";
import { TraitResolver } from "../rolls";
import { AFFINITY_SOURCES, ATTRIBUTES, BackgroundDef, BudgetDef, BudgetEntry, CLANS, COST_PURSES, CostTable, CreationBudget, DEFAULT_SUPERNATURAL_CATEGORIES, DEFAULT_SUPERNATURAL_TRAITS, DEFAULT_TEMPLATE_DEFS, GRANT_SOURCES, NOT_PURCHASABLE, ROADS, ResourceDef, SOAK_TABLES, TEMPLATES, TemplateDef, TraitGrant, TraitLimit, advancementCostsFrom, affinityDisciplines, backgroundTierAt, budgetBuyable, budgetDef, budgetOfKind, categoryOpenTo, clanByName, creationBudgetFor, describeCreationGrant, fellowshipByName, grantSourceNote, kindSpends, makeBackgroundDef, makeTemplateDef, roadByName, roadRatingExpr, sourceDrawsOnPurse, supernaturalTraitOf } from "../rules";
import { LorebookManager } from "../services";
import { AdvancementCosts, BackgroundRegistry, COSTS_CONFIG_ENTRY, CharacterStore, DerivedValue, PlayableCharacter, ResourceOverrides, ScopeExtension, StoryClock, TemplateRegistry, characterScope, derivedValuesOf, evalOn, grantedTraitsOf, lastTemplateProblems, numericOn, ownedPowerInstances, resolveTraitFromRecord, roadOf, traitValueOf } from "../state";
import { resolveCharacterRef } from "./afflictions";
import { disp, intOrUndef, noCharacter } from "./common";
import { characterRollEnv } from "./effects";
import { timedScope } from "./time";

// =============================================================================
// BUDGETS - what a character may spend, per purse
// -----------------------------------------------------------------------------
// Arcana are NOT merits: they trade in a purse of their own, so counting them
// as merits would make a legal character look overspent. A budget is an
// EXPRESSION ("25", and later one written in terms of another), declared on the
// template and overridable on the sheet. Everything here is ADVISORY - there is
// no creation engine yet, so [[show-budget]] reports and the Storyteller decides.
// =============================================================================

// Every purse this character has a budget for: the creation pools first, then
// each template's, then the sheet's - each layer merging FIELD BY FIELD, so
// pricing a purse never erases the allowance underneath and vice versa.
//
// The prices come from the chronicle's cost table when nobody states them, so
// a purse always knows what one of its dots costs in freebies and in
// experience. A template says otherwise when its creature is otherwise: the
// Ouroboros' Arcana are NOT_PURCHASABLE from either.
function budgetsOf(char: PlayableCharacter): Record<string, BudgetDef> {
  // The creation budget already answers three of these purses; [[show-budget]] and
  // [[show-creation]] must not disagree about how many Background dots you get.
  const creation = creationBudgetFor(char.templates);
  const out: Record<string, BudgetDef> = {
    background: { allows: String(creation.backgrounds) },
    freebie: { allows: String(creation.freebies) },
    ...(creation.disciplines !== undefined ? { discipline: { allows: String(creation.disciplines) } } : {}),
  };
  const layer = (purse: string, entry: BudgetEntry): void => {
    const key = StringUtil.normalize(purse);
    out[key] = { ...(out[key] ?? {}), ...budgetDef(entry) };
  };
  for (const t of char.templates) {
    for (const [purse, entry] of Object.entries(TEMPLATES[StringUtil.normalize(t)]?.Budgets ?? {})) layer(purse, entry);
  }
  for (const [purse, entry] of Object.entries(char.budgets ?? {})) layer(purse, entry);
  // Chronicle bonuses ADD to the allowance rather than replacing it, and keep
  // their reason attached - "everyone here is Suspect" is part of the budget
  // now, not a number somebody remembers.
  for (const g of char.purseGrants ?? []) {
    const key = StringUtil.normalize(g.purse);
    const base = out[key]?.allows;
    out[key] = {
      ...(out[key] ?? {}),
      allows: base ? `(${base}) + ${g.points}` : String(g.points),
      note: [out[key]?.note, `+${g.points} from ${g.source}${g.note ? `: ${g.note}` : ""}`].filter(Boolean).join("; "),
    };
  }
  // The default price of a dot is what the chronicle's table says a dot of that
  // kind costs - the purses whose names ARE the kind ("background",
  // "discipline", "virtue"). A purse the table has never heard of keeps its
  // silence, and [[show-budget]] reports it as the Storyteller's call.
  const table = advancementCostsFrom(AdvancementCosts.current() as CostTable);
  for (const [purse, def] of Object.entries(out)) {
    const priced = table[purse];
    if (!priced) continue;
    if (def.freebie === undefined && priced.freebie) def.freebie = priced.freebie;
    if (def.experience === undefined && priced.experience) def.experience = priced.experience;
  }
  return out;
}

// An expression -> a number, through the one expression language, so a budget
// may be written in terms of the character's own traits.
function evalBudget(char: PlayableCharacter, expr: string): number {
  return Math.max(0, evalOn(char, expr).value);
}

// The allowance a purse holds for this character, or undefined when nobody has
// said - which is a different answer from zero and must stay one.
function budgetAllowance(char: PlayableCharacter, def: BudgetDef | undefined): number | undefined {
  return def?.allows === undefined ? undefined : evalBudget(char, def.allows);
}

// The two prices, said the way [[show-budget]] and [[show-cost]] both want them.
function budgetPrices(def: BudgetDef): string {
  const bits = (["freebie", "experience"] as const)
    .filter(p => def[p] !== undefined)
    .map(p => budgetBuyable(def[p]) ? `${p} ${def[p]}` : `not bought with ${p === "freebie" ? "freebies" : "experience"}`);
  return bits.join(", ");
}

// The purse namespaces an expression may reach: `budget:freebie` (what the
// purse holds), `spent:freebie` (what has left it) and `left:freebie` (the
// difference). state.ts cannot compute these - the ledger lives up here - so it
// takes them as a scope EXTENSION, which is the seam a legality proof will use
// to say "you have four Background dots you never assigned".
function purseScope(char: PlayableCharacter): ScopeExtension {
  return (path) => {
    const [head, ...rest] = path;
    if (!["budget", "spent", "left"].includes(head)) return undefined;
    const purse = rest.join(":");
    // The ledger reads traits, and a trait may itself be derived - but a purse
    // is never part of a derivation, so the plain trait scope breaks the knot.
    const resolve = (n: string): number => traitValueOf(char, n);
    const spent = purseLedger(char, resolve)[purse]?.spent ?? 0;
    if (head === "spent") return { value: spent };
    const allows = budgetsOf(char)[purse]?.allows;
    if (allows === undefined) return undefined;
    const budget = Math.max(0, evaluateExpr(allows, characterScope(char)).value);
    return { value: head === "budget" ? budget : budget - spent };
  };
}

// What each owned merit / flaw / arcanum / taint draws from its purse. The
// listed price is the default; `paid` on the sheet overrides it, because price
// paid is not price listed - a Storyteller may simply GRANT a thing.
function purseLedger(char: PlayableCharacter, resolve: TraitResolver): Record<string, { spent: number; items: string[] }> {
  const out: Record<string, { spent: number; items: string[] }> = {};
  // Background DOTS are a purse of their own, and dots are not cost: a
  // Background the chronicle handed you rates 5 and cost nothing, which is
  // exactly what `paid` records. A CONFERRED rating never cost anything either.
  const conferred = grantedTraitsOf(char);
  const backgrounds = { spent: 0, items: [] as string[] };
  // A purchase whose SOURCE is not a creation purse costs the purse nothing -
  // and the ledger says which source, so the proof reads "template" or
  // "storyteller" rather than an unexplained zero.
  const sourceOf = (key: string): string | undefined => char.source?.[StringUtil.normalize(key)];
  const offPurse = (key: string): boolean => !sourceDrawsOnPurse(sourceOf(key));
  for (const [name, rating] of Object.entries(char.backgrounds ?? {})) {
    if (rating <= 0) continue;
    if (offPurse(name)) { backgrounds.items.push(`${name} ${rating} (${sourceOf(name)})`); continue; }
    const held = char.instances?.[name];
    const each = held?.length ? held : [{ rating, paid: char.paid?.[name] }];
    for (const one of each) {
      const override = (one as { paid?: string }).paid;
      const cost = override !== undefined ? evalBudget(char, override) : one.rating;
      backgrounds.spent += cost;
      backgrounds.items.push(`${name} ${one.rating}${override !== undefined ? ` (paid ${cost})` : ""}`);
    }
  }
  for (const [name, g] of Object.entries(conferred)) {
    backgrounds.items.push(`${name} ${g.rating} (from ${g.from}, free)`);
  }
  if (backgrounds.items.length) out["background"] = backgrounds;
  // Discipline DOTS are a purse too, and like Backgrounds a dot is not a cost:
  // `paid` records what the chronicle actually charged for one.
  const disciplines = { spent: 0, items: [] as string[] };
  for (const [name, rating] of Object.entries(char.disciplines ?? {})) {
    if (rating <= 0) continue;
    if (offPurse(name)) { disciplines.items.push(`${name} ${rating} (${sourceOf(name)})`); continue; }
    const override = char.paid?.[name];
    const cost = override !== undefined ? evalBudget(char, override) : rating;
    disciplines.spent += cost;
    disciplines.items.push(`${name} ${rating}${override !== undefined ? ` (paid ${cost})` : ""}`);
  }
  if (disciplines.items.length) out["discipline"] = disciplines;
  // BOTH categories: a purse ledger is machinery, and the whole reason arcana
  // are their own category is that they draw on their own purse. Each instance
  // says which one it trades in.
  for (const inst of ownedPowerInstances(char)) {
    const purse = budgetOfKind(inst.def);
    if (offPurse(inst.key)) {
      const row = out[purse] ?? { spent: 0, items: [] };
      row.items.push(`${inst.key} (${sourceOf(inst.key)})`);
      out[purse] = row;
      continue;
    }
    const override = char.paid?.[inst.key];
    const listed = inst.points;
    const cost = override !== undefined ? evalBudget(char, override) : listed;
    const signed = kindSpends(inst.def.kind) ? cost : -cost;
    const row = out[purse] ?? { spent: 0, items: [] };
    row.spent += signed;
    row.items.push(`${inst.key} ${signed >= 0 ? signed : `+${-signed}`}${override !== undefined ? " (set)" : ""}`);
    out[purse] = row;
  }
  return out;
}

// budget - each purse: what it allows, what the sheet has spent, what is left.
export async function cmdBudget(cmd: ParsedCommand): Promise<string> {
  const raw = (cmd.named["character"] ?? cmd.positional[0])?.trim();
  const char = raw ? await CharacterStore.load((await resolveCharacterRef(raw)).name ?? raw) : await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const { resolver } = await characterRollEnv(char);
  const budgets = budgetsOf(char);
  const ledger = purseLedger(char, resolver);
  const purses = [...new Set([...Object.keys(budgets), ...Object.keys(ledger)])].sort();
  if (!purses.length) return sys(`${disp(char.name)} has no budgets and has bought nothing that draws on one.`);
  const lines = purses.map(purse => {
    const def = budgets[purse] ?? {};
    const spent = ledger[purse]?.spent ?? 0;
    const items = ledger[purse]?.items ?? [];
    const detail = items.length ? ` [${items.join(", ")}]` : "";
    // A purse says three things: what it holds, what it has spent, and what a
    // dot of it costs to buy - and "cannot be bought" is one of those answers.
    const prices = budgetPrices(def);
    const tail = `${prices ? ` - ${prices}` : ""}${def.note ? ` (${def.note})` : ""}${detail}`;
    const total = budgetAllowance(char, def);
    if (total === undefined) return `${purse}: ${spent} spent, no budget set (Storyteller's call)${tail}`;
    const shown = def.allows !== String(total) ? ` (${def.allows})` : "";
    return `${purse}: ${spent}/${total}${shown}, ${total - spent} left${tail}`;
  });
  return sys(`${disp(char.name)} budgets - ${lines.join("; ")}. Advisory: nothing is enforced until creation is. `
    + `Override one on the sheet's "budgets" block or with [[extend-template ... budgets=\`purse=expr\`]]; `
    + `set what a purchase really cost with [[paid <key> <expr>]].`);
}

// grant - where something came from, when it was not bought from a purse.
//
// Two shapes, because the owner named two different things:
//   [[grant potence source=template]]        this trait costs the purse nothing
//   [[grant freebie 3 source=storyteller note=`everyone here is Suspect`]]
//                                            the chronicle ADDS to a purse
// The second is the ruling he described: Flaws past the cap that still pay,
// recorded as a bonus with its reason rather than as a silently larger budget.
export async function cmdGrant(cmd: ParsedCommand, forChar?: PlayableCharacter): Promise<string> {
  const char = forChar ?? await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const key = StringUtil.normalize(cmd.positional[0] ?? "");
  const source = StringUtil.normalize(cmd.named["source"] ?? "storyteller");
  if (!key) {
    const owned = Object.entries(char.source ?? {}).map(([k, v]) => `${k}: ${v}`);
    const bonuses = (char.purseGrants ?? []).map(g => `${g.purse} +${g.points} (${g.source}${g.note ? `: ${g.note}` : ""})`);
    return sys(`${disp(char.name)} - ${owned.length ? `granted: ${owned.join(", ")}` : "nothing granted"}`
      + `${bonuses.length ? `; purse bonuses: ${bonuses.join(", ")}` : ""}. `
      + `Sources: ${Object.entries(GRANT_SOURCES).map(([k, v]) => `${k} (${v})`).join("; ")}. `
      + `[[grant <trait> source=template]] marks one; [[grant <purse> <points> source=storyteller note=\`why\`]] adds to a purse.`);
  }
  if (!(source in GRANT_SOURCES)) {
    return sys(`No grant source "${source}". Known: ${Object.keys(GRANT_SOURCES).join(", ")}.`);
  }
  const points = intOrUndef(cmd.positional[1] ?? "");
  if (points !== undefined) {
    // A PURSE bonus: more points to spend, and the reason travels with them.
    const note = cmd.named["note"]?.trim();
    char.purseGrants = [
      ...(char.purseGrants ?? []).filter(g => !(g.purse === key && g.source === source)),
      { purse: key, points, source, ...(note ? { note } : {}) },
    ];
    await CharacterStore.save(char);
    return sys(`${disp(char.name)}: ${key} purse +${points} (${source}${note ? ` - ${note}` : ""}). `
      + `[[show-budget]] counts it, with the reason attached.`);
  }
  // A TRAIT or merit instance: it costs the purse nothing, and this says why.
  char.source = { ...(char.source ?? {}), [key]: source };
  await CharacterStore.save(char);
  return sys(`${disp(char.name)}: ${disp(key)} is ${source} - ${grantSourceNote(source)}. `
    + `It costs no creation purse${sourceDrawsOnPurse(source) ? " differently than before" : ""}; [[show-budget]] shows it.`);
}

export async function cmdUngrant(cmd: ParsedCommand): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const key = StringUtil.normalize(cmd.positional[0] ?? "");
  if (!key) return sys(`forget-grant needs a trait or a purse.`);
  const hadSource = char.source?.[key] !== undefined;
  if (hadSource) { delete char.source![key]; if (!Object.keys(char.source!).length) delete char.source; }
  const before = (char.purseGrants ?? []).length;
  char.purseGrants = (char.purseGrants ?? []).filter(g => g.purse !== key);
  if (!char.purseGrants.length) delete char.purseGrants;
  await CharacterStore.save(char);
  const dropped = (hadSource ? 1 : 0) + (before - (char.purseGrants?.length ?? 0));
  return dropped
    ? sys(`${disp(char.name)}: ${disp(key)} is back to being bought normally.`)
    : sys(`${disp(char.name)} had no grant for "${key}".`);
}

// paid <key> [expr] - what a purchase ACTUALLY cost. No expression means 0: the
// Storyteller granted it. Bare [[paid]] lists the overrides.
export async function cmdPaid(cmd: ParsedCommand): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const rawKey = cmd.positional[0]?.trim();
  if (!rawKey) {
    const entries = Object.entries(char.paid ?? {});
    return entries.length
      ? sys(`${disp(char.name)} - prices the Storyteller set: ${entries.map(([k, v]) => `${k} = ${v}`).join(", ")}. `
        + `[[paid <key> <expr>]] sets one; [[paid <key> listed]] puts it back.`)
      : sys(`${disp(char.name)} paid the listed price for everything. [[paid <key> [expr]]] records otherwise (no expression = granted).`);
  }
  const key = StringUtil.normalize(rawKey);
  const expr = cmd.positional[1]?.trim() ?? cmd.named["expr"]?.trim() ?? "0";
  char.paid = { ...(char.paid ?? {}) };
  if (expr.toLowerCase() === "listed") {
    if (!(key in char.paid)) return sys(`No price was set for "${key}".`);
    delete char.paid[key];
    if (!Object.keys(char.paid).length) delete char.paid;
    await CharacterStore.save(char);
    return sys(`${key} pays the listed price again.`);
  }
  char.paid[key] = expr;
  await CharacterStore.save(char);
  const { resolver } = await characterRollEnv(char);
  const value = evalBudget(char, expr);
  return sys(`${key} cost ${value}${expr !== String(value) ? ` (${expr})` : ""}${value === 0 ? " - granted, not bought" : ""}. `
    + `[[show-budget]] counts it.`);
}

// =============================================================================
// CREATION - the budget a fresh character is built against
// -----------------------------------------------------------------------------
// Reports, never enforces. The numbers live in the template's CreationBudget
// (rules.ts); this walks the sheet and says what each pool has actually taken.
// =============================================================================
// The trait names in one priority category. Attributes come from the fixed
// three (rules.ts); Abilities come from the CHRONICLE's own lists, so a
// house-ruled Ability counts in whichever of them names it. Both the plural and
// the singular answer, because both are what a player types.
async function categoryTraits(kind: "attributes" | "abilities"): Promise<{ order: string[]; of: Record<string, string[]> }> {
  const order: string[] = [];
  const of: Record<string, string[]> = {};
  const put = (category: string, names: readonly string[]): void => {
    const list = names.map(n => StringUtil.normalize(n));
    order.push(category);
    of[category] = list;
    if (category.endsWith("s")) of[category.slice(0, -1)] = list;
  };
  if (kind === "attributes") {
    for (const [category, names] of Object.entries(ATTRIBUTES)) put(category, names);
    return { order, of };
  }
  put("talents", await LorebookManager.allTalents());
  put("skills", await LorebookManager.allSkills());
  put("knowledges", await LorebookManager.allKnowledges());
  return { order, of };
}

// The template's budget (templates stack - see creationBudgetFor).
function creationOf(char: PlayableCharacter): CreationBudget {
  return creationBudgetFor(char.templates);
}

// The trait limits in force: the template's, plus the chosen clan's (a
// Nosferatu's Appearance is 0 and stays 0).
function limitsFor(char: PlayableCharacter): Record<string, TraitLimit> {
  const clan = char.choices?.["clan"] ? clanByName(char.choices["clan"]) : undefined;
  return { ...(creationOf(char).limits ?? {}), ...(clan?.limits ?? {}) };
}

// The Disciplines that are this character's own, from every source at once: the
// clan or bloodline family he picked, and what his templates say outright.
// Templates stack the same way their budgets do - and a "replace" anywhere
// means the families have nothing to add.
function affinityOf(char: PlayableCharacter): { disciplines: string[]; sources: string[] } {
  const own: string[] = [];
  let replace = false;
  for (const t of char.templates) {
    const a = TEMPLATES[StringUtil.normalize(t)]?.Affinity;
    if (!a) continue;
    own.push(...a.disciplines);
    if (a.mode === "replace") replace = true;
  }
  return affinityDisciplines(char.choices, { disciplines: own, ...(replace ? { mode: "replace" as const } : {}) });
}

// choose <what> <value> - the picks a template asks for.
export async function cmdChoose(cmd: ParsedCommand): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const what = StringUtil.normalize(cmd.positional[0] ?? cmd.named["what"] ?? "");
  const value = (cmd.positional[1] ?? cmd.named["value"] ?? "").trim();
  if (!what) {
    const made = Object.entries(char.choices ?? {}).map(([k, v]) => `${k}: ${disp(v)}`);
    // The family choices carry Disciplines with them; two of the three
    // registries are empty for now, and a template's own list covers for them.
    const families = AFFINITY_SOURCES.filter(s => s.choice !== "clan")
      .map(s => `[[choose ${s.choice} <name>]]${Object.keys(s.families).length ? "" : " (none defined yet)"}`);
    return sys(`${disp(char.name)} - ${made.length ? made.join(", ") : "nothing chosen yet"}. `
      + `[[choose clan <name>]] ([[show-clan]]), [[choose fellowship <name>]] ([[show-fellowship]]), `
      + `[[choose road <name>]] (${Object.values(ROADS).map(r => r.name).join(", ")}), `
      + `[[choose attributes physical,social,mental]] (primary, secondary, tertiary), `
      + `${families.join(", ")}.`);
  }
  if (what === "attributes" || what === "abilities") {
    const groups = await categoryTraits(what);
    const order = value.split(",").map(x => StringUtil.normalize(x)).filter(Boolean);
    const wrong = order.filter(c => !(c in groups.of));
    if (order.length !== 3 || wrong.length) {
      return sys(`${wrong.length ? `No ${what} category ${wrong.map(w => `"${w}"`).join(", ")}. ` : ""}`
        + `${what} needs three categories in priority order, e.g. [[choose ${what} ${groups.order.join(",")}]]. `
        + `Known: ${groups.order.join(", ")}.`);
    }
    char.priorities = { ...(char.priorities ?? {}) };
    (["primary", "secondary", "tertiary"] as const).forEach((slot, i) => { char.priorities![`${what}-${slot}`] = order[i]; });
    await CharacterStore.save(char);
    return sys(`${disp(char.name)} ${what}: ${order.map((o, i) => `${["primary", "secondary", "tertiary"][i]} ${disp(o)}`).join(", ")}. [[show-creation]] checks the pools.`);
  }
  if (!value) return sys(`[[choose ${what} <value>]] needs a value.`);
  if (what === "road") {
    const road = roadByName(value);
    if (!road) return sys(`No road "${value}". Known: ${Object.values(ROADS).map(r => r.name).join(", ")}.`);
    char.choices = { ...(char.choices ?? {}), road: StringUtil.normalize(road.name) };
    await CharacterStore.save(char);
    return sys(`${disp(char.name)} walks the ${road.name}. Virtues: ${road.virtues.map(v => disp(v)).join(", ")}; `
      + `the rating is ${road.ratingVirtues.map(v => disp(v)).join(" + ")}. [[show-derived]] shows what follows.`);
  }
  if (what === "clan") {
    const clan = clanByName(value);
    if (!clan) return sys(`No clan "${value}". [[show-clan]] lists them.`);
    char.choices = { ...(char.choices ?? {}), clan: clan.id };
    await CharacterStore.save(char);
    const bounds = Object.values(clan.limits ?? {}).map(l => l.note).filter(Boolean).join(" ");
    return sys(`${disp(char.name)} is ${clan.name}. Clan Disciplines: ${clan.disciplines.map(d => disp(d)).join(", ")}. `
      + `${bounds ? `${bounds} ` : ""}Rate them with [[set-trait <discipline> <n> group=discipline]].`);
  }
  if (what === "fellowship") {
    const f = fellowshipByName(value);
    if (!f) return sys(`No fellowship "${value}". [[show-fellowship]] lists them.`);
    char.choices = { ...(char.choices ?? {}), fellowship: f.id };
    await CharacterStore.save(char);
    return sys(`${disp(char.name)} follows the ${f.name}${f.theme ? ` (${f.theme})` : ""}. `
      + `Foundation: ${disp(f.foundation)}. Pillars: ${Object.entries(f.pillars).map(([p, g]) => `${disp(p)} (${g})`).join(", ")}. `
      + `Rate them with [[set-trait <pillar> <n>]].`);
  }
  char.choices = { ...(char.choices ?? {}), [what]: StringUtil.normalize(value) };
  await CharacterStore.save(char);
  return sys(`${disp(char.name)} ${what}: ${disp(value)} (recorded; the engine knows no rules for it).`);
}

// clans / clan <name>
export async function cmdClans(cmd: ParsedCommand): Promise<string> {
  const which = cmd.positional[0]?.trim();
  if (which) {
    const clan = clanByName(which);
    if (!clan) return sys(`No clan "${which}". Known: ${Object.values(CLANS).map(c => c.name).join(", ")}.`);
    const limits = Object.entries(clan.limits ?? {}).map(([t, l]) => `${disp(t)} ${l.start ?? 0}-${l.max ?? 5}${l.note ? ` (${l.note})` : ""}`);
    return sys(`${clan.name} - Disciplines: ${clan.disciplines.map(d => disp(d)).join(", ")}`
      + `${limits.length ? `; ${limits.join("; ")}` : ""}. [[choose clan ${clan.id}]] picks it.`);
  }
  return sys(`Clans: ${Object.values(CLANS).map(c => `${c.name} (${c.disciplines.map(d => disp(d)).join("/")})`).join("; ")}. `
    + `[[show-clan <name>]] for one; [[choose clan <name>]] picks it.`);
}

// creation - every pool, against what the sheet actually holds.
export async function cmdCreation(cmd: ParsedCommand): Promise<string> {
  const raw = (cmd.named["character"] ?? cmd.positional[0])?.trim();
  const char = raw ? await CharacterStore.load((await resolveCharacterRef(raw)).name ?? raw) : await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const budget = creationOf(char);
  const limits = limitsFor(char);
  const lines: string[] = [];
  // Every number below may be an EXPRESSION over this very character - a
  // vampire's Attribute ceiling is `trait-max(generation)`, not 5 - so each is
  // read through the character's own scope (state.ts).
  const num = (v: Numeric | undefined, fallback: number): number => numericOn(char, v, fallback, purseScope(char));
  const startOf = (name: string, free: number): number => num(limits[name]?.start, free);

  // Attributes and Abilities are per CATEGORY, so the priorities must be set.
  for (const kind of ["attributes", "abilities"] as const) {
    const pools = kind === "attributes" ? budget.attributes : budget.abilities;
    const free = num(kind === "attributes" ? budget.attributeStart : budget.abilityStart, kind === "attributes" ? 1 : 0);
    const groups = await categoryTraits(kind);
    const slots = (["primary", "secondary", "tertiary"] as const).map(slot => ({
      slot, category: char.priorities?.[`${kind}-${slot}`], allowed: num(pools[slot], 0),
    }));
    if (slots.some(x => !x.category)) {
      lines.push(`${kind}: ${slots.map(x => `${x.allowed}`).join("/")} to spend - `
        + `[[choose ${kind} ${groups.order.join(",")}]] first (primary, secondary, tertiary)`);
      continue;
    }
    const bucket = (kind === "attributes" ? char.attributes : char.abilities) ?? {};
    const counted = new Set<string>();
    const bits = slots.map(x => {
      const names = groups.of[x.category!];
      if (!names) return `${x.slot} ${disp(x.category!)} ?/${x.allowed} ⚠ no such category`;
      const spent = names.reduce((sum, n) => {
        counted.add(n);
        return sum + Math.max(0, (bucket[n] ?? free) - startOf(n, free));
      }, 0);
      return `${x.slot} ${disp(x.category!)} ${spent}/${x.allowed}`;
    });
    // Dots on the sheet that no priority category claims: an Ability the
    // chronicle's lists don't name, or a category the player never made a
    // priority. They are real dots, and silently dropping them would lie.
    const stray = Object.entries(bucket)
      .filter(([n, v]) => !counted.has(n) && v > startOf(n, free))
      .map(([n]) => disp(n));
    lines.push(`${kind}: ${bits.join(", ")}${stray.length ? ` ⚠ uncounted: ${stray.join(", ")}` : ""}`);
  }

  // ONE ledger, so [[show-creation]] and [[show-budget]] can never disagree about what a
  // Background cost. (They used to: this counted `paid` with parseInt while the
  // ledger evaluated it as an expression.)
  const bgSpent = purseLedger(char, (n) => traitValueOf(char, n))["background"]?.spent ?? 0;
  lines.push(`backgrounds: ${bgSpent}/${num(budget.backgrounds, 5)}`);

  if (budget.disciplines !== undefined) {
    // Whose Disciplines are properly his: his clan's, his bloodline family's,
    // or - for a creature no book speaks for - his template's own.
    const affinity = affinityOf(char);
    const spent = purseLedger(char, (n) => traitValueOf(char, n))["discipline"]?.spent ?? 0;
    const out = Object.keys(char.disciplines ?? {}).filter(d => affinity.disciplines.length && !affinity.disciplines.includes(d));
    const whose = affinity.disciplines.length
      ? ` (${affinity.sources.join(" + ")}: ${affinity.disciplines.map(d => disp(d)).join(", ")})`
      : ` - nothing names his Disciplines yet ([[choose clan …]], or [[extend-template … disciplines=\`…\`]])`;
    lines.push(`disciplines: ${spent}/${num(budget.disciplines, 0)}${whose}`
      + `${out.length ? ` ⚠ out of affinity: ${out.map(d => disp(d)).join(", ")}` : ""}`);
  }
  if (budget.virtues !== undefined) {
    const free = num(budget.virtueStart, 1);
    const spent = Object.values(char.virtues ?? {}).reduce((a, b) => a + b, 0) - free * Object.keys(char.virtues ?? {}).length;
    lines.push(`virtues: ${Math.max(0, spent)}/${num(budget.virtues, 0)} (over ${free} free dot each)`);
  }
  lines.push(`freebies: ${num(budget.freebies, 15)} to spend ([[show-cost]] prices them)`
    + `${budget.flawMax !== undefined ? `, Flaws pay up to ${num(budget.flawMax, 7)}` : ""}`);
  // What the TEMPLATE hands out free. Reported, never auto-applied: a ghoul's
  // dot is usually Potence and sometimes Fortitude, and that is the player's
  // pick, not the engine's.
  for (const g of budget.grants ?? []) {
    const has = g.trait ? traitValueOf(char, g.trait) > 0
      : (g.choose ?? []).some(c => traitValueOf(char, c) > 0);
    lines.push(`free: ${describeCreationGrant(g)}${has ? " ✓" : " - not on the sheet yet"}`
      + `${has ? "" : ` ([[set-trait ${g.trait ?? g.choose?.[0]} ${g.rating} group=${g.bucket ?? "discipline"}]] then [[grant ${g.trait ?? g.choose?.[0]} source=template]])`}`);
  }

  // The ceilings, which for a vampire are a consequence of generation rather
  // than a number: Attributes 1-6 at the 7th. Per-trait exceptions follow.
  const ceilings: Array<[string, keyof PlayableCharacter, Numeric | undefined, Numeric | undefined]> = [
    ["attributes", "attributes", budget.attributeStart, budget.attributeMax],
    ["abilities", "abilities", budget.abilityStart, budget.abilityMax],
    ...(budget.disciplines !== undefined ? [["disciplines", "disciplines", 0, budget.disciplineMax ?? budget.abilityMax] as [string, keyof PlayableCharacter, Numeric, Numeric]] : []),
  ];
  const over: string[] = [];
  const caps = ceilings.map(([label, bucketKey, start, max]) => {
    const lo = num(start, 0), hi = num(max, 5);
    for (const [t, v] of Object.entries((char[bucketKey] ?? {}) as Record<string, number>)) {
      const cap = limits[t]?.max !== undefined ? num(limits[t].max, hi) : hi;
      if (v > cap) over.push(`${disp(t)} ${v} > ${cap}`);
    }
    return `${label} ${lo}-${hi}`;
  });
  // A rating a per-trait limit forbids: a Nosferatu sheet still carrying the
  // free Appearance dot every other character gets. Said, not corrected.
  const exceptions = Object.entries(limits).map(([t, l]) => `${disp(t)} ${num(l.start, 0)}-${num(l.max, 5)}`);
  lines.push(`ceilings: ${[...caps, ...exceptions].join(", ")}${over.length ? ` ⚠ over: ${over.join(", ")}` : ""}`);

  // What the sheet IMPLIES rather than states, with its arithmetic shown.
  const derived = derivedValuesOf(char, purseScope(char));
  if (derived.length) lines.push(`derived: ${derived.map(d => derivedLine(d, char)).join(", ")}`);

  // The notes are whole sentences the splat's own book states; they follow the
  // pools rather than joining them, so the punctuation stays readable.
  const notes = budget.notes?.length ? ` ${budget.notes.join(" ")}` : "";

  return sys(`${disp(char.name)} creation - ${lines.join("; ")}.${notes} Advisory: nothing is enforced.`);
}

// derived - what this sheet implies rather than states, and why.
export async function cmdDerived(cmd: ParsedCommand): Promise<string> {
  const raw = (cmd.named["character"] ?? cmd.positional[0])?.trim();
  const char = raw ? await CharacterStore.load((await resolveCharacterRef(raw)).name ?? raw) : await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const derived = derivedValuesOf(char, purseScope(char));
  if (!derived.length) {
    return sys(`${disp(char.name)} derives nothing - this template states every number outright. `
      + `[[show-eval <expression>]] still reads the sheet.`);
  }
  const lines = derived.map(d => {
    const kind = d.when === "always" ? "always" : d.overridden !== undefined ? "started here, now the sheet's" : "starts here";
    return `${derivedLine(d, char)} [${kind}]${d.note ? ` - ${d.note}` : ""}`;
  });
  return sys(`${disp(char.name)} derived - ${lines.join("; ")}. `
    + `An "always" value recomputes whatever the sheet says; a starting one steps aside once you rate it.`);
}

// eval <expression> - the whole reference system, exposed. This is how you find
// out what the engine thinks a name means without guessing from a report.
export async function cmdEval(cmd: ParsedCommand, forChar?: PlayableCharacter): Promise<string> {
  const char = forChar ?? await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const expr = (cmd.named["expression"] ?? cmd.positional.join(" ")).trim();
  if (!expr) {
    return sys(`[[show-eval <expression>]] reads an expression against ${disp(char.name)}. `
      + `Names are traits (\`courage\`, \`self-control\`); a path asks one place (\`background:generation\`, `
      + `\`derived:willpower\`, \`granted:sanctum\`, \`budget:freebie\`, \`spent:freebie\`, \`left:freebie\`, `
      + `\`resource:quintessence:max\` for that pool by name, \`role:willpower\` for whatever fills that role here). `
      + `Arithmetic is + - * / and ( ); functions are ${BUILTIN_FUNCTIONS.join(", ")}, trait-max, blood-max, road-virtues. `
      + `Mind the hyphen: \`a - b\` needs the spaces, \`self-control\` does not.`);
  }
  // [[show-eval]] sees everything a rules expression sees, INCLUDING the clock - it
  // is where you test an affliction's until-condition before writing it onto a
  // card. Elapsed time is measured from the story's start, since a bare
  // expression has no "when this began".
  const clock = await StoryClock.get();
  const scope = await timedScope(char, clock?.start ?? 0, clock?.now ?? 0);
  const purse = purseScope(char);
  const out = evaluateCondition(expr, {
    lookup: (path) => scope.lookup(path) ?? purse(path),
    call: scope.call,
  });
  if (out.error) return sys(`Cannot read "${expr}": ${out.error}.`);
  // Showing the work is only worth it when there IS work: a single reference
  // restating itself ("road = 2 = road 2") is noise, unless it came from
  // somewhere worth naming.
  const one = out.terms.length === 1 ? out.terms[0] : undefined;
  const work = one && !one.from ? "" : ` = ${describeTerms(out.terms)}`;
  const missed = out.unknown.length ? ` ⚠ nothing answers to ${out.unknown.join(", ")}` : "";
  return sys(`${disp(char.name)}: ${expr} = ${out.value}${work}${missed}`);
}

// One derived value, said the way a Storyteller would check it: the number, the
// arithmetic behind it, and whether the sheet has overridden a starting value.
function derivedLine(d: DerivedValue, char?: PlayableCharacter): string {
  if (d.error) return `${disp(d.trait)} ⚠ ${d.error}`;
  const shown = d.overridden ?? d.value;
  const why = d.overridden !== undefined
    ? `sheet ${d.overridden}, would start at ${d.value}`
    // `road-virtues()` is opaque until it says WHICH Virtues; the Road knows.
    : describeTerms(d.terms).replace("road-virtues()", char ? roadRatingExpr(roadOf(char)) : "road-virtues()");
  return `${disp(d.trait)} ${shown} (${why})`;
}

// =============================================================================
// TEMPLATES - the chronicle's own splats, written rather than compiled
// -----------------------------------------------------------------------------
// A template EXTENDS another and states only what differs. That is what makes a
// unique creature (the Ouroboros: a mage who soaks like a ghoul and carries one
// fused pool) a thing a player can write instead of a thing the engine ships.
// =============================================================================
export async function cmdTemplates(cmd: ParsedCommand): Promise<string> {
  const which = cmd.positional[0]?.trim();
  if (which) {
    const key = StringUtil.normalize(which);
    const tpl = TEMPLATES[key];
    if (!tpl) return sys(`No template "${which}". Known: ${Object.keys(TEMPLATES).sort().join(", ")}.`);
    const def = TemplateRegistry.get(key) ?? DEFAULT_TEMPLATE_DEFS.find(d => StringUtil.normalize(d.name) === key);
    const purses = Object.entries(tpl.Budgets).map(([purse, entry]) => {
      const d = budgetDef(entry);
      const prices = budgetPrices(d);
      return `${purse} ${d.allows ?? "?"}${prices ? ` (${prices})` : ""}`;
    });
    const bits = [
      `resources: ${tpl.Pools.map(p => disp(p.name)).join(", ") || "none"}`,
      `soak: ${Object.entries(SOAK_TABLES).find(([, v]) => v === tpl.Soak)?.[0] ?? "custom"}`,
      `morality: ${tpl.Morality?.name ?? "none"}${tpl.HasVirtues ? " (with Virtues)" : ""}`,
      tpl.Capabilities.length ? `can use: ${tpl.Capabilities.join(", ")}` : "",
      tpl.Affinity.disciplines.length
        ? `Disciplines: ${tpl.Affinity.disciplines.map(d => disp(d)).join(", ")}${tpl.Affinity.mode === "replace" ? " (and no family's)" : ""}`
        : tpl.Affinity.mode === "replace" ? "Disciplines: his own, none named yet" : "",
      purses.length ? `budgets: ${purses.join(", ")}` : "",
      def?.extends ? `extends ${disp(def.extends)}` : "built in",
    ].filter(Boolean);
    return sys(`${tpl.Name} - ${bits.join("; ")}. ${def ? `Written as data; ` : ""}`
      + `[[create-playable name="..." templates=${key}]] uses it.`);
  }
  const written = new Set([...DEFAULT_TEMPLATE_DEFS, ...TemplateRegistry.all()].map(d => StringUtil.normalize(d.name)));
  const listed = Object.keys(TEMPLATES).sort().map(k => `${k}${written.has(k) ? "*" : ""}`);
  const problems = lastTemplateProblems.length ? ` ⚠ ${lastTemplateProblems.join("; ")}` : "";
  return sys(`Templates: ${listed.join(", ")} (* = written as data, editable). `
    + `[[show-template <name>]] details one; [[extend-template]] makes a new one from an old one.${problems}`);
}

// "a=b,c=d" -> {a: "b", c: "d"}. The one place a command carries a small map,
// used for budgets and for the creation pools alike. Keys come back RAW: a
// budget key is `purse:field` and the colon must survive to be split on.
function pairsArg(raw: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const bit of (raw ?? "").split(",")) {
    const at = bit.indexOf("=");
    if (at <= 0) continue;
    const key = bit.slice(0, at).trim();
    const value = bit.slice(at + 1).trim();
    if (key && value) out[key] = value;
  }
  return out;
}

// The creation pools a command may set, by the name it writes them under. Every
// one of them is Numeric, so "5" and "trait-max(generation)" both land.
export const CREATION_FIELDS: Array<[string, keyof CreationBudget]> = [
  ["attribute-start", "attributeStart"], ["attribute-max", "attributeMax"],
  ["ability-start", "abilityStart"], ["ability-max", "abilityMax"],
  ["backgrounds", "backgrounds"], ["freebies", "freebies"],
  ["disciplines", "disciplines"], ["discipline-max", "disciplineMax"],
  ["virtues", "virtues"], ["virtue-start", "virtueStart"],
];

// A creation pool value: a plain integer stays a number, anything else is an
// expression the character resolves for itself.
function numericArg(raw: string): Numeric {
  const v = raw.trim();
  return /^-?\d+$/.test(v) ? parseInt(v, 10) : v;
}

// extend-template <name> extends=<parent> [soak=] [morality=] [awakened=]
//   [capabilities=] [budgets=`arcana=role:willpower`] [creation=`disciplines=4`]
//   [disciplines=`celerity,potence`] [description=]
export async function cmdExtendTemplate(cmd: ParsedCommand): Promise<string> {
  const rawName = (cmd.named["name"] ?? cmd.positional[0])?.trim();
  if (!rawName) {
    return sys(`extend-template needs a name and a parent, e.g. `
      + `[[extend-template name=\`Ouroboros\` extends=mage soak=ghoul description=\`...\`]]. `
      + `Any part of its budget is yours: budgets=\`arcana=role:willpower\` (allowance), `
      + `budgets=\`arcana:freebie=-\` (a price; "-" means it cannot be bought at all), `
      + `creation=\`disciplines=4,discipline-max=5\` (the creation pools). `
      + `Add resources with [[define-resource]].`);
  }
  // This verb EDITS as well as creates: the second call must not gut what the
  // first one wrote. Start from the def already in force (the chronicle's, else
  // the shipped one) and lay the arguments over it, so "set the Ouroboros'
  // arcana purse" costs one line and keeps his soak, his pools and his notes.
  const existingKey = StringUtil.normalize(rawName);
  const existing = TemplateRegistry.get(existingKey)
    ?? DEFAULT_TEMPLATE_DEFS.find(d => StringUtil.normalize(d.name) === existingKey);
  const parts: Partial<TemplateDef> & { name: string } = { ...(existing ?? {}), name: rawName };
  for (const key of ["extends", "soak", "morality", "ruleset", "description"] as const) {
    const v = (cmd.named[key] ?? (key === "extends" ? cmd.positional[1] : undefined))?.trim();
    if (v) parts[key] = v;
  }
  for (const key of ["awakened", "has-virtues"] as const) {
    const v = cmd.named[key]?.trim().toLowerCase();
    if (v === "true" || v === "false") {
      if (key === "awakened") parts.awakened = v === "true"; else parts.hasVirtues = v === "true";
    }
  }
  const resources = (cmd.named["resources"] ?? "").split(",").map(r => StringUtil.normalize(r)).filter(Boolean);
  if (resources.length) {
    const known = ResourceOverrides.current();
    const missing = resources.filter(r => !(r in known));
    if (missing.length) {
      return sys(`No resource ${missing.map(m => `"${m}"`).join(", ")} - define it first with `
        + `[[define-resource name=\`...\` kind=pool start=N max=N]].`);
    }
    parts.resources = resources.map(r => ({ ...(known[r] as ResourceDef), name: r }));
  }
  const capabilities = (cmd.named["capabilities"] ?? "").split(",").map(c => StringUtil.normalize(c)).filter(Boolean);
  if (capabilities.length) parts.capabilities = [...new Set([...(parts.capabilities ?? []), ...capabilities])];
  // Any part of a budget, and the whole of one: `arcana=role:willpower` sets the
  // allowance, `arcana:freebie=-` prices it, and either one leaves the rest of
  // that purse alone.
  const budgets: Record<string, BudgetEntry> = { ...(parts.budgets ?? {}) };
  for (const [raw, value] of Object.entries(pairsArg(cmd.named["budgets"]))) {
    const at = raw.indexOf(":");
    // A purse's own name never contains a colon; an ALLOWANCE may ("role:…"),
    // and that is on the right of the "=", so only the KEY is split here.
    const purse = StringUtil.normalize(at < 0 ? raw : raw.slice(0, at));
    const field = StringUtil.normalize(at < 0 ? "" : raw.slice(at + 1));
    const entry = budgetDef(budgets[purse]);
    if (field && ["allows", "freebie", "experience", "note"].includes(field)) {
      entry[field as keyof BudgetDef] = value;
    } else entry.allows = value;
    budgets[purse] = entry;
  }
  if (Object.keys(budgets).length) parts.budgets = budgets;
  const creation: Partial<CreationBudget> = { ...(parts.creation ?? {}) };
  const unknownPools: string[] = [];
  for (const [raw, value] of Object.entries(pairsArg(cmd.named["creation"]))) {
    const field = CREATION_FIELDS.find(([name]) => name === StringUtil.normalize(raw))?.[1];
    if (!field) { unknownPools.push(raw); continue; }
    (creation as Record<string, Numeric>)[field] = numericArg(value);
  }
  if (unknownPools.length) {
    return sys(`No creation pool ${unknownPools.map(p => `"${p}"`).join(", ")}. `
      + `Known: ${CREATION_FIELDS.map(([n]) => n).join(", ")}.`);
  }
  if (Object.keys(creation).length) parts.creation = creation;
  // "=celerity,potence" (or mode=replace) means THESE and no others - the way a
  // creature no clan speaks for still has Disciplines of his own.
  const rawDisc = (cmd.named["disciplines"] ?? "").trim();
  if (rawDisc) {
    const replace = rawDisc.startsWith("=") || StringUtil.normalize(cmd.named["disciplines-mode"] ?? "") === "replace"
      || (!rawDisc.startsWith("+") && parts.disciplines?.mode === "replace");
    const listed = rawDisc.replace(/^[=+]/, "").split(",").map(d => StringUtil.normalize(d)).filter(Boolean);
    parts.disciplines = { disciplines: listed, ...(replace ? { mode: "replace" as const } : {}) };
  }
  const def = makeTemplateDef(parts);
  if (def.extends && !TEMPLATES[StringUtil.normalize(def.extends)]) {
    return sys(`No template "${def.extends}" to extend. Known: ${Object.keys(TEMPLATES).sort().join(", ")}.`);
  }
  await TemplateRegistry.put(def);
  const problems = lastTemplateProblems.length ? ` ⚠ ${lastTemplateProblems.join("; ")}` : "";
  const built = TEMPLATES[def.name];
  return sys(`Template "${disp(def.name)}"${def.extends ? ` extends ${disp(def.extends)}` : ""} - `
    + `resources: ${built?.Pools.map(p => disp(p.name)).join(", ") || "none"}. `
    + `[[show-template ${def.name}]] shows it.${problems}`);
}

export async function cmdForgetTemplate(cmd: ParsedCommand): Promise<string> {
  const name = StringUtil.normalize(cmd.positional[0]?.trim() ?? "");
  if (!name) return sys(`forget-template needs a name. [[show-template]] lists them.`);
  if (!TemplateRegistry.get(name)) return sys(`No chronicle template "${name}" to forget (the built-ins cannot be removed).`);
  await TemplateRegistry.remove(name);
  return sys(`Forgot the chronicle's "${disp(name)}"${TEMPLATES[name] ? ` - the shipped one resurfaces` : ""}.`);
}

// define-resource - a pool or tracker written from a command. It lands in the
// resources card (the same overlay [[configure-resources]] edits), so a
// template can then name it.
export async function cmdDefineResource(cmd: ParsedCommand): Promise<string> {
  const rawName = (cmd.named["name"] ?? cmd.positional[0])?.trim();
  if (!rawName) {
    return sys(`define-resource needs a name, e.g. [[define-resource name=\`Living Resolve\` kind=pool `
      + `start=30 max=30 roles=\`blood,willpower,quintessence\` replaces=\`blood,willpower,quintessence\`]].`);
  }
  const name = StringUtil.normalize(rawName);
  const kind = StringUtil.normalize(cmd.named["kind"] ?? "pool") === "tracker" ? "tracker" : "pool";
  const patch: Partial<ResourceDef> = { kind };
  // start / max / per-turn are NUMERIC: an integer, or an expression over the
  // character ("10 + 2 * background:fount"). A bare integer stays a number.
  const numeric = (raw: string | undefined): Numeric | undefined => {
    const v = raw?.trim();
    if (!v) return undefined;
    return /^-?\d+$/.test(v) ? parseInt(v, 10) : v;
  };
  patch.start = numeric(cmd.named["start"]) ?? 0;
  patch.max = numeric(cmd.named["max"]) ?? (typeof patch.start === "number" ? Math.max(10, patch.start) : 10);
  // `requires` is what a character must be CAPABLE OF to spend this at all -
  // the difference between holding a talisman's pool and being able to use it.
  for (const key of ["roles", "replaces", "requires"] as const) {
    const list = (cmd.named[key] ?? "").split(",").map(r => StringUtil.normalize(r)).filter(Boolean);
    if (list.length) patch[key] = list;
  }
  const perTurn = numeric(cmd.named["per-turn"]);
  if (perTurn !== undefined) patch.perTurnLimit = perTurn;
  const description = cmd.named["description"]?.trim();
  if (description) patch.description = description;
  await ResourceOverrides.save({ ...ResourceOverrides.current(), [name]: { ...(ResourceOverrides.current()[name] ?? {}), ...patch } });
  return sys(`Resource "${disp(name)}" - ${kind} ${patch.start}/${patch.max}`
    + `${patch.roles?.length ? `, roles ${patch.roles.join("/")}` : ""}`
    + `${patch.replaces?.length ? `, replaces ${patch.replaces.join("/")}` : ""}`
    + `${patch.requires?.length ? `, usable only by the ${patch.requires.join("/")}-capable` : ""}. `
    + `Give it to a template with [[extend-template ... resources=${name}]]; `
    + `[[configure-resources]] tunes it.`);
}

// backgrounds / background <name> - the bag Backgrounds never had.
export async function cmdBackgrounds(): Promise<string> {
  const char = await CharacterStore.getCurrent();
  const defs = BackgroundRegistry.all();
  const held = char?.backgrounds ?? {};
  const granted = char ? grantedTraitsOf(char) : {};
  const mine = Object.entries(held).filter(([, v]) => v > 0)
    .map(([n, v]) => `${disp(n)} ${v}${char?.paid?.[n] !== undefined ? ` (paid ${char.paid![n]})` : ""}`);
  const conferred = Object.entries(granted).map(([n, g]) => `${disp(n)} ${g.rating} (from ${disp(g.from)})`);
  const parts = [`Defined: ${defs.map(d => d.name).join(", ")}`];
  if (mine.length) parts.push(`${disp(char!.name)} holds: ${mine.join(", ")}`);
  if (conferred.length) parts.push(`Conferred: ${conferred.join(", ")}`);
  return sys(`${parts.join(". ")}. [[show-background <name>]] for one; [[set-trait <name> <n>]] rates one; `
    + `[[define-background]] adds one.`);
}

export async function cmdBackground(cmd: ParsedCommand): Promise<string> {
  const raw = cmd.positional[0]?.trim();
  if (!raw) return cmdBackgrounds();
  const def = BackgroundRegistry.get(StringUtil.normalize(raw));
  if (!def) return sys(`No background "${raw}". [[show-background]] lists them.`);
  const char = await CharacterStore.getCurrent();
  const rating = char ? char.backgrounds?.[StringUtil.normalize(def.name)] ?? 0 : 0;
  const bits = [`background "${disp(def.name)}"`, `max ${def.max ?? 5}`];
  if (def.templates?.length) bits.push(`only ${def.templates.join("/")}`);
  if (char) bits.push(`${disp(char.name)} has ${rating}`);
  const tier = backgroundTierAt(def, rating);
  for (const t of def.tiers ?? []) {
    const marks = [t.max !== undefined ? `hold ${t.max}` : "", t.perTurn !== undefined ? `${t.perTurn}/turn` : "", t.note ?? ""].filter(Boolean);
    bits.push(`${t === tier ? "• " : ""}${t.atLeast}: ${marks.join(", ")}`);
  }
  for (const g of def.grants ?? []) {
    bits.push(`grants ${disp(g.trait)} ${g.rating}${(g.atLeast ?? 1) > 1 ? ` at ${g.atLeast}+` : ""}${g.note ? ` - ${g.note}` : ""}`);
  }
  return sys(`${bits.join("; ")}.${def.description ? ` ${def.description}` : ""}${def.note ? ` ${def.note}` : ""}`);
}

// define-background name=... [max=] [templates=] [grants="sanctum:5,library:5"] [description=]
export async function cmdDefineBackground(cmd: ParsedCommand): Promise<string> {
  const rawName = cmd.named["name"] ?? cmd.positional[0];
  if (!rawName?.trim()) {
    return sys(`define-background needs a name, e.g. [[define-background name=\`Talisman\` max=5 `
      + `grants=\`cray:5,library:5,sanctum:5\` description=\`…\`]].`);
  }
  const parts: Partial<BackgroundDef> & { name: string } = { name: rawName.trim() };
  const max = intOrUndef(cmd.named["max"] ?? "");
  if (max !== undefined) parts.max = max;
  const templates = (cmd.named["templates"] ?? "").split(",").map(t => t.trim()).filter(Boolean);
  if (templates.length) parts.templates = templates;
  const description = cmd.named["description"]?.trim();
  if (description) parts.description = description;
  const grants = (cmd.named["grants"] ?? "").split(",").map(g => g.trim()).filter(Boolean)
    .map(g => { const [t, n] = g.split(":"); return { trait: t, rating: intOrUndef(n ?? "") ?? 1 }; })
    .filter(g => g.trait);
  if (grants.length) parts.grants = grants as TraitGrant[];
  const def = makeBackgroundDef(parts);
  const shadows = BackgroundRegistry.get(def.name) && !BackgroundRegistry.all().some(d => d.name === def.name && d !== def) ? "" : "";
  await BackgroundRegistry.put(def);
  const grantBits = (def.grants ?? []).map(g => `${disp(g.trait)} ${g.rating}`);
  return sys(`Defined background "${disp(def.name)}" (max ${def.max ?? 5})`
    + `${grantBits.length ? `, granting ${grantBits.join(", ")}` : ""}${shadows}. `
    + `Rate it with [[set-trait ${def.name} <n>]].`);
}

export async function cmdForgetBackground(cmd: ParsedCommand): Promise<string> {
  const raw = cmd.positional[0]?.trim() ?? cmd.named["name"]?.trim();
  if (!raw) return sys(`forget-background needs a name.`);
  const key = StringUtil.normalize(raw);
  const removed = await BackgroundRegistry.remove(key);
  if (!removed) {
    return BackgroundRegistry.get(key)
      ? sys(`"${key}" is a built-in - it can be shadowed with [[define-background]] but not deleted.`)
      : sys(`No custom background "${key}".`);
  }
  return sys(`Forgot custom ${key}.${BackgroundRegistry.get(key) ? ` The built-in "${key}" resurfaces.` : ""}`);
}

// supernatural [category] - which families of power this character may have,
// what they hold in each, and whether anything hangs from a Discipline they do
// not have. Reports; enforces nothing.
export async function cmdSupernatural(cmd: ParsedCommand, forChar?: PlayableCharacter): Promise<string> {
  const char = forChar ?? await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const which = cmd.positional[0]?.trim();
  const cats = DEFAULT_SUPERNATURAL_CATEGORIES;
  if (which) {
    const key = StringUtil.normalize(which);
    const cat = cats.find(c => StringUtil.normalize(c.name) === key);
    if (!cat) return sys(`No supernatural category "${which}". Known: ${cats.map(c => c.name).join(", ")}.`);
    const open = categoryOpenTo(cat, char.templates);
    const members = DEFAULT_SUPERNATURAL_TRAITS.filter(t => StringUtil.normalize(t.category) === key);
    const memberBits = members.map(m => `${m.name}${m.parent ? ` (needs ${disp(m.parent)})` : ""}`);
    return sys(`${cat.label ?? cat.name} - ${open ? `open to ${disp(char.name)}` : `NOT open to ${char.templates.join("+")}`}`
      + `${cat.templates?.length ? ` (templates: ${cat.templates.join(", ")})` : " (anyone)"}; `
      + `ratings live in the ${cat.bucket ?? "traits"} group.${cat.note ? ` ${cat.note}` : ""}`
      + `${memberBits.length ? ` Known: ${memberBits.join(", ")}.` : ""}`);
  }
  const lines: string[] = [];
  for (const cat of cats) {
    if (!categoryOpenTo(cat, char.templates)) continue;
    const bucket = (char[(cat.bucket ?? "traits") as keyof PlayableCharacter] ?? {}) as Record<string, number>;
    const held = Object.entries(bucket).filter(([, v]) => v > 0);
    const mine = held.filter(([n]) => {
      const def = supernaturalTraitOf(n);
      return def ? StringUtil.normalize(def.category) === StringUtil.normalize(cat.name) : cat.bucket === "disciplines";
    });
    lines.push(`${cat.label ?? cat.name}: ${mine.length ? mine.map(([n, v]) => `${disp(n)} ${v}`).join(", ") : "nothing yet"}`);
  }
  // A path that hangs from a Discipline the character does not have.
  const orphans: string[] = [];
  for (const [name, rating] of Object.entries({ ...char.traits, ...char.disciplines })) {
    if (rating <= 0) continue;
    const def = supernaturalTraitOf(name);
    if (!def?.parent) continue;
    if (resolveTraitFromRecord(char, def.parent) <= 0) orphans.push(`${disp(name)} needs ${disp(def.parent)}`);
  }
  if (orphans.length) lines.push(`⚠ ${orphans.join("; ")} (Storyteller-adjudicated)`);
  return sys(`${disp(char.name)} - ${lines.join("; ")}. [[show-supernatural <category>]] for one; `
    + `set a rating with [[set-trait <name> <n>]].`);
}

// costs [kind] - what a dot costs, from each purse. Prices are CHRONICLE rules
// (rules.ts DEFAULT_ADVANCEMENT_COSTS + the wod:config:costs card), never
// character data - which is why they are not on the sheet. Nothing evaluates
// them yet; this surfaces them for the Storyteller, and the advancement engine
// will read the same table when it lands.
export async function cmdCosts(cmd: ParsedCommand): Promise<string> {
  const table = advancementCostsFrom(AdvancementCosts.current() as CostTable);
  const which = cmd.positional[0]?.trim();
  const priced = (purses: Record<string, string>): string =>
    COST_PURSES.filter(p => purses[p]).map(p => `${p} ${purses[p]}`).join(", ");
  if (which) {
    const key = StringUtil.normalize(which);
    const purses = table[key];
    if (!purses) return sys(`No cost kind "${which}". Known: ${Object.keys(table).join(", ")}.`);
    return sys(`${disp(key)} - ${priced(purses)}. "current" is the rating you raise FROM. `
      + `Storyteller-applied: the engine records prices, it does not spend for you.`);
  }
  const items = Object.entries(table).map(([kind, purses]) => `${disp(kind)}: ${priced(purses)}`).join("; ");
  return sys(`Advancement costs - ${items}. [[show-cost <kind>]] for one; edit them in the "${COSTS_CONFIG_ENTRY}" card. `
    + `A template may price its own purse instead ([[show-budget]] shows the one in force) - `
    + `"${NOT_PURCHASABLE}" there means that purse cannot be bought from at all. `
    + `🚧 maturation is recorded here and spent by nobody: there is no downtime engine yet.`);
}
