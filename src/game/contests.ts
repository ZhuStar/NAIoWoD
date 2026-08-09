// Split out of the former 7941-line src/game.ts (memory §7.91). The cut points
// are the file's own section banners and SOURCE ORDER IS PRESERVED across the
// split, so dist/naiowod.ts keeps the exact declaration order it had as one
// file - the artifact's only diff is which //#region each line sits in.
import { CommandContext, CommandHandler, ParsedCommand, sys } from "../command";
import { Rng } from "../core/dice";
import { StringUtil } from "../core/traits";
import { CONTEST_DRAW, CONTEST_OPEN, ContestEntrant, ContestMode, ContestSide, ExtendedContest, FieldOutcome, RollExecution, RollModifier, RollOutcomeKind, RollSpec, applyContestRound, compareField, describeContest, describeStandings, formatExecution, makeRollSpec, overrideSpec, parseBotchPolicy } from "../rolls";
import { CharacterAfflictions, CharacterStore, ExtendedContestStore, OpposedSavedConfig, PlayableCharacter, SavedRoll } from "../state";
import { resolveCharacterRef } from "./afflictions";
import { disp, intOrUndef, noCharacter, runRoll } from "./common";
import { applySpend, characterRollEnv, passiveRollExtra, poolTraitsOf, rollOverridesFromNamed, surfaceSteps, tableNote, withAfflictionTags } from "./effects";

// =============================================================================
// RESISTED / CONTESTED ROLLS - two pools, one adjudication
// -----------------------------------------------------------------------------
// The active character is side A; side B is either a named character
// (vs="Erik", who rolls their pool against their own traits) or an ad-hoc
// opposition (vs="the sturdy lock", or no vs= at all, rolling its pool with only
// literal numbers counting). oWoD classic tie rules live in compareRolls; an
// optional table= reads what the actor's winning margin MEANS.
// =============================================================================

// Roll one side of a contest. A named character rolls live (traits + boosts +
// wound penalty); an ad-hoc side rolls its pool with a zero resolver, so only
// literal numbers count. A char that no longer exists degrades to ad-hoc.
// Every side of a contest rolls, in order. A named character rolls live off its
// own sheet; an ad-hoc side rolls literals. One place, because three callers
// need it and a field of five must not be spelled out at each.
async function rollContestSides(sides: ContestSide[], ctx: CommandContext, overrides?: (side: ContestSide, i: number) => RollSpec): Promise<RollExecution[]> {
  const out: RollExecution[] = [];
  for (const [i, side] of sides.entries()) {
    out.push(await execContestSide(overrides ? overrides(side, i) : side.base, side.char, ctx.rng));
  }
  return out;
}

// Apply one round, persist it, and keep the "current contest" pointer honest:
// an open contest becomes the current one, a finished one stops being it. The
// three callers used to hand-roll this, and the two that OPEN a contest forgot
// to clear the pointer when a contest ended on its first round.
async function commitContestRound(contest: ExtendedContest, execs: RollExecution[]): Promise<{ after: ExtendedContest; note: string; tail: string }> {
  const { contest: after, note } = applyContestRound(contest, execs);
  await ExtendedContestStore.save(after);
  if (after.status === CONTEST_OPEN) await ExtendedContestStore.setCurrent(after.id);
  else if ((await ExtendedContestStore.currentId()) === after.id) await ExtendedContestStore.clearCurrent();
  const tail = after.status === CONTEST_OPEN ? ` Continue with [[continue-contest]] (id ${after.id}).` : "";
  return { after, note, tail };
}

