/**
 * AssetDiet
 * Full-repository asset intelligence, optimization and MCP server for AI coding assistants.
 */

export * from "@assetdiet/core";
export * from "@assetdiet/scanner";
export * from "@assetdiet/asset-graph";
export * from "@assetdiet/planner";
export * from "@assetdiet/optimizer-images";
export * from "@assetdiet/optimizer-svg";
export {
  type FFmpegCapability,
  type VideoOptimizeOptions,
  type VideoOptimizeResult,
  detectFFmpeg,
  inspectVideo,
  optimizeVideo,
} from "@assetdiet/optimizer-video";
export * from "@assetdiet/optimizer-3d";
export * from "@assetdiet/optimizer-fonts";
export * from "@assetdiet/reference-analyzer";
export * from "@assetdiet/validation";
export * from "@assetdiet/transactions";
export * from "@assetdiet/reporting";

export {
  runSetup,
  type SetupOptions,
  type SetupResult,
  SUPPORTED_CLIENTS,
} from "./setup.js";
export { runDoctor, type DoctorReport, type DoctorCheck } from "./doctor.js";
export {
  runUninstall,
  type UninstallOptions,
  type UninstallResult,
} from "./uninstall.js";
export { startMcpServer, server } from "./mcp.js";
