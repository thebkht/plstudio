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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { assignableRoles, canChangeMemberRole, type WorkspaceRole } from "@/app/lib/workspace";

type WorkspaceMember = { id: string; userId: string; role: string; user?: { name?: string; email?: string } };

const ROLE_LABELS: Record<WorkspaceRole, string> = { owner: "Owner", admin: "Admin", member: "Member" };

export default function SettingsClient({ workspace, organizationId, organizationName, canManage, viewerRole, viewerUserId }: { workspace: string; organizationId: string; organizationName: string; canManage: boolean; viewerRole: WorkspaceRole; viewerUserId: string }) {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [email, setEmail] = useState("");
  const [pendingRoleFor, setPendingRoleFor] = useState<string | null>(null);
  const options = assignableRoles(viewerRole);

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

  const changeRole = async (member: WorkspaceMember, role: WorkspaceRole) => {
    if (role === member.role) return;
    setPendingRoleFor(member.id);
    setMembers((current) => current.map((row) => (row.id === member.id ? { ...row, role } : row)));
    const result = await (authClient.organization as any).updateMemberRole({ memberId: member.id, role, organizationId });
    setPendingRoleFor(null);
    if (result.error) {
      // The server is the authority on who may change what, so put the old role back.
      setMembers((current) => current.map((row) => (row.id === member.id ? { ...row, role: member.role } : row)));
      toast.error(result.error.message || "Could not change that member's role.");
    } else toast.success(`${member.user?.name || member.user?.email} is now ${ROLE_LABELS[role].toLowerCase()}.`);
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
                  {canChangeMemberRole(viewerRole, member.role, member.userId === viewerUserId) ? (
                    <Select
                      className="w-36"
                      aria-label={`Role for ${member.user?.name || member.user?.email}`}
                      isDisabled={pendingRoleFor === member.id}
                      selectedKey={member.role}
                      onSelectionChange={(key) => void changeRole(member, key as WorkspaceRole)}
                    >
                      <SelectTrigger size="sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {options.map((role) => (
                            <SelectItem key={role} id={role}>{ROLE_LABELS[role]}</SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="secondary">{member.role}</Badge>
                  )}
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