async function execContestSide(base: RollSpec, charName: string | undefined, rng: Rng | undefined, extra?: Partial<RollModifier>): Promise<RollExecution> {
  if (charName) {
    const c = await CharacterStore.load(charName);
    if (c) {
      const env = await characterRollEnv(c);
      const spec = await withAfflictionTags(c.name, base);
      // Owned passives (Trait Affinity et al.) apply to contest sides too.
      const passive = passiveRollExtra(c, poolTraitsOf(c, spec.pool), spec.tags, undefined, await CharacterAfflictions.ops(c.name));
      const merged: Partial<RollModifier> = { ...(extra ?? {}) };
      if (passive.extra.difficultyMod) merged.difficultyMod = (merged.difficultyMod ?? 0) + passive.extra.difficultyMod;
      if (passive.extra.diceMod) merged.diceMod = (merged.diceMod ?? 0) + passive.extra.diceMod;
      if (passive.extra.autoSuccesses) merged.autoSuccesses = (merged.autoSuccesses ?? 0) + passive.extra.autoSuccesses;
      if (passive.extra.nAgain !== undefined) merged.nAgain = Math.min(merged.nAgain ?? 10, passive.extra.nAgain);
      if (env.penalty !== 0) merged.diceMod = (merged.diceMod ?? 0) + env.penalty;
      return runRoll(spec, env.resolver, { rng, extra: merged, usedTags: passive.usedTags });
    }
  }
  return runRoll(base, () => 0, { rng, extra });
}

// From the actor's side, what does a table read? The actor's winning margin (the
// successes that actually land) at "success"; an actor botch reads as botch; any
// non-win (resisted, out-contested, tie) reads as failure.
function contestTableInput(o: FieldOutcome, actor: string): { outcome: RollOutcomeKind; successes: number } {
  const mine = o.standings.find(s => StringUtil.normalize(s.name) === StringUtil.normalize(actor));
  if (mine?.botch) return { outcome: "botch", successes: 0 };
  // Sharing the top with somebody is not winning it.
  if (o.winners.length !== 1 || StringUtil.normalize(o.winners[0]) !== StringUtil.normalize(actor)) {
    return { outcome: "failure", successes: 0 };
  }
  return { outcome: "success", successes: o.margin };
}

// THE OPPOSITION - one name or SEVERAL. `vs=` takes a comma-separated list, so
// two men wrestling and five thieves reaching for the same purse are the same
// command with a longer argument. Each entry is a character, an @alias, or a
// bare label (an ad-hoc side that rolls only literal numbers). No vs= at all
// leaves one ad-hoc opponent, exactly as before.
interface Opponent { char?: PlayableCharacter; name: string }
async function resolveOpponents(cmd: ParsedCommand, mode: ContestMode): Promise<{ error?: string; all: Opponent[] }> {
  const raw = (cmd.named["vs"] ?? "").split(",").map(t => t.trim()).filter(Boolean);
  if (!raw.length) {
    return { all: [{ name: mode === "resisted" ? "the-resistance" : "the-opposition" }] };
  }
  const all: Opponent[] = [];
  for (const token of raw) {
    let arg = token;
    if (arg.startsWith("@")) {
      const ref = await resolveCharacterRef(arg);
      if (ref.error) return { error: ref.error, all: [] };
      arg = ref.name!;
    }
    const char = await CharacterStore.load(arg);
    const name = char ? char.name : arg;
    // The same name twice would make the standings ambiguous, and it is always
    // a typo rather than a man contesting himself.
    if (all.some(o => StringUtil.normalize(o.name) === StringUtil.normalize(name))) {
      return { error: `"${name}" is named twice in vs= - each side contests once.`, all: [] };
    }
    all.push({ char, name });
  }
  return { all };
}

// The pool each opponent rolls. `vs-pool=` may give one per opponent (in vs=
// order) or a single pool everyone rolls; failing that they all roll the pool
// given positionally, which is the two-sided form unchanged.
function opponentPools(cmd: ParsedCommand, shared: string, count: number): string[] {
  const listed = (cmd.named["vs-pool"] ?? "").split(",").map(t => t.trim()).filter(Boolean);
  if (!listed.length) return Array.from({ length: count }, () => shared);
  if (listed.length === 1) return Array.from({ length: count }, () => listed[0]);
  return Array.from({ length: count }, (_, i) => listed[i] ?? shared);
}

