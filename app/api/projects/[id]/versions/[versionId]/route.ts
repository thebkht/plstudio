import { readVersion, updateVersionLabel, withProjectLock } from "@/db/file-store";
import { projectAccess } from "@/app/lib/project-access";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; versionId: string }> };

/** Only ids `writeVersion` mints, so nothing else can be spliced into a path. */
const VERSION_ID = /^\d{8}-[0-9a-z]+$/;

/** One version, schema included. */
export async function GET(request: Request, { params }: Params) {
  try {
    const { id, versionId } = await params;
    await projectAccess(request, id);
    const version = VERSION_ID.test(versionId) ? await readVersion(id, versionId) : null;
    return version ? Response.json(version) : Response.json({ error: "Version not found" }, { status: 404 });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error: error instanceof Error ? error.message : "Version history unavailable" }, { status: 503 });
  }
}

/** Name a version, or clear its name with an empty label. */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id, versionId } = await params;
    await projectAccess(request, id);
    const input = (await request.json()) as { label?: unknown };
    if (typeof input.label !== "string") return Response.json({ error: "label is required" }, { status: 400 });
    if (!VERSION_ID.test(versionId)) return Response.json({ error: "Version not found" }, { status: 404 });
    const meta = await withProjectLock(id, () => updateVersionLabel(id, versionId, input.label as string));
    return meta ? Response.json(meta) : Response.json({ error: "Version not found" }, { status: 404 });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error: error instanceof Error ? error.message : "Could not rename the version" }, { status: 400 });
  }
}
