import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/db";
import { readProject } from "@/db/file-store";
import { member, organization } from "@/db/schema";
import { auth } from "./auth";

export async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  return session;
}

/**
 * Every workspace the user belongs to. A user may own several and be invited to
 * several more — the organization plugin has always allowed it — so nothing here
 * takes the first row and calls it "the" workspace.
 */
export async function listUserWorkspaces(userId: string) {
  return getDb().select({ id: organization.id, slug: organization.slug, name: organization.name, role: member.role }).from(member).innerJoin(organization, eq(member.organizationId, organization.id)).where(eq(member.userId, userId)).orderBy(organization.name);
}

export async function requireWorkspace(slug: string) {
  const session = await requireSession();
  const row = (await getDb().select({ organization, role: member.role }).from(member).innerJoin(organization, eq(member.organizationId, organization.id)).where(and(eq(member.userId, session.user.id), eq(organization.slug, slug))))[0];
  if (!row) notFound();
  return { session, organization: row.organization, role: row.role as "owner" | "admin" | "member" };
}

/**
 * Membership lives in SQLite and the project lives on disk, so what used to be a
 * three-way join is now a workspace lookup plus an ownership check.
 */
export async function requireProjectAccess(workspaceSlug: string, projectId: string) {
  const workspace = await requireWorkspace(workspaceSlug);
  const project = await readProject(projectId);
  if (!project || project.organizationId !== workspace.organization.id) notFound();
  return { ...workspace, project };
}

export async function requirePersonalProjectAccess(projectId: string) {
  const session = await requireSession();
  const project = await readProject(projectId);
  if (!project || project.createdBy !== session.user.id || project.organizationId !== null) notFound();
  return { session, project, role: "owner" as const };
}
