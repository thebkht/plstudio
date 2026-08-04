import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

// `db/paths.ts` resolves DATA_DIR once at module load, so it has to be set
// before the store is imported — hence the dynamic import below.
const root = await fs.mkdtemp(path.join(os.tmpdir(), "drawsql-store-"));
process.env.DATA_DIR = root;

const store = await import("@/db/file-store");
const { makeEmptySchema, SCHEMA_FORMAT_VERSION } = await import("@/app/lib/schema");
const { createProjectShare, hashProjectShareToken, revokeProjectShare, findProjectByShareToken } = await import("@/app/lib/project-share");
const { migrateStorageLayout } = await import("@/scripts/migrate-storage-layout");

const seed = (id: string, overrides: Partial<Parameters<typeof store.createProject>[0]> = {}) =>
  store.createProject({ id, name: id, organizationId: null, createdBy: "user-1", schemaJson: makeEmptySchema(id, id), revision: 1, schemaFormatVersion: SCHEMA_FORMAT_VERSION, ...overrides });

beforeEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
  await fs.mkdir(root, { recursive: true });
});

afterAll(async () => { await fs.rm(root, { recursive: true, force: true }); });

describe("project records", () => {
  it("round-trips a project with real Date timestamps", async () => {
    const created = await seed("p1");
    const read = await store.readProject("p1");
    expect(read).not.toBeNull();
    expect(read!.name).toBe("p1");
    expect(read!.schemaJson.id).toBe("p1");
    // JSON can only carry ISO strings, but the dashboards call toLocaleDateString().
    expect(read!.createdAt).toBeInstanceOf(Date);
    expect(read!.updatedAt.getTime()).toBe(created.updatedAt.getTime());
  });

  it("returns null for a project that does not exist", async () => {
    expect(await store.readProject("nope")).toBeNull();
  });

  it("does not clobber an existing project, so a double RSC render is harmless", async () => {
    await seed("p1");
    await store.updateProject("p1", { revision: 7 });
    await seed("p1");
    expect((await store.readProject("p1"))!.revision).toBe(7);
  });
});

describe("on-disk layout", () => {
  const projects = path.join(root, "projects");
  const exists = (file: string) => fs.stat(file).then(() => true, () => false);

  it("files a project under its organization, and a personal one under its creator", async () => {
    await seed("org-scoped", { organizationId: "org-1" });
    await seed("personal");

    expect(await exists(path.join(projects, "org-1", "org-scoped.json"))).toBe(true);
    expect(await exists(path.join(projects, "user-1", "personal.json"))).toBe(true);
    // The flat layout is gone, not merely unused.
    expect(await exists(path.join(projects, "org-scoped.json"))).toBe(false);
  });

  it("has a bucket for a project with neither an organization nor a creator", async () => {
    await seed("imported", { createdBy: null });
    expect(await exists(path.join(projects, "_unowned", "imported.json"))).toBe(true);
    expect((await store.readProject("imported"))!.name).toBe("imported");
  });

  it("reads a project by id alone, without being told the owner", async () => {
    // The share-link and collab paths: whoever opens the project knows only its id.
    await seed("p1", { organizationId: "org-1", createdBy: "user-9" });
    expect((await store.readProject("p1"))!.organizationId).toBe("org-1");
  });

  it("moves the file when the owner changes, leaving exactly one copy", async () => {
    await seed("p1", { organizationId: "org-1" });
    await store.updateProject("p1", { organizationId: "org-2" });

    expect(await exists(path.join(projects, "org-2", "p1.json"))).toBe(true);
    expect(await fs.readdir(projects)).toEqual(["org-2"]);
    expect((await store.readProject("p1"))!.organizationId).toBe("org-2");
  });

  it("moves a personal project when its guest owner links an account", async () => {
    await seed("p1");
    await store.reassignProjectOwner("user-1", "user-2");

    expect(await fs.readdir(projects)).toEqual(["user-2"]);
    expect((await store.readProject("p1"))!.createdBy).toBe("user-2");
  });
});

