CREATE TABLE IF NOT EXISTS "project_share" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL UNIQUE REFERENCES "projects"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL UNIQUE,
  "permission" text DEFAULT 'editor' NOT NULL,
  "created_by" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "revoked_at" timestamptz
);
