import { Server } from "@hocuspocus/server";
import { Database } from "@hocuspocus/extension-database";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { projects, yjsDocuments } from "@/db/schema";
import { projectIdFrom, verifyCollabToken } from "@/app/lib/collab/token";
import { schemaFromYDoc } from "@/app/lib/collab/ydoc";
import { SCHEMA_FORMAT_VERSION, type Schema } from "@/app/lib/schema";

const secret = process.env.COLLAB_TOKEN_SECRET;
if (!secret) throw new Error("COLLAB_TOKEN_SECRET is required");

const port = Number(process.env.COLLAB_PORT ?? 1234);

const server = new Server({
  port,
  // Store on a trailing edge so a burst of edits is one write, but never let a
  // busy room go more than 10s without being durable.
  debounce: 2000,
  maxDebounce: 10000,

  async onAuthenticate({ token, documentName, connectionConfig }) {
    const claims = verifyCollabToken(token, secret);
    if (!claims || claims.documentName !== documentName) throw new Error("Not authorized for this project");
    // Enforced here, not in the client: a read-only share must stay read-only
    // even against a patched browser.
    connectionConfig.readOnly = claims.readOnly;
    return { userId: claims.sub, name: claims.name, image: claims.image, readOnly: claims.readOnly };
  },

  extensions: [
    new Database({
      fetch: async ({ documentName }) => {
        const row = (await getDb().select().from(yjsDocuments).where(eq(yjsDocuments.projectId, projectIdFrom(documentName))))[0];
        return row ? new Uint8Array(Buffer.from(row.state, "base64")) : null;
      },

      store: async ({ documentName, state, document }) => {
        const projectId = projectIdFrom(documentName);
        const encoded = Buffer.from(state).toString("base64");
        const db = getDb();

        await db
          .insert(yjsDocuments)
          .values({ projectId, state: encoded, updatedAt: new Date() })
          .onConflictDoUpdate({ target: yjsDocuments.projectId, set: { state: encoded, updatedAt: new Date() } });

        // Mirror the document back into `projects.schemaJson` so the REST routes,
        // share pages, project list and DDL export keep reading what they always did.
        const schema = schemaFromYDoc(document, { id: projectId });
        const stored = (await db.select({ revision: projects.revision }).from(projects).where(eq(projects.id, projectId)))[0];
        if (!stored) return;

        const mirrored: Schema = { ...schema, revision: stored.revision + 1, schemaFormatVersion: SCHEMA_FORMAT_VERSION };
        await db
          .update(projects)
          .set({ name: mirrored.name, schemaJson: mirrored, revision: mirrored.revision, schemaFormatVersion: SCHEMA_FORMAT_VERSION, updatedAt: new Date() })
          .where(eq(projects.id, projectId));
      },
    }),
  ],
});

server.listen().then(() => console.log(`collab listening on :${port}`));
