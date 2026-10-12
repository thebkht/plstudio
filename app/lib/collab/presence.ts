import { nextId } from "@/app/lib/schema";

/**
 * Presence comes in two speeds. Who is in the room and what they have selected
 * changes a few times a minute; where their pointer is changes every frame. The
 * roster is React state the whole designer reads, so it must only change when
 * the roster does — cursors live in a store only the cursor layer subscribes to,
 * so a peer moving their mouse repaints their cursor and nothing else.
 */
/**
 * `id` is the account; `device` and `alias` are this browser's. A team sharing
 * one login is one account in many browsers, so the account alone cannot tell
 * them apart — `displayName` falls back to the alias exactly when it can't.
 * Both are optional because a peer on an older build sends neither.
 */
export type CollabUser = { id: string; name: string; image?: string | null; device?: string; alias?: string };
export type Peer = { clientId: number; user: CollabUser; color: string; selectedIds: string[] };
export type CursorPoint = { x: number; y: number };
export type PeerCursorMap = ReadonlyMap<number, CursorPoint>;

const sameUser = (a: CollabUser, b: CollabUser) => a.id === b.id && a.name === b.name && (a.image ?? null) === (b.image ?? null) && a.device === b.device && a.alias === b.alias;
const sameIds = (a: string[], b: string[]) => a.length === b.length && a.every((id, index) => id === b[index]);

/** Structural equality of two rosters, cursors aside — the guard that keeps a pointer move from re-rendering the designer. */
export const samePeers = (a: Peer[], b: Peer[]) =>
  a.length === b.length && a.every((peer, index) => {
    const other = b[index];
    return peer.clientId === other.clientId && peer.color === other.color && sameUser(peer.user, other.user) && sameIds(peer.selectedIds, other.selectedIds);
  });

const hash = (seed: string) => Math.abs([...seed].reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) | 0, 7));

const ADJECTIVES = ["Amber", "Brisk", "Calm", "Coral", "Dusky", "Eager", "Frosty", "Golden", "Jade", "Lucky", "Misty", "Nimble", "Quiet", "Rusty", "Swift", "Teal"];
const ANIMALS = ["Badger", "Crane", "Falcon", "Fox", "Gecko", "Heron", "Ibis", "Lynx", "Marten", "Otter", "Panda", "Puffin", "Raven", "Seal", "Tapir", "Wren"];

/** A readable name every peer derives identically from a device id. */
export const aliasFor = (device: string) => { const value = hash(device); return `${ADJECTIVES[value % ADJECTIVES.length]} ${ANIMALS[Math.floor(value / ADJECTIVES.length) % ANIMALS.length]}`; };

/** Peer colours are derived from a stable id so everyone sees the same person in the same colour. */
const PEER_COLORS = ["#175e7a", "#7d9dff", "#3cde7d", "#6360f7", "#f2994a", "#e8617d", "#00b8d9"];
export const peerColor = (id: string) => PEER_COLORS[hash(id) % PEER_COLORS.length];

const DEVICE_KEY = "drawsql:collab-device";

/**
 * One per browser, so a person's tabs share a name and a reload keeps it; per load when storage is blocked.
 * Minted by `nextId`, not `crypto.randomUUID`, which is absent on plain-http LAN addresses and would crash the designer.
 */
export function deviceId() {
  try {
    const stored = localStorage.getItem(DEVICE_KEY);
    if (stored) return stored;
    const minted = nextId("device");
    localStorage.setItem(DEVICE_KEY, minted);
    return minted;
  } catch {
    return nextId("device");
  }
}

/** The alias this browser goes by, when its account is also open elsewhere in the room. */
export const selfAlias = (self: CollabUser | null, peers: Peer[]) => (self && peers.some((peer) => peer.user.id === self.id) ? self.alias : undefined);

/** The person's own name, unless their account is in the room more than once — then the browser's alias. */
export const displayName = (peer: Peer, peers: Peer[], self: CollabUser | null) =>
  (self?.id === peer.user.id || peers.some((other) => other.clientId !== peer.clientId && other.user.id === peer.user.id)) && peer.user.alias ? peer.user.alias : peer.user.name;

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
