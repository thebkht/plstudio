import { Server } from "@hocuspocus/server";
import { Database } from "@hocuspocus/extension-database";
import { readProject, readYDoc, updateProject, withProjectLock, writeYDoc } from "@/db/file-store";
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
      fetch: async ({ documentName }) => readYDoc(projectIdFrom(documentName)),

      store: async ({ documentName, state, document }) => {
        const projectId = projectIdFrom(documentName);
        await writeYDoc(projectId, state);

        // Mirror the document back into the project's `schemaJson` so the REST
        // routes, share pages, project list and DDL export keep reading what they
        // always did. Postgres used to serialize this read-modify-write of
        // `revision` against the web app's PUT; on disk the lock has to do it.
        const schema = schemaFromYDoc(document, { id: projectId });
        await withProjectLock(projectId, async () => {
          const stored = await readProject(projectId);
          if (!stored) return;
          const mirrored: Schema = { ...schema, revision: stored.revision + 1, schemaFormatVersion: SCHEMA_FORMAT_VERSION };
          await updateProject(projectId, { name: mirrored.name, schemaJson: mirrored, revision: mirrored.revision, schemaFormatVersion: SCHEMA_FORMAT_VERSION });
        });
      },
    }),
  ],
});

server.listen().then(() => console.log(`collab listening on :${port}`));
