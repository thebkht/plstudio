import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import type { Schema } from "@/app/lib/schema";
import { LOCKS_DIR, PROJECTS_DIR, SHARES_DIR, YJS_DIR } from "./paths";

/**
 * Projects live on disk, one JSON file each, instead of in Postgres. Field names
 * match the old `projects` row exactly so every reader kept its property access.
 *
 * `shareTokenHash` replaces what used to be `project_share`'s unique FK: the
 * token -> project direction reads `shares/<hash>.json`, and this back-pointer
 * gives the project -> share direction without scanning the projects directory.
 */
export type ProjectRecord = {
  id: string;
  name: string;
  organizationId: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  schemaJson: Schema;
  revision: number;
  schemaFormatVersion: number;
  shareTokenHash: string | null;
};

export type ShareRecord = {
  id: string;
  projectId: string;
  tokenHash: string;
  permission: string;
  createdBy: string;
  createdAt: Date;
  revokedAt: Date | null;
};

const projectFile = (id: string) => path.join(PROJECTS_DIR, `${encodeURIComponent(id)}.json`);
const yjsFile = (id: string) => path.join(YJS_DIR, `${encodeURIComponent(id)}.bin`);
const shareFile = (tokenHash: string) => path.join(SHARES_DIR, `${encodeURIComponent(tokenHash)}.json`);

const isMissing = (error: unknown) => (error as NodeJS.ErrnoException)?.code === "ENOENT";

async function readJson<T>(file: string): Promise<T | null> {
  try { return JSON.parse(await fs.readFile(file, "utf8")) as T; }
  catch (error) { if (isMissing(error)) return null; throw error; }
}

/**
 * Write to a unique temp name and rename over the target. Rename is atomic
 * within a filesystem, so a concurrent reader sees either the whole old file or
 * the whole new one — never a half-written JSON blob.
 */
export async function writeAtomic(file: string, contents: string | Uint8Array) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
  try {
    await fs.writeFile(temp, contents);
    await fs.rename(temp, file);
  } catch (error) {
    await fs.rm(temp, { force: true });
    throw error;
  }
}

const LOCK_STALE_MS = 10_000;
const LOCK_RETRY_MS = 25;
const LOCK_TIMEOUT_MS = 15_000;

// Same-process writers queue on a promise chain rather than spinning on mkdir;
// the lock directory is only there to serialize the *other* process (collab).
const inProcessLocks = new Map<string, Promise<unknown>>();

async function acquire(dir: string) {
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  for (;;) {
    try { return await fs.mkdir(dir); } // exclusive by definition without `recursive`
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      // A writer that crashed mid-transaction would otherwise wedge the project
      // forever, so a lock nobody has touched in 10s is treated as abandoned.
      const age = await fs.stat(dir).then((s) => Date.now() - s.mtimeMs, () => 0);
      if (age > LOCK_STALE_MS) { await fs.rm(dir, { recursive: true, force: true }); continue; }
      if (Date.now() > deadline) throw new Error(`Timed out waiting for lock on ${path.basename(dir)}`);
      await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_MS));
    }
  }
}

/**
 * Cross-process mutex for a single project. Postgres used to serialize the
 * read-modify-write of `revision`; now the web app and the collab server have to
 * do it themselves, since both bump it and they are separate processes.
 */
export async function withProjectLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
  const previous = inProcessLocks.get(id) ?? Promise.resolve();
  const run = previous.catch(() => {}).then(async () => {
    await fs.mkdir(LOCKS_DIR, { recursive: true });
    const dir = path.join(LOCKS_DIR, encodeURIComponent(id));
    await acquire(dir);
    try { return await fn(); }
    finally { await fs.rm(dir, { recursive: true, force: true }); }
  });
  inProcessLocks.set(id, run);
  try { return await run; }
  finally { if (inProcessLocks.get(id) === run) inProcessLocks.delete(id); }
}

// ---------------------------------------------------------------- projects

type StoredProject = Omit<ProjectRecord, "createdAt" | "updatedAt"> & { createdAt: string; updatedAt: string };

