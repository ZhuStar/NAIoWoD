// =============================================================================
// PROBE: what the NovelAI host ACTUALLY guarantees
// -----------------------------------------------------------------------------
// NOT part of the build, not part of the engine, not covered by `bun run
// typecheck` (tsconfig includes src/test/types only). Paste it into a NovelAI
// script slot and read what it prints with api.v1.log.
//
// HOW TO RUN IT
//   1. Paste this whole file into a script slot. Leave ROLE as "one".
//   2. Paste it AGAIN into a SECOND slot, and change the ROLE line to "two".
//      Both slots must be ENABLED - a disabled script never initializes.
//   3. Reload the story and wait ~5s. Q1-Q4, S1 and S2 print by themselves.
//   4. Type `probe-hooks` in the Text Adventure input box -> H1, H2, H3.
//      Type `probe-hooks stop` to test stopFurtherScripts specifically.
//   5. Type `probe-reply` in the same box -> Q5. This one leaves no trace in
//      the story. `probe-hooks` DELIBERATELY does write into it - passing the
//      marked-up text down the chain IS the H1 measurement - so expect to see
//      "You probe-hooks. <seen-by:one>" and delete it afterwards.
//   6. Copy the whole log back.
//
// WHERE THE OUTPUT GOES: every line is api.v1.log, tagged `[probe:one]` or
// `[probe:two]`, so it lands wherever that slot's script logs show up in the
// NovelAI UI - not in the story text. Nothing is written into the narrative;
// each probe input returns stopGeneration, so the AI never responds to it.
//
// READING Q5 - AND THE THIRD OUTCOME. Two of its answers are printed:
// an answer means a reply CAN cross while a hook awaits; TIMED OUT after ~2s
// means it cannot. The third outcome is not printed at all: if the input box
// HANGS and no Q5 line ever appears, the host ran neither the message nor the
// timer while the hook was awaiting - which is a stronger "no" than TIMED OUT,
// and is itself the finding. Say so if it happens.
//
// WHAT MAKES Q5 TRUSTWORTHY NOW: script two replies from a LOAD-TIME
// subscription, not from inside its own hook, and script one subscribes before
// it asks. Both were wrong before, and either would have printed TIMED OUT on a
// host where the answer is actually yes.
//
// The documentation is complete about the SHAPE of these APIs and silent about
// their BEHAVIOUR, and none of it can be answered off-host: the mock in
// src/host-mock.ts can only be as truthful as the docs it was written from.
//
// THE MESSAGING QUESTIONS
//   Q1. Does send() to your OWN script id deliver? (broadcast is documented to
//       exclude the sender; send is not documented either way.)
//   Q2. Is delivery ORDERED - do three messages arrive in the order sent?
//   Q3. Is delivery ever SYNCHRONOUS, or always a later tick?
//   Q4. Does a message reach a listener registered by ANOTHER script - i.e. is
//       this usable for distributing the engine at all?
//   Q5. Can a reply arrive WHILE A HOOK IS AWAITING IT? If not, commands
//       cannot be distributed by message, only fire-and-forget events can.
//
// THE STORAGE QUESTIONS - S1 IS THE ONE THAT DECIDES THE ARCHITECTURE.
//   S1. Is api.v1.storyStorage SHARED between scripts? docs/storage-api.md says
//       "Each script gets its own storage separate from other scripts", but it
//       says that about `storage` while describing storyStorage as "always
//       stored in the current story". If storyStorage is shared, then splitting
//       the engine into several scripts that see ONE game state is a one-line
//       change - ScopedStorage's prefix is already a constructor parameter
//       (services.ts:27), defaulting to api.v1.script.id. If it is isolated,
//       every split script has to reach the sheet through the lorebook.
//   S2. Does api.v1.storage behave differently from storyStorage here?
//
// THE HOOK-CHAIN QUESTIONS. docs/hooks.md promises scripts run their hooks in
// User-Scripts-modal order, each may modify `inputText`, and any may set
// `stopFurtherScripts`. That is an ordered, synchronous, cancellable bus with
// stop-propagation, provided by the host, needing no messages at all - so if it
// holds, it is how commands get distributed and Q5 stops mattering.
//   H1. Does the chain really pass inputText down - does script two see what
//       script one returned?
//   H2. Does stopFurtherScripts actually halt the rest?
//   H3. What order do the hooks run in, and can a script tell where it sits?
// =============================================================================

// ---------------------------------------------------------------------------
// CHANGE "one" TO "two" IN THE SECOND SCRIPT SLOT. Nothing else differs.
// (The `as Role` is load-bearing: without it TypeScript narrows the const to
// the literal "one" and declares every ROLE === "two" test unreachable.)
type Role = "one" | "two";
const ROLE = "one" as Role;
// ---------------------------------------------------------------------------

const OTHER = ROLE === "one" ? "two" : "one";
const TAG = `[probe:${ROLE}]`;
const say = (msg: string): void => { api.v1.log(`${TAG} ${msg}`); };

// The magic words that trigger the interactive probes, so a normal turn is not
// slowed down by a two-second timeout on every single input.
const HOOK_WORD = "probe-hooks";
const REPLY_WORD = "probe-reply";

