import Link from "next/link";
import { listProjects } from "@/db/file-store";
import { listUserWorkspaces, requireWorkspace } from "@/app/lib/session";
import NewProjectButton from "@/app/components/new-project-button";
import ProjectCard from "@/app/components/project-card";
import WorkspaceTopbar from "@/app/components/workspace-topbar";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

export default async function WorkspacePage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;
  const { organization, session } = await requireWorkspace(workspace);
  const [rows, workspaces] = await Promise.all([listProjects({ organizationId: organization.id }), listUserWorkspaces(session.user.id)]);
  return (
    <main className="dashboard-shell">
      <WorkspaceTopbar
        workspaces={workspaces}
        current={workspace}
        links={[
          { href: `/${workspace}`, label: "Projects" },
          { href: "/templates", label: "Templates" },
          { href: `/${workspace}/settings`, label: "Settings" },
        ]}
        account={{ href: `/${workspace}/settings`, label: `${organization.name} · workspace` }}
      />
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Your workspace</p>
          <h1>{organization.name}</h1>
        </div>
        <div className="dashboard-actions">
          <Link data-slot="button" className={buttonVariants({ variant: "outline" })} href="/editor">Personal diagram</Link>
          <Link data-slot="button" className={buttonVariants({ variant: "outline" })} href="/templates">Browse templates</Link>
          <NewProjectButton workspace={workspace} />
        </div>
      </header>
      {rows.length ? (
        <section className="project-grid">
          {rows.map((project) => {
            const schema = project.schemaJson as { tables?: unknown[] };
            return <ProjectCard key={project.id} projectId={project.id} href={`/${workspace}/${project.id}`} name={project.name} tableCount={schema.tables?.length || 0} updatedAt={project.updatedAt.toLocaleDateString()} workspace={workspace} />;
          })}
        </section>
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Start from a template</EmptyTitle>
            <EmptyDescription>
              Build your first Oracle diagram from a ready-made foundation.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Link data-slot="button" className={buttonVariants()} href="/templates">Browse templates</Link>
          </EmptyContent>
        </Empty>
      )}
    </main>
  );
}
