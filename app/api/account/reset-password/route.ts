import { auth } from "@/app/lib/auth";
import { takeResetToken } from "@/app/lib/reset-tokens";

/**
 * Resets a password in one shot, with no email round-trip: this deployment has
 * no mail transport, so proving control of the inbox is not an option.
 *
 * The trade-off is real — anyone who knows a registered address can set that
 * account's password. `ALLOW_DIRECT_PASSWORD_RESET=false` turns the route off
 * for deployments that cannot accept that, and the attempt limiter below keeps
 * it from being sprayed at a list of addresses.
 *
 * It works by driving Better Auth's own flow end to end rather than writing to
 * `account.password`: `requestPasswordReset` mints a real token (parked in memory by
 * `sendResetPassword`) and `resetPassword` redeems it, so hashing, token
 * expiry and session invalidation stay Better Auth's business.
 *
 * It lives under /api/account rather than /api/auth to stay clear of the Better
 * Auth catch-all at app/api/auth/[...all]/route.ts.
 */
export const dynamic = "force-dynamic";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60_000;
const attempts = new Map<string, { count: number; resetAt: number }>();

// Better Auth's `rateLimit: { storage: "database" }` only guards its own
// routes, so this one brings its own limiter.
const rateLimited = (keys: string[]) => {
  const now = Date.now();
  for (const [key, entry] of attempts) if (entry.resetAt <= now) attempts.delete(key);
  // Count every key before answering, so one blocked key still charges the other.
  return keys.reduce((blocked, key) => {
    const entry = attempts.get(key) ?? { count: 0, resetAt: now + WINDOW_MS };
    attempts.set(key, { count: entry.count + 1, resetAt: entry.resetAt });
    return blocked || entry.count + 1 > MAX_ATTEMPTS;
  }, false);
};

export async function POST(request: Request) {
  if (process.env.ALLOW_DIRECT_PASSWORD_RESET === "false")
    return Response.json({ error: "Password reset is disabled on this server" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email) return Response.json({ error: "Email is required" }, { status: 400 });
  if (password.length < 8) return Response.json({ error: "Password must be at least 8 characters" }, { status: 400 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (rateLimited([`ip:${ip}`, `email:${email.toLowerCase()}`]))
    return Response.json({ error: "Too many attempts. Try again later." }, { status: 429 });

  try {
    await auth.api.requestPasswordReset({ body: { email, redirectTo: "/login" } });
    const token = takeResetToken(email);
    // No token means no account with a password — an unknown address, or one
    // that only ever signed in anonymously.
    if (!token) return Response.json({ error: "Could not reset the password for that email" }, { status: 400 });
    await auth.api.resetPassword({ body: { token, newPassword: password } });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not reset the password" }, { status: 400 });
  }
}
