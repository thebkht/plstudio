import { createHash, randomBytes } from "node:crypto";
import { deleteShareFile, putShare, readProject, readShareByTokenHash, updateProject, withProjectLock } from "@/db/file-store";

export function hashProjectShareToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function makeProjectShareToken() {
  return randomBytes(32).toString("base64url");
}

export async function findProjectByShareToken(token: string) {
  const share = await readShareByTokenHash(hashProjectShareToken(token));
  if (!share || share.revokedAt) return null;
  const project = await readProject(share.projectId);
  return project ? { project, share } : null;
}

/**
 * One live link per project, so issuing a new one retires the old token's file —
 * the file-store equivalent of the upsert on `project_share.project_id`.
 */
export async function createProjectShare(projectId: string, userId: string) {
  const token = makeProjectShareToken();
  const tokenHash = hashProjectShareToken(token);
  await withProjectLock(projectId, async () => {
    const project = await readProject(projectId);
    if (project?.shareTokenHash && project.shareTokenHash !== tokenHash) await deleteShareFile(project.shareTokenHash);
    await putShare({ id: crypto.randomUUID(), projectId, tokenHash, permission: "editor", createdBy: userId, createdAt: new Date(), revokedAt: null });
    await updateProject(projectId, { shareTokenHash: tokenHash, updatedAt: project?.updatedAt });
  });
  return token;
}

export async function revokeProjectShare(projectId: string) {
  await withProjectLock(projectId, async () => {
    const project = await readProject(projectId);
    if (!project?.shareTokenHash) return;
    const share = await readShareByTokenHash(project.shareTokenHash);
    // Soft delete, as the column did: a revoked token stays known-revoked rather
    // than falling back to "no such link".
    if (share) await putShare({ ...share, revokedAt: new Date() });
  });
}