// The dashboards call `updatedAt.toLocaleDateString()`, so timestamps have to
// come back as real Dates rather than the ISO strings JSON can carry.
const hydrate = (stored: StoredProject): ProjectRecord => ({ ...stored, createdAt: new Date(stored.createdAt), updatedAt: new Date(stored.updatedAt) });

export async function readProject(id: string) {
  const stored = await readJson<StoredProject>(projectFile(id));
  return stored ? hydrate(stored) : null;
}

async function writeProject(record: ProjectRecord) {
  await writeAtomic(projectFile(record.id), JSON.stringify({ ...record, createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString() }, null, 2));
  return record;
}

type NewProject = Pick<ProjectRecord, "id" | "name" | "organizationId" | "createdBy" | "schemaJson" | "revision" | "schemaFormatVersion">;

/**
 * Write-if-absent: `app/editor/page.tsx` creates a project from inside an RSC
 * render, which React is free to run twice.
 */
export async function createProject(input: NewProject) {
  const existing = await readProject(input.id);
  if (existing) return existing;
  const now = new Date();
  return writeProject({ ...input, createdAt: now, updatedAt: now, shareTokenHash: null });
}

export async function updateProject(id: string, patch: Partial<Omit<ProjectRecord, "id" | "createdAt">>) {
  const existing = await readProject(id);
  if (!existing) return null;
  return writeProject({ ...existing, ...patch, updatedAt: patch.updatedAt ?? new Date() });
}

export const touchProject = (id: string) => updateProject(id, {});

/** The explicit form of the `ON DELETE CASCADE` the foreign keys used to provide. */
export async function deleteProject(id: string) {
  const existing = await readProject(id);
  await fs.rm(projectFile(id), { force: true });
  await fs.rm(yjsFile(id), { force: true });
  if (existing?.shareTokenHash) await fs.rm(shareFile(existing.shareTokenHash), { force: true });
}

type ListFilter = { organizationId?: string; createdBy?: string; personalOnly?: boolean };

/** Replaces every `orderBy(desc(projects.updatedAt))` query. */
export async function listProjects(filter: ListFilter = {}) {
  const names = await fs.readdir(PROJECTS_DIR).catch((error) => { if (isMissing(error)) return [] as string[]; throw error; });
  const records = (await Promise.all(names.filter((name) => name.endsWith(".json")).map((name) => readJson<StoredProject>(path.join(PROJECTS_DIR, name)))))
    .filter((stored): stored is StoredProject => stored !== null)
    .map(hydrate);
  return records
    .filter((project) => (filter.organizationId === undefined || project.organizationId === filter.organizationId)
      && (filter.createdBy === undefined || project.createdBy === filter.createdBy)
      && (!filter.personalOnly || project.organizationId === null))
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

/** Better Auth's anonymous plugin re-owns a guest's projects on account linking. */
export async function reassignProjectOwner(fromUserId: string, toUserId: string) {
  const owned = await listProjects({ createdBy: fromUserId });
  await Promise.all(owned.map((project) => withProjectLock(project.id, () => updateProject(project.id, { createdBy: toUserId, updatedAt: project.updatedAt }))));
}

// ------------------------------------------------------------------- yjs

export async function readYDoc(id: string) {
  try { return new Uint8Array(await fs.readFile(yjsFile(id))); }
  catch (error) { if (isMissing(error)) return null; throw error; }
}

export const writeYDoc = (id: string, state: Uint8Array) => writeAtomic(yjsFile(id), state);

// ----------------------------------------------------------------- shares

type StoredShare = Omit<ShareRecord, "createdAt" | "revokedAt"> & { createdAt: string; revokedAt: string | null };

export async function readShareByTokenHash(tokenHash: string) {
  const stored = await readJson<StoredShare>(shareFile(tokenHash));
  return stored ? { ...stored, createdAt: new Date(stored.createdAt), revokedAt: stored.revokedAt ? new Date(stored.revokedAt) : null } : null;
}

export const putShare = (share: ShareRecord) =>
  writeAtomic(shareFile(share.tokenHash), JSON.stringify({ ...share, createdAt: share.createdAt.toISOString(), revokedAt: share.revokedAt?.toISOString() ?? null }, null, 2));

export const deleteShareFile = (tokenHash: string) => fs.rm(shareFile(tokenHash), { force: true });
