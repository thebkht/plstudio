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
  baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL,
  trustedOrigins: (request?: Request) => {
    const origin = request?.headers.get("origin") || request?.headers.get("referer");
    const forwardedHost = request?.headers.get("x-forwarded-host") || request?.headers.get("host");
    const forwardedProto = request?.headers.get("x-forwarded-proto") || "https";

    const allowed = [
      "http://localhost:3000",
      "http://localhost:5555",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:5555",
      ...(process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : []),
      ...(process.env.NEXT_PUBLIC_APP_URL ? [process.env.NEXT_PUBLIC_APP_URL] : []),
      ...(process.env.APP_URL ? [process.env.APP_URL] : []),
      ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS ? process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(",") : []),
    ];

    if (forwardedHost) {
      const host = forwardedHost.split(",")[0].trim();
      allowed.push(`http://${host}`, `https://${host}`);
    }

    if (origin) {
      try {
        const originHost = new URL(origin).host;
        if (originHost.includes("jprq.live") || originHost.includes("jprq.io")) {
          allowed.push(new URL(origin).origin);
        }
      } catch {}
    }

    return allowed;
  },
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
