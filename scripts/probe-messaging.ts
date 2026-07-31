// =============================================================================
// PROBE: what api.v1.messaging ACTUALLY guarantees
// -----------------------------------------------------------------------------
// NOT part of the build, not part of the engine. Paste this into a NovelAI
// script slot and run it; it prints its findings with api.v1.log.
//
// The documentation (docs/api-reference.md §api.v1.messaging) is complete about
// the SHAPE of the API and silent about its BEHAVIOUR. Four questions decide
// how much of the engine may safely sit on a message bus, and none of them can
// be answered off-host, because the mock can only be as truthful as the docs it
// was written from:
//
//   Q1. Does send() to your OWN script id deliver? (broadcast is documented to
//       exclude the sender; send is not documented either way.)
//   Q2. Is delivery ORDERED - do three messages arrive in the order sent?
//   Q3. Is delivery ever SYNCHRONOUS, or always a later tick? (If a handler
//       could run before the sender's next line, a round-trip bus would be
//       possible. We assume it cannot; this checks.)
//   Q4. Does a message survive to a listener registered by ANOTHER script -
//       i.e. is this usable for distributing the engine at all?
//
// For Q4, paste the SECOND half into a second script slot.
// =============================================================================

// --- SCRIPT ONE ------------------------------------------------------------
async function probe(): Promise<void> {
  const me = api.v1.script.id;
  const seen: string[] = [];
  let tickAtDelivery = 0;
  let tick = 0;

  const sub = await api.v1.messaging.onMessage((m) => {
    seen.push(`${m.channel ?? "-"}:${JSON.stringify(m.data)} from ${m.fromScriptId === me ? "SELF" : m.fromScriptId}`);
    tickAtDelivery = tick;
  });

  api.v1.log(`[probe] my script id: ${me}`);

  // Q1 + Q3: send to myself, then immediately check whether anything arrived
  // before the next statement ran.
  tick = 1;
  await api.v1.messaging.send(me, { q: 1 }, "probe");
  api.v1.log(`[probe] Q3 synchronous delivery? ${seen.length > 0 ? "YES (arrived within send)" : "no (later tick, as assumed)"}`);

  // Q2: three in a row, in order.
  tick = 2;
  await api.v1.messaging.send(me, { n: 1 }, "probe-order");
  await api.v1.messaging.send(me, { n: 2 }, "probe-order");
  await api.v1.messaging.send(me, { n: 3 }, "probe-order");

  // Broadcast, which the docs say I must NOT receive.
  await api.v1.messaging.broadcast({ q: "broadcast" }, "probe");

  // Give the host a moment to deliver whatever it is going to deliver.
  await new Promise((r) => setTimeout(r, 1000));

  api.v1.log(`[probe] Q1 send-to-self delivers? ${seen.some((s) => s.includes("SELF")) ? "YES" : "NO"}`);
  api.v1.log(`[probe] Q2 order preserved? ${seen.filter((s) => s.includes("probe-order")).join(" | ")}`);
  api.v1.log(`[probe] own broadcast heard? ${seen.some((s) => s.includes('"broadcast"')) ? "YES (docs say it should not be)" : "no, as documented"}`);
  api.v1.log(`[probe] everything received: ${seen.length ? seen.join("  //  ") : "(nothing)"}`);
  api.v1.log(`[probe] delivery tick: ${tickAtDelivery} (0 = after everything, which is the assumption the bus is built on)`);

  await api.v1.messaging.unsubscribe(sub);
}

void probe();

// --- SCRIPT TWO (paste into a SECOND script slot, for Q4) -------------------
//
// async function listener(): Promise<void> {
//   await api.v1.messaging.onMessage((m) => {
//     api.v1.log(`[listener] heard ${m.channel}: ${JSON.stringify(m.data)} from ${m.fromScriptId}`);
//   }, { channel: "probe" });
//   api.v1.log(`[listener] listening as ${api.v1.script.id}`);
// }
// void listener();
