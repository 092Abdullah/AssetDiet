/**
 * AssetDiet Validation Engine — Quality Gates
 * Validates optimized outputs for corruption, regression, and integrity.
 */

import sharp from 'sharp';
import fs from 'node:fs';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate an image file post-optimization.
 * Checks that the file can be decoded, dimensions are preserved (unless resized),
 * and alpha channel is preserved if expected.
 */
export async function validateImage(
  originalPath: string,
  optimizedPath: string,
  options: { allowResize?: boolean } = {}
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
 * Validate an SVG file post-optimization.
 */
export async function validateSvg(optimizedPath: string): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const content = await fs.promises.readFile(optimizedPath, 'utf-8');

    if (!content.includes('<svg') || !content.includes('</svg>')) {
      errors.push('SVG does not contain valid opening and closing <svg> tags');
    }

    if (!content.includes('viewBox')) {
      warnings.push('Optimized SVG does not have a viewBox attribute; scalable rendering may fail');
    }

    if (/<script\b/i.test(content)) {
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
