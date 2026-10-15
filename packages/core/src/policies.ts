/**
 * AssetDiet Core — Optimization Policies
 * Defines the allowed optimization modes and their constraints.
 */

export const OPTIMIZATION_POLICIES = ['audit', 'safe', 'balanced', 'aggressive'] as const;
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
  /** Minimum SSIM score to accept an image optimization */
  minSsimScore: number;
  /** Maximum acceptable file size increase (0 = never allow larger output) */
  maxSizeIncreaseFactor: number;
  /** Skip assets already optimized within this factor of current size */
  alreadyOptimizedThreshold: number;
}

export const POLICY_CONSTRAINTS: Readonly<Record<OptimizationPolicy, PolicyConstraints>> = {
  audit: {
    allowWrites: false,
    allowFormatConversion: false,
    allowResize: false,
    allowTranscode: false,
    allow3DCompression: false,
    allowReferenceMigration: false,
    minSsimScore: 1.0,
    maxSizeIncreaseFactor: 0,
    alreadyOptimizedThreshold: 0.95,
  },
  safe: {
    allowWrites: true,
    allowFormatConversion: false, // only lossless improvements to same format
    allowResize: false,
    allowTranscode: false,
    allow3DCompression: false,
    allowReferenceMigration: false,
    minSsimScore: 0.98,
    maxSizeIncreaseFactor: 0,
    alreadyOptimizedThreshold: 0.95,
  },
  balanced: {
    allowWrites: true,
    allowFormatConversion: true,
    allowResize: true,
    allowTranscode: true,
    allow3DCompression: true,
    allowReferenceMigration: true,
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
    minSsimScore: 0.88,
    maxSizeIncreaseFactor: 0,
    alreadyOptimizedThreshold: 0.8,
  },
} as const;

export function getPolicyConstraints(policy: OptimizationPolicy): PolicyConstraints {
  return POLICY_CONSTRAINTS[policy];
}
