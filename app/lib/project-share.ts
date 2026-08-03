import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { projectShare, projects } from "@/db/schema";

export function hashProjectShareToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function makeProjectShareToken() {
  return randomBytes(32).toString("base64url");
}

export async function findProjectByShareToken(token: string) {
  const tokenHash = hashProjectShareToken(token);
  const row = (await getDb()
    .select({ project: projects, share: projectShare })
    .from(projectShare)
    .innerJoin(projects, eq(projectShare.projectId, projects.id))
    .where(and(eq(projectShare.tokenHash, tokenHash), isNull(projectShare.revokedAt))))[0];
  return row || null;
}

export async function createProjectShare(projectId: string, userId: string) {
  const token = makeProjectShareToken();
  const db = getDb();
  await db
    .insert(projectShare)
    .values({
      id: crypto.randomUUID(),
      projectId,
      tokenHash: hashProjectShareToken(token),
      permission: "editor",
      createdBy: userId,
      revokedAt: null,
    })
    .onConflictDoUpdate({
      target: projectShare.projectId,
      set: {
        tokenHash: hashProjectShareToken(token),
        permission: "editor",
        createdBy: userId,
        revokedAt: null,
        createdAt: new Date(),
      },
    });
  return token;
}

export async function revokeProjectShare(projectId: string) {
  await getDb().update(projectShare).set({ revokedAt: new Date() }).where(eq(projectShare.projectId, projectId));
}
