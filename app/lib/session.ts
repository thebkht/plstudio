import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/db";
import { member, organization, projects } from "@/db/schema";
import { auth } from "./auth";

export async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  return session;
}

export async function requireWorkspace(slug: string) {
  const session = await requireSession();
  const row = (await getDb().select({ organization, role: member.role }).from(member).innerJoin(organization, eq(member.organizationId, organization.id)).where(and(eq(member.userId, session.user.id), eq(organization.slug, slug))))[0];
  if (!row) notFound();
  return { session, organization: row.organization, role: row.role as "owner" | "admin" | "member" };
}

export async function requireProjectAccess(workspaceSlug: string, projectId: string) {
  const session = await requireSession();
  const row = (await getDb().select({ project: projects, organization, role: member.role }).from(member).innerJoin(organization, eq(member.organizationId, organization.id)).innerJoin(projects, eq(projects.organizationId, organization.id)).where(and(eq(member.userId, session.user.id), eq(organization.slug, workspaceSlug), eq(projects.id, projectId))))[0];
  if (!row) notFound();
  return { ...row, role: row.role as "owner" | "admin" | "member" };
}
