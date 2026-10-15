/**
 * AssetDiet Core — Run Context
 * Carries all runtime configuration for a single scan/optimize run.
 */

import { parseConfig, type AssetDietConfig } from "./config.js";
import type { OptimizationPolicy } from "./policies.js";

export interface RunContext {
  /** Absolute path to the workspace root */
  root: string;
  /** Resolved configuration */
  config: AssetDietConfig;
  /** Active optimization policy */
  policy: OptimizationPolicy;
  /** If true, no files will be written */
  dryRun: boolean;
  /** Unique run ID (UUIDv4) */
  runId: string;
  /** AbortSignal for cancellation */
  signal?: AbortSignal | undefined;
  /** Progress callback — called with descriptive status strings */
  onProgress?: ((message: string) => void) | undefined;
}

/** Generate a simple run ID without external dependencies */
export function generateRunId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `${timestamp}-${random}`;
}

/** Check if the run has been cancelled */
export function isCancelled(ctx: RunContext): boolean {
  return ctx.signal?.aborted === true;
}

/** Emit a progress message if a handler is registered */
export function emitProgress(ctx: RunContext, message: string): void {
  ctx.onProgress?.(message);
}

/** Helper to create a fully initialized RunContext */
export function createContext(options: {
  root: string;
  config?: Partial<AssetDietConfig> | Record<string, unknown>;
  policy?: OptimizationPolicy;
  dryRun?: boolean;
  runId?: string;
  signal?: AbortSignal;
  onProgress?: (message: string) => void;
}): RunContext {
  const cfg = options.config
    ? (options.config as AssetDietConfig).policy
      ? (options.config as AssetDietConfig)
      : ({ ...parseConfig({}), ...options.config } as AssetDietConfig)
    : parseConfig({});
  return {
    root: options.root,
    config: cfg,
    policy: options.policy ?? cfg.policy ?? "safe",
    dryRun: options.dryRun ?? false,
    runId: options.runId ?? generateRunId(),
    signal: options.signal,
    onProgress: options.onProgress,
  };
}
