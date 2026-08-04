/**
 * One-off move of the flat project files into their owner's directory.
 *
 *   pnpm tsx scripts/migrate-storage-layout.ts [--force]
 *
 *   <DATA_DIR>/projects/<projectId>.json  →  <DATA_DIR>/projects/<ownerId>/<projectId>.json
 *
 * The owner is the project's organization when it has one, otherwise its
 * creator. Only top-level *.json entries are touched, so a re-run is a no-op.
 * Each file moves with `rename`, which is atomic within the volume: an
 * interrupted run leaves every project either flat or nested, never missing.
 * `--force` overwrites a destination that already exists.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { ownerSegment, projectFile } from "@/db/file-store";
import { PROJECTS_DIR } from "@/db/paths";

type Owned = { organizationId: string | null; createdBy: string | null };

export async function migrateStorageLayout({ force = false, log = console.log } = {}) {
  const entries = await fs.readdir(PROJECTS_DIR, { withFileTypes: true })
    .catch((error: NodeJS.ErrnoException) => { if (error.code === "ENOENT") return []; throw error; });
  const flat = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".json"));

  let moved = 0, skipped = 0;
  for (const entry of flat) {
    const from = path.join(PROJECTS_DIR, entry.name);
    const record = JSON.parse(await fs.readFile(from, "utf8")) as Owned & { id?: string };
    const id = record.id ?? entry.name.slice(0, -".json".length);
    const to = projectFile(ownerSegment(record), id);

    const occupied = await fs.stat(to).then(() => true, () => false);
    if (occupied && !force) { log(`  ${id}: ${path.relative(PROJECTS_DIR, to)} already exists, skipped (--force to overwrite)`); skipped++; continue; }

    await fs.mkdir(path.dirname(to), { recursive: true });
    await fs.rename(from, to);
    log(`  ${id} → ${path.relative(PROJECTS_DIR, to)}`);
    moved++;
  }

  log(`projects: ${moved} moved, ${skipped} skipped, ${entries.length - flat.length} owner directories already in place`);
  return { moved, skipped };
}

// Guarded so the test can import the function without the script running. The
// repo compiles to CJS under tsx, where `import.meta` is unavailable.
if (process.argv[1]?.includes("migrate-storage-layout")) {
  migrateStorageLayout()
    .then(() => console.log("\nDone. Open a project to verify before removing any backup."))
    .catch((error) => { console.error(error); process.exit(1); });
}
