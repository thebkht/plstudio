/**
 * Whether the collab server holds everything this client has done: the socket
 * is up, the first handshake is over, and every local update has been
 * acknowledged. While that is true the server is the one persisting the
 * document, so the designer has nothing left to `PUT`.
 *
 * It flips twice per burst of edits, so like `CursorStore` it is a store and
 * not React state in `SchemaContext` -- only whoever subscribes hears about it.
 */
export type SyncStore = { subscribe: (listener: () => void) => () => void; get: () => boolean; set: (next: boolean) => void };

export function createSyncStore(): SyncStore {
  let current = false;
  const listeners = new Set<() => void>();
  return {
    subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    get: () => current,
    set: (next) => {
      if (current === next) return;
      current = next;
      listeners.forEach((listener) => listener());
    },
  };
}

/** The revision the server stamps on a stored mirror, as it arrives in a stateless message; null for anything else. */
export const revisionFromStateless = (payload: string) => {
  try {
    const revision = (JSON.parse(payload) as { revision?: unknown } | null)?.revision;
    return typeof revision === "number" && Number.isFinite(revision) ? revision : null;
  } catch { return null; }
};
