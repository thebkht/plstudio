import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { anonymous } from "better-auth/plugins/anonymous";
import { organization } from "better-auth/plugins/organization";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import * as schema from "@/db/schema";
import { member, projects } from "@/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(getDb(), { provider: "pg", schema }),
  emailAndPassword: { enabled: true },
  rateLimit: { storage: "database" },
  plugins: [
    anonymous({
      onLinkAccount: async ({ anonymousUser, newUser }) => {
        const db = getDb();
        await db.update(member).set({ userId: newUser.user.id }).where(eq(member.userId, anonymousUser.user.id));
        await db.update(projects).set({ createdBy: newUser.user.id }).where(eq(projects.createdBy, anonymousUser.user.id));
      },
    }),
    organization({ allowUserToCreateOrganization: true, organizationLimit: 10, membershipLimit: 50 }),
  ],
});
