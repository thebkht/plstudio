import Link from "next/link";
import { auth } from "@/app/lib/auth";
import { listProjects } from "@/db/file-store";
import { listUserWorkspaces } from "@/app/lib/session";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import PendingInvitations from "@/app/components/pending-invitations";
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

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const [workspaces, personalProjects] = await Promise.all([
    listUserWorkspaces(session.user.id),
    listProjects({ createdBy: session.user.id, personalOnly: true }),
  ]);
  return (
    <main className="dashboard-shell">
      <WorkspaceTopbar
        workspaces={workspaces}
        current={null}
        links={[
          { href: "/", label: "Personal projects", current: true },
          { href: "/templates", label: "Templates" },
        ]}
        user={{ name: session.user.name, email: session.user.email, image: session.user.image }}
      />
      <header className="dashboard-header">
        <div>
          {/* No eyebrow here: the switcher two rows up already says which space
              this is, and repeating it makes the label read as decoration. */}
          <h1>Your projects</h1>
        </div>
        <div className="dashboard-actions">
          <Link data-slot="button" className={buttonVariants()} href="/editor">New diagram</Link>
          <Link data-slot="button" className={buttonVariants({ variant: "outline" })} href="/onboarding">New workspace</Link>
        </div>
      </header>
      <PendingInvitations />
      {workspaces.length > 0 && (
        <section className="workspace-list">
          <h2 className="eyebrow">Your workspaces</h2>
          <ul>
            {workspaces.map((workspace) => (
              <li key={workspace.id}>
                <Link href={`/${workspace.slug}`}>
                  <span>{workspace.name}</span>
                  <span className="workspace-list-role">{workspace.role}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {personalProjects.length ? (
        <section className="project-grid">
          {personalProjects.map((project) => {
            const schema = project.schemaJson;
            /* No author here: every project in the personal space is yours, so
               the name would be the same string on every card. */
            return <ProjectCard key={project.id} projectId={project.id} href={`/project/${project.id}`} name={project.name} tableCount={schema.tables?.length || 0} updatedAt={formatTimestamp(project.updatedAt)} updatedLabel={formatRelative(project.updatedAt)} preview={<SchemaPreview schema={schema} />} />;
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
