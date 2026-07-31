import Designer from "@/app/components/Designer";
import { requirePersonalProjectAccess } from "@/app/lib/session";
import type { Schema } from "@/app/lib/schema";

export default async function PersonalProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const { project } = await requirePersonalProjectAccess(projectId);
  return <main className="app-shell"><Designer initialSchema={project.schemaJson as Schema} projectId={project.id} /></main>;
}