describe("listProjects", () => {
  it("filters by organization, by owner, and to personal projects only", async () => {
    await seed("org-a", { organizationId: "org-1" });
    await seed("org-b", { organizationId: "org-2" });
    await seed("mine");
    await seed("theirs", { createdBy: "user-2" });

    expect((await store.listProjects({ organizationId: "org-1" })).map((p) => p.id)).toEqual(["org-a"]);
    expect((await store.listProjects({ createdBy: "user-2" })).map((p) => p.id)).toEqual(["theirs"]);
    expect((await store.listProjects({ createdBy: "user-1", personalOnly: true })).map((p) => p.id)).toEqual(["mine"]);
  });

  it("orders by updatedAt descending", async () => {
    await seed("old");
    await seed("mid");
    await seed("new");
    await store.updateProject("old", { updatedAt: new Date(1_000) });
    await store.updateProject("mid", { updatedAt: new Date(2_000) });
    await store.updateProject("new", { updatedAt: new Date(3_000) });
    expect((await store.listProjects()).map((p) => p.id)).toEqual(["new", "mid", "old"]);
  });

  it("merges owner directories into one ordered list", async () => {
    await seed("a", { organizationId: "org-1" });
    await seed("b", { createdBy: "user-2" });
    await seed("c");
    await store.updateProject("a", { updatedAt: new Date(2_000) });
    await store.updateProject("b", { updatedAt: new Date(3_000) });
    await store.updateProject("c", { updatedAt: new Date(1_000) });

    expect((await store.listProjects()).map((p) => p.id)).toEqual(["b", "a", "c"]);
  });

  it("is empty rather than throwing before any project exists", async () => {
    expect(await store.listProjects()).toEqual([]);
  });
});

describe("deleteProject", () => {
  it("removes the Yjs blob and the share file too", async () => {
    await seed("p1");
    await store.writeYDoc("p1", new Uint8Array([1, 2, 3]));
    const token = await createProjectShare("p1", "user-1");

    await store.deleteProject("p1");

    expect(await store.readProject("p1")).toBeNull();
    expect(await store.readYDoc("p1")).toBeNull();
    expect(await store.readShareByTokenHash(hashProjectShareToken(token))).toBeNull();
  });

  it("takes the owner directory with it once it is empty", async () => {
    await seed("p1");
    await seed("p2");
    await store.deleteProject("p1");
    expect(await fs.readdir(path.join(root, "projects"))).toEqual(["user-1"]);

    await store.deleteProject("p2");
    expect(await fs.readdir(path.join(root, "projects"))).toEqual([]);
  });
});

describe("migrate-storage-layout", () => {
  const projects = path.join(root, "projects");

  const flat = async (id: string, owned: { organizationId?: string | null; createdBy?: string | null } = {}) => {
    await fs.mkdir(projects, { recursive: true });
    const now = new Date().toISOString();
    await fs.writeFile(path.join(projects, `${id}.json`), JSON.stringify({ id, name: id, organizationId: null, createdBy: "user-1", ...owned, createdAt: now, updatedAt: now, schemaJson: makeEmptySchema(id, id), revision: 1, schemaFormatVersion: SCHEMA_FORMAT_VERSION, shareTokenHash: null }));
  };

  it("moves flat files under their owner and is a no-op on a second run", async () => {
    await flat("p1");
    await flat("p2", { organizationId: "org-1" });

    expect(await migrateStorageLayout({ log: () => {} })).toEqual({ moved: 2, skipped: 0 });
    expect((await fs.readdir(projects)).sort()).toEqual(["org-1", "user-1"]);
    expect((await store.readProject("p2"))!.organizationId).toBe("org-1");

    expect(await migrateStorageLayout({ log: () => {} })).toEqual({ moved: 0, skipped: 0 });
    expect((await store.listProjects()).map((p) => p.id).sort()).toEqual(["p1", "p2"]);
  });

  it("leaves a project alone when the destination is already taken", async () => {
    await seed("p1");
    await flat("p1");

    expect(await migrateStorageLayout({ log: () => {} })).toEqual({ moved: 0, skipped: 1 });
    expect(await fs.readdir(projects)).toContain("p1.json");
  });
});

