// =============================================================================
// THE EVENT BUS - one place a thing that happened is announced
// -----------------------------------------------------------------------------
// PURE. No `api`, no storage, no imports: this file is the dispatch rule and
// nothing else, so it can be reasoned about and tested on its own. The half
// that talks to other scripts (api.v1.messaging) lives in services.ts and is
// built ON this - see PostOffice.
//
// The owner's model, and it is the right one: every script keeps a POST OFFICE.
// You walk to it to send something, or you wait at home and it brings you what
// arrived. Sending something to yourself still gets delivered.
//
// That last part is why `emit` here is DIRECT and SYNCHRONOUS rather than a
// round trip through messaging. It is NOT an efficiency choice:
//
//   * api.v1.messaging.broadcast() explicitly excludes the sender, so a script
//     literally cannot receive its own broadcast; and
//   * every messaging call is a Promise. An event that leaves and comes back
//     arrives on a LATER TICK - so the thing that raised it has already
//     finished. "Let a handler adjust this roll before it is rolled" is
//     impossible across the wire and trivial in a direct call.
//
// So: local dispatch is a function call, the relay is a message, and the
// PUBLISHER cannot tell the difference. That is the simplicity the owner asked
// for, kept without the trap underneath it.
// =============================================================================

// Handlers run in this order. `monitor` is the observe-only slot: it runs last,
// after everything has had its say, and its verdict is IGNORED - use it for
// logging and ledgers, where reacting is right and interfering is not.
export const BUS_PRIORITIES = ["first", "early", "normal", "late", "last", "monitor"] as const;
export type BusPriority = typeof BUS_PRIORITIES[number];

// THREE PHASES, and they are not the same axis as priority. Priority orders the
// handlers that all want to do the same KIND of thing; a phase says WHICH KIND:
//
//   before  - the veto. Runs first, and cancelling here means the thing does not
//             happen: `on` and `after` are skipped. This is where a rule that
//             forbids something belongs.
//   on      - the thing itself. The default, and where everything written before
//             phases existed already sits.
//   after   - it happened. Cannot un-happen it (a cancel from `before` or `on`
//             means `after` never runs at all), so this is the ledger's slot,
//             the reply note's, the cache invalidation's.
//
// WITHIN a phase, `cancelled` stays what it always was - a flag later handlers
// may honour or ignore. BETWEEN phases it is binding. That is the whole
// difference, and it is why a veto needs its own phase rather than a priority:
// `first` could always be out-voted by someone who simply did not check.
export const BUS_PHASES = ["before", "on", "after"] as const;
export type BusPhase = typeof BUS_PHASES[number];

// A channel whose name starts with this NEVER leaves the script: the post
// office recognises it and simply hands it back down the hall. Anything else is
// relayed. (The owner's "loco" prefix, spelled the way the rest of the engine
// spells things.)
export const LOCAL_PREFIX = "local:";
export function isLocalChannel(channel: string): boolean {
  return channel.trim().toLowerCase().startsWith(LOCAL_PREFIX);
}

// THE SYSTEM CHANNELS: events the parts of this engine raise at each other,
// never at the outside world. They are `local:` (so they never reach the wire)
// and they are the ONLY events that CAUSE things - a command publishes one and
// a handler does the work, rather than the command doing the work and
// announcing it afterwards. That inversion is the point: the thing that knows
// WHEN is not the thing that knows HOW.
export const SYSTEM = {
  powerTaken: `${LOCAL_PREFIX}power:taken`,
  powerLost: `${LOCAL_PREFIX}power:lost`,
  afflictionRequested: `${LOCAL_PREFIX}affliction:requested`,
  afflictionLiftRequested: `${LOCAL_PREFIX}affliction:lift-requested`,
} as const;

// A channel can be ANYTHING - that was the owner's point, and it is worth
// keeping. "character-healed-aggravated-with-a-resource" is a perfectly good
// channel; so is "rolls". Names are normalized only by case and trimming, so
// two spellings of the same intent cannot drift apart.
export function busChannel(name: string): string {
  return name.trim().toLowerCase();
}

// What handlers actually see. `cancelled` is a FLAG, not an interruption: later
// handlers still run and may honour it (`if (event.cancelled) return;`) or
// ignore it entirely. `stopped` is the interruption - nothing further runs, and
// the post office does not relay it onward.
export interface BusEvent<T = unknown> {
  channel: string;
  data: T;
  // The script this arrived from, absent when it was raised right here. The
  // difference matters: a handler may want to act only on local events, or only
  // on foreign ones, and it should never have to guess.
  from?: string;
  at: number;              // epoch ms (the relayed ScriptMessage's timestamp)
  cancelled: boolean;
  stopped: boolean;
  // A handler that throws does not take the emit down with it: the failure is
  // recorded here and the rest of the handlers still run. Same law as a bad
  // lorebook card - surfaced, never fatal.
  errors: string[];
  // ASYNC WORK A HANDLER STARTED. `emit` is synchronous on purpose - a verdict
  // has to be readable on the next line - but a handler that must touch storage
  // cannot be. So it pushes its promise here and the PUBLISHER awaits them all
  // before returning. Verdicts stay synchronous; effects may take their time.
  pending: Array<Promise<unknown>>;
}

