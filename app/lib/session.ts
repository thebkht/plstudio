import { and, eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/db";
import { readProject } from "@/db/file-store";
import { member, organization, user } from "@/db/schema";
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

/**
 * Display names for a set of `createdBy` ids. Projects are files and users are
 * SQLite rows, so the author of a project card has to be looked up separately —
 * batched into one query rather than one per card. Ids with no row (a deleted
 * account, `"_unowned"`) are simply absent from the map.
 */
export async function lookupUserNames(ids: string[]) {
  const wanted = [...new Set(ids.filter(Boolean))];
  if (!wanted.length) return new Map<string, string>();
  const rows = await getDb().select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, wanted));
  return new Map(rows.map((row) => [row.id, row.name]));
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
