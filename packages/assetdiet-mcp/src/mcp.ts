/**
 * AssetDiet MCP Server Runner
 * Exposes the 16 AssetDiet tools over stdio JSON-RPC transport.
 * Writes diagnostic errors to stderr; stdout is reserved strictly for JSON-RPC.
 */

import { startMcpServer, server } from "@assetdiet/mcp-server";

export { startMcpServer, server };

export async function runMcp(): Promise<void> {
  await startMcpServer();
}

const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith("mcp.js") ||
    process.argv[1].endsWith("mcp.ts") ||
    process.argv[1].endsWith("mcp"));

if (isDirectRun && process.env.NODE_ENV !== "test") {
  runMcp().catch((err) => {
    console.error("Fatal MCP Server Error:", err);
    process.exit(1);
  });
}