// =============================================================================
// LOAD-TIME: messaging (Q1-Q4) and storage (S1, S2)
// =============================================================================
async function atLoad(): Promise<void> {
  const me = api.v1.script.id;
  say(`my script id: ${me}`);

  // --- S1 / S2 -------------------------------------------------------------
  // Both roles write their own key and then read the OTHER's, so load ORDER
  // does not matter: whoever runs second finds the first one's value, and the
  // first one finds it on the delayed re-read below.
  const nonce = `${ROLE}-${Date.now()}`;
  await api.v1.storyStorage.set(`probe-s1-${ROLE}`, nonce);
  await api.v1.storage.set(`probe-s2-${ROLE}`, nonce);

  // --- Q1 + Q3 -------------------------------------------------------------
  const seen: string[] = [];
  let tickAtDelivery = 0;
  let tick = 0;
  const sub = await api.v1.messaging.onMessage((m) => {
    const who = m.fromScriptId === me ? "SELF" : `OTHER(${m.fromScriptId})`;
    seen.push(`${m.channel ?? "-"}=${JSON.stringify(m.data)} from ${who}`);
    tickAtDelivery = tick;
  });

  tick = 1;
  await api.v1.messaging.send(me, { q: 1 }, "probe");
  say(`Q3 synchronous delivery? ${seen.length > 0 ? "YES - arrived inside send()" : "no - later tick, as assumed"}`);

  // --- Q2 ------------------------------------------------------------------
  tick = 2;
  await api.v1.messaging.send(me, { n: 1 }, "probe-order");
  await api.v1.messaging.send(me, { n: 2 }, "probe-order");
  await api.v1.messaging.send(me, { n: 3 }, "probe-order");

  // --- Q4 ------------------------------------------------------------------
  // Documented to exclude the sender, so anything heard here came from the
  // other slot - which is exactly what Q4 asks.
  await api.v1.messaging.broadcast({ hello: ROLE }, "probe");

  // Let the host deliver whatever it is going to deliver, and let the other
  // slot finish loading.
  // The host hides the global setTimeout/clearTimeout and provides its own,
  // promise-shaped: api.v1.timers.{setTimeout,clearTimeout,sleep}.
  await api.v1.timers.sleep(3000);

  say(`Q1 send-to-self delivers? ${seen.some(s => s.includes("SELF")) ? "YES" : "NO"}`);
  const ordered = seen.filter(s => s.includes("probe-order"));
  say(`Q2 order preserved? ${ordered.length ? ordered.join(" | ") : "(none arrived)"}`);
  say(`Q4 heard the OTHER script? ${seen.some(s => s.includes("OTHER")) ? "YES - messaging spans scripts" : "NO (or the other slot is not installed)"}`);
  say(`own broadcast heard? ${seen.some(s => s.includes(`"hello":"${ROLE}"`)) ? "YES - contradicts the docs" : "no, as documented"}`);
  say(`delivery tick: ${tickAtDelivery} (0 = after everything, the assumption the bus is built on)`);
  say(`everything received: ${seen.length ? seen.join("  //  ") : "(nothing)"}`);

  // --- S1 / S2, read back ---------------------------------------------------
  const theirStory = await api.v1.storyStorage.get(`probe-s1-${OTHER}`);
  const theirPlain = await api.v1.storage.get(`probe-s2-${OTHER}`);
  const mineStory = await api.v1.storyStorage.get(`probe-s1-${ROLE}`);
  say(`S1 *** storyStorage SHARED between scripts? ${theirStory !== undefined
    ? `YES - read "${String(theirStory)}" written by script ${OTHER}`
    : `no - script ${OTHER}'s key is invisible (or that slot is not installed)`} ***`);
  say(`S2 plain storage shared? ${theirPlain !== undefined
    ? `YES - read "${String(theirPlain)}"`
    : "no - per-script, as documented"}`);
  say(`sanity: my own storyStorage key reads back as "${String(mineStory)}"`);
  say(`storyStorage keys visible to me: ${JSON.stringify(await api.v1.storyStorage.list())}`);

  await api.v1.messaging.unsubscribe(sub);
  say(`load-time probe done.`);
}

void atLoad();

// =============================================================================
// THE RESPONDER - the half of Q5 that was missing
// -----------------------------------------------------------------------------
// Q5 asks whether a reply can arrive while script one's hook is awaiting it, so
// somebody has to ACTUALLY REPLY. Nothing did: script two printed "I am the
// responder" from inside its own hook and never subscribed to anything, so Q5
// could only ever report TIMED OUT - which is not the answer "no", it is the
// answer "nobody was listening", and the two are indistinguishable in the log.
// The probe would have reported the opposite of the truth on the one question it
// was written to settle.
//
// This subscription is registered at LOAD and lives for the session, because the
// question is whether a reply can cross while a hook is blocked - so the
// responder must not itself be inside a hook.
if (ROLE === "two") {
  void api.v1.messaging.onMessage((m) => {
    const data = (m.data ?? {}) as { id?: string; verb?: string };
    if (data.verb !== "probe" || !data.id) return;
    say(`Q5 responder: heard ${data.verb} ${data.id}, replying now`);
    void api.v1.messaging.send(m.fromScriptId, {
      id: data.id, text: `answered by script ${ROLE}`,
    }, "probe-reply");
  }, { channel: "command:probe" });
}

// =============================================================================
// THE HOOK CHAIN: H1, H2, H3 - and Q5
// -----------------------------------------------------------------------------
// Type `probe-hooks` into the Text Adventure box for H1/H2/H3, or
// `probe-reply` for Q5. Any other input passes through untouched, so the probe
// can sit installed without getting in the way.
// =============================================================================
api.v1.hooks.register("onTextAdventureInput", async (params: {
  inputText: string; continuityId: string;
}): Promise<OnTextAdventureInputReturnValue> => {
  const text = params.inputText ?? "";

  // --- H3: when did I run, and what did I receive? -------------------------
  if (text.includes(HOOK_WORD)) {
    say(`H3 hook ran at ${Date.now()} (continuityId ${params.continuityId})`);
    // H1: did I see the marker the earlier script appended?
    const sawOther = text.includes(`<seen-by:${OTHER}>`);
    say(`H1 inputText carries the other script's mark? ${sawOther
      ? `YES - the chain passes modified text down (I am AFTER ${OTHER})`
      : `not present - either I run FIRST, or the chain does not pass text`}`);
    say(`H1 raw inputText I received: ${JSON.stringify(text)}`);

    // H2: script one asks the host to stop the chain; script two reports
    // whether it ran anyway. Only when the input also says `stop`.
    if (ROLE === "one" && text.includes("stop")) {
      say(`H2 setting stopFurtherScripts - script ${OTHER} should NOT log anything after this`);
      return { inputText: `${text} <seen-by:one>`, stopFurtherScripts: true, stopGeneration: true };
    }
    if (ROLE === "two" && text.includes("stop")) {
      say(`H2 *** I RAN ANYWAY - stopFurtherScripts did NOT halt the chain ***`);
    }
    return { inputText: `${text} <seen-by:${ROLE}>`, stopGeneration: true };
  }

  // --- Q5: can a reply arrive while this hook is awaiting it? --------------
  if (text.includes(REPLY_WORD)) {
    if (ROLE === "two") {
      // The reply comes from the load-time subscription above, NOT from here -
      // a responder inside a hook could not answer while the other script's
      // hook is blocked, which is the whole thing being measured.
      say(`Q5 I am the responder; my load-time subscription is what answers.`);
      return { inputText: "", stopGeneration: true };
    }
    const started = Date.now();
    // ARM, THEN SUBSCRIBE, THEN ASK. onMessage is async: the question used to go
    // out from inside the Promise executor while the subscription was still
    // being registered, so a FAST responder could answer before anyone was
    // listening and the probe would print TIMED OUT - again reporting the
    // opposite of the truth. Ordering it this way also means clearTimeout
    // always has a real id rather than the 0 the old code raced on.
    let sub = 0;
    const answer = await new Promise<string>((resolve) => {
      void (async () => {
        const timer = await api.v1.timers.setTimeout(() => resolve("TIMED OUT"), 2000);
        sub = await api.v1.messaging.onMessage((m) => {
          const data = (m.data ?? {}) as { id?: string; text?: string };
          if (data.id !== params.continuityId) return;
          void api.v1.timers.clearTimeout(timer);
          resolve(data.text ?? "(empty)");
        }, { channel: "probe-reply" });
        // The formalized envelope, exactly as src/command.ts defines it.
        await api.v1.messaging.broadcast({
          id: params.continuityId, verb: "probe", positional: [], named: {},
          raw: text, at: Date.now(),
        }, "command:probe");
      })();
    });
    if (sub) void api.v1.messaging.unsubscribe(sub);
    say(`Q5 *** reply inside a hook: ${answer} (waited ${Date.now() - started}ms) ***`);
    say(`Q5 verdict: ${answer === "TIMED OUT"
      ? "commands CANNOT be distributed by message - use the hook chain"
      : "commands CAN be distributed by message"}`);
    // BLANK THE INPUT, not merely stopGeneration. `stopGeneration` stops the AI
    // from replying; it does NOT stop the typed text from being written into the
    // story, which is why `probe-reply` still printed "You probe-reply." An
    // empty inputText is the documented way to suppress the insertion itself.
    return { inputText: "", stopGeneration: true };
  }

  return {};
});

// Q5's responder half, live only in the second slot.
if (ROLE === "two") {
  void api.v1.messaging.onMessage(async (m) => {
    const env = (m.data ?? {}) as { id?: string; verb?: string };
    if (!env.id) return;
    say(`Q5 answering command "${env.verb}" (${env.id})`);
    await api.v1.messaging.broadcast(
      { id: env.id, handled: true, by: api.v1.script.id, text: `[SYSTEM: ${env.verb} handled remotely.]` },
      "probe-reply",
    );
  }, { channel: "command:probe" });
}