describe("share links", () => {
  it("resolves a token back to its project", async () => {
    await seed("p1");
    const token = await createProjectShare("p1", "user-1");
    const found = await findProjectByShareToken(token);
    expect(found?.project.id).toBe("p1");
    expect(found?.share.permission).toBe("editor");
  });

  it("retires the previous token when a new link is issued", async () => {
    await seed("p1");
    const first = await createProjectShare("p1", "user-1");
    const second = await createProjectShare("p1", "user-1");

    expect(await findProjectByShareToken(first)).toBeNull();
    expect((await findProjectByShareToken(second))?.project.id).toBe("p1");
    expect(await fs.readdir(path.join(root, "shares"))).toHaveLength(1);
  });

  it("keeps a revoked token known-revoked rather than unknown", async () => {
    await seed("p1");
    const token = await createProjectShare("p1", "user-1");
    await revokeProjectShare("p1");

    expect(await findProjectByShareToken(token)).toBeNull();
    expect((await store.readShareByTokenHash(hashProjectShareToken(token)))!.revokedAt).toBeInstanceOf(Date);
  });
});

describe("concurrency", () => {
  it("loses no updates when writers race on one project", async () => {
    await seed("p1");
    const bump = () => store.withProjectLock("p1", async () => {
      const current = await store.readProject("p1");
      // Yield inside the critical section: without the lock this interleaves and
      // every writer reads the same revision.
      await new Promise((resolve) => setTimeout(resolve, 1));
      await store.updateProject("p1", { revision: current!.revision + 1 });
    });

    await Promise.all(Array.from({ length: 20 }, bump));
    expect((await store.readProject("p1"))!.revision).toBe(21);
  });

  it("waits on a lock held by another process", async () => {
    await seed("p1");
    // The in-process chain never contends with itself, so the lock directory is
    // only ever exercised against the collab server. Stand in for it by hand.
    const held = path.join(root, ".locks", encodeURIComponent("p1"));
    await fs.mkdir(held, { recursive: true });

    let entered = false;
    const waiting = store.withProjectLock("p1", async () => { entered = true; });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(entered).toBe(false);

    await fs.rm(held, { recursive: true, force: true });
    await waiting;
    expect(entered).toBe(true);
  });

  it("reclaims a lock abandoned by a crashed writer", async () => {
    await seed("p1");
    const stale = path.join(root, ".locks", encodeURIComponent("p1"));
    await fs.mkdir(stale, { recursive: true });
    const long_ago = new Date(Date.now() - 60_000);
    await fs.utimes(stale, long_ago, long_ago);

    await expect(store.withProjectLock("p1", async () => "through")).resolves.toBe("through");
  });

  it("releases the lock when the critical section throws", async () => {
    await seed("p1");
    await expect(store.withProjectLock("p1", async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    await expect(store.withProjectLock("p1", async () => "recovered")).resolves.toBe("recovered");
  });
});

describe("writeAtomic", () => {
  it("never leaves a partial file visible to a reader", async () => {
    const file = path.join(root, "atomic.json");
    await store.writeAtomic(file, JSON.stringify({ value: "first" }));

    const big = JSON.stringify({ value: "x".repeat(2_000_000) });
    const write = store.writeAtomic(file, big);
    // Interleave reads with the write; each must parse as a whole document.
    const reads = Array.from({ length: 40 }, async () => JSON.parse(await fs.readFile(file, "utf8")).value.length);
    const [lengths] = await Promise.all([Promise.all(reads), write]);

    for (const length of lengths) expect([5, 2_000_000]).toContain(length);
    expect(JSON.parse(await fs.readFile(file, "utf8")).value.length).toBe(2_000_000);
    expect((await fs.readdir(root)).filter((name) => name.endsWith(".tmp"))).toEqual([]);
  });
});
