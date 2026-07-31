import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { projects } from "@/db/schema";
import { requireWorkspace } from "@/app/lib/session";
import { Button } from "@/components/ui/button";
import NewProjectButton from "@/app/components/NewProjectButton";
export default async function WorkspacePage({ params }: { params: Promise<{ workspace: string }> }) { const { workspace } = await params; const { organization } = await requireWorkspace(workspace); const rows = await getDb().select().from(projects).where(eq(projects.organizationId, organization.id)).orderBy(desc(projects.updatedAt)); return <main className="dashboard-shell"><header className="dashboard-header"><div><p className="eyebrow">Workspace</p><h1>{organization.name}</h1></div><div className="dashboard-actions"><Link href={`/${workspace}/settings`}>Settings</Link><NewProjectButton workspace={workspace} /></div></header><section className="project-grid">{rows.map((project) => { const schema = project.schemaJson as { tables?: unknown[] }; return <Link className="project-card" key={project.id} href={`/${workspace}/${project.id}`}><h2>{project.name}</h2><p>{schema.tables?.length || 0} tables</p><small>Updated {project.updatedAt.toLocaleDateString()}</small></Link>; })}</section></main>; }
