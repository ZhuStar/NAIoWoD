// =============================================================================
// SMALL PROBE: where does a window field actually GO?
// -----------------------------------------------------------------------------
// *** RUN ON-HOST 2026-08-08. ANSWERED. Kept so the answer can be re-checked if
// *** NovelAI ever changes it - there is no need to run it again otherwise.
// ***
// ***   storageKey "foo"         -> api.v1.storage["foo"]         (per SCRIPT)
// ***   storageKey "story:foo"   -> api.v1.storyStorage["foo"]    (per STORY)
// ***   storageKey "history:foo" -> api.v1.historyStorage["foo"]  (undo-aware)
// ***
// *** Every prefix behaves as declared, the key is stored BARE with the prefix
// *** stripped, and the undocumented case - unprefixed - is the per-script
// *** store. That confirmed the window bug outright: the engine wrote
// *** unprefixed (-> storage) and read tempStorage. window.ts now binds with
// *** "story:" and reads storyStorage, with no fallback.
//
// ONE script slot, no second half, ~20 seconds to run.
//
//   1. Paste this whole file into any NovelAI script slot.
//   2. Type `probe-field` into the Text Adventure box. A window opens.
//   3. Type a different word into each of the three boxes.
//   4. Click "Where did they go?" and copy the log.
//
// WHY IT MATTERS. script-types.d.ts says on every *Input part: "Storage key for
// persisting the value... For historyStorage, prefix with 'history:'. For
// storyStorage, prefix with 'story:'". It does NOT say where an UNPREFIXED key
// goes. The engine used to write unprefixed keys and read them back out of
// tempStorage - the read never saw the write, so every window field was
// permanently empty and [[win-roll]]'s Roll button answered "Needs a pool"
// forever. That is fixed by naming the store explicitly ("story:"), plus a
// fallback chain because the default could not be determined off-host.
//
// This settles both halves:
//   F1. Is the "story:" prefix honoured - does a field bound to
//       `story:<key>` really turn up in api.v1.storyStorage under `<key>`?
//       If yes, the fallback chain in window.ts is dead code and can go.
//   F2. Where does an UNPREFIXED key land - storage, storyStorage, or
//       tempStorage? That is the one the docs leave silent.
//   F3. Does "history:" behave symmetrically (bonus - it is the store the
//       engine will want for undo-aware form state later).
// =============================================================================

const PLAIN_KEY = "naiowod-probe-plain";
const STORY_KEY = "naiowod-probe-story";
const HIST_KEY = "naiowod-probe-history";

async function report(): Promise<void> {
  const stores: Array<[string, { get: (k: string) => Promise<unknown> }]> = [
    ["storage      ", api.v1.storage],
    ["storyStorage ", api.v1.storyStorage],
    ["tempStorage  ", api.v1.tempStorage],
    ["historyStorage", api.v1.historyStorage],
  ];

  // Look for each key in every store, under BOTH the bare name and the
  // prefixed one - a host that stores the prefix verbatim is a real answer too.
  const found = async (key: string): Promise<string[]> => {
    const hits: string[] = [];
    for (const [label, store] of stores) {
      for (const probe of [key, `story:${key}`, `history:${key}`]) {
        const v = await store.get(probe);
        if (v !== undefined && v !== null && String(v) !== "") {
          hits.push(`${label.trim()}["${probe}"] = ${JSON.stringify(v)}`);
        }
      }
    }
    return hits;
  };

  const plain = await found(PLAIN_KEY);
  const story = await found(STORY_KEY);
  const hist = await found(HIST_KEY);

  api.v1.log("=========== NAIoWoD window-field probe ===========");
  api.v1.log(`F2 UNPREFIXED key "${PLAIN_KEY}":`);
  api.v1.log(plain.length ? `   ${plain.join("\n   ")}` : "   (nowhere - did you type in the first box?)");
  api.v1.log(`F1 "story:" key "${STORY_KEY}":`);
  api.v1.log(story.length ? `   ${story.join("\n   ")}` : "   (nowhere - did you type in the second box?)");
  api.v1.log(`F3 "history:" key "${HIST_KEY}":`);
  api.v1.log(hist.length ? `   ${hist.join("\n   ")}` : "   (nowhere - did you type in the third box?)");

  // The verdict, spelled out, so the log answers the question by itself.
  const storyOk = story.some(h => h.startsWith("storyStorage") && h.includes(`["${STORY_KEY}"]`));
  api.v1.log(`VERDICT F1: the "story:" prefix is ${storyOk ? "HONOURED - window.ts can drop its fallback chain"
    : "NOT honoured as expected - see above for where it actually landed"}`);
  const plainWhere = plain.length ? plain[0].split("[")[0] : "nowhere";
  api.v1.log(`VERDICT F2: an unprefixed storageKey lands in ${plainWhere}`);
  api.v1.log("==================================================");
}

api.v1.hooks.register("onTextAdventureInput", async (params: {
  inputText: string;
}): Promise<OnTextAdventureInputReturnValue> => {
  if (!(params.inputText ?? "").includes("probe-field")) return {};

  const part = api.v1.ui.part;
  const handle = await api.v1.ui.window.open({
    title: "Where does a window field go?", content: [], defaultWidth: 460, defaultHeight: 420,
  });
  await handle.update({ content: [part.column({ content: [
    part.text({ text: "Type a DIFFERENT word in each box, then click the button.", markdown: false }),

    part.text({ text: "1. storageKey with NO prefix:" }),
    part.textInput({ storageKey: PLAIN_KEY, placeholder: "e.g. alpha" }),

    part.text({ text: '2. storageKey prefixed "story:":' }),
    part.textInput({ storageKey: `story:${STORY_KEY}`, placeholder: "e.g. bravo" }),

    part.text({ text: '3. storageKey prefixed "history:":' }),
    part.textInput({ storageKey: `history:${HIST_KEY}`, placeholder: "e.g. charlie" }),

    part.button({ text: "Where did they go?", callback: () => { void report(); } }),
    part.button({ text: "Close", callback: () => handle.close() }),
  ] })] });

  return { stopGeneration: true };
});
