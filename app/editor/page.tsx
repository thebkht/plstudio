import { redirect } from "next/navigation";
import { createProject } from "@/db/file-store";
import { makeEmptySchema, SCHEMA_FORMAT_VERSION } from "@/app/lib/schema";
import { requireSession } from "@/app/lib/session";

export default async function NewEditorPage() {
  const session = await requireSession();
  const starter = makeEmptySchema("Untitled Diagram", crypto.randomUUID());
  await createProject({ id: starter.id, name: starter.name, organizationId: null, createdBy: session.user.id, schemaJson: starter, revision: 1, schemaFormatVersion: SCHEMA_FORMAT_VERSION });
  redirect(`/project/${starter.id}`);
}
