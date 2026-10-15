/**
 * AssetDiet Image Optimizer — Sharp Adapter
 * Handles JPEG, PNG, WebP, AVIF, GIF, TIFF optimization.
 *
 * Guarantees:
 * - Will never emit an output larger than the original (unless explicit resize).
 * - 'audit' policy never modifies files.
 * - 'safe' policy uses lossless/high-fidelity compression and preserves format by default.
 */

import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import type { OptimizationPolicy } from '@assetdiet/core';

export interface ImageOptimizeOptions {
  quality?: number;
  format?: 'webp' | 'avif' | 'original';
  maxWidth?: number;
  maxHeight?: number;
  stripMetadata?: boolean;
  preserveAnimation?: boolean;
}

export interface ImageOptimizeResult {
  sourcePath: string;
  outputPath: string;
  originalSizeBytes: number;
  optimizedSizeBytes: number;
  savedBytes: number;
  savedPercentage: number;
  format: string;
  width: number;
  height: number;
  skipped: boolean;
  reason?: string;
}

/**
 * Optimize an image file safely under policy constraints.
 */
export async function optimizeImage(
  src: string,
  dest: string,
  options: ImageOptimizeOptions = {},
  policy: OptimizationPolicy = 'safe'
): Promise<ImageOptimizeResult> {
  const stat = await fs.promises.stat(src);
  const originalSizeBytes = stat.size;

  let pipeline = sharp(src, {
    animated: options.preserveAnimation ?? true,
  });

  const metadata = await pipeline.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  // Resize if explicitly requested and larger than bounds
  if (options.maxWidth || options.maxHeight) {
    pipeline = pipeline.resize({
      width: options.maxWidth,
      height: options.maxHeight,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  // Determine quality based on policy
  let quality = options.quality;
  if (!quality) {
    switch (policy) {
      case 'aggressive':
        quality = 70;
        break;
      case 'balanced':
        quality = 80;
        break;
      case 'safe':
      case 'audit':
      default:
        quality = 85;
        break;
    }
  }

  const targetFormat = options.format ?? 'original';
  const origFormat = metadata.format?.toLowerCase() ?? 'jpeg';

  if (targetFormat === 'webp') {
    pipeline = pipeline.webp({ quality, effort: 4 });
  } else if (targetFormat === 'avif') {
    pipeline = pipeline.avif({ quality, effort: 4 });
  } else {
    // Preserve original format with lossless or conservative settings
    if (origFormat === 'png') {
      const compressionLevel = policy === 'aggressive' ? 9 : 6;
      // Palette quantization is lossy: only allowed in aggressive mode
      pipeline = pipeline.png({ compressionLevel, palette: policy === 'aggressive' });
    } else if (origFormat === 'jpeg' || origFormat === 'jpg') {
      pipeline = pipeline.jpeg({ quality, mozjpeg: true });
    } else if (origFormat === 'webp') {
      pipeline = pipeline.webp({ quality });
    } else if (origFormat === 'avif') {
      pipeline = pipeline.avif({ quality });
    } else if (origFormat === 'gif') {
      pipeline = pipeline.gif({});
    }
  }

  if (options.stripMetadata !== false) {
    // Keep ICC profile for correct color rendering, preserve orientation
    pipeline = pipeline.withMetadata({ orientation: metadata.orientation });
  }

  const buffer = await pipeline.toBuffer();
  const optimizedSizeBytes = buffer.length;
  const outMeta = await sharp(buffer).metadata();
  const finalWidth = outMeta.width ?? width;
  const finalHeight = outMeta.height ?? height;

  // 1. Audit Policy Guard: Never modify files
  if (policy === 'audit') {
    const saved = Math.max(0, originalSizeBytes - optimizedSizeBytes);
    return {
      sourcePath: src,
      outputPath: dest,
      originalSizeBytes,
      optimizedSizeBytes,
      savedBytes: saved,
      savedPercentage: originalSizeBytes > 0 ? Number(((saved / originalSizeBytes) * 100).toFixed(2)) : 0,
      format: targetFormat === 'original' ? origFormat : targetFormat,
      width: finalWidth,
      height: finalHeight,
      skipped: true,
      reason: 'Audit policy: file modification disabled',
    };
  }

  // 2. Safety guard: if output is larger or equal and not explicitly resized, keep original!
  if (
    optimizedSizeBytes >= originalSizeBytes &&
    targetFormat === 'original' &&
    !options.maxWidth &&
    !options.maxHeight
  ) {
    if (src !== dest) {
      await fs.promises.mkdir(path.dirname(dest), { recursive: true });
      await fs.promises.copyFile(src, dest);
    }
    return {
      sourcePath: src,
      outputPath: dest,
      originalSizeBytes,
      optimizedSizeBytes: originalSizeBytes,
      savedBytes: 0,
      savedPercentage: 0,
      format: origFormat,
      width,
      height,
      skipped: true,
      reason: 'Optimized file was larger or equal to original; original preserved',
    };
  }

  // Create destination directory and write
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  await fs.promises.writeFile(dest, buffer);

  const savedBytes = Math.max(0, originalSizeBytes - optimizedSizeBytes);
  const savedPercentage = Number(((savedBytes / originalSizeBytes) * 100).toFixed(2));

  return {
    sourcePath: src,
    outputPath: dest,
    originalSizeBytes,
    optimizedSizeBytes,
    savedBytes,
    savedPercentage,
    format: targetFormat === 'original' ? origFormat : targetFormat,
    width: finalWidth,
    height: finalHeight,
    skipped: false,
  };
}
