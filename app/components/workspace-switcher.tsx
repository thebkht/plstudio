"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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

export type SwitchableWorkspace = { slug: string; name: string };

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
          <SelectItem id={PERSONAL}>Personal space</SelectItem>
          {workspaces.map((workspace) => (
            <SelectItem key={workspace.slug} id={workspace.slug}>{workspace.name}</SelectItem>
          ))}
          <SelectSeparator />
          <SelectItem id={CREATE}>New workspace…</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
