import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { projects } from "@/db/schema";
import { SCHEMA_FORMAT_VERSION, type Schema } from "@/app/lib/schema";
import { canDeleteProject } from "@/app/lib/workspace";
import { requireProjectAccess } from "@/app/lib/session";

type Params = { params: Promise<{ id: string }> };
async function access(request: Request, id: string) { const url = new URL(request.url); const workspace = url.searchParams.get("workspace"); if (!workspace) throw new Response(JSON.stringify({ error: "workspace is required" }), { status: 400 }); return requireProjectAccess(workspace, id); }
export async function GET(request: Request, { params }: Params) { try { const { id } = await params; const { project } = await access(request, id); return Response.json(project); } catch (error) { if (error instanceof Response) return error; return Response.json({ error: error instanceof Error ? error.message : "Database unavailable" }, { status: 503 }); } }

export async function PUT(request: Request, { params }: Params) {
  try { const { id } = await params; const { project } = await access(request, id); const input = (await request.json()) as { schema: Schema; overwrite?: boolean }; const schema = input.schema; if (!input.overwrite && project.revision !== schema.revision) return Response.json({ error: "REVISION_CONFLICT", current: project, overwrite: true }, { status: 409 }); const nextRevision = Math.max(project.revision, schema.revision) + 1; const nextSchema = { ...schema, id, revision: nextRevision, schemaFormatVersion: SCHEMA_FORMAT_VERSION }; await getDb().update(projects).set({ name: nextSchema.name, schemaJson: nextSchema, revision: nextRevision, updatedAt: new Date() }).where(eq(projects.id, id)); return Response.json(nextSchema); }
  catch (error) { if (error instanceof Response) return error; return Response.json({ error: error instanceof Error ? error.message : "Could not update project" }, { status: 400 }); }
}

export async function PATCH(request: Request, { params }: Params) {
  try { const { id } = await params; const { project } = await access(request, id); const input = (await request.json()) as { name?: string; revision?: number; overwrite?: boolean }; if (!input.name?.trim() || typeof input.revision !== "number") return Response.json({ error: "name and revision are required" }, { status: 400 }); if (!input.overwrite && project.revision !== input.revision) return Response.json({ error: "REVISION_CONFLICT", current: project, overwrite: true }, { status: 409 }); const nextRevision = Math.max(project.revision, input.revision) + 1; const nextSchema = { ...(project.schemaJson as Schema), name: input.name.trim(), revision: nextRevision, schemaFormatVersion: SCHEMA_FORMAT_VERSION }; await getDb().update(projects).set({ name: nextSchema.name, schemaJson: nextSchema, revision: nextRevision, updatedAt: new Date() }).where(eq(projects.id, id)); return Response.json(nextSchema); }
  catch (error) { if (error instanceof Response) return error; return Response.json({ error: error instanceof Error ? error.message : "Could not rename project" }, { status: 400 }); }
}

export async function DELETE(request: Request, { params }: Params) { try { const { id } = await params; const { role } = await access(request, id); if (!canDeleteProject(role)) return Response.json({ error: "Forbidden" }, { status: 403 }); await getDb().delete(projects).where(eq(projects.id, id)); return new Response(null, { status: 204 }); } catch (error) { if (error instanceof Response) return error; return Response.json({ error: error instanceof Error ? error.message : "Could not delete project" }, { status: 400 }); } }
