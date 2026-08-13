import Designer from "@/app/components/designer";
import { requireProjectAccess } from "@/app/lib/session";
import type { Schema } from "@/app/lib/schema";
export default async function ProjectPage({ params }: { params: Promise<{ workspace: string; projectId: string }> }) { const { workspace, projectId } = await params; const { project, organization, session } = await requireProjectAccess(workspace, projectId); return <main className="app-shell"><Designer initialSchema={project.schemaJson as Schema} projectId={project.id} workspaceSlug={workspace} workspaceId={organization.id} user={{ id: session.user.id, name: session.user.name, email: session.user.email, image: session.user.image }} /></main>; }
