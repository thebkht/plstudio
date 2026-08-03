import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const RETRY_DELAYS_MS = [150, 500];

/**
 * Neon autosuspends an idle compute, so the first query after a pause has to
 * wake it and can outrun the fetch timeout — surfacing as a failed session
 * lookup on an otherwise healthy database.
 *
 * Retrying at the fetch layer scopes this to transport failures only: a
 * rejected fetch means the request never completed, whereas a SQL error comes
 * back as a *resolved* response carrying a Postgres error. So a genuinely bad
 * query still fails immediately instead of being retried and masked.
 */
neonConfig.fetchFunction = async (input: RequestInfo | URL, init?: RequestInit) => {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetch(input, init);
    } catch (error) {
      // Don't retry a caller-driven abort, and stop once attempts run out.
      if (attempt >= RETRY_DELAYS_MS.length || init?.signal?.aborted) throw error;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
    }
  }
};

/**
 * The driver derives its HTTP endpoint from the connection host, which only
 * works against a real Neon compute. `NEON_FETCH_ENDPOINT` overrides it so a
 * local Postgres behind the Neon HTTP proxy (see docker-compose.db.yml) works
 * with the same code path. Unset everywhere but local dev.
 */
if (process.env.NEON_FETCH_ENDPOINT) neonConfig.fetchEndpoint = process.env.NEON_FETCH_ENDPOINT;

export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured.");
  return drizzle(neon(url), { schema });
}
