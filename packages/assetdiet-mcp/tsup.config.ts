import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    cli: "src/cli.ts",
    index: "src/index.ts",
    mcp: "src/mcp.ts",
  },
  format: ["esm"],
  target: "node20",
  clean: true,
  dts: true,
  splitting: false,
  sourcemap: true,
  external: [
    "sharp",
    "svgo",
    "@gltf-transform/core",
    "@gltf-transform/extensions",
    "@gltf-transform/functions",
    "@modelcontextprotocol/sdk",
    "commander",
    "fast-glob",
    "ignore",
    "zod",
  ],
  noExternal: [/^@assetdiet\//],
});
