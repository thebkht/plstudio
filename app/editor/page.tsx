import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { projects } from "@/db/schema";
import { makeEmptySchema, SCHEMA_FORMAT_VERSION } from "@/app/lib/schema";
import { requireSession } from "@/app/lib/session";

export default async function NewEditorPage() {
  const session = await requireSession();
  const starter = makeEmptySchema("Untitled Diagram", crypto.randomUUID());
  await getDb().insert(projects).values({ id: starter.id, name: starter.name, organizationId: null, createdBy: session.user.id, schemaJson: starter, revision: 1, schemaFormatVersion: SCHEMA_FORMAT_VERSION });
  redirect(`/project/${starter.id}`);
}
