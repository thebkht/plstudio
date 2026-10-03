"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, UserIcon } from "lucide-react";
import { toast } from "sonner";
import { Identicon } from "@/app/components/identicon";
import { authClient } from "@/app/lib/auth-client";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SwitchableWorkspace = { id?: string; slug: string; name: string };

const PERSONAL = "__personal";
const CREATE = "__create";

/**
 * Moves between the personal space and every workspace the user belongs to.
 * Switching also moves the session's active organization: invitations and member
 * lists are resolved against it, so leaving it pointing at the previous
 * workspace would make those screens disagree with the one on display.
 */
export default function WorkspaceSwitcher({ workspaces, current }: { workspaces: SwitchableWorkspace[]; current?: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const go = async (key: string) => {
    if (key === CREATE) return router.push("/onboarding");
    if (key === (current ?? PERSONAL)) return;
    setBusy(true);
    const result = await authClient.organization.setActive(key === PERSONAL ? { organizationId: null } : { organizationSlug: key });
    setBusy(false);
    if (result?.error) return toast.error(result.error.message || "Could not switch workspace.");
    router.push(key === PERSONAL ? "/" : `/${key}`);
  };

  return (
    <Select
      className="min-w-44"
      aria-label="Switch workspace"
      isDisabled={busy}
      selectedKey={current ?? PERSONAL}
      onSelectionChange={(key) => void go(String(key))}
    >
      <SelectTrigger size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {/* Each space carries the mark it has everywhere else -- the same
              identicon as its dashboard row -- so the menu and the trigger
              both say which one you are in at a glance. */}
          <SelectItem id={PERSONAL} textValue="Personal space">
            <span className="switcher-icon switcher-icon-personal"><UserIcon /></span>
            Personal space
          </SelectItem>
          {workspaces.map((workspace) => (
            <SelectItem key={workspace.slug} id={workspace.slug} textValue={workspace.name}>
              <Identicon seed={workspace.id ?? workspace.slug} className="switcher-icon" />
              {workspace.name}
            </SelectItem>
          ))}
          <SelectSeparator />
          <SelectItem id={CREATE} textValue="New Workspace">
            <span className="switcher-icon switcher-icon-plain"><PlusIcon /></span>
            New Workspace…
          </SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
