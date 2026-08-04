import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { member, organization } from "@/db/schema";
import { auth } from "@/app/lib/auth";
import TemplateGallery from "@/app/components/template-gallery";

export default async function TemplatesPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login?redirect=/templates");
  const row = (await getDb().select({ slug: organization.slug }).from(member).innerJoin(organization, eq(member.organizationId, organization.id)).where(eq(member.userId, session.user.id)).limit(1))[0];
  return <TemplateGallery workspace={row?.slug} />;
}
