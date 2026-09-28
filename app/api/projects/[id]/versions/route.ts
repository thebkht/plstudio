import { listVersions, readProject, withProjectLock, writeVersion } from "@/db/file-store";
import { projectAccess } from "@/app/lib/project-access";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** The project's saved versions, newest first: metadata only. */
export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    await projectAccess(request, id);
    return Response.json({ versions: await listVersions(id) });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error: error instanceof Error ? error.message : "Version history unavailable" }, { status: 503 });
  }
}

/**
 * Snapshot the project as stored, optionally named. With collaboration on, the
 * schema reaches the file through the collab server rather than `PUT`, so this
 * is how a save becomes a version there -- and how any version gets a name.
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { session } = await projectAccess(request, id);
    const input = (await request.json().catch(() => ({}))) as { label?: unknown };
    if (input.label !== undefined && typeof input.label !== "string") return Response.json({ error: "label must be a string" }, { status: 400 });
    return await withProjectLock(id, async () => {
      const project = await readProject(id);
      if (!project) return Response.json({ error: "Project not found" }, { status: 404 });
      return Response.json(await writeVersion(project, { label: input.label as string | undefined, createdBy: session.user.id }));
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error: error instanceof Error ? error.message : "Could not save a version" }, { status: 400 });
  }
}
