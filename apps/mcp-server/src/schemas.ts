/**
 * AssetDiet MCP Server — Tool Schemas
 * Zod schemas for all 16 MCP tool inputs and outputs.
 */

import { z } from 'zod';

// ─── Shared primitives ──────────────────────────────────────────────────────

export const PolicySchema = z.enum(['audit', 'safe', 'balanced', 'aggressive']).default('safe');

export const AssetTypeFilterSchema = z
  .array(z.enum(['image', 'svg', 'video', '3d', 'font']))
  .optional();

// ─── assetdiet_scan ─────────────────────────────────────────────────────────

export const ScanInputSchema = z.object({
  /** Absolute path to the repository root to scan */
  root: z.string().describe('Absolute path to the repository root to scan'),
  /** Asset types to include (omit for all) */
  types: AssetTypeFilterSchema.describe('Asset types to include (omit = all)'),
  /** Additional glob patterns to exclude */
  exclude: z.array(z.string()).optional().describe('Additional glob patterns to exclude'),
});

// ─── assetdiet_audit ────────────────────────────────────────────────────────

export const AuditInputSchema = z.object({
  root: z.string().describe('Absolute path to the repository root'),
  policy: PolicySchema.describe('Optimization policy context for ranking'),
  types: AssetTypeFilterSchema,
  /** Maximum number of opportunities to return */
  limit: z.number().positive().optional().default(50),
});

// ─── assetdiet_estimate ─────────────────────────────────────────────────────

export const EstimateInputSchema = z.object({
  root: z.string().describe('Absolute path to the repository root'),
  policy: PolicySchema,
  types: AssetTypeFilterSchema,
});

// ─── assetdiet_optimize ─────────────────────────────────────────────────────

export const OptimizeInputSchema = z.object({
  /** Absolute paths to the specific files to optimize */
  files: z.array(z.string()).min(1).describe('Absolute paths to files to optimize'),
  root: z.string().describe('Workspace root for safety checks'),
  policy: PolicySchema,
  dryRun: z.boolean().default(true).describe('If true, no files are written'),
  outputDir: z
    .string()
    .optional()
    .describe('Output directory for optimized files (default: alongside originals)'),
});

// ─── assetdiet_optimize_all ─────────────────────────────────────────────────

export const OptimizeAllInputSchema = z.object({
  root: z.string().describe('Absolute path to the repository root'),
  policy: PolicySchema,
  dryRun: z.boolean().default(true),
  types: AssetTypeFilterSchema,
  /** Skip files already processed in this run */
  skipAlreadyOptimized: z.boolean().default(true),
  /** Max number of assets to optimize in this call */
  limit: z.number().positive().optional(),
});

// ─── assetdiet_inspect ──────────────────────────────────────────────────────

export const InspectInputSchema = z.object({
  file: z.string().describe('Absolute path to the asset file to inspect'),
  root: z.string().describe('Workspace root for safety checks'),
});

// ─── assetdiet_find_references ──────────────────────────────────────────────

export const FindReferencesInputSchema = z.object({
  /** Asset file to find references to */
  file: z.string().describe('Absolute path to the asset'),
  root: z.string().describe('Repository root to search within'),
});

// ─── assetdiet_find_duplicates ──────────────────────────────────────────────

export const FindDuplicatesInputSchema = z.object({
  root: z.string().describe('Repository root to scan for duplicates'),
  types: AssetTypeFilterSchema,
});

// ─── assetdiet_validate ─────────────────────────────────────────────────────

export const ValidateInputSchema = z.object({
  /** Files to validate (absolute paths) */
  files: z.array(z.string()).optional().describe('Specific files to validate (omit = all in root)'),
  root: z.string().describe('Repository root'),
  /** Run ID to validate a specific optimization run */
  runId: z.string().optional().describe('Validate outputs from a specific run'),
});

// ─── assetdiet_compare ──────────────────────────────────────────────────────

export const CompareInputSchema = z.object({
  original: z.string().describe('Absolute path to the original file'),
  optimized: z.string().describe('Absolute path to the optimized file'),
  root: z.string().describe('Workspace root for safety checks'),
});

// ─── assetdiet_preview ──────────────────────────────────────────────────────

export const PreviewInputSchema = z.object({
  file: z.string().describe('Absolute path to the asset to preview'),
  root: z.string(),
  outputDir: z.string().optional().describe('Where to write preview artifacts'),
});

// ─── assetdiet_migrate_references ───────────────────────────────────────────

export const MigrateReferencesInputSchema = z.object({
  /** Original asset path that has been replaced */
  originalFile: z.string().describe('Original asset path'),
  /** New asset path (e.g. the WebP replacement) */
  newFile: z.string().describe('New/replacement asset path'),
  root: z.string(),
  dryRun: z.boolean().default(true),
  /** Which reference types to update */
  updateCss: z.boolean().default(false),
  updateHtml: z.boolean().default(false),
});

// ─── assetdiet_unused_assets ────────────────────────────────────────────────

export const UnusedAssetsInputSchema = z.object({
  root: z.string(),
  types: AssetTypeFilterSchema,
  /** Only return assets with no confirmed references */
  confirmedOnly: z.boolean().default(false),
});

// ─── assetdiet_restore ──────────────────────────────────────────────────────

export const RestoreInputSchema = z.object({
  root: z.string(),
  /** Run ID to restore from */
  runId: z.string().describe('The run ID returned by a previous optimize call'),
  dryRun: z.boolean().default(true).describe('If true, show what would be restored without doing it'),
});

// ─── assetdiet_report ───────────────────────────────────────────────────────

export const ReportInputSchema = z.object({
  root: z.string(),
  /** Run ID to report on (omit for latest) */
  runId: z.string().optional(),
  format: z.enum(['markdown', 'json', 'html']).default('markdown'),
  outputFile: z.string().optional().describe('Write report to this file path'),
});

// ─── assetdiet_capabilities ─────────────────────────────────────────────────

export const CapabilitiesInputSchema = z.object({});
