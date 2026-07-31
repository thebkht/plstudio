import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  schemaJson: jsonb("schema_json").notNull(),
  revision: integer("revision").notNull().default(1),
  schemaFormatVersion: integer("schema_format_version").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
