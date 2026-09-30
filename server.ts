import { createServer } from "node:http";
import next from "next";
import { attachCollab, COLLAB_PATH, createCollab } from "@/collab/hocuspocus";

/**
 * One process, one port: Next serves the pages and routes, and Hocuspocus answers
 * WebSocket upgrades on `COLLAB_PATH` of the same server. Next has no WebSocket
 * route handlers, so this custom server is what makes that possible.
 */
// A flag rather than `NODE_ENV=production` in the script, which Windows shells
// cannot parse; Docker sets NODE_ENV itself.
if (process.argv.includes("--production")) Object.assign(process.env, { NODE_ENV: "production" });
const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT ?? 4000);
const app = next({ dev, port });

/**
 * Two private members, both deliberate. On its first request Next attaches its
 * own "upgrade" listener to the server, and for anything that is not its HMR
 * socket it runs the full router — `proxy.ts` included — and `socket.end()`s when
 * a page matches (`/collab` matches `/[workspace]`) or the proxy redirects. That
 * would kill collab sockets underneath us, so we claim `didWebSocketSetup` and own
 * the single listener. Everything else goes to `upgradeHandler`, the router-level
 * handler Next would have attached; the public `getUpgradeHandler()` reaches only
 * the inner page server and never answers HMR.
 */
const internals = app as unknown as { didWebSocketSetup: boolean; upgradeHandler: Parameters<typeof attachCollab>[2] };
internals.didWebSocketSetup = true;

// `prepare()` loads `.env*`, so secrets are read after it. (No top-level await:
// the package is CommonJS, which is how tsx runs this file.)
app.prepare().then(() => {
  const collabEnabled = process.env.NEXT_PUBLIC_COLLAB !== "off";
  const secret = process.env.COLLAB_TOKEN_SECRET;
  if (collabEnabled && !secret) throw new Error("COLLAB_TOKEN_SECRET is required (or set NEXT_PUBLIC_COLLAB=off for single-player)");

  const server = createServer(app.getRequestHandler());
  const shutdownCollab = collabEnabled && secret ? attachCollab(server, createCollab(secret), internals.upgradeHandler) : null;
  if (!shutdownCollab) server.on("upgrade", internals.upgradeHandler);

  server.listen(port, () => console.log(`> Ready on http://localhost:${port}${shutdownCollab ? ` (collab on ${COLLAB_PATH})` : ""}`));

  // Flush every room's debounced store before exiting, or the last ≤10s of edits
  // only ever reach the in-memory Y.Doc.
  const stop = async () => {
    server.close();
    await shutdownCollab?.();
    await app.close();
    process.exit(0);
  };
  for (const signal of ["SIGINT", "SIGTERM", "SIGQUIT"] as const) process.once(signal, stop);
});
