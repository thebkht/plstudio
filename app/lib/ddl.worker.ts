/**
 * `generateDDL` off the main thread. It is the one per-commit pass worth moving:
 * about 7ms at 200 tables against the ~3ms the structured clone of the schema
 * costs to get it here. Validation stays put -- at under 1ms it is cheaper to
 * run than to post. Driven by `useWorkerDDL`: a schema in, its DDL out.
 */
import { generateDDL } from "./generators";
import type { Schema } from "./schema";

self.addEventListener("message", (event: MessageEvent<Schema>) => {
  self.postMessage(generateDDL(event.data));
});
