import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { projects } from "@/db/schema";
import { makeEmptySchema, SCHEMA_FORMAT_VERSION } from "@/app/lib/schema";
import { requireWorkspace } from "@/app/lib/session";

export async function GET(request: Request) {
  try { const workspace = new URL(request.url).searchParams.get("workspace"); if (!workspace) return Response.json({ error: "workspace is required" }, { status: 400 }); const { organization } = await requireWorkspace(workspace); return Response.json(await getDb().select().from(projects).where(eq(projects.organizationId, organization.id)).orderBy(desc(projects.updatedAt))); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Database unavailable" }, { status: 503 }); }
}

export async function POST(request: Request) {
  try { const input = (await request.json()) as { workspace?: string; name?: string }; if (!input.workspace || !input.name?.trim()) return Response.json({ error: "workspace and name are required" }, { status: 400 }); const { organization, session } = await requireWorkspace(input.workspace); const starter = makeEmptySchema(input.name.trim(), crypto.randomUUID()); const row = { id: starter.id, name: starter.name, organizationId: organization.id, createdBy: session.user.id, schemaJson: starter, revision: 1, schemaFormatVersion: SCHEMA_FORMAT_VERSION }; await getDb().insert(projects).values(row); return Response.json(starter, { status: 201 }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Could not create project" }, { status: 400 }); }
}
