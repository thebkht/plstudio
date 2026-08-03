/**
 * One-off import of an existing Neon database into the on-disk store.
 *
 *   DATABASE_URL=postgres://… pnpm tsx scripts/migrate-from-neon.ts [--force]
 *
 * Auth rows go into <DATA_DIR>/auth.db (run `pnpm drizzle-kit push` first); the
 * three project tables become JSON files. Idempotent: existing rows and files are
 * skipped unless --force is passed. Reads only — the Postgres database is left
 * untouched, so this can be re-run and verified before anything is dropped.
 */
import { Client } from "pg";
import { getDb } from "@/db";
import { createProject, deleteProject, putShare, readProject, writeYDoc } from "@/db/file-store";
import * as schema from "@/db/schema";
import type { Schema } from "@/app/lib/schema";

const force = process.argv.includes("--force");
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required — point it at the Neon database being retired.");

const pg = new Client({ connectionString: url });
const db = getDb();

// Ordered by dependency: a member row needs its user and organization to exist.
const AUTH_TABLES = [
  ["user", schema.user, (r: Record<string, unknown>) => ({ id: r.id, name: r.name, email: r.email, emailVerified: r.email_verified, image: r.image, isAnonymous: r.is_anonymous, createdAt: r.created_at, updatedAt: r.updated_at })],
  ["organization", schema.organization, (r: Record<string, unknown>) => ({ id: r.id, name: r.name, slug: r.slug, logo: r.logo, metadata: r.metadata, createdAt: r.created_at })],
  ["account", schema.account, (r: Record<string, unknown>) => ({ id: r.id, accountId: r.account_id, providerId: r.provider_id, userId: r.user_id, accessToken: r.access_token, refreshToken: r.refresh_token, idToken: r.id_token, accessTokenExpiresAt: r.access_token_expires_at, refreshTokenExpiresAt: r.refresh_token_expires_at, scope: r.scope, password: r.password, createdAt: r.created_at, updatedAt: r.updated_at })],
  ["session", schema.session, (r: Record<string, unknown>) => ({ id: r.id, expiresAt: r.expires_at, token: r.token, createdAt: r.created_at, updatedAt: r.updated_at, ipAddress: r.ip_address, userAgent: r.user_agent, userId: r.user_id })],
  ["verification", schema.verification, (r: Record<string, unknown>) => ({ id: r.id, identifier: r.identifier, value: r.value, expiresAt: r.expires_at, createdAt: r.created_at, updatedAt: r.updated_at })],
  ["member", schema.member, (r: Record<string, unknown>) => ({ id: r.id, organizationId: r.organization_id, userId: r.user_id, role: r.role, createdAt: r.created_at })],
  ["invitation", schema.invitation, (r: Record<string, unknown>) => ({ id: r.id, organizationId: r.organization_id, inviterId: r.inviter_id, email: r.email, role: r.role, status: r.status, expiresAt: r.expires_at, createdAt: r.created_at })],
  ["rate_limit", schema.rateLimit, (r: Record<string, unknown>) => ({ id: r.id, key: r.key, count: r.count, lastRequest: r.last_request })],
] as const;

async function rows(table: string) {
  const exists = await pg.query("select to_regclass($1) as t", [`public.${table}`]);
  if (!exists.rows[0].t) { console.log(`  ${table}: absent in Postgres, skipped`); return []; }
  return (await pg.query(`select * from "${table}"`)).rows as Record<string, unknown>[];
}

async function migrateAuth() {
  console.log("Auth tables → auth.db");
  // Children first, so foreign keys stay satisfied while the old rows go.
  if (force) for (const [, table] of [...AUTH_TABLES].reverse()) await db.delete(table);

  for (const [name, table, map] of AUTH_TABLES) {
    const source = await rows(name);
    if (!source.length) continue;
    // One statement rather than a loop: SQLite is local and these tables are
    // small by construction. onConflictDoNothing is what makes a plain re-run a
    // no-op instead of a unique-constraint crash.
    const inserted = db.insert(table).values(source.map((row) => map(row)) as never[]).onConflictDoNothing().run().changes;
    console.log(`  ${name}: ${inserted} inserted, ${source.length - inserted} already present`);
  }
}

async function migrateProjects() {
  console.log("Projects → JSON files");
  const shares = new Map<string, Record<string, unknown>>();
  for (const share of await rows("project_share")) shares.set(share.project_id as string, share);

  const ydocs = new Map<string, string>();
  for (const doc of await rows("yjs_documents")) ydocs.set(doc.project_id as string, doc.state as string);

  let written = 0, skipped = 0;
  for (const row of await rows("projects")) {
    const id = row.id as string;
    if (await readProject(id)) {
      if (!force) { skipped++; continue; }
      // createProject is write-if-absent, so --force has to clear the record
      // first. This also sweeps a share file whose token has since changed.
      await deleteProject(id);
    }

    const share = shares.get(id);
    await createProject({ id, name: row.name as string, organizationId: (row.organization_id as string) ?? null, createdBy: (row.created_by as string) ?? null, schemaJson: row.schema_json as Schema, revision: row.revision as number, schemaFormatVersion: row.schema_format_version as number, createdAt: row.created_at as Date, updatedAt: row.updated_at as Date, shareTokenHash: (share?.token_hash as string) ?? null });

    const state = ydocs.get(id);
    if (state) await writeYDoc(id, new Uint8Array(Buffer.from(state, "base64")));
    if (share) await putShare({ id: share.id as string, projectId: id, tokenHash: share.token_hash as string, permission: share.permission as string, createdBy: share.created_by as string, createdAt: share.created_at as Date, revokedAt: (share.revoked_at as Date) ?? null });
    written++;
  }
  console.log(`  projects: ${written} written, ${skipped} already present`);
}

// Wrapped rather than top-level await: the repo is CommonJS, so `tsx` compiles
// this to CJS where top-level await is a syntax error.
async function main() {
  await pg.connect();
  try {
    await migrateAuth();
    await migrateProjects();
    console.log("\nDone. Verify every project opens before dropping the Postgres database.");
  } finally {
    await pg.end();
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
