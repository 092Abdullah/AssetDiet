/**
 * AssetDiet Core — Run Context
 * Carries all runtime configuration for a single scan/optimize run.
 */

import type { AssetDietConfig } from './config.js';
import type { OptimizationPolicy } from './policies.js';

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
  signal?: AbortSignal;
  /** Progress callback — called with descriptive status strings */
  onProgress?: (message: string) => void;
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
