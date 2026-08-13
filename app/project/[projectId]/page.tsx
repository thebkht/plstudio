import Designer from "@/app/components/designer";
import { requirePersonalProjectAccess } from "@/app/lib/session";
import type { Schema } from "@/app/lib/schema";

export default async function PersonalProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const { project, session } = await requirePersonalProjectAccess(projectId);
  return <main className="app-shell"><Designer initialSchema={project.schemaJson as Schema} projectId={project.id} user={{ id: session.user.id, name: session.user.name, email: session.user.email, image: session.user.image }} /></main>;
}
