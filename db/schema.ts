import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Better Auth's tables, and nothing else. Projects live on disk as JSON — see
 * `db/file-store.ts` — so this schema is only ever touched by the auth adapter.
 *
 * `integer({ mode: "timestamp" })` matters: Better Auth hands the adapter `Date`
 * objects and expects them back, which a plain integer column would not do.
 */
export const user = sqliteTable("user", {
  id: text("id").primaryKey(), name: text("name").notNull(), email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false), image: text("image"),
  isAnonymous: integer("is_anonymous", { mode: "boolean" }).notNull().default(false), createdAt: integer("created_at", { mode: "timestamp" }).notNull(), updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(), expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(), token: text("token").notNull().unique(), createdAt: integer("created_at", { mode: "timestamp" }).notNull(), updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(), ipAddress: text("ip_address"), userAgent: text("user_agent"), userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(), accountId: text("account_id").notNull(), providerId: text("provider_id").notNull(), userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }), accessToken: text("access_token"), refreshToken: text("refresh_token"), idToken: text("id_token"), accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }), refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }), scope: text("scope"), password: text("password"), createdAt: integer("created_at", { mode: "timestamp" }).notNull(), updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(), identifier: text("identifier").notNull(), value: text("value").notNull(), expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(), createdAt: integer("created_at", { mode: "timestamp" }).notNull(), updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const organization = sqliteTable("organization", {
  id: text("id").primaryKey(), name: text("name").notNull(), slug: text("slug").notNull().unique(), logo: text("logo"), metadata: text("metadata"), createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const member = sqliteTable("member", {
  id: text("id").primaryKey(), organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }), userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }), role: text("role").notNull(), createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, (table) => [index("member_organization_idx").on(table.organizationId), index("member_user_idx").on(table.userId)]);

export const invitation = sqliteTable("invitation", {
  id: text("id").primaryKey(), organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }), inviterId: text("inviter_id").notNull().references(() => user.id, { onDelete: "cascade" }), email: text("email").notNull(), role: text("role"), status: text("status").notNull(), expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(), createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const rateLimit = sqliteTable("rate_limit", {
  id: text("id").primaryKey(), key: text("key").notNull().unique(), count: integer("count").notNull(), lastRequest: integer("last_request", { mode: "number" }).notNull(),
});
