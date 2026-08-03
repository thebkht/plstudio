"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import type { Schema } from "@/app/lib/schema";
import { applySchemaToYDoc, isEmptyDoc, schemaFromYDoc, schemaRoot } from "./ydoc";

export type CollabUser = { id: string; name: string; image?: string | null };
export type Peer = { clientId: number; user: CollabUser; color: string; cursor: { x: number; y: number } | null; selectedId: string | null };
export type CollabStatus = "local" | "connecting" | "connected" | "disconnected";

/** Peer colours are derived from the user id so everyone sees the same person in the same colour. */
const PEER_COLORS = ["#175e7a", "#7d9dff", "#3cde7d", "#6360f7", "#f2994a", "#e8617d", "#00b8d9"];
export const peerColor = (id: string) => PEER_COLORS[Math.abs([...id].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) | 0, 7)) % PEER_COLORS.length];

/**
 * Owns the shared document and presents the same surface the designer already
 * used for local state: a `Schema` plus `commit(next)`, `undo`, `redo`. The
 * designer's ~40 commit call sites are unchanged by design.
 *
 * The `Y.Doc` exists even with no server. When `NEXT_PUBLIC_COLLAB_URL` is unset
 * or the collab service is down, this degrades to single-player editing and the
 * designer's existing debounced `PUT` remains the durability path.
 */
export function useCollaborativeSchema({
  projectId,
  initialSchema,
  readOnly = false,
  user,
  shareToken,
  workspaceSlug,
}: {
  projectId: string;
  initialSchema: Schema;
  readOnly?: boolean;
  user?: CollabUser | null;
  shareToken?: string;
  workspaceSlug?: string;
}) {
  const collabUrl = process.env.NEXT_PUBLIC_COLLAB_URL;
  const ydoc = useMemo(() => new Y.Doc(), [projectId]);
  /** Tags local transactions so the undo manager can ignore everyone else's edits. */
  const localOrigin = useMemo(() => Symbol("local"), [projectId]);

  const revisionRef = useRef(initialSchema.revision);
  const [schema, setSchemaState] = useState<Schema>(initialSchema);
  const [status, setStatus] = useState<CollabStatus>(collabUrl ? "connecting" : "local");
  const [peers, setPeers] = useState<Peer[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const providerRef = useRef<HocuspocusProvider | null>(null);
  const undoRef = useRef<Y.UndoManager | null>(null);

  const readSchema = useCallback(
    () => schemaFromYDoc(ydoc, { id: projectId, revision: revisionRef.current }),
    [projectId, ydoc],
  );

  // Seed, then mirror every document change — local or remote — into React state.
  useEffect(() => {
    if (isEmptyDoc(ydoc)) applySchemaToYDoc(ydoc, initialSchema);
    setSchemaState(readSchema());
    const sync = () => setSchemaState(readSchema());
    ydoc.on("update", sync);
    return () => { ydoc.off("update", sync); };
    // `initialSchema` is a seed, not a subscription: re-seeding on every server
    // render would fight concurrent edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, readSchema, ydoc]);

  // The undo manager is built after seeding, so the seed itself is never undoable.
  useEffect(() => {
    const manager = new Y.UndoManager(Object.values(schemaRoot(ydoc)), { trackedOrigins: new Set([localOrigin]), captureTimeout: 350 });
    const refresh = () => { setCanUndo(manager.canUndo()); setCanRedo(manager.canRedo()); };
    manager.on("stack-item-added", refresh);
    manager.on("stack-item-popped", refresh);
    manager.on("stack-cleared", refresh);
    undoRef.current = manager;
    return () => { manager.destroy(); undoRef.current = null; };
  }, [localOrigin, ydoc]);

  useEffect(() => {
    if (!collabUrl || !user) return;
    const query = new URLSearchParams({ projectId });
    if (workspaceSlug) query.set("workspace", workspaceSlug);
    if (shareToken) query.set("shareToken", shareToken);

    const provider = new HocuspocusProvider({
      url: collabUrl,
      name: `project:${projectId}`,
      document: ydoc,
      // Minted per connection by a route that reuses the existing session helpers,
      // so authorization is never decided twice.
      token: async () => {
        const response = await fetch(`/api/collab/token?${query}`);
        if (!response.ok) throw new Error("Not authorized for this project");
        return ((await response.json()) as { token: string }).token;
      },
      onStatus: ({ status: next }) => setStatus(next === "connected" ? "connected" : next === "connecting" ? "connecting" : "disconnected"),
      onAuthenticationFailed: () => setStatus("disconnected"),
    });
    providerRef.current = provider;

    provider.setAwarenessField("user", user);
    provider.setAwarenessField("color", peerColor(user.id));

    const awareness = provider.awareness;
    const syncPeers = () => {
      if (!awareness) return;
      setPeers(
        [...awareness.getStates().entries()]
          .filter(([clientId, state]) => clientId !== awareness.clientID && (state as Peer).user)
          .map(([clientId, state]) => {
            const peer = state as Omit<Peer, "clientId">;
            return { clientId, user: peer.user, color: peer.color ?? peerColor(peer.user.id), cursor: peer.cursor ?? null, selectedId: peer.selectedId ?? null };
          }),
      );
    };
    awareness?.on("change", syncPeers);
    syncPeers();

    return () => {
      awareness?.off("change", syncPeers);
      provider.destroy();
      providerRef.current = null;
      setPeers([]);
      setStatus(collabUrl ? "connecting" : "local");
    };
  }, [collabUrl, projectId, shareToken, user, workspaceSlug, ydoc]);

  const commit = useCallback(
    (next: Schema) => { if (!readOnly) applySchemaToYDoc(ydoc, next, localOrigin); },
    [localOrigin, readOnly, ydoc],
  );

  const undo = useCallback(() => { undoRef.current?.undo(); }, []);
  const redo = useCallback(() => { undoRef.current?.redo(); }, []);

  /** The server owns `revision`; it lives beside the document, never inside it. */
  const setRevision = useCallback((revision: number) => {
    revisionRef.current = revision;
    setSchemaState((current) => (current.revision === revision ? current : { ...current, revision }));
  }, []);

  // Cursor moves are per-pointermove; coalesce them to one frame so presence
  // never becomes the reason the canvas drops frames.
  const cursorFrame = useRef<number | null>(null);
  const pendingCursor = useRef<{ x: number; y: number } | null>(null);
  const setCursor = useCallback((point: { x: number; y: number } | null) => {
    const provider = providerRef.current;
    if (!provider) return;
    if (!point) { provider.setAwarenessField("cursor", null); return; }
    pendingCursor.current = point;
    if (cursorFrame.current !== null) return;
    cursorFrame.current = requestAnimationFrame(() => {
      cursorFrame.current = null;
      providerRef.current?.setAwarenessField("cursor", pendingCursor.current);
    });
  }, []);

  const setSelection = useCallback((selectedId: string | null) => { providerRef.current?.setAwarenessField("selectedId", selectedId); }, []);

  useEffect(() => () => { if (cursorFrame.current !== null) cancelAnimationFrame(cursorFrame.current); }, []);

  return { schema, commit, undo, redo, canUndo, canRedo, setRevision, status, peers, setCursor, setSelection };
}
