import type { Schema } from "./schema";

/**
 * Serialises writes to the project file.
 *
 * `PUT` is optimistic: it compares the revision the client sends against the
 * stored one and answers 409 when they differ. That is exactly right for two
 * *people* editing, and exactly wrong for one person typing — fire a save per
 * keystroke and the second request races the first, arrives with the revision
 * the first is in the middle of superseding, and conflicts with nobody but
 * itself.
 *
 * So writes go through a queue that guarantees three things:
 *
 * - **One in flight at a time.** A save started while another is running waits.
 * - **The wait coalesces.** Only the newest snapshot survives; the schema is a
 *   whole document, so an intermediate state has nothing to contribute.
 * - **The revision carries forward.** Each response's revision seeds the next
 *   request, so a 409 can only ever mean somebody else wrote — which is the
 *   one case a person should be asked about.
 *
 * Pure of React and of `fetch`: the caller supplies `write`, so the whole thing
 * is testable without a server.
 */

export type SaveResult =
  | { status: "saved"; revision: number }
  /** The stored revision is not the one we sent — a real remote edit. */
  | { status: "conflict"; revision: number }
  | { status: "failed"; message: string };

/** What the UI shows. `pending` means edits are waiting out the debounce. */
export type SaveState = "idle" | "pending" | "saving" | "conflict" | "failed";

export type SaveQueue = {
  /** Queue a snapshot. Resets the debounce, so a burst of edits writes once. */
  push: (schema: Schema) => void;
  /**
   * Write now, skipping the debounce — the explicit Save. A snapshot given
   * here supersedes whatever was queued, so ⌘S always writes what is on screen
   * rather than whatever the last edit happened to leave behind.
   */
  flush: (
    schema?: Schema | null,
    options?: { overwrite?: boolean },
  ) => Promise<void>;
  /** Drop anything queued and cancel the timer. For unmount. */
  cancel: () => void;
  /** Resolves once nothing is queued or in flight. For tests and for unload. */
  idle: () => Promise<void>;
  readonly state: SaveState;
};

export function createSaveQueue({
  write,
  revision,
  onRevision,
  onState,
  onResult,
  delay = 3000,
}: {
  write: (
    schema: Schema,
    revision: number,
    overwrite: boolean,
  ) => Promise<SaveResult>;
  /** The revision the caller believes is current, read fresh on every write. */
  revision: () => number;
  onRevision: (revision: number) => void;
  onState: (state: SaveState) => void;
  /** Every outcome, so the caller can raise the conflict toast exactly once. */
  onResult?: (result: SaveResult) => void;
  /**
   * How long a burst of edits has to settle before it is written. Long enough
   * that a pause for thought mid-edit is not mistaken for the end of one — the
   * timer re-arms on every edit, so this is the cost of the quietest gap, not
   * of the whole burst. Explicit Save bypasses it via `flush`.
   */
  delay?: number;
}): SaveQueue {
  let pending: Schema | null = null;
  let running = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let state: SaveState = "idle";
  /**
   * Set by a 409 and cleared by the next push. Until then the queue stops
   * writing: retrying a conflict on a timer would either spin forever or
   * silently clobber the other edit, and neither is ours to decide.
   */
  let blocked = false;
  let idleWaiters: (() => void)[] = [];

  const setState = (next: SaveState) => {
    if (state === next) return;
    state = next;
    onState(next);
  };

  const settle = () => {
    if (running || pending || timer) return;
    const waiters = idleWaiters;
    idleWaiters = [];
    waiters.forEach((resolve) => resolve());
  };

  const run = async (overwrite: boolean) => {
    if (running) return;
    const schema = pending;
    if (!schema) return;
    pending = null;
    running = true;
    setState("saving");
    let result: SaveResult;
    try {
      result = await write(schema, revision(), overwrite);
    } catch {
      result = { status: "failed", message: "Could not reach the server." };
    }
    running = false;
    onResult?.(result);
    if (result.status === "saved" || result.status === "conflict")
      onRevision(result.revision);

    if (result.status === "conflict") {
      blocked = true;
      // The snapshot is kept so an Overwrite from the toast still has it.
      pending = pending ?? schema;
      setState("conflict");
      settle();
      return;
    }
    if (result.status === "failed") {
      /*
       * Keep the snapshot rather than dropping the edit on the floor, but do
       * not schedule a retry: the next edit carries it, and a queue that
       * retries a dead server on a timer is a queue that hammers it.
       */
      pending = pending ?? schema;
      setState("failed");
      settle();
      return;
    }
    // A write that landed while this one ran goes out immediately.
    if (pending) {
      void run(false);
      return;
    }
    setState("idle");
    settle();
  };

  const arm = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void run(false);
    }, delay);
  };

  return {
    push(schema) {
      pending = schema;
      blocked = false;
      setState("pending");
      arm();
    },
    async flush(schema, options) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      const snapshot = schema ?? pending;
      if (!snapshot) {
        setState("idle");
        settle();
        return;
      }
      blocked = false;
      // A write already running holds the only slot; wait for it rather than
      // dropping this one, which is how an Overwrite pressed mid-save survives.
      if (running) await this.idle();
      pending = snapshot;
      await run(options?.overwrite ?? false);
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = null;
      pending = null;
      setState("idle");
      settle();
    },
    idle() {
      if (!running && !pending && !timer) return Promise.resolve();
      return new Promise<void>((resolve) => idleWaiters.push(resolve));
    },
    get state() {
      return state;
    },
  };
}
