import { createProjectIndex } from "@/db/file-store";
import { schemaPreview } from "@/app/lib/schema-preview";

/**
 * What a dashboard card shows of a project: its thumbnail geometry and how many
 * tables it has. Derived once per saved version of the project (see
 * `createProjectIndex`), so opening a dashboard does not re-parse every diagram
 * on it.
 */
export const listProjectSummaries = createProjectIndex((project) => ({
  tables: project.schemaJson.tables?.length ?? 0,
  preview: schemaPreview(project.schemaJson),
}));
