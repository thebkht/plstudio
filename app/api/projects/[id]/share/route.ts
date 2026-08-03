import { touchProject } from "@/db/file-store";
import { createProjectShare, revokeProjectShare } from "@/app/lib/project-share";
import { requirePersonalProjectAccess, requireProjectAccess } from "@/app/lib/session";
import { canManageProjectShare } from "@/app/lib/workspace";

type Params = { params: Promise<{ id: string }> };

async function access(request: Request, id: string) {
  const workspace = new URL(request.url).searchParams.get("workspace");
  return workspace ? requireProjectAccess(workspace, id) : requirePersonalProjectAccess(id);
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { project, session, role } = await access(request, id);
    if (!canManageProjectShare(session.user.id, project.createdBy, role)) return Response.json({ error: "Only project owners can manage share links." }, { status: 403 });
    const token = await createProjectShare(id, session.user.id);
    return Response.json({ url: `${new URL(request.url).origin}/share/project/${token}` });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error: error instanceof Error ? error.message : "Could not create project link" }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { project, session, role } = await access(request, id);
    if (!canManageProjectShare(session.user.id, project.createdBy, role)) return Response.json({ error: "Only project owners can manage share links." }, { status: 403 });
    await revokeProjectShare(id);
    await touchProject(id);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error: error instanceof Error ? error.message : "Could not revoke project link" }, { status: 400 });
  }
}
