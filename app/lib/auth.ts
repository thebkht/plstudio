import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { anonymous } from "better-auth/plugins/anonymous";
import { organization } from "better-auth/plugins/organization";
import { adminAc, defaultAc, ownerAc } from "better-auth/plugins/organization/access";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { reassignProjectOwner } from "@/db/file-store";
import * as schema from "@/db/schema";
import { member } from "@/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(getDb(), { provider: "sqlite", schema }),
  emailAndPassword: { enabled: true },
  rateLimit: { storage: "database" },
  plugins: [
    anonymous({
      onLinkAccount: async ({ anonymousUser, newUser }) => {
        await getDb().update(member).set({ userId: newUser.user.id }).where(eq(member.userId, anonymousUser.user.id));
        await reassignProjectOwner(anonymousUser.user.id, newUser.user.id);
      },
    }),
    organization({
      allowUserToCreateOrganization: true,
      organizationLimit: 10,
      membershipLimit: 50,
      roles: {
        owner: ownerAc,
        admin: adminAc,
        member: defaultAc.newRole({ invitation: ["create"], ac: ["read"] }),
      },
    }),
  ],
});
