"use client";

import { memo, useSyncExternalStore } from "react";
import { AvatarStack } from "@/components/kibo-ui/avatar-stack";
import { Cursor, CursorBody, CursorName, CursorPointer } from "@/components/kibo-ui/cursor";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Identicon } from "@/app/components/identicon";
import type { CollabStatus, Peer } from "@/app/lib/collab/useCollaborativeSchema";
import type { CursorStore } from "@/app/lib/collab/presence";

/**
 * Collaborators' pointers. Rendered inside the canvas transform so a peer's
 * cursor sits over the same table for everyone, then counter-scaled by
 * `--inverse-zoom` so the label stays legible at any zoom level. Reading the
 * scale from the custom property rather than a `zoom` prop is what keeps this
 * layer off the per-frame render path — see `context/transform-context`.
 *
 * Positions come from the cursor store rather than `peers`, so this is the only
 * component a remote pointer move re-renders.
 */
export const PeerCursors = memo(function PeerCursors({ peers, cursors }: { peers: Peer[]; cursors: CursorStore }) {
  const points = useSyncExternalStore(cursors.subscribe, cursors.getSnapshot, cursors.getSnapshot);
  return (
    <>
      {peers.flatMap((peer) => { const point = points.get(peer.clientId); return point ? [{ peer, point }] : []; }).map(({ peer, point }) => (
        <Cursor
          className="peer-cursor"
          key={peer.clientId}
          style={{
            transform: `translate3d(${point.x}px, ${point.y}px, 0) scale(var(--inverse-zoom, 1))`,
            color: peer.color,
          }}
        >
          <CursorPointer style={{ color: peer.color }} />
          <CursorBody className="peer-cursor-body" style={{ background: peer.color, color: "#fff" }}>
            <CursorName>{peer.user.name}</CursorName>
          </CursorBody>
        </Cursor>
      ))}
    </>
  );
});

/** Who else is in the room. Absent entirely when nobody is. */
export const PeerAvatars = memo(function PeerAvatars({ peers, status }: { peers: Peer[]; status: CollabStatus }) {
  if (status === "local" || !peers.length) return null;
  return (
    <AvatarStack animate size={26} className="peer-avatars">
      {peers.map((peer) => (
        <Avatar key={peer.clientId} title={peer.user.name} aria-label={peer.user.name} style={{ outline: `2px solid ${peer.color}` }}>
          {peer.user.image ? <AvatarImage src={peer.user.image} alt="" /> : null}
          <AvatarFallback className="overflow-hidden p-0">
            <Identicon seed={peer.user.id} className="size-full" />
          </AvatarFallback>
        </Avatar>
      ))}
    </AvatarStack>
  );
});
