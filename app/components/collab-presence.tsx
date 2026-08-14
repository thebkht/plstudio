"use client";

import { memo } from "react";
import { AvatarStack } from "@/components/kibo-ui/avatar-stack";
import { Cursor, CursorBody, CursorName, CursorPointer } from "@/components/kibo-ui/cursor";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { avatarGradient } from "@/app/lib/avatar";
import type { CollabStatus, Peer } from "@/app/lib/collab/useCollaborativeSchema";

const initials = (name: string) => name.trim().slice(0, 2).toUpperCase() || "?";

/**
 * Collaborators' pointers. Rendered inside the canvas transform so a peer's
 * cursor sits over the same table for everyone, then counter-scaled by `1/zoom`
 * so the label stays legible at any zoom level.
 */
export const PeerCursors = memo(function PeerCursors({ peers, zoom }: { peers: Peer[]; zoom: number }) {
  return (
    <>
      {peers.filter((peer) => peer.cursor).map((peer) => (
        <Cursor
          className="peer-cursor"
          key={peer.clientId}
          style={{
            transform: `translate3d(${peer.cursor!.x}px, ${peer.cursor!.y}px, 0) scale(${1 / zoom})`,
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
          <AvatarFallback style={avatarGradient(peer.user.id)}>{initials(peer.user.name)}</AvatarFallback>
        </Avatar>
      ))}
    </AvatarStack>
  );
});
