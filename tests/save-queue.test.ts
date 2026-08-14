import { describe, expect, it } from "vitest";
import { makeEmptySchema, type Schema } from "@/app/lib/schema";
import { createSaveQueue, type SaveResult, type SaveState } from "@/app/lib/save-queue";

/** A recorded write, plus the lever that decides when it answers. */
type Call = { schema: Schema; revision: number; overwrite: boolean; settle: (result: SaveResult) => void };

/**
 * A queue wired to a hand-driven server. `delay: 0` keeps the debounce a
 * single macrotask, which `tick()` steps past.
 */
function harness({ delay = 0 } = {}) {
  const calls: Call[] = [];
  const states: SaveState[] = [];
  let revision = 1;
  const queue = createSaveQueue({
    delay,
    revision: () => revision,
    onRevision: (next) => { revision = next; },
    onState: (state) => states.push(state),
    write: (schema, sentRevision, overwrite) =>
      new Promise<SaveResult>((resolve) => calls.push({ schema, revision: sentRevision, overwrite, settle: resolve })),
  });
  const named = (name: string) => ({ ...makeEmptySchema(name), revision });
  /** Let timers and the microtask queue drain. */
  const tick = () => new Promise((resolve) => setTimeout(resolve, 1));
  return { queue, calls, states, named, tick, current: () => revision };
}

describe("the save queue", () => {
  it("coalesces a burst of edits into one write, carrying the newest", async () => {
    const { queue, calls, named, tick } = harness();
    queue.push(named("first"));
    queue.push(named("second"));
    queue.push(named("third"));
    await tick();

    expect(calls).toHaveLength(1);
    expect(calls[0].schema.name).toBe("third");
  });

  it("never runs two writes at once", async () => {
    const { queue, calls, named, tick } = harness();
    queue.push(named("one"));
    await tick();
    expect(calls).toHaveLength(1);

    // Two more edits while the first request is still open.
    queue.push(named("two"));
    queue.push(named("three"));
    await tick();
    expect(calls).toHaveLength(1);

    calls[0].settle({ status: "saved", revision: 2 });
    await tick();
    expect(calls).toHaveLength(2);
    expect(calls[1].schema.name).toBe("three");
  });

  it("carries each response's revision into the next write", async () => {
    const { queue, calls, named, tick, current } = harness();
    queue.push(named("one"));
    await tick();
    expect(calls[0].revision).toBe(1);

    calls[0].settle({ status: "saved", revision: 7 });
    await tick();
    expect(current()).toBe(7);

    // This is the whole point: our own second write cannot conflict with our first.
    queue.push(named("two"));
    await tick();
    expect(calls[1].revision).toBe(7);
  });

  it("stops writing after a conflict, and keeps the snapshot for an overwrite", async () => {
    const { queue, calls, named, tick } = harness();
    queue.push(named("mine"));
    await tick();
    calls[0].settle({ status: "conflict", revision: 9 });
    await tick();
    expect(queue.state).toBe("conflict");
    expect(calls).toHaveLength(1);

    // The user chooses. Overwrite re-sends the snapshot at the revision the
    // server just told us about.
    void queue.flush(null, { overwrite: true });
    await tick();
    expect(calls).toHaveLength(2);
    expect(calls[1]).toMatchObject({ overwrite: true, revision: 9 });
    expect(calls[1].schema.name).toBe("mine");
  });

  it("keeps an unsaved edit after a failure and sends it with the next one", async () => {
    const { queue, calls, named, tick } = harness();
    queue.push(named("one"));
    await tick();
    calls[0].settle({ status: "failed", message: "offline" });
    await tick();
    expect(queue.state).toBe("failed");
    // No retry on a timer — a dead server must not be hammered.
    await tick();
    expect(calls).toHaveLength(1);

    queue.push(named("two"));
    await tick();
    expect(calls[1].schema.name).toBe("two");
  });

  it("writes what is on screen when the explicit save skips the debounce", async () => {
    const { queue, calls, named, tick } = harness({ delay: 10_000 });
    queue.push(named("typed"));
    void queue.flush(named("on screen"));
    await tick();

    expect(calls).toHaveLength(1);
    expect(calls[0].schema.name).toBe("on screen");
    expect(calls[0].overwrite).toBe(false);
  });

  it("reports its state and resolves idle once the queue drains", async () => {
    const { queue, calls, states, named, tick } = harness();
    expect(queue.state).toBe("idle");
    queue.push(named("one"));
    expect(queue.state).toBe("pending");
    await tick();
    expect(queue.state).toBe("saving");

    const idle = queue.idle();
    let settled = false;
    void idle.then(() => { settled = true; });
    await tick();
    expect(settled).toBe(false);

    calls[0].settle({ status: "saved", revision: 2 });
    await idle;
    expect(queue.state).toBe("idle");
    expect(states).toEqual(["pending", "saving", "idle"]);
  });

  it("drops what is queued when cancelled", async () => {
    const { queue, calls, named, tick } = harness({ delay: 10_000 });
    queue.push(named("one"));
    queue.cancel();
    await tick();
    expect(calls).toHaveLength(0);
    expect(queue.state).toBe("idle");
    await expect(queue.idle()).resolves.toBeUndefined();
  });
});
