import { redirect } from "next/navigation";
import { auth } from "@/app/lib/auth";
import { getDb } from "@/db";
import { eq } from "drizzle-orm";
import { member, organization } from "@/db/schema";
import { headers } from "next/headers";
export default async function Page() { const session = await auth.api.getSession({ headers: await headers() }); if (!session) redirect("/login"); const row = (await getDb().select({ slug: organization.slug }).from(member).innerJoin(organization, eq(member.organizationId, organization.id)).where(eq(member.userId, session.user.id)).limit(1))[0]; redirect(row ? `/${row.slug}` : "/onboarding"); }
