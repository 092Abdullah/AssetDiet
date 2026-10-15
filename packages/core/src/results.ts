/**
 * AssetDiet Core — Structured Result Types
 * Standard envelope for all tool outputs.
 */

export type ResultStatus =
  "ok" | "completed_with_warnings" | "dry_run" | "error" | "cancelled";

export interface ErrorEntry {
  code: string;
  message: string;
  path?: string;
  details?: unknown;
}

export interface WarningEntry {
  code: string;
  message: string;
  path?: string;
  details?: unknown;
}

export interface StructuredResult<T = unknown> {
  status: ResultStatus;
  data: T;
  errors: ErrorEntry[];
  warnings: WarningEntry[];
  durationMs: number;
  runId: string;
  timestamp: string;
}

/** Build a successful result */
export function okResult<T>(
  data: T,
  runId: string,
  durationMs: number,
  warnings: WarningEntry[] = [],
): StructuredResult<T> {
  return {
    status: warnings.length > 0 ? "completed_with_warnings" : "ok",
    data,
    errors: [],
    warnings,
    durationMs,
    runId,
    timestamp: new Date().toISOString(),
  };
}

/** Build an error result */
export function errorResult<T = null>(
  error: ErrorEntry,
  runId: string,
  durationMs: number,
): StructuredResult<T> {
  return {
    status: "error",
    data: null as T,
    errors: [error],
    warnings: [],
    durationMs,
    runId,
    timestamp: new Date().toISOString(),
  };
}

/** Build a dry-run result */
export function dryRunResult<T>(
  data: T,
  runId: string,
  durationMs: number,
  warnings: WarningEntry[] = [],
): StructuredResult<T> {
  return {
    status: "dry_run",
    data,
    errors: [],
    warnings,
    durationMs,
    runId,
    timestamp: new Date().toISOString(),
  };
}
