import { deleteProject, readProject, updateProject, withProjectLock, writeVersion } from "@/db/file-store";
import { SCHEMA_FORMAT_VERSION, type Schema } from "@/app/lib/schema";
import { canDeleteProject } from "@/app/lib/workspace";
import { projectAccess as access } from "@/app/lib/project-access";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Params) { try { const { id } = await params; const { project } = await access(request, id); return Response.json(project); } catch (error) { if (error instanceof Response) return error; return Response.json({ error: error instanceof Error ? error.message : "Project storage unavailable" }, { status: 503 }); } }

export async function PUT(request: Request, { params }: Params) {
  try { const { id } = await params; const { session } = await access(request, id); const input = (await request.json()) as { schema: Schema; overwrite?: boolean }; const schema = input.schema;
    // The revision has to be re-read inside the lock: the collab server bumps it
    // from another process, so a check against the pre-lock read would race.
    return await withProjectLock(id, async () => { const project = await readProject(id); if (!project) return Response.json({ error: "Project not found" }, { status: 404 }); if (!input.overwrite && project.revision !== schema.revision) return Response.json({ error: "REVISION_CONFLICT", current: project, overwrite: true }, { status: 409 }); const nextRevision = Math.max(project.revision, schema.revision) + 1; const nextSchema = { ...schema, id, revision: nextRevision, schemaFormatVersion: SCHEMA_FORMAT_VERSION }; const saved = await updateProject(id, { name: nextSchema.name, schemaJson: nextSchema, revision: nextRevision, schemaFormatVersion: SCHEMA_FORMAT_VERSION });
      // An explicit save is a version; inside the lock, so it snapshots exactly what was written.
      if (saved) await writeVersion(saved, { createdBy: session.user.id });
      return Response.json(nextSchema); }); }
  catch (error) { if (error instanceof Response) return error; return Response.json({ error: error instanceof Error ? error.message : "Could not update project" }, { status: 400 }); }
}

export async function PATCH(request: Request, { params }: Params) {
  try { const { id } = await params; await access(request, id); const input = (await request.json()) as { name?: string; revision?: number; overwrite?: boolean }; if (!input.name?.trim() || typeof input.revision !== "number") return Response.json({ error: "name and revision are required" }, { status: 400 });
    return await withProjectLock(id, async () => { const project = await readProject(id); if (!project) return Response.json({ error: "Project not found" }, { status: 404 }); if (!input.overwrite && project.revision !== input.revision) return Response.json({ error: "REVISION_CONFLICT", current: project, overwrite: true }, { status: 409 }); const nextRevision = Math.max(project.revision, input.revision!) + 1; const nextSchema = { ...project.schemaJson, name: input.name!.trim(), revision: nextRevision, schemaFormatVersion: SCHEMA_FORMAT_VERSION }; await updateProject(id, { name: nextSchema.name, schemaJson: nextSchema, revision: nextRevision, schemaFormatVersion: SCHEMA_FORMAT_VERSION }); return Response.json(nextSchema); }); }
  catch (error) { if (error instanceof Response) return error; return Response.json({ error: error instanceof Error ? error.message : "Could not rename project" }, { status: 400 }); }
}

export async function DELETE(request: Request, { params }: Params) { try { const { id } = await params; const { role } = await access(request, id); if (!canDeleteProject(role)) return Response.json({ error: "Forbidden" }, { status: 403 }); await withProjectLock(id, () => deleteProject(id)); return new Response(null, { status: 204 }); } catch (error) { if (error instanceof Response) return error; return Response.json({ error: error instanceof Error ? error.message : "Could not delete project" }, { status: 400 }); } }
