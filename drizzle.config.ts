import type { Config } from "drizzle-kit";
import { AUTH_DB_PATH } from "./db/paths";

export default {
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: { url: AUTH_DB_PATH },
} satisfies Config;
