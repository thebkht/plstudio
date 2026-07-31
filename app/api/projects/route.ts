import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { projects } from "@/db/schema";
import { SCHEMA_FORMAT_VERSION, type Schema } from "@/app/lib/schema";

export async function GET() {
  try {
    const rows = await getDb().select().from(projects).orderBy(projects.updatedAt);
    return Response.json(rows);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Database unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as { schema: Schema };
    const schema = input.schema;
    const row = { id: schema.id, name: schema.name, schemaJson: schema, revision: schema.revision, schemaFormatVersion: SCHEMA_FORMAT_VERSION };
    await getDb().insert(projects).values(row);
    return Response.json(schema, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not save project" }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  try {
    const input = (await request.json()) as { schema: Schema; overwrite?: boolean };
    const schema = input.schema;
    const db = getDb();
    const current = await db.select().from(projects).where(eq(projects.id, schema.id));
    if (!current[0]) return Response.json({ error: "Project not found" }, { status: 404 });
    if (!input.overwrite && current[0].revision !== schema.revision) return Response.json({ error: "REVISION_CONFLICT", current: current[0] }, { status: 409 });
    const nextRevision = Math.max(current[0].revision, schema.revision) + 1;
    const nextSchema = { ...schema, revision: nextRevision, schemaFormatVersion: SCHEMA_FORMAT_VERSION };
    await db.update(projects).set({ name: nextSchema.name, schemaJson: nextSchema, revision: nextRevision, updatedAt: new Date() }).where(eq(projects.id, schema.id));
    return Response.json(nextSchema);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not update project" }, { status: 400 });
  }
}
