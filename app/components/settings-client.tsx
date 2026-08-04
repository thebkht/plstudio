"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/app/lib/auth-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";

type WorkspaceMember = { id: string; role: string; user?: { name?: string; email?: string } };

export default function SettingsClient({ workspace, organizationId, organizationName, canManage }: { workspace: string; organizationId: string; organizationName: string; canManage: boolean }) {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [email, setEmail] = useState("");

  useEffect(() => {
    void (async () => {
      await authClient.organization.setActive({ organizationSlug: workspace });
      const result = await (authClient.organization as any).listMembers({ query: { organizationSlug: workspace } });
      setMembers(result.data?.members || []);
      if (result.error) toast.error(result.error.message || "Could not load workspace members.");
    })();
  }, [workspace]);

  const invite = async () => {
    const result = await (authClient.organization as any).inviteMember({ organizationId, email: email.trim(), role: "member" });
    if (result.data?.id) {
      const url = `${window.location.origin}/invite/${result.data.id}`;
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Invitation link copied.");
      } catch {
        // Clipboard is unavailable outside a secure context, so show the link to copy by hand.
        toast.info(url, { duration: Infinity });
      }
    } else toast.error(result.error?.message || "Could not create invitation.");
  };

  return (
    <Card className="settings-card">
      <CardHeader>
        <CardTitle>{organizationName} members</CardTitle>
        <CardDescription>Everyone with access to this workspace.</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <ItemGroup>
            {members.map((member) => (
              <Item key={member.id} variant="outline">
                <ItemContent>
                  <ItemTitle>{member.user?.name || member.user?.email}</ItemTitle>
                </ItemContent>
                <ItemActions>
                  <Badge variant="secondary">{member.role}</Badge>
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
          {canManage && (
            <Field>
              <FieldLabel htmlFor="invite-email">Invite a member</FieldLabel>
              <div className="flex gap-2">
                <Input id="invite-email" placeholder="person@example.com" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
                <Button isDisabled={!email.trim()} onPress={invite}>Copy invitation link</Button>
              </div>
            </Field>
          )}
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
