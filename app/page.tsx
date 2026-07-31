import Link from "next/link";
import { and, desc, eq, isNull } from "drizzle-orm";
import { auth } from "@/app/lib/auth";
import { getDb } from "@/db";
import { member, organization, projects } from "@/db/schema";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import BrandMark from "@/app/components/BrandMark";
export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const db = getDb();
  const [workspace, personalProjects] = await Promise.all([
    db.select({ slug: organization.slug, name: organization.name }).from(member).innerJoin(organization, eq(member.organizationId, organization.id)).where(eq(member.userId, session.user.id)).limit(1),
    db.select().from(projects).where(and(eq(projects.createdBy, session.user.id), isNull(projects.organizationId))).orderBy(desc(projects.updatedAt)),
  ]);
  const workspaceRow = workspace[0];
  return <main className="dashboard-shell"><header className="workspace-topbar"><Link href="/"><BrandMark /></Link><nav><Link href="/">Personal projects</Link>{workspaceRow && <Link href={`/${workspaceRow.slug}`}>Workspace</Link>}<Link href="/templates">Templates</Link></nav><Link className="account-link" href={workspaceRow ? `/${workspaceRow.slug}/settings` : "/onboarding"}>{workspaceRow ? workspaceRow.name : "Create a workspace"}</Link></header><header className="dashboard-header"><div><p className="eyebrow">Personal space</p><h1>Your projects</h1></div><div className="dashboard-actions"><Link href="/editor">New diagram</Link>{workspaceRow && <Link href={`/${workspaceRow.slug}`}>Open workspace</Link>}</div></header><section className="project-grid">{personalProjects.map((project) => { const schema = project.schemaJson as { tables?: unknown[] }; return <Link className="project-card" key={project.id} href={`/project/${project.id}`}><h2>{project.name}</h2><p>{schema.tables?.length || 0} tables</p><small>Updated {project.updatedAt.toLocaleDateString()}</small></Link>; })}{!personalProjects.length && <Link className="project-card project-empty-card" href="/editor"><h2>Draw your first diagram</h2><p>Start modeling tables and relationships without creating a workspace.</p><small>Open a blank editor →</small></Link>}</section></main>;
}
