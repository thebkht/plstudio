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
import { Identicon } from "@/app/components/identicon";
import { buttonVariants } from "@/components/ui/button-variants";
import { ChevronRightIcon } from "lucide-react";
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
        <section className="dashboard-section workspace-list">
          <h2 className="dashboard-section-title">Workspaces</h2>
          <ul>
            {workspaces.map((workspace) => (
              <li key={workspace.id}>
                <Link href={`/${workspace.slug}`}>
                  <Identicon seed={workspace.id} className="workspace-list-icon" />
                  <span className="workspace-list-text">
                    <span className="workspace-list-name">{workspace.name}</span>
                    <span className="workspace-list-role">{workspace.role}</span>
                  </span>
                  {/* A tile that navigates says so, the way a disclosure row does. */}
                  <ChevronRightIcon className="workspace-list-chevron" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {personalProjects.length ? (
        <section className="dashboard-section">
          {/* The h1 covers everything on the page, workspaces included, so the
              grid gets its own name rather than sitting unlabelled under theirs. */}
          <h2 className="dashboard-section-title">
            Personal diagrams <span className="dashboard-section-count">{personalProjects.length}</span>
          </h2>
          <div className="project-grid">
            {personalProjects.map((project) => {
              const schema = project.schemaJson;
              /* No author here: every project in the personal space is yours, so
                 the name would be the same string on every card. */
              return <ProjectCard key={project.id} projectId={project.id} href={`/project/${project.id}`} name={project.name} tableCount={schema.tables?.length || 0} updatedAt={formatTimestamp(project.updatedAt)} updatedLabel={formatRelative(project.updatedAt)} preview={<SchemaPreview schema={schema} />} />;
            })}
          </div>
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
