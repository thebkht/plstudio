import { requireWorkspace } from "@/app/lib/session";
import { canManageMembers } from "@/app/lib/workspace";
import SettingsClient from "@/app/components/settings-client";
import WorkspaceTopbar from "@/app/components/workspace-topbar";

export default async function SettingsPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;
  const { organization, role, session } = await requireWorkspace(workspace);
  return (
    <main className="dashboard-shell">
      <WorkspaceTopbar
        links={[
          { href: `/${workspace}`, label: "Projects" },
          { href: "/templates", label: "Templates" },
        ]}
        account={{ href: `/${workspace}`, label: "Back to workspace" }}
      />
      <div className="dashboard-header settings-page-heading">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1>Settings</h1>
        </div>
      </div>
      <SettingsClient workspace={workspace} organizationId={organization.id} organizationName={organization.name} canManage={canManageMembers(role)} viewerRole={role} viewerUserId={session.user.id} />
    </main>
  );
}
