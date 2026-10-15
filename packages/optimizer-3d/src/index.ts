/**
 * AssetDiet 3D Optimizer — glTF-Transform Adapter
 * Runs dedup, prune, weld, and resample pipelines on GLB/GLTF models.
 */

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, resample } from '@gltf-transform/functions';
import fs from 'node:fs';
import path from 'node:path';
import type { OptimizationPolicy } from '@assetdiet/core';

export interface Model3DOptimizeOptions {
  weldTolerance?: number;
  pruneUnused?: boolean;
  resampleAnimations?: boolean;
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
  _policy: OptimizationPolicy = 'safe'
): Promise<Model3DOptimizeResult> {
  const stat = await fs.promises.stat(src);
  const originalSizeBytes = stat.size;

  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const document = await io.read(src);

  // Apply non-destructive transforms
  await document.transform(
    dedup(),
    prune(),
    weld(),
    resample()
  );

  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  await io.write(dest, document);

  const destStat = await fs.promises.stat(dest);
  const optimizedSizeBytes = destStat.size;

  if (optimizedSizeBytes >= originalSizeBytes) {
    if (src !== dest) {
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
      reason: 'Optimized 3D model was not smaller than original; original preserved',
    };
  }

  const savedBytes = originalSizeBytes - optimizedSizeBytes;
  const savedPercentage = Number(((savedBytes / originalSizeBytes) * 100).toFixed(2));

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
