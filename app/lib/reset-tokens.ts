/**
 * There is no mail transport in this app, so `sendResetPassword` parks the
 * token Better Auth minted here and the direct-reset route consumes it a few
 * microseconds later in the same request. In-memory is deliberate: the token
 * must never leave the server, and a value that outlives the request is a
 * liability, not a feature.
 */
const pending = new Map<string, { token: string; expires: number }>();

const TTL_MS = 60_000;

const key = (email: string) => email.trim().toLowerCase();

const sweep = () => {
  const now = Date.now();
  for (const [k, v] of pending) if (v.expires <= now) pending.delete(k);
};

export const rememberResetToken = (email: string, token: string) => {
  sweep();
  pending.set(key(email), { token, expires: Date.now() + TTL_MS });
};

/** Single use: reading a token drops it. */
export const takeResetToken = (email: string) => {
  sweep();
  const entry = pending.get(key(email));
  if (!entry) return null;
  pending.delete(key(email));
  return entry.expires > Date.now() ? entry.token : null;
};
