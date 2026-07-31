import { eq } from "drizzle-orm";
import { auth } from "@/app/lib/auth";
import { getDb } from "@/db";
import { member, organization } from "@/db/schema";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const row = session
    ? (
        await getDb()
          .select({ slug: organization.slug })
          .from(member)
          .innerJoin(organization, eq(member.organizationId, organization.id))
          .where(eq(member.userId, session.user.id))
          .limit(1)
      )[0]
    : undefined;
  redirect(row ? `/${row.slug}` : "/editor");
}
