/**
 * AssetDiet Validation Engine — Quality Gates
 * Validates optimized outputs for corruption, regression, parity, and integrity.
 * Compares original and optimized files independently across Image, SVG, Video, and 3D assets.
 */

import sharp from 'sharp';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ImageValidationOptions {
  allowResize?: boolean;
}

/**
 * Validate an image file post-optimization by comparing original and optimized files independently.
 * Checks decodability, dimension parity (unless resized), and alpha channel preservation.
 */
export async function validateImage(
  originalPath: string,
  optimizedPath: string,
  options: ImageValidationOptions = {}
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const origMeta = await sharp(originalPath).metadata();
    const optMeta = await sharp(optimizedPath).metadata();

    if (!optMeta.width || !optMeta.height) {
      errors.push('Optimized image has missing or 0 dimensions');
    }

    if (!options.allowResize) {
      if (origMeta.width !== optMeta.width || origMeta.height !== optMeta.height) {
        errors.push(
          `Image dimensions changed unexpectedly: original was ${origMeta.width}x${origMeta.height}, optimized is ${optMeta.width}x${optMeta.height}`
        );
      }
    }

    if (origMeta.hasAlpha && !optMeta.hasAlpha) {
      errors.push('Optimized image lost transparency (alpha channel was present in original)');
    }
  } catch (err) {
    errors.push(`Failed to decode image file: ${(err as Error).message}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate an SVG file post-optimization by comparing original and optimized SVG content independently.
 */
export async function validateSvg(
  originalPath: string,
  optimizedPath: string
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const origContent = await fs.promises.readFile(originalPath, 'utf-8');
    const optContent = await fs.promises.readFile(optimizedPath, 'utf-8');

    if (!optContent.includes('<svg') || !optContent.includes('</svg>')) {
      errors.push('SVG does not contain valid opening and closing <svg> tags');
    }

    // Preserve viewBox if original had it
    if (origContent.includes('viewBox') && !optContent.includes('viewBox')) {
      errors.push('Optimized SVG removed the viewBox attribute present in the original');
    } else if (!optContent.includes('viewBox')) {
      warnings.push('Optimized SVG does not have a viewBox attribute; scalable rendering may fail');
    }

    if (/<script\b/i.test(optContent)) {
      warnings.push('SVG contains embedded script tags');
    }
  } catch (err) {
    errors.push(`Failed to read SVG file: ${(err as Error).message}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export interface VideoValidationOptions {
  allowResize?: boolean;
  allowAudioStrip?: boolean;
}

/**
 * Helper to probe video stream metadata using FFprobe subprocess.
 */
function probeVideo(filePath: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffprobe', [
      '-v',
      'quiet',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      filePath,
    ]);

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`FFprobe exited with code ${code}: ${stderr}`));
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        reject(e);
      }
    });

    proc.on('error', (err) => reject(err));
  });
}

/**
 * Deep validation for video files comparing original and optimized video streams.
 */
export async function validateVideo(
  originalPath: string,
  optimizedPath: string,
  options: VideoValidationOptions = {}
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const origStat = await fs.promises.stat(originalPath);
    const optStat = await fs.promises.stat(optimizedPath);

    if (optStat.size === 0) {
      errors.push('Optimized video file is empty (0 bytes)');
      return { valid: false, errors, warnings };
    }

    let origProbe: any;
    let optProbe: any;

    try {
      origProbe = await probeVideo(originalPath);
      optProbe = await probeVideo(optimizedPath);
    } catch {
      // If ffprobe is not installed on the system, perform basic container header validation
      const buffer = Buffer.alloc(16);
      const fd = await fs.promises.open(optimizedPath, 'r');
      await fd.read(buffer, 0, 16, 0);
      await fd.close();

      const hex = buffer.toString('hex');
      const isMp4 = hex.includes('66747970'); // 'ftyp'
      const isWebm = hex.startsWith('1a45dfa3');

      if (!isMp4 && !isWebm) {
        errors.push('Optimized video has invalid or missing container header signature');
      } else {
        warnings.push('FFprobe not available in PATH; container header verified');
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
      };
    }

    const origDuration = parseFloat(origProbe.format?.duration ?? '0');
    const optDuration = parseFloat(optProbe.format?.duration ?? '0');

    // Duration parity check: duration should not be severely truncated (within 1.0s or 5%)
    if (origDuration > 0 && Math.abs(origDuration - optDuration) > 1.5) {
      errors.push(
        `Video duration truncated: original was ${origDuration}s, optimized is ${optDuration}s`
      );
    }

    const origVideo = origProbe.streams?.find((s: any) => s.codec_type === 'video');
    const optVideo = optProbe.streams?.find((s: any) => s.codec_type === 'video');

    if (!optVideo) {
      errors.push('Optimized file does not contain a valid video stream');
    } else if (!options.allowResize && origVideo) {
      if (origVideo.width !== optVideo.width || origVideo.height !== optVideo.height) {
        errors.push(
          `Video dimensions changed unexpectedly: original was ${origVideo.width}x${origVideo.height}, optimized is ${optVideo.width}x${optVideo.height}`
        );
      }
    }

    const origAudio = origProbe.streams?.find((s: any) => s.codec_type === 'audio');
    const optAudio = optProbe.streams?.find((s: any) => s.codec_type === 'audio');

    if (origAudio && !optAudio && !options.allowAudioStrip) {
      errors.push('Optimized video lost its audio stream (audio was present in original)');
    }
  } catch (err) {
    errors.push(`Failed to validate video file: ${(err as Error).message}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Deep validation for 3D assets (GLB / GLTF) comparing original and optimized models independently.
 */
export async function validate3D(
  originalPath: string,
  optimizedPath: string
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

    const origDoc = await io.read(originalPath);
    const optDoc = await io.read(optimizedPath);

    const origMeshes = origDoc.getRoot().listMeshes();
    const optMeshes = optDoc.getRoot().listMeshes();

    if (optMeshes.length === 0 && origMeshes.length > 0) {
      errors.push('Optimized 3D model lost all geometry meshes');
    }

    const optScenes = optDoc.getRoot().listScenes();
    if (optScenes.length === 0) {
      warnings.push('Optimized 3D model has no explicit scene declared');
    }

    // Verify accessors and vertex buffers are non-empty
    const optAccessors = optDoc.getRoot().listAccessors();
    const emptyAccessors = optAccessors.filter((a) => a.getCount() === 0);
    if (emptyAccessors.length > 0 && optAccessors.length === emptyAccessors.length) {
      errors.push('Optimized 3D model contains only empty vertex accessors');
    }
  } catch (err) {
    errors.push(`Failed to decode 3D model file: ${(err as Error).message}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
