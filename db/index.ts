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
  const sqlite = new Database(AUTH_DB_PATH);
  // Set busy timeout BEFORE journal_mode so the WAL pragma write doesn't fail with SQLITE_BUSY
  sqlite.pragma("busy_timeout = 5000");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  db = drizzle(sqlite, { schema });
  return db;
}
