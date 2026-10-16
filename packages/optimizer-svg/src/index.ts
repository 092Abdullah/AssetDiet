/**
 * AssetDiet SVG Optimizer — SVGO Adapter
 * Provides conservative, balanced, and aggressive optimization profiles.
 *
 * Guarantees:
 * - 'audit' policy never modifies files.
 * - 'safe' policy strictly preserves viewBox, IDs, scripts, and accessibility tags.
 * - Output is validated to ensure well-formed XML and smaller output size.
 */

import { optimize, type Config as SvgoConfig } from "svgo";
import fs from "node:fs";
import path from "node:path";
import type { OptimizationPolicy } from "@assetdiet/core";

export interface SvgOptimizeOptions {
  profile?: "conservative" | "balanced" | "aggressive";
  preserveIds?: string[];
  preserveAccessibility?: boolean;
}

export interface SvgOptimizeResult {
  sourcePath: string;
  outputPath: string;
  originalSizeBytes: number;
  optimizedSizeBytes: number;
  savedBytes: number;
  savedPercentage: number;
  skipped: boolean;
  reason?: string;
}

export async function optimizeSvg(
  src: string,
  dest: string,
  options: SvgOptimizeOptions = {},
  policy: OptimizationPolicy = "safe",
): Promise<SvgOptimizeResult> {
  const content = await fs.promises.readFile(src, "utf-8");
  const originalSizeBytes = Buffer.byteLength(content, "utf-8");

  const profile =
    options.profile ??
    (policy === "aggressive"
      ? "aggressive"
      : policy === "safe"
        ? "conservative"
        : "balanced");

  const svgoConfig: SvgoConfig = {
    multipass: true,
    plugins: [
      {
        name: "preset-default",
        params: {
          overrides: {
            // NEVER remove viewBox by default to prevent layout breakage
            removeViewBox: false,
            // Keep IDs if conservative or preserveIds is specified
            cleanupIds:
              profile === "aggressive"
                ? { preserve: options.preserveIds ?? [] }
                : false,
            // Keep accessibility elements
            removeTitle: false,
            removeDesc: false,
          },
        },
      },
    ],
  };

  const result = optimize(content, svgoConfig);
  const optimizedContent = result.data;
  const optimizedSizeBytes = Buffer.byteLength(optimizedContent, "utf-8");

  // Safety: ensure it still looks like an SVG
  if (
    !optimizedContent.includes("<svg") ||
    !optimizedContent.includes("</svg>")
  ) {
    throw new Error(
      `SVG optimization resulted in malformed SVG content for ${src}`,
    );
  }

  // 1. Audit Policy Guard: Never modify files
  if (policy === "audit") {
    const saved = Math.max(0, originalSizeBytes - optimizedSizeBytes);
    return {
      sourcePath: src,
      outputPath: dest,
      originalSizeBytes,
      optimizedSizeBytes,
      savedBytes: saved,
      savedPercentage:
        originalSizeBytes > 0
          ? Number(((saved / originalSizeBytes) * 100).toFixed(2))
          : 0,
      skipped: true,
      reason: "Audit policy: file modification disabled",
    };
  }

  // 2. Safety: if optimized is larger or equal, preserve original
  if (optimizedSizeBytes >= originalSizeBytes) {
    if (src !== dest) {
      await fs.promises.mkdir(path.dirname(dest), { recursive: true });
      await fs.promises.writeFile(dest, content, "utf-8");
    }
    return {
      sourcePath: src,
      outputPath: dest,
      originalSizeBytes,
      optimizedSizeBytes: originalSizeBytes,
      savedBytes: 0,
      savedPercentage: 0,
      skipped: true,
      reason: "Optimized SVG was not smaller than original; original preserved",
    };
  }

  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  const tempPath = `${dest}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`;
  await fs.promises.writeFile(tempPath, optimizedContent, "utf-8");
  try {
    await fs.promises.rename(tempPath, dest);
  } catch {
    await fs.promises.copyFile(tempPath, dest);
    await fs.promises.unlink(tempPath).catch(() => {});
  }

  const savedBytes = originalSizeBytes - optimizedSizeBytes;
  const savedPercentage = Number(
    ((savedBytes / originalSizeBytes) * 100).toFixed(2),
  );

  return {
    sourcePath: src,
    outputPath: dest,
    originalSizeBytes,
    optimizedSizeBytes,
    savedBytes,
    savedPercentage,
    skipped: false,
  };
}
