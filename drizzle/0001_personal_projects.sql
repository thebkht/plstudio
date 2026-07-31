ALTER TABLE "projects" ALTER COLUMN "organization_id" DROP NOT NULL;
CREATE INDEX IF NOT EXISTS "projects_created_by_idx" ON "projects" ("created_by");
