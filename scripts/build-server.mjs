import { build } from "esbuild";

/**
 * Compiles `server.ts` -- and the collab server, file store and schema code it
 * imports -- into one CommonJS file, so production starts with plain `node`
 * instead of transforming every module through tsx on each boot and keeping its
 * loader resident. Packages stay external: they are already JavaScript, and
 * `better-sqlite3` and Next have to be resolved from node_modules regardless.
 * The `@/` alias comes from tsconfig.json, which esbuild reads by itself.
 */
await build({
  entryPoints: ["server.ts"],
  outfile: "dist/server.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  packages: "external",
  logLevel: "info",
});
