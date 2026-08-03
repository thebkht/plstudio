import fs from "node:fs";
import path from "node:path";

/**
 * Everything durable lives under one directory: the auth database and the
 * project JSON files. Keeping the resolution in a single module is what lets
 * `drizzle.config.ts`, the web app and the collab server agree on where the
 * data is without any of them hardcoding a path.
 */
export const DATA_DIR = path.resolve(process.env.DATA_DIR ?? path.join(process.cwd(), "data"));

// Created on import, not by the first writer: `drizzle-kit push` opens auth.db
// directly from drizzle.config.ts and never goes through getDb(), so it would
// otherwise fail on a fresh checkout.
fs.mkdirSync(DATA_DIR, { recursive: true });

export const AUTH_DB_PATH = path.join(DATA_DIR, "auth.db");
export const PROJECTS_DIR = path.join(DATA_DIR, "projects");
export const YJS_DIR = path.join(DATA_DIR, "yjs");
export const SHARES_DIR = path.join(DATA_DIR, "shares");
export const LOCKS_DIR = path.join(DATA_DIR, ".locks");
