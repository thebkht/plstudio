import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { projects } from "@/db/schema";
import { requireWorkspace } from "@/app/lib/session";
import NewProjectButton from "@/app/components/NewProjectButton";
import ProjectCard from "@/app/components/ProjectCard";
import WorkspaceTopbar from "@/app/components/WorkspaceTopbar";
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
  const { organization } = await requireWorkspace(workspace);
  const rows = await getDb().select().from(projects).where(eq(projects.organizationId, organization.id)).orderBy(desc(projects.updatedAt));
  return (
    <main className="dashboard-shell">
      <WorkspaceTopbar
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
          <Link className={buttonVariants({ variant: "outline" })} href="/editor">Personal diagram</Link>
          <Link className={buttonVariants({ variant: "outline" })} href="/templates">Browse templates</Link>
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
            <Link className={buttonVariants()} href="/templates">Browse templates</Link>
          </EmptyContent>
        </Empty>
      )}
    </main>
  );
}