// What a handler may say on the way out. Returning nothing is the common case.
export interface BusVerdict { cancel?: boolean; stop?: boolean }
export type BusHandler<T = unknown> = (event: BusEvent<T>) => BusVerdict | void;

// Third argument to `on`. A bare priority still works and still means the `on`
// phase, so nothing written before phases existed has to move.
export interface BusSubscribeOptions { phase?: BusPhase; priority?: BusPriority }

interface Subscription {
  id: number; channel: string; phase: BusPhase; priority: BusPriority; handler: BusHandler;
}

export class EventBus {
  private _subs: Subscription[] = [];
  private _next = 1;
  // Bumped on every subscribe/unsubscribe. The post office watches it to know
  // when its announced interests have gone stale, which is cheaper and more
  // exact than diffing the channel list on every publish.
  private _version = 0;
  get version(): number { return this._version; }

  // Subscribe. The number back is the handle `off` takes - the same shape
  // api.v1.messaging.onMessage uses, so the two layers read alike.
  on<T = unknown>(
    channel: string,
    handler: BusHandler<T>,
    opts: BusPriority | BusSubscribeOptions = "normal",
  ): number {
    const { phase = "on", priority = "normal" } = typeof opts === "string" ? { priority: opts } : opts;
    const id = this._next++;
    this._subs.push({ id, channel: busChannel(channel), phase, priority, handler: handler as BusHandler });
    this._version++;
    return id;
  }

  off(id: number): boolean {
    const before = this._subs.length;
    this._subs = this._subs.filter(s => s.id !== id);
    if (this._subs.length < before) { this._version++; return true; }
    return false;
  }

  // Every handler on a channel, in the order they will run: by phase, then by
  // priority, then by registration. Exposed because "who is listening to this,
  // and when" is a question worth being able to answer out loud. Pass a phase
  // to ask about just that one.
  listeners(channel: string, phase?: BusPhase): Array<{ id: number; phase: BusPhase; priority: BusPriority }> {
    const key = busChannel(channel);
    return this._subs
      .filter(s => s.channel === key && (phase === undefined || s.phase === phase))
      .sort((a, b) =>
        BUS_PHASES.indexOf(a.phase) - BUS_PHASES.indexOf(b.phase) ||
        BUS_PRIORITIES.indexOf(a.priority) - BUS_PRIORITIES.indexOf(b.priority) ||
        a.id - b.id)
      .map(s => ({ id: s.id, phase: s.phase, priority: s.priority }));
  }

  channels(): string[] { return [...new Set(this._subs.map(s => s.channel))].sort(); }

  // Announce something. SYNCHRONOUS: by the time this returns, every local
  // handler has run and the event carries their verdicts - which is exactly
  // what lets a caller ask "was this cancelled?" and act on the answer.
  //
  // The three phases run in order and a cancel BETWEEN them is binding: veto in
  // `before` and neither `on` nor `after` happens; cancel in `on` and `after` is
  // skipped. Within a phase nothing changes - `cancelled` is still the flag it
  // always was.
  emit<T = unknown>(channel: string, data: T, meta: { from?: string; at?: number } = {}): BusEvent<T> {
    const event: BusEvent<T> = {
      channel: busChannel(channel), data,
      ...(meta.from ? { from: meta.from } : {}),
      at: meta.at ?? Date.now(),
      cancelled: false, stopped: false, errors: [], pending: [],
    };
    for (const phase of BUS_PHASES) {
      // A veto earlier in the chain means the later phases simply do not run.
      if (event.stopped || event.cancelled) break;
      this._runPhase(event, phase);
    }
    return event;
  }

  private _runPhase<T>(event: BusEvent<T>, phase: BusPhase): void {
    for (const { id } of this.listeners(event.channel, phase)) {
      if (event.stopped) break;
      const sub = this._subs.find(s => s.id === id);
      if (!sub) continue;   // a handler that unsubscribed a handler mid-emit
      try {
        const verdict = sub.handler(event as BusEvent);
        // A monitor watches; it does not vote.
        if (sub.priority === "monitor" || !verdict) continue;
        if (verdict.cancel) event.cancelled = true;
        if (verdict.stop) event.stopped = true;
      } catch (err) {
        event.errors.push(`${event.channel} handler #${id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
}
