import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, expect, it } from "vitest";

/**
 * Auth is the one part of the app still backed by a database, and moving it from
 * Postgres to SQLite changed every column type. This exercises the adapter end to
 * end rather than the schema in isolation, because the failure mode — a timestamp
 * or boolean that no longer round-trips — only shows up through Better Auth.
 *
 * The tables come from `drizzle-kit push` rather than hand-written DDL so the
 * test cannot drift from `db/schema.ts`.
 */
const root = await fs.mkdtemp(path.join(os.tmpdir(), "plstudio-auth-"));
process.env.DATA_DIR = root;
process.env.BETTER_AUTH_SECRET = "test-secret-0123456789";
process.env.BETTER_AUTH_URL = "http://localhost:3000";

execFileSync("npx", ["drizzle-kit", "push", "--force"], { cwd: process.cwd(), env: { ...process.env, DATA_DIR: root }, stdio: "ignore" });

afterAll(async () => { await fs.rm(root, { recursive: true, force: true }); });

it("signs up, signs in and creates an organization against auth.db", async () => {
  const { auth } = await import("@/app/lib/auth");

  const signUp = await auth.api.signUpEmail({ body: { name: "Test", email: "test@example.com", password: "hunter2hunter2" } });
  expect(signUp.user.email).toBe("test@example.com");

  const signIn = await auth.api.signInEmail({ body: { email: "test@example.com", password: "hunter2hunter2" }, returnHeaders: true });
  const cookie = signIn.headers.get("set-cookie");
  expect(cookie).toContain("session_token");

  const session = await auth.api.getSession({ headers: new Headers({ cookie: cookie! }) });
  expect(session!.user.email).toBe("test@example.com");
  // integer({ mode: "timestamp" }) has to hand a Date back, not a number.
  expect(session!.session.expiresAt).toBeInstanceOf(Date);
  expect(session!.session.expiresAt.getTime()).toBeGreaterThan(Date.now());
  expect(session!.user.emailVerified).toBe(false);

  const org = await auth.api.createOrganization({ body: { name: "Acme", slug: "acme" }, headers: new Headers({ cookie: cookie! }) });
  expect(org!.slug).toBe("acme");
}, 30_000);
