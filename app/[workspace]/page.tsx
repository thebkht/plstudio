import Link from "next/link";
import { listProjects } from "@/db/file-store";
import { listUserWorkspaces, lookupUserNames, requireWorkspace } from "@/app/lib/session";
import NewProjectButton from "@/app/components/new-project-button";
import ProjectCard from "@/app/components/project-card";
import SchemaPreview from "@/app/components/schema-preview";
import WorkspaceTopbar from "@/app/components/workspace-topbar";
import { formatRelative, formatTimestamp } from "@/app/lib/format";
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
  // A workspace's projects come from several members, so the authors are looked up in one batch.
  const authors = await lookupUserNames(rows.map((project) => project.createdBy ?? ""));
  return (
    <main className="dashboard-shell">
      <WorkspaceTopbar
        workspaces={workspaces}
        current={workspace}
        links={[
          { href: `/${workspace}`, label: "Projects", current: true },
          { href: "/templates", label: "Templates" },
          { href: `/${workspace}/settings`, label: "Settings" },
        ]}
        user={{ name: session.user.name, email: session.user.email, image: session.user.image }}
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
            const schema = project.schemaJson;
            return <ProjectCard key={project.id} projectId={project.id} href={`/${workspace}/${project.id}`} name={project.name} tableCount={schema.tables?.length || 0} updatedAt={formatTimestamp(project.updatedAt)} updatedLabel={formatRelative(project.updatedAt)} author={project.createdBy ? authors.get(project.createdBy) : undefined} workspace={workspace} preview={<SchemaPreview schema={schema} />} />;
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
