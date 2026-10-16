/**
 * AssetDiet Core — Optimization Policies
 * Defines the allowed optimization modes and their constraints.
 */

export const OPTIMIZATION_POLICIES = [
  "audit",
  "safe",
  "balanced",
  "aggressive",
] as const;
export type OptimizationPolicy = (typeof OPTIMIZATION_POLICIES)[number];

export interface PolicyConstraints {
  /** Allow any file writes */
  allowWrites: boolean;
  /** Allow format conversion (e.g. PNG→WebP) */
  allowFormatConversion: boolean;
  /** Allow image resizing */
  allowResize: boolean;
  /** Allow video transcoding */
  allowTranscode: boolean;
  /** Allow 3D geometry compression */
  allow3DCompression: boolean;
  /** Allow updating source file references */
  allowReferenceMigration: boolean;
  /** Default image quality target (0–100) */
  defaultQuality: number;
  /** Max image dimension (px), or null if preservation is required */
  maxDimension: number | null;
  /** Preferred target format for image conversions */
  targetFormat: "original" | "webp" | "avif";
  /** Minimum SSIM score to accept an image optimization */
  minSsimScore: number;
  /** Maximum acceptable file size increase (0 = never allow larger output) */
  maxSizeIncreaseFactor: number;
  /** Skip assets already optimized within this factor of current size */
  alreadyOptimizedThreshold: number;
}

export const POLICY_CONSTRAINTS: Readonly<
  Record<OptimizationPolicy, PolicyConstraints>
> = {
  audit: {
    allowWrites: false,
    allowFormatConversion: false,
    allowResize: false,
    allowTranscode: false,
    allow3DCompression: false,
    allowReferenceMigration: false,
    defaultQuality: 85,
    maxDimension: null,
    targetFormat: "original",
    minSsimScore: 1.0,
    maxSizeIncreaseFactor: 0,
    alreadyOptimizedThreshold: 0.95,
  },
  safe: {
    allowWrites: true,
    allowFormatConversion: false, // strictly lossless / same-extension
    allowResize: false,
    allowTranscode: false,
    allow3DCompression: false,
    allowReferenceMigration: false,
    defaultQuality: 85,
    maxDimension: null,
    targetFormat: "original",
    minSsimScore: 0.98,
    maxSizeIncreaseFactor: 0,
    alreadyOptimizedThreshold: 0.95,
  },
  balanced: {
    allowWrites: true,
    allowFormatConversion: true, // high quality PNG/JPEG -> WebP
    allowResize: false, // preserve original dimensions by default
    allowTranscode: true,
    allow3DCompression: true,
    allowReferenceMigration: true,
    defaultQuality: 85, // high quality ~85, near imperceptible visual difference
    maxDimension: null,
    targetFormat: "webp",
    minSsimScore: 0.95,
    maxSizeIncreaseFactor: 0,
    alreadyOptimizedThreshold: 0.9,
  },
  aggressive: {
    allowWrites: true,
    allowFormatConversion: true,
    allowResize: true,
    allowTranscode: true,
    allow3DCompression: true,
    allowReferenceMigration: true,
    defaultQuality: 75, // aggressive compression ~75
    maxDimension: 2560, // cap excessively large images >2560px
    targetFormat: "webp",
    minSsimScore: 0.88,
    maxSizeIncreaseFactor: 0,
    alreadyOptimizedThreshold: 0.8,
  },
} as const;

export function getPolicyConstraints(
  policy: OptimizationPolicy,
): PolicyConstraints {
  return POLICY_CONSTRAINTS[policy];
}
