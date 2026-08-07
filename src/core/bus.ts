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

interface Subscription { id: number; channel: string; priority: BusPriority; handler: BusHandler }

export class EventBus {
  private _subs: Subscription[] = [];
  private _next = 1;

  // Subscribe. The number back is the handle `off` takes - the same shape
  // api.v1.messaging.onMessage uses, so the two layers read alike.
  on<T = unknown>(channel: string, handler: BusHandler<T>, priority: BusPriority = "normal"): number {
    const id = this._next++;
    this._subs.push({ id, channel: busChannel(channel), priority, handler: handler as BusHandler });
    return id;
  }

  off(id: number): boolean {
    const before = this._subs.length;
    this._subs = this._subs.filter(s => s.id !== id);
    return this._subs.length < before;
  }

  // Every handler on a channel, in the order they will run: by priority, then
  // by registration. Exposed because "who is listening to this, and when" is a
  // question worth being able to answer out loud.
  listeners(channel: string): Array<{ id: number; priority: BusPriority }> {
    const key = busChannel(channel);
    return this._subs
      .filter(s => s.channel === key)
      .sort((a, b) => BUS_PRIORITIES.indexOf(a.priority) - BUS_PRIORITIES.indexOf(b.priority) || a.id - b.id)
      .map(s => ({ id: s.id, priority: s.priority }));
  }

  channels(): string[] { return [...new Set(this._subs.map(s => s.channel))].sort(); }

  // Announce something. SYNCHRONOUS: by the time this returns, every local
  // handler has run and the event carries their verdicts - which is exactly
  // what lets a caller ask "was this cancelled?" and act on the answer.
  emit<T = unknown>(channel: string, data: T, meta: { from?: string; at?: number } = {}): BusEvent<T> {
    const event: BusEvent<T> = {
      channel: busChannel(channel), data,
      ...(meta.from ? { from: meta.from } : {}),
      at: meta.at ?? Date.now(),
      cancelled: false, stopped: false, errors: [], pending: [],
    };
    for (const { id } of this.listeners(event.channel)) {
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
    return event;
  }
}
