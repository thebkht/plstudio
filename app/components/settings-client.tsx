"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { authClient } from "@/app/lib/auth-client";
import { Identicon } from "@/app/components/identicon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const router = useRouter();
  const [savedName, setSavedName] = useState(organizationName);
  const [draftName, setDraftName] = useState(organizationName);
  const [renaming, setRenaming] = useState(false);
  const renamable = draftName.trim() !== "" && draftName.trim() !== savedName;
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

  // Only the display name changes: the slug is the workspace's URL, and every
  // link and share already handed out would break with it.
  const rename = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!renamable) return;
    const name = draftName.trim();
    setRenaming(true);
    const result = await authClient.organization.update({ organizationId, data: { name } });
    setRenaming(false);
    if (result.error) return toast.error(result.error.message || "Could not rename this workspace.");
    setSavedName(name);
    setDraftName(name);
    toast.success(`Workspace renamed to ${name}.`);
    // The title, the switcher and the dashboard all read the name on the server.
    router.refresh();
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

  const roleLabel = (role: string) => ROLE_LABELS[role as WorkspaceRole] ?? role;

  /* System Settings, not a form: each concern is a titled section holding
     one inset grouped list, explained by a footnote beneath it. */
  return (
    <div className="settings-page">
      <section className="dashboard-section">
        <h2 className="dashboard-section-title">General</h2>
        {canManage ? (
          <form className="grouped-list" onSubmit={rename}>
            <div className="grouped-row settings-field">
              <label htmlFor="workspace-name" className="grouped-row-label">Name</label>
              <Input
                id="workspace-name"
                value={draftName}
                maxLength={64}
                disabled={renaming}
                onChange={(event) => setDraftName(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Escape") setDraftName(savedName); }}
              />
              {renamable && <Button type="submit" size="sm" isDisabled={renaming}>{renaming ? "Saving…" : "Rename"}</Button>}
            </div>
          </form>
        ) : (
          <div className="grouped-list">
            <div className="grouped-row">
              <span className="grouped-row-label">Name</span>
              <span className="grouped-row-detail settings-value">{savedName}</span>
            </div>
          </div>
        )}
        <p className="grouped-list-footer">The workspace address stays /{workspace}{canManage ? " when you rename it" : ""}.</p>
      </section>
      <section className="dashboard-section">
        <h2 className="dashboard-section-title">
          Members {members.length > 0 && <span className="dashboard-section-count">{members.length}</span>}
        </h2>
        <ul className="grouped-list">
          {members.length === 0 && (
            <li className="grouped-row grouped-row-placeholder">Loading members…</li>
          )}
          {members.map((member) => {
            const name = member.user?.name || member.user?.email || "Unknown member";
            return (
              <li key={member.id} className="grouped-row">
                <Identicon seed={member.user?.email || member.userId} className="grouped-row-icon grouped-row-avatar" />
                <span className="grouped-row-text">
                  <span className="grouped-row-title">{name}</span>
                  {member.user?.name && member.user.email && <span className="grouped-row-subtitle">{member.user.email}</span>}
                </span>
                {canChangeMemberRole(viewerRole, member.role, member.userId === viewerUserId) ? (
                  <Select
                    aria-label={`Role for ${name}`}
                    isDisabled={pendingRoleFor === member.id}
                    selectedKey={member.role}
                    onSelectionChange={(key) => void changeRole(member, key as WorkspaceRole)}
                  >
                    <SelectTrigger size="sm" className="grouped-row-popup">
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
                  <span className="grouped-row-detail">{roleLabel(member.role)}</span>
                )}
              </li>
            );
          })}
        </ul>
        <p className="grouped-list-footer">Everyone with access to diagrams in {savedName}.</p>
      </section>
      {canManage && (
        <section className="dashboard-section">
          <h2 className="dashboard-section-title">Invite</h2>
          <div className="grouped-list">
            <div className="grouped-row settings-invite">
              <Input id="invite-email" aria-label="Email address to invite" placeholder="person@example.com" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
              <Button size="sm" isDisabled={!email.trim()} onPress={invite}>Copy Link</Button>
            </div>
          </div>
          <p className="grouped-list-footer">Creates a one-time invitation and copies its link. New members join as Member.</p>
        </section>
      )}
    </div>
  );
}
