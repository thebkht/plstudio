import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * A short-lived bearer token for one collab room. Authorization is decided once,
 * by the Next route using the existing session helpers; this token only carries
 * that verdict to the websocket server, which must never re-derive it.
 */
export type CollabClaims = {
  sub: string;
  name: string;
  image: string | null;
  documentName: string;
  readOnly: boolean;
  exp: number;
};

export const documentNameFor = (projectId: string) => `project:${projectId}`;
export const projectIdFrom = (documentName: string) => documentName.replace(/^project:/, "");

const encode = (value: string) => Buffer.from(value).toString("base64url");
const sign = (payload: string, secret: string) => createHmac("sha256", secret).update(payload).digest("base64url");

/** Tokens are deliberately short-lived: they are minted per connection, not per session. */
export function signCollabToken(claims: Omit<CollabClaims, "exp">, secret: string, ttlSeconds = 120) {
  const payload = encode(JSON.stringify({ ...claims, exp: Math.floor(Date.now() / 1000) + ttlSeconds }));
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyCollabToken(token: string, secret: string): CollabClaims | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString()) as CollabClaims;
    return claims.exp > Math.floor(Date.now() / 1000) ? claims : null;
  } catch {
    return null;
  }
}
