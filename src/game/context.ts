// Split out of the former 7941-line src/game.ts (memory §7.91). The cut points
// are the file's own section banners and SOURCE ORDER IS PRESERVED across the
// split, so dist/naiowod.ts keeps the exact declaration order it had as one
// file - the artifact's only diff is which //#region each line sits in.
import { COMMAND_CHANNEL, CommandRouter, commandChannel, commandEnvelope, sys } from "../command";
import { PostOffice } from "../services";
import { CharacterStore, GenCounter, WizardSession } from "../state";
import { answerActiveWizard } from "./common";
import { HideDirective, applyHideDirectives, extractHideBlocks } from "./narration";
import { COMMAND_PATTERN, isQuietVerb, wantsInStory } from "./show";

// =============================================================================
// CONTEXT HYGIENE - keep engine noise out of the AI's context (§7.32)
// -----------------------------------------------------------------------------
// A QUIET reply (help, listings, sheet, scene-info, ...) is for the PLAYER, not
// the AI - it is pure noise in the model's context. Such replies are wrapped in
// a marker tagged with the generation count at which they were written; the
// onContextBuilt hook strips marked spans out of the messages before generation
// (so the AI never reads them), and Pass 2 will age-delete the blocks from the
// document itself after a few generations. onContextBuilt is also the reliable
// place to COUNT real generations: it fires for every generation AND for the
// player's context inspections, and the `dryRun` flag tells them apart.
// =============================================================================
const CTX_SKIP_TAG = "wod:ctx-skip";
const CTX_SKIP_RE = /<!--wod:ctx-skip:\d+-->[\s\S]*?<!--\/wod:ctx-skip-->/g;

// Wrap a reply the AI should not see, tagged with the current generation count
// (for later age-out). No newlines - the marker rides the single input line.
async function markCtxSkip(reply: string): Promise<string> {
  return `<!--${CTX_SKIP_TAG}:${await GenCounter.get()}-->${reply}<!--/${CTX_SKIP_TAG}-->`;
}
// Remove every ctx-skip block from a text (leaving surrounding prose intact).
export function stripCtxSkip(text: string): string {
  return text.replace(CTX_SKIP_RE, "");
}

// The onContextBuilt handler: count the generation (real ones only), then strip
// ctx-skip noise from the messages so the AI never reads it. Returns the modified
// message array, or undefined when nothing changed. Emptied messages are dropped.
export async function processContextBuilt(messages: Message[], dryRun: boolean): Promise<Message[] | undefined> {
  if (!dryRun) await GenCounter.increment();
  let changed = false;
  const out: Message[] = [];
  for (const msg of messages) {
    const content = msg.content ?? "";
    if (!content.includes(`<!--${CTX_SKIP_TAG}:`)) { out.push(msg); continue; }
    changed = true;
    const stripped = stripCtxSkip(content).replace(/[ \t]{2,}/g, " ").trim();
    if (stripped) out.push({ ...msg, content: stripped });   // else: drop the now-empty message
  }
  return changed ? out : undefined;
}

// Age-out: remove the ctx-skip blocks whose creation generation is at least
// `keepFor` generations behind `now` (leaving fresher ones + surrounding prose).
// Returns the new text, or null when nothing was old enough to drop.
export function stripAgedCtxSkip(text: string, now: number, keepFor: number): string | null {
  let changed = false;
  const out = text.replace(/<!--wod:ctx-skip:(\d+)-->[\s\S]*?<!--\/wod:ctx-skip-->/g, (m, g: string) => {
    if (now - parseInt(g, 10) >= keepFor) { changed = true; return ""; }
    return m;
  });
  return changed ? out : null;
}

const CTX_SKIP_KEEP = 2;   // keep a noise block visible for this many generations, then delete it from the story

// The onGenerationEnd handler: post-generation DOCUMENT cleanup (best-effort,
// needs documentEdit). Two jobs: (a) the streaming <hide> backstop - a block
// that survived a chunk split lands in the document, so scan for any complete
// <hide>...</hide>, route it to the scene plan/Author's Note, and strip it out;
// (b) age-out - delete ctx-skip noise blocks older than CTX_SKIP_KEEP generations
// from the story itself (onContextBuilt already keeps them out of the AI's view).
// `keepFor` is how many generations a noise block stays visible before it is
// deleted from the story. The automatic pass keeps them briefly (a player may
// want to read the reply they just got); an EXPLICIT flush passes 0, because
// somebody asking for a clean story now means now.
export async function processGenerationEnd(keepFor: number = CTX_SKIP_KEEP): Promise<{ scanned: number; cleaned: number; recovered: number } | undefined> {
  let sections: { sectionId: number; section: { text: string } }[];
  try { sections = await api.v1.document.scan(); }
  catch { return undefined; }   // no documentEdit permission - nothing to clean
  const now = await GenCounter.get();
  const recovered: HideDirective[] = [];
  let cleaned = 0;
  for (const { sectionId, section } of sections) {
    let text = section.text ?? "";
    let dirty = false;
    if (/<hide[\s>]/i.test(text) && /<\/hide>/i.test(text)) {   // (a) a surviving hide block
      const ex = extractHideBlocks(text);
      recovered.push(...ex.directives);
      text = ex.cleaned; dirty = true;
    }
    const aged = stripAgedCtxSkip(text, now, keepFor);          // (b) old noise
    if (aged !== null) { text = aged; dirty = true; }
    if (!dirty) continue;
    cleaned++;
    text = text.replace(/[ \t]{2,}/g, " ").trimEnd();           // tidy the gap a removed block left
    try {
      if (text.trim()) await api.v1.document.updateParagraph(sectionId, { text });
      else await api.v1.document.removeParagraph(sectionId);
    } catch { /* best-effort per section */ }
  }
  if (recovered.length) await applyHideDirectives(recovered);
  return { scanned: sections.length, cleaned, recovered: recovered.length };
}

