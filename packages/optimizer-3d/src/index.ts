/**
 * AssetDiet 3D Optimizer — glTF-Transform Adapter
 * Runs dedup, prune, weld, and resample pipelines on GLB/GLTF models,
 * with geometry compression (Draco) support where available.
 *
 * Guarantees:
 * - In-place operations (src === dest) use safe temporary files to prevent corruption.
 * - Files are only replaced if the optimized output is strictly smaller and decodable.
 * - 'audit' policy never modifies files; 'safe' policy avoids lossy geometry alteration.
 */

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, weld, resample, draco } from "@gltf-transform/functions";
import fs from "node:fs";
import path from "node:path";
import type { OptimizationPolicy } from "@assetdiet/core";

export interface Model3DOptimizeOptions {
  weldTolerance?: number;
  pruneUnused?: boolean;
  resampleAnimations?: boolean;
  enableDraco?: boolean;
}

export interface Model3DOptimizeResult {
  sourcePath: string;
  outputPath: string;
  originalSizeBytes: number;
  optimizedSizeBytes: number;
  savedBytes: number;
  savedPercentage: number;
  skipped: boolean;
  reason?: string;
}

export async function optimize3D(
  src: string,
  dest: string,
  options: Model3DOptimizeOptions = {},
  policy: OptimizationPolicy = "safe",
): Promise<Model3DOptimizeResult> {
  const stat = await fs.promises.stat(src);
  const originalSizeBytes = stat.size;

  // 1. Audit Policy Guard: Never modify files
  if (policy === "audit") {
    return {
      sourcePath: src,
      outputPath: dest,
      originalSizeBytes,
      optimizedSizeBytes: originalSizeBytes,
      savedBytes: 0,
      savedPercentage: 0,
      skipped: true,
      reason: "Audit policy: file modification disabled",
    };
  }

  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const document = await io.read(src);

  // 2. Select transforms based on policy
  if (policy === "safe") {
    // Safe policy: strictly lossless deduplication and pruning only
    await document.transform(dedup(), prune());
  } else {
    // Balanced / Aggressive: deduplicate, prune, weld close vertices, resample animation tracks
    const transforms: any[] = [dedup(), prune(), weld(), resample()];

    // Draco geometry compression if explicitly enabled or aggressive policy
    if (options.enableDraco || policy === "aggressive") {
      try {
        transforms.push(draco());
      } catch {
        // Fallback gracefully if draco3d encoder is unavailable in runtime
      }
    }

    try {
      await (document.transform as any)(...transforms);
    } catch {
      // If combined transforms fail (e.g. Draco encoder missing), fallback to safe transforms
      await document.transform(dedup(), prune());
    }
  }

  const destDir = path.dirname(dest);
  await fs.promises.mkdir(destDir, { recursive: true });

  // Use a temporary output file so in-place operations never truncate original
  const tempOutputFile = path.join(
    destDir,
    `.${path.basename(dest)}.assetdiet-tmp-${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(dest)}`,
  );

  try {
    await io.write(tempOutputFile, document);
    const tempStat = await fs.promises.stat(tempOutputFile);
    const optimizedSizeBytes = tempStat.size;

    // Safety guard: if output is larger or 0 bytes, discard and keep original
    if (optimizedSizeBytes >= originalSizeBytes || optimizedSizeBytes === 0) {
      await fs.promises.unlink(tempOutputFile).catch(() => {});
      if (src !== dest && !fs.existsSync(dest)) {
        await fs.promises.copyFile(src, dest);
      }
      return {
        sourcePath: src,
        outputPath: dest,
        originalSizeBytes,
        optimizedSizeBytes: originalSizeBytes,
        savedBytes: 0,
        savedPercentage: 0,
        skipped: true,
        reason:
          "Optimized 3D model was not smaller than original; original preserved",
      };
    }

    // Deep validation: verify the written file can be parsed back
    const verifyDoc = await io.read(tempOutputFile);
    if (!verifyDoc.getRoot()) {
      throw new Error(
        "Optimized 3D model verification failed: missing scene root",
      );
    }

    // Atomic replacement
    try {
      await fs.promises.rename(tempOutputFile, dest);
    } catch {
      await fs.promises.copyFile(tempOutputFile, dest);
      await fs.promises.unlink(tempOutputFile).catch(() => {});
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
  } catch (err) {
    await fs.promises.unlink(tempOutputFile).catch(() => {});
    throw err;
  }
}