// Run ONE resisted/contested round against ANY NUMBER of opponents: the actor
// rolls mySpec through the live env (spend + wound penalty, exactly like
// [[roll spend=...]]), every opponent rolls its own, compareField adjudicates,
// and a table (override or a saved sidecar) reads the actor's winning margin.
// Returns a BODY string (the caller wraps it in sys - so a procedure can append
// its next-steps inside the same reply).
async function runSingleContest(mode: ContestMode, me: PlayableCharacter, mySpec: RollSpec, theirSpecs: Array<{ spec: RollSpec; opp: Opponent }>, cmd: ParsedCommand, ctx: CommandContext, tableOverride?: string): Promise<string> {
  const spend = await applySpend(me, cmd, ctx, mySpec.tags, poolTraitsOf(me, mySpec.pool));
  if (spend.refuse) return `${disp(me.name)} can't: ${spend.refuse}.`;
  const myExtra: Partial<RollModifier> = { ...(spend.extra ?? {}) };
  const myEnv = await characterRollEnv(me);
  if (myEnv.penalty !== 0) myExtra.diceMod = (myExtra.diceMod ?? 0) + myEnv.penalty;
  const myExec = runRoll(mySpec, myEnv.resolver, { rng: ctx.rng, extra: myExtra });
  const entrants: ContestEntrant[] = [{ name: me.name, exec: myExec }];
  const shown = [`${disp(me.name)}: ${formatExecution(myExec)}`];
  for (const { spec, opp } of theirSpecs) {
    const exec = await execContestSide(spec, opp.char?.name, ctx.rng);
    entrants.push({ name: opp.name, exec });
    shown.push(`${disp(opp.name)}: ${formatExecution(exec)}`);
  }
  const field = compareField(mode, entrants);
  // The table still reads the ACTOR's result - a table says what HIS margin
  // bought, and the field only changes who he had to beat.
  const t = contestTableInput(field, me.name);
  const standing = entrants.length > 2 ? `standings ${describeStandings(field)}` : "";
  const notes = [field.note, standing, await tableNote(tableOverride ?? cmd.named["table"], t.outcome, t.successes), spend.note].filter(Boolean).join("; ");
  return `${mode}${entrants.length > 2 ? ` (${entrants.length} ways)` : ""} - ${shown.join(" vs ")} - ${notes}`;
}

async function cmdVersus(mode: ContestMode, cmd: ParsedCommand, ctx: CommandContext): Promise<string> {
  const me = await CharacterStore.getCurrent();
  if (!me) return noCharacter();
  const myPool = cmd.positional[0]?.trim();
  const theirPool = cmd.positional[1]?.trim();
  const verb = mode === "resisted" ? "resist" : "contest";
  // The opposition's pool comes from the second positional OR from vs-pool=
  // (which is what a field of several with different pools needs).
  if (!myPool || (!theirPool && !cmd.named["vs-pool"]?.trim())) {
    return sys(`${verb} needs your pool and the opposition's, e.g. [[${verb} dexterity+stealth perception+alertness vs="Erik"]]. `
      + `More than one opposing: vs="Erik,Rok,Sigrid" - they all roll the second pool, or vs-pool="a,b,c" gives each its own.`);
  }
  const opp = await resolveOpponents(cmd, mode);
  if (opp.error) return sys(`${opp.error}`);
  const myTags = cmd.named["tags"] ? cmd.named["tags"].split(",").map(t => t.trim()).filter(Boolean) : undefined;
  const mySpec = await withAfflictionTags(me.name, makeRollSpec({ pool: myPool, difficulty: intOrUndef(cmd.named["difficulty"] ?? cmd.named["diff"]), tags: myTags }));
  const vsDiff = intOrUndef(cmd.named["vs-difficulty"] ?? cmd.named["vs-diff"]);
  const pools = opponentPools(cmd, theirPool ?? "", opp.all.length);
  const theirSpecs = opp.all.map((o, i) => ({ opp: o, spec: makeRollSpec({ pool: pools[i], difficulty: vsDiff }) }));
  return sys(await runSingleContest(mode, me, mySpec, theirSpecs, cmd, ctx));
}

