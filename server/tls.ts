import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { generate } from "selfsigned";
import { DATA_DIR } from "@/db/paths";

export type TlsCredentials = { cert: string | Buffer; key: string | Buffer };
type StoredCertificate = { cert: string; key: string; names: string[]; expires: number };

const SELF_SIGNED_PATH = path.join(DATA_DIR, "tls", "self-signed.json");
const DAY = 86_400_000;
// Browsers refuse leaf certificates valid for more than 398 days.
const LIFETIME_DAYS = 397;
const RENEW_WITHIN_DAYS = 30;

/** Every name this machine answers to — localhost, its host name and each IP — so one certificate covers the LAN. */
const localNames = () => {
  const host = os.hostname().replace(/\.local$/, "");
  const ips = Object.values(os.networkInterfaces()).flat().flatMap((nic) => (nic && !nic.address.startsWith("fe80") ? [nic.address] : []));
  return ["localhost", host, `${host}.local`, ...ips];
};

const readStored = (): StoredCertificate | null => {
  try {
    return JSON.parse(fs.readFileSync(SELF_SIGNED_PATH, "utf8"));
  } catch {
    return null;
  }
};

/**
 * A self-signed certificate kept under `DATA_DIR`, so a device that accepted it
 * once is not asked again on every restart. It is reissued only when it nears
 * expiry or the machine answers to a name it does not cover (a new network),
 * and the reissue keeps the old names so moving between networks settles.
 */
async function selfSigned(): Promise<TlsCredentials> {
  const stored = readStored();
  const names = localNames();
  if (stored && stored.expires - Date.now() > RENEW_WITHIN_DAYS * DAY && names.every((name) => stored.names.includes(name))) return stored;

  const all = [...new Set([...names, ...(stored?.names ?? [])])];
  const expires = Date.now() + LIFETIME_DAYS * DAY;
  const pems = await generate([{ name: "commonName", value: names[1] }], {
    keyType: "ec",
    curve: "P-256",
    notAfterDate: new Date(expires),
    extensions: [
      { name: "basicConstraints", cA: false },
      { name: "keyUsage", digitalSignature: true, keyEncipherment: true },
      { name: "extKeyUsage", serverAuth: true },
      { name: "subjectAltName", altNames: all.map((name) => (net.isIP(name) ? { type: 7, ip: name } : { type: 2, value: name })) },
    ],
  });
  const next: StoredCertificate = { cert: pems.cert, key: pems.private, names: all, expires };
  fs.mkdirSync(path.dirname(SELF_SIGNED_PATH), { recursive: true });
  fs.writeFileSync(SELF_SIGNED_PATH, JSON.stringify(next), { mode: 0o600 });
  return next;
}

/**
 * HTTPS is the default: plain http is not a secure context, so `crypto.randomUUID`
 * and the clipboard are missing on a LAN address, and browsers increasingly try
 * https first. `HTTPS_CERT`/`HTTPS_KEY` supply a real certificate; without them a
 * self-signed one is used. `HTTPS=off` serves plain http, for a deployment whose
 * reverse proxy terminates TLS.
 */
export async function loadTls(): Promise<{ credentials: TlsCredentials; selfSigned: boolean } | null> {
  if (process.env.HTTPS === "off") return null;
  const { HTTPS_CERT, HTTPS_KEY } = process.env;
  if (HTTPS_CERT && HTTPS_KEY) return { credentials: { cert: fs.readFileSync(HTTPS_CERT), key: fs.readFileSync(HTTPS_KEY) }, selfSigned: false };
  return { credentials: await selfSigned(), selfSigned: true };
}
