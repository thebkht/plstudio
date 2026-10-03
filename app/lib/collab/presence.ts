/**
 * Presence comes in two speeds. Who is in the room and what they have selected
 * changes a few times a minute; where their pointer is changes every frame. The
 * roster is React state the whole designer reads, so it must only change when
 * the roster does — cursors live in a store only the cursor layer subscribes to,
 * so a peer moving their mouse repaints their cursor and nothing else.
 */
export type CollabUser = { id: string; name: string; image?: string | null };
export type Peer = { clientId: number; user: CollabUser; color: string; selectedIds: string[] };
export type CursorPoint = { x: number; y: number };
export type PeerCursorMap = ReadonlyMap<number, CursorPoint>;

const sameUser = (a: CollabUser, b: CollabUser) => a.id === b.id && a.name === b.name && (a.image ?? null) === (b.image ?? null);
const sameIds = (a: string[], b: string[]) => a.length === b.length && a.every((id, index) => id === b[index]);

/** Structural equality of two rosters, cursors aside — the guard that keeps a pointer move from re-rendering the designer. */
export const samePeers = (a: Peer[], b: Peer[]) =>
  a.length === b.length && a.every((peer, index) => {
    const other = b[index];
    return peer.clientId === other.clientId && peer.color === other.color && sameUser(peer.user, other.user) && sameIds(peer.selectedIds, other.selectedIds);
  });

export const sameCursors = (a: PeerCursorMap, b: PeerCursorMap) =>
  a.size === b.size && [...a].every(([clientId, point]) => { const other = b.get(clientId); return !!other && other.x === point.x && other.y === point.y; });

/** A `useSyncExternalStore` source; the snapshot keeps its identity until a cursor actually moves. */
export type CursorStore = { subscribe: (listener: () => void) => () => void; getSnapshot: () => PeerCursorMap; set: (next: PeerCursorMap) => void };

const EMPTY: PeerCursorMap = new Map();

export function createCursorStore(): CursorStore {
  let current = EMPTY;
  const listeners = new Set<() => void>();
  return {
    subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getSnapshot: () => current,
    set: (next) => {
      if (sameCursors(current, next)) return;
      current = next.size ? next : EMPTY;
      listeners.forEach((listener) => listener());
    },
  };
}