// flush-context - do the post-generation cleanup NOW, on demand.
//
// The same work onGenerationEnd does, and the heaviest thing the engine asks of
// the host: one document scan plus an edit per dirty paragraph. On a slow
// device that is exactly the work worth doing when the PLAYER chooses rather
// than while they wait - so it is also a verb. If the story feels sluggish or
// engine notes are showing through, run it, wait a beat, carry on.
export async function cmdFlushContext(): Promise<string> {
  const r = await processGenerationEnd(0);   // everything, not just what has aged out
  if (!r) {
    return sys(`Cannot reach the story text - the script needs the documentEdit permission. Nothing was changed.`);
  }
  const bits = [
    `${r.scanned} paragraph${r.scanned === 1 ? "" : "s"} scanned`,
    r.cleaned ? `${r.cleaned} cleaned` : "nothing needed clearing",
    r.recovered ? `${r.recovered} hidden block${r.recovered === 1 ? "" : "s"} recovered to the scene plan` : "",
  ].filter(Boolean);
  return sys(`Flushed: ${bits.join(", ")}. Engine notes are out of the story and out of the AI's context.`);
}

// Replace every [[command]] in the player's adventure-mode input with its
// [SYSTEM: ...] note, running commands in order. Generation is suppressed when
// the input was ONLY commands (no prose) OR any command was a QUIET (query) one
// - either way the player is operating the system, not advancing the story.
// A QUIET reply is also wrapped in a ctx-skip marker (kept out of the AI's
// context by onContextBuilt); a signal reply (a roll, a scene change) is not.
export async function processAdventureInput(rawInputText: string): Promise<OnTextAdventureInputReturnValue | undefined> {
  const matches = [...rawInputText.matchAll(COMMAND_PATTERN)];
  if (matches.length === 0) {
    // A running wizard claims plain (command-less) input as its reply - the
    // text "prompt -> reply" medium. [[commands]] still route normally below.
    const active = await WizardSession.get();
    if (active) {
      const out = await answerActiveWizard(active, rawInputText);
      return { inputText: out.replace(/\n/g, " "), stopGeneration: true };
    }
    return undefined; // not ours; leave input untouched
  }

  let out = "";
  let cursor = 0;
  let anyQuiet = false;
  for (const m of matches) {
    out += rawInputText.slice(cursor, m.index);
    // Through the ROUTER's parse, so a bare flag (`[[show-sheet in-story]]`) is
    // promoted here exactly as it is when the command is dispatched.
    const parsed = CommandRouter.parse(m[1]);
    const quiet = isQuietVerb(parsed.name);
    if (quiet) anyQuiet = true;
    // EVERY command is announced on the bus, in the formalized envelope, on
    // both the catch-all channel and its own verb's. Locally this costs a
    // function call; in a distributed engine it is how a script that owns a
    // verb hears about it. Nothing subscribes yet - the announcement is the
    // seam, and it exists before anything needs it.
    const envelope = commandEnvelope(parsed, {
      id: `${Date.now()}-${m.index}`, character: (await CharacterStore.getCurrent())?.name, at: Date.now(),
    });
    await PostOffice.publish(COMMAND_CHANNEL, envelope);
    await PostOffice.publish(commandChannel(parsed.name), envelope);
    const reply = await CommandRouter.route(m[1]);
    // ONE question, asked of every command: does this reply belong in the story?
    // (The turn's quietness is a separate matter, decided above.)
    out += wantsInStory(parsed) ? reply : await markCtxSkip(reply);
    cursor = (m.index ?? 0) + m[0].length;
  }
  out += rawInputText.slice(cursor);

  const prose = rawInputText.replace(COMMAND_PATTERN, "").trim();
  // The host forbids newlines in inputText (it would replace them with spaces).
  return { inputText: out.replace(/\n/g, " "), stopGeneration: prose.length === 0 || anyQuiet };
}