// Invoke a saved OPPOSED roll: the save holds the actor's shape + the opposition
// descriptor (mode, opposing pool, default vs-difficulty); the OPPONENT is play-
// time input (vs=). opposed+extended launches an extended contest instead. Any
// `steps` are surfaced after the round (procedure composition).
export async function launchOpposedFromSaved(char: PlayableCharacter, name: string, saved: SavedRoll, cmd: ParsedCommand, args: Partial<RollSpec>, ctx: CommandContext): Promise<string> {
  const opp = saved.opposed!;
  const mySpec = await withAfflictionTags(char.name, overrideSpec(saved, args));
  const oppRes = await resolveOpponents(cmd, opp.mode);
  if (oppRes.error) return sys(`${oppRes.error}`);
  const theirPool = (cmd.named["vs-pool"] ?? "").split(",")[0]?.trim() || opp.pool || mySpec.pool;
  const theirDiff = intOrUndef(cmd.named["vs-difficulty"] ?? cmd.named["vs-diff"]) ?? opp.vsDifficulty;
  if (opp.extended) return launchOpposedExtended(char, name, saved, opp, mySpec, theirPool, theirDiff, oppRes, cmd, args, ctx);
  const pools = opponentPools(cmd, theirPool, oppRes.all.length);
  const theirSpecs = oppRes.all.map((o, i) => ({ opp: o, spec: makeRollSpec({ pool: pools[i], difficulty: theirDiff }) }));
  const body = await runSingleContest(opp.mode, char, mySpec, theirSpecs, cmd, ctx, saved.table);
  return sys(`${body}${surfaceSteps(saved.steps, undefined)}`);
}

// opposed + extended = an extended contest (a race like Pursuit). Both race to a
// play-time `target`; `rounds`/`intervals` cap it (falling back to the save).
async function launchOpposedExtended(char: PlayableCharacter, name: string, saved: SavedRoll, opp: OpposedSavedConfig, mySpec: RollSpec, theirPool: string, theirDiff: number | undefined, oppRes: { all: Opponent[] }, cmd: ParsedCommand, args: Partial<RollSpec>, ctx: CommandContext): Promise<string> {
  const cfg = opp.extended!;
  const target = args.requires ?? intOrUndef(cmd.named["target"]);
  if (target === undefined || target < 1) {
    return sys(`"${name}" is an extended contest - give it a target, e.g. [[roll @${name} requires=5 vs="Erik"]] (the successes = winning the race).`);
  }
  const maxRounds = intOrUndef(cmd.named["rounds"] ?? cmd.named["intervals"]) ?? cfg.intervals;
  if (maxRounds === undefined || maxRounds < 1) return sys(`"${name}" needs rounds=<max> (its save defines none), e.g. [[roll @${name} requires=${target} rounds=5 vs="Erik"]].`);
  const aSpec = makeRollSpec({ ...mySpec, requires: 1 });
  const pools = opponentPools(cmd, theirPool, oppRes.all.length);
  const contest: ExtendedContest = {
    id: api.v1.uuid(), label: cmd.named["label"] ?? name,
    sides: [
      { name: char.name, base: aSpec, accumulated: 0, char: char.name },
      ...oppRes.all.map((o, i) => ({
        name: o.name, base: makeRollSpec({ pool: pools[i], difficulty: theirDiff, requires: 1 }),
        accumulated: 0, char: o.char?.name,
      })),
    ],
    target, maxRounds,
    interval: cmd.named["interval"] ?? cfg.interval ?? "",
    onBotch: cmd.named["on-botch"] ? parseBotchPolicy(cmd.named["on-botch"]) : (cfg.onBotch ?? "fail"),
    rounds: 0, status: CONTEST_OPEN, log: [],
  };
  const execs = await rollContestSides(contest.sides, ctx);
  const { after, note, tail } = await commitContestRound(contest, execs);
  return sys(`${disp(char.name)} opens ${describeContest(after)}. Round 1: ${note}.${tail}${surfaceSteps(saved.steps, undefined)}`);
}

export const cmdResist: CommandHandler = (cmd, ctx) => cmdVersus("resisted", cmd, ctx);
export const cmdContest: CommandHandler = (cmd, ctx) => cmdVersus("contested", cmd, ctx);

