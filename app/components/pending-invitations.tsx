"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { authClient } from "@/app/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";

type UserInvitation = { id: string; status: string; organizationName?: string; organizationSlug?: string };

/**
 * Invitations addressed to the signed-in user. Without this the only way to join
 * a second workspace is the /invite/<id> link the inviter copied by hand, which
 * is easy to lose — the membership itself was never the limitation.
 */
export default function PendingInvitations() {
  const router = useRouter();
  const [invitations, setInvitations] = useState<UserInvitation[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const result = await (authClient.organization as any).listUserInvitations();
      // A signed-out or errored read is not worth a toast here; the section just
      // stays hidden.
      setInvitations((result.data || []).filter((invitation: UserInvitation) => invitation.status === "pending"));
    })();
  }, []);

  const respond = async (invitation: UserInvitation, accept: boolean) => {
    setBusy(invitation.id);
    const organization = authClient.organization as any;
    const result = accept
      ? await organization.acceptInvitation({ invitationId: invitation.id })
      : await organization.rejectInvitation({ invitationId: invitation.id });
    setBusy(null);
    if (result.error) return toast.error(result.error.message || "Could not respond to the invitation.");
    setInvitations((current) => current.filter((row) => row.id !== invitation.id));
    if (!accept) return toast.success("Invitation declined.");
    const slug = invitation.organizationSlug || result.data?.organization?.slug;
    if (slug) {
      await authClient.organization.setActive({ organizationSlug: slug });
      router.push(`/${slug}`);
    } else router.refresh();
  };

  if (!invitations.length) return null;
  return (
    <section className="workspace-list">
      <h2 className="eyebrow">Pending invitations</h2>
      <ItemGroup>
        {invitations.map((invitation) => (
          <Item key={invitation.id} variant="outline">
            <ItemContent>
              <ItemTitle>{invitation.organizationName || "A workspace"}</ItemTitle>
              <ItemDescription>You have been invited to join this workspace.</ItemDescription>
            </ItemContent>
            <ItemActions>
              <Button size="sm" isDisabled={busy === invitation.id} onPress={() => void respond(invitation, true)}>Join</Button>
              <Button size="sm" variant="outline" isDisabled={busy === invitation.id} onPress={() => void respond(invitation, false)}>Decline</Button>
            </ItemActions>
          </Item>
        ))}
      </ItemGroup>
    </section>
  );
}
