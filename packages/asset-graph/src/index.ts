/**
 * AssetDiet Asset Graph — Duplicate Detection and Opportunity Ranking
 */

import type { AssetRecord } from "@assetdiet/core";
import type { ScanResult } from "@assetdiet/scanner";

export interface DuplicateGroup {
  hash: string;
  assets: AssetRecord[];
  /** Total wasted bytes (size × (count - 1)) */
  wastedBytes: number;
}

export type RiskLevel = "none" | "low" | "medium" | "high";

export interface OptimizationOpportunity {
  asset: AssetRecord;
  action:
    | "compress"
    | "convert-format"
    | "resize"
    | "transcode"
    | "remove-duplicate"
    | "flag-unused";
  /** Estimated savings in bytes (may be imprecise before actual optimization) */
  estimatedSavingsBytes: number;
  /** Confidence in the estimate (0–1) */
  confidence: number;
  /** Risk of visual/functional regression */
  risk: RiskLevel;
  /** Human-readable reason */
  reason: string;
}

export interface AssetGraph {
  assets: Map<string, AssetRecord>;
  duplicateGroups: DuplicateGroup[];
  opportunities: OptimizationOpportunity[];
}

/**
 * Build the asset graph from a scan result.
 * Detects exact duplicates by content hash and ranks optimization opportunities.
 */
export function buildAssetGraph(scan: ScanResult): AssetGraph {
  const assets = new Map<string, AssetRecord>();
  const hashGroups = new Map<string, AssetRecord[]>();

  // Index all assets
  for (const asset of scan.assets) {
    assets.set(asset.path, asset);

    // Group by content hash
    const group = hashGroups.get(asset.hash);
    if (group) {
      group.push(asset);
    } else {
      hashGroups.set(asset.hash, [asset]);
    }
  }

  // Mark duplicates
  const duplicateGroups: DuplicateGroup[] = [];
  for (const [hash, group] of hashGroups) {
    if (group.length > 1) {
      for (const asset of group) {
        asset.isDuplicate = true;
        // Mark all but the first as duplicates of the first
        const first = group[0];
        if (first && asset.path !== first.path) {
          asset.duplicateOf = first.hash;
        }
      }

      const wastedBytes = (group.length - 1) * (group[0]?.sizeBytes ?? 0);
      duplicateGroups.push({ hash, assets: group, wastedBytes });
    }
  }

  // Rank opportunities
  const opportunities = rankOpportunities(scan.assets);

  return { assets, duplicateGroups, opportunities };
}

/**
 * Rank optimization opportunities by estimated value.
 * Sorted by: estimatedSavingsBytes × confidence (descending).
 */
function rankOpportunities(assets: AssetRecord[]): OptimizationOpportunity[] {
  const opps: OptimizationOpportunity[] = [];

  for (const asset of assets) {
    const opp = analyzeOpportunity(asset);
    if (opp) opps.push(opp);
  }

  // Sort by value (savings × confidence) descending
  return opps.sort(
    (a, b) =>
      b.estimatedSavingsBytes * b.confidence -
      a.estimatedSavingsBytes * a.confidence,
  );
}

/**
 * Analyze a single asset and produce an optimization opportunity if one exists.
 */
function analyzeOpportunity(
  asset: AssetRecord,
): OptimizationOpportunity | null {
  if (asset.isDuplicate && asset.duplicateOf) {
    return {
      asset,
      action: "remove-duplicate",
      estimatedSavingsBytes: asset.sizeBytes,
      confidence: 1.0,
      risk: "low",
      reason: `Exact duplicate of another file (hash: ${asset.duplicateOf.slice(0, 8)}...)`,
    };
  }

  if (asset.type === "image") {
    return analyzeImageOpportunity(asset);
  }

  if (asset.type === "svg") {
    return analyzeSvgOpportunity(asset);
  }

  if (asset.type === "video") {
    return analyzeVideoOpportunity(asset);
  }

  if (asset.type === "3d") {
    return analyze3DOpportunity(asset);
  }

  return null;
}

function analyzeImageOpportunity(
  asset: AssetRecord,
): OptimizationOpportunity | null {
  if (asset.sizeBytes < 10_000) return null;

  const meta = asset.metadata?.type === "image" ? asset.metadata.data : null;

  // If it's a PNG or JPEG without animation, format conversion to WebP gives huge gains (40-70%)
  if (
    (asset.extension === ".png" ||
      asset.extension === ".jpg" ||
      asset.extension === ".jpeg") &&
    (!meta || !meta.isAnimated)
  ) {
    return {
      asset,
      action: "convert-format",
      estimatedSavingsBytes: Math.round(asset.sizeBytes * 0.5),
      confidence: 0.85,
      risk: "medium", // Requires balanced or aggressive policy
      reason: `${asset.extension.toUpperCase().slice(1)} (${(asset.sizeBytes / 1024).toFixed(0)}KB) — WebP conversion typically saves 40-70% safely`,
    };
  }

  // Large images: suggest in-place compression
  if (asset.sizeBytes > 25_000) {
    return {
      asset,
      action: "compress",
      estimatedSavingsBytes: Math.round(asset.sizeBytes * 0.2),
      confidence: 0.7,
      risk: "none",
      reason: `Image (${(asset.sizeBytes / 1024).toFixed(0)}KB) — lossless compression reduces size safely`,
    };
  }

  return null;
}

function analyzeSvgOpportunity(
  asset: AssetRecord,
): OptimizationOpportunity | null {
  if (asset.sizeBytes < 500) return null;

  return {
    asset,
    action: "compress",
    estimatedSavingsBytes: Math.round(asset.sizeBytes * 0.3),
    confidence: 0.8,
    risk: "none",
    reason: `SVG (${(asset.sizeBytes / 1024).toFixed(0)}KB) — SVGO typically reduces SVG size by 20-40%`,
  };
}

function analyzeVideoOpportunity(
  asset: AssetRecord,
): OptimizationOpportunity | null {
  if (asset.sizeBytes < 1_000_000) return null; // < 1MB, skip

  return {
    asset,
    action: "transcode",
    estimatedSavingsBytes: Math.round(asset.sizeBytes * 0.3),
    confidence: 0.5,
    risk: "medium",
    reason: `Video (${(asset.sizeBytes / 1024 / 1024).toFixed(1)}MB) — transcoding with optimized CRF can reduce size`,
  };
}

function analyze3DOpportunity(
  asset: AssetRecord,
): OptimizationOpportunity | null {
  if (asset.sizeBytes < 100_000) return null;

  return {
    asset,
    action: "compress",
    estimatedSavingsBytes: Math.round(asset.sizeBytes * 0.4),
    confidence: 0.6,
    risk: "low",
    reason: `3D model (${(asset.sizeBytes / 1024).toFixed(0)}KB) — Draco compression typically saves 30-60%`,
  };
}

export { buildAssetGraph as default };
