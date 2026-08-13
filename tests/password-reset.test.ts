import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, expect, it } from "vitest";

/**
 * The direct reset drives Better Auth's own token flow with the token parked in
 * memory instead of emailed. What can silently break is the seam between the
 * two halves — `sendResetPassword` capturing the token and the route redeeming
 * it — so this exercises the real route handler against a real auth.db.
 */
const root = await fs.mkdtemp(path.join(os.tmpdir(), "plstudio-reset-"));
process.env.DATA_DIR = root;
process.env.BETTER_AUTH_SECRET = "test-secret-0123456789";
process.env.BETTER_AUTH_URL = "http://localhost:3000";

execFileSync("npx", ["drizzle-kit", "push", "--force"], { cwd: process.cwd(), env: { ...process.env, DATA_DIR: root }, stdio: "ignore" });

afterAll(async () => { await fs.rm(root, { recursive: true, force: true }); });

const post = async (body: unknown, ip = "10.0.0.1") => {
  const { POST } = await import("@/app/api/account/reset-password/route");
  return POST(new Request("http://localhost:3000/api/account/reset-password", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  }));
};

it("resets a password without sending email, then rate limits", async () => {
  const { auth } = await import("@/app/lib/auth");
  await auth.api.signUpEmail({ body: { name: "Reset", email: "reset@example.com", password: "hunter2hunter2" } });

  const ok = await post({ email: "reset@example.com", password: "newpassword1" });
  expect(ok.status).toBe(200);

  const signIn = await auth.api.signInEmail({ body: { email: "reset@example.com", password: "newpassword1" } });
  expect(signIn.user.email).toBe("reset@example.com");
  await expect(auth.api.signInEmail({ body: { email: "reset@example.com", password: "hunter2hunter2" } })).rejects.toThrow();

  // An address with no account cannot be distinguished from one that failed —
  // both are a plain 400, never a 500.
  const unknown = await post({ email: "nobody@example.com", password: "newpassword1" }, "10.0.0.2");
  expect(unknown.status).toBe(400);

  // Short passwords are rejected before any auth work happens.
  expect((await post({ email: "reset@example.com", password: "short" }, "10.0.0.3")).status).toBe(400);

  // One attempt is already spent above; the 6th on this address trips the limiter.
  for (let i = 0; i < 4; i++) expect((await post({ email: "reset@example.com", password: "newpassword1" }, `10.1.0.${i}`)).status).toBe(200);
  expect((await post({ email: "reset@example.com", password: "newpassword1" }, "10.1.0.9")).status).toBe(429);
}, 30_000);
