/**
 * AssetDiet Core — Configuration Schema
 * Zod-validated project-level configuration.
 */

import { z } from "zod";
import { OPTIMIZATION_POLICIES } from "./policies.js";

export const AssetDietConfigSchema = z.object({
  /** Root directory to scan. Defaults to the project root. */
  root: z.string().optional(),

  /** Default optimization policy */
  policy: z.enum(OPTIMIZATION_POLICIES).default("safe"),

  /** Directories to always exclude (in addition to .gitignore) */
  exclude: z
    .array(z.string())
    .default([
      "node_modules",
      ".git",
      ".assetdiet",
      "dist",
      "build",
      "out",
      ".output",
      ".next",
      ".nuxt",
      ".turbo",
      ".cache",
      "coverage",
    ]),

  /** Only include these directories (undefined = all) */
  include: z.array(z.string()).optional(),

  /** Per-asset-type configuration */
  images: z
    .object({
      quality: z.number().min(1).max(100).default(85),
      maxWidth: z.number().positive().optional(),
      maxHeight: z.number().positive().optional(),
      convertToWebP: z.boolean().default(false),
      convertToAvif: z.boolean().default(false),
      stripMetadata: z.boolean().default(true),
    })
    .default({}),

  svg: z
    .object({
      profile: z
        .enum(["conservative", "balanced", "aggressive"])
        .default("balanced"),
    })
    .default({}),

  video: z
    .object({
      crf: z.number().min(0).max(51).default(28),
      maxWidth: z.number().positive().optional(),
      maxHeight: z.number().positive().optional(),
      codec: z
        .enum(["libx264", "libx265", "libvpx-vp9", "libaom-av1"])
        .default("libx264"),
    })
    .default({}),

  model3d: z
    .object({
      draco: z.boolean().default(true),
      maxTextureSize: z.number().positive().default(1024),
    })
    .default({}),

  fonts: z
    .object({
      /** Experimental: subsetting is not performed in v1 */
      subsetting: z.literal(false).default(false),
    })
    .default({}),

  /** Reference migration settings */
  references: z
    .object({
      /** Automatically update CSS/HTML references after format conversion */
      autoUpdateCss: z.boolean().default(false),
      autoUpdateHtml: z.boolean().default(false),
      /** Never auto-update JSX/TSX references */
      autoUpdateJsx: z.literal(false).default(false),
    })
    .default({}),

  /** Processing limits */
  limits: z
    .object({
      /** Max file size (bytes) to process. Larger files are skipped. */
      maxFileSizeBytes: z
        .number()
        .positive()
        .default(500 * 1024 * 1024), // 500MB
      /** Max concurrent optimization jobs */
      concurrency: z.number().min(1).max(32).default(4),
      /** Per-asset timeout in milliseconds */
      timeoutMs: z.number().positive().default(60_000),
    })
    .default({}),
});

export type AssetDietConfig = z.infer<typeof AssetDietConfigSchema>;

/** Parse and validate a raw config object */
export function parseConfig(raw: unknown): AssetDietConfig {
  return AssetDietConfigSchema.parse(raw);
}

/** Resolve config with defaults */
export function defaultConfig(): AssetDietConfig {
  return AssetDietConfigSchema.parse({});
}
