import Link from "next/link";
import { eq } from "drizzle-orm";
import { auth } from "@/app/lib/auth";
import { getDb } from "@/db";
import { listProjects } from "@/db/file-store";
import { member, organization } from "@/db/schema";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
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

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const [workspace, personalProjects] = await Promise.all([
    getDb().select({ slug: organization.slug, name: organization.name }).from(member).innerJoin(organization, eq(member.organizationId, organization.id)).where(eq(member.userId, session.user.id)).limit(1),
    listProjects({ createdBy: session.user.id, personalOnly: true }),
  ]);
  const workspaceRow = workspace[0];
  return (
    <main className="dashboard-shell">
      <WorkspaceTopbar
        links={[
          { href: "/", label: "Personal projects" },
          ...(workspaceRow ? [{ href: `/${workspaceRow.slug}`, label: "Workspace" }] : []),
          { href: "/templates", label: "Templates" },
        ]}
        account={{
          href: workspaceRow ? `/${workspaceRow.slug}/settings` : "/onboarding",
          label: workspaceRow ? workspaceRow.name : "Create a workspace",
        }}
      />
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Personal space</p>
          <h1>Your projects</h1>
        </div>
        <div className="dashboard-actions">
          <Link data-slot="button" className={buttonVariants()} href="/editor">New diagram</Link>
          {workspaceRow && <Link data-slot="button" className={buttonVariants({ variant: "outline" })} href={`/${workspaceRow.slug}`}>Open workspace</Link>}
        </div>
      </header>
      {personalProjects.length ? (
        <section className="project-grid">
          {personalProjects.map((project) => {
            const schema = project.schemaJson as { tables?: unknown[] };
            return <ProjectCard key={project.id} projectId={project.id} href={`/project/${project.id}`} name={project.name} tableCount={schema.tables?.length || 0} updatedAt={project.updatedAt.toLocaleDateString()} />;
          })}
        </section>
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Draw your first diagram</EmptyTitle>
            <EmptyDescription>
              Start modeling tables and relationships without creating a workspace.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Link data-slot="button" className={buttonVariants()} href="/editor">Open a blank editor</Link>
          </EmptyContent>
        </Empty>
      )}
    </main>
  );
}
