"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Logout01Icon, UserCircleIcon } from "@hugeicons/core-free-icons";
import { authClient } from "@/app/lib/auth-client";
import { avatarGradient } from "@/app/lib/avatar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type NavUserAccount = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

/**
 * The account dropdown shared by the editor app bar and the dashboard topbar.
 * Anonymous users have a name but no email, so the label degrades to one line.
 *
 * `isOpen`/`onOpenChange` are optional: the designer tracks them so its
 * keyboard shortcuts stand down while the menu owns the keyboard.
 */
export default function NavUser({
  user,
  isOpen,
  onOpenChange,
}: {
  user?: NavUserAccount | null;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const [uncontrolled, setUncontrolled] = useState(false);
  const name = user?.name?.trim() || "Guest";
  const initials = initialsOf(user?.name);
  const seededFace = avatarGradient(user?.email || user?.name);
  return (
    <DropdownMenuTrigger
      isOpen={isOpen ?? uncontrolled}
      onOpenChange={onOpenChange ?? setUncontrolled}
    >
      <Button variant="ghost" size="icon" aria-label="Account menu">
        <Avatar size="sm">
          {user?.image && <AvatarImage src={user.image} alt={name} />}
          <AvatarFallback style={seededFace}>
            {initials || <HugeiconsIcon icon={UserCircleIcon} />}
          </AvatarFallback>
        </Avatar>
      </Button>
      <DropdownMenu placement="bottom end" className="w-auto min-w-56">
        <DropdownMenuLabel className="nav-user-label">
          <Avatar size="sm">
            {user?.image && <AvatarImage src={user.image} alt={name} />}
            <AvatarFallback style={seededFace}>
              {initials || <HugeiconsIcon icon={UserCircleIcon} />}
            </AvatarFallback>
          </Avatar>
          <span className="nav-user-identity">
            <span className="nav-user-name">{name}</span>
            {user?.email && (
              <span className="nav-user-email">{user.email}</span>
            )}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            onAction={() =>
              void authClient.signOut().then(() => router.push("/login"))
            }
          >
            <HugeiconsIcon icon={Logout01Icon} />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenu>
    </DropdownMenuTrigger>
  );
}

const initialsOf = (name?: string | null) =>
  (name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
