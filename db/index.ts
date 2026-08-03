import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { AUTH_DB_PATH } from "./paths";
import * as schema from "./schema";

let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

/**
 * Memoized, unlike the Neon client this replaces: an HTTP client was free to
 * build per call, but a SQLite handle is a real file descriptor and opening one
 * per request would leak them.
 */
export function getDb() {
  if (db) return db;
  fs.mkdirSync(path.dirname(AUTH_DB_PATH), { recursive: true });
  const sqlite = new Database(AUTH_DB_PATH);
  // WAL keeps session reads from queueing behind a write; the busy timeout turns
  // the rare collision into a short wait instead of an immediate SQLITE_BUSY.
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.pragma("foreign_keys = ON");
  db = drizzle(sqlite, { schema });
  return db;
}