// =============================================================================
// EXTENDED CONTESTS - both sides accumulate across rounds; first to the goal wins
// =============================================================================
export async function cmdExtendedContest(cmd: ParsedCommand, ctx: CommandContext): Promise<string> {
  const me = await CharacterStore.getCurrent();
  if (!me) return noCharacter();
  const myPool = cmd.positional[0]?.trim();
  const theirPool = cmd.positional[1]?.trim();
  if (!myPool || !theirPool) {
    return sys(`extended-contest needs both pools, e.g. [[extended-contest wits+melee wits+melee vs="Erik" target=5 rounds=5]]. `
      + `vs= takes a LIST for a race with more than two in it: vs="Erik,Rok,Sigrid".`);
  }
  const opp = await resolveOpponents(cmd, "contested");
  if (opp.error) return sys(`${opp.error}`);

  const target = intOrUndef(cmd.named["target"] ?? cmd.named["requires"]) ?? 0;
  if (target < 1) return sys(`extended-contest needs target=<successes> (the goal both race to).`);
  const maxRounds = intOrUndef(cmd.named["rounds"] ?? cmd.named["intervals"]) ?? 0;
  if (maxRounds < 1) return sys(`extended-contest needs rounds=<max> (at least 1).`);

  const aSpec = makeRollSpec({ pool: myPool, difficulty: intOrUndef(cmd.named["difficulty"] ?? cmd.named["diff"]), requires: 1 });
  const vsDiff = intOrUndef(cmd.named["vs-difficulty"] ?? cmd.named["vs-diff"]);
  const pools = opponentPools(cmd, theirPool, opp.all.length);
  const contest: ExtendedContest = {
    id: api.v1.uuid(),
    label: cmd.named["label"] ?? "",
    sides: [
      { name: me.name, base: aSpec, accumulated: 0, char: me.name },
      ...opp.all.map((o, i) => ({
        name: o.name, base: makeRollSpec({ pool: pools[i], difficulty: vsDiff, requires: 1 }),
        accumulated: 0, char: o.char?.name,
      })),
    ],
    target, maxRounds,
    interval: cmd.named["interval"] ?? "",
    onBotch: parseBotchPolicy(cmd.named["on-botch"]),
    rounds: 0, status: CONTEST_OPEN, log: [],
  };
  const execs = await rollContestSides(contest.sides, ctx);
  const { after, note, tail } = await commitContestRound(contest, execs);
  return sys(`${disp(me.name)} opens ${describeContest(after)}. Round 1: ${note}.${tail}`);
}

export async function cmdContinueContest(cmd: ParsedCommand, ctx: CommandContext): Promise<string> {
  const contest = await ExtendedContestStore.resolve(cmd.positional[0]);
  if (!contest) return sys(`No open contest. Start one with [[extended-contest ...]] or name its id.`);
  if (contest.status !== CONTEST_OPEN) {
    const who = contest.status === CONTEST_DRAW ? "a draw" : `won by ${disp(contest.status)}`;
    return sys(`That contest is already ${who}.`);
  }
  // The ACTOR (side 0) takes this round's roll overrides; every other side may
  // be re-difficultied at once with vs-difficulty=, as before.
  const mine = rollOverridesFromNamed(cmd);
  const vDiff = intOrUndef(cmd.named["vs-difficulty"] ?? cmd.named["vs-diff"]);
  const execs = await rollContestSides(contest.sides, ctx, (side, i) =>
    i === 0 ? overrideSpec(side.base, mine)
      : vDiff !== undefined ? overrideSpec(side.base, { difficulty: vDiff }) : side.base);
  const { after, note } = await commitContestRound(contest, execs);
  return sys(`${describeContest(after)}. This round: ${note}.`);
}

export async function cmdContestStatus(cmd: ParsedCommand): Promise<string> {
  const contest = await ExtendedContestStore.resolve(cmd.positional[0]);
  if (!contest) return sys(`No extended contest found. Start one with [[extended-contest ...]].`);
  const recent = contest.log.slice(-3)
    .map(l => `r${l.round}: ${Object.entries(l.nets ?? {}).map(([n, v]) => `${disp(n)} +${v}`).join("/")}`)
    .join(", ");
  return sys(`${describeContest(contest)}${recent ? ` | recent: ${recent}` : ""}.`);
}

export async function cmdCancelContest(cmd: ParsedCommand): Promise<string> {
  const contest = await ExtendedContestStore.resolve(cmd.positional[0]);
  if (!contest) return sys(`No extended contest to cancel.`);
  await ExtendedContestStore.remove(contest.id);
  if ((await ExtendedContestStore.currentId()) === contest.id) await ExtendedContestStore.clearCurrent();
  const progress = contest.sides.map(s => `${disp(s.name)} ${s.accumulated}/${contest.target}`).join(" vs ");
  return sys(`Cancelled contest${contest.label ? ` "${contest.label}"` : ""} (was ${progress}).`);
}
