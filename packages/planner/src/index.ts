/**
 * AssetDiet Planner — Builds optimization execution plans
 */

import type {
  AssetGraph,
  OptimizationOpportunity,
  RiskLevel,
} from "@assetdiet/asset-graph";
import type { OptimizationPolicy } from "@assetdiet/core";

export interface OptimizationTask {
  id: string;
  assetPath: string;
  assetType: string;
  action:
    | "compress"
    | "convert-format"
    | "resize"
    | "transcode"
    | "remove-duplicate"
    | "flag-unused";
  estimatedSavingsBytes: number;
  confidence: number;
  risk: RiskLevel;
  requiredPolicy: OptimizationPolicy;
  reason: string;
}

export interface OptimizationPlan {
  totalTasks: number;
  estimatedTotalSavingsBytes: number;
  tasks: OptimizationTask[];
  dryRun: boolean;
}

const POLICY_LEVELS: Record<OptimizationPolicy, number> = {
  audit: 0,
  safe: 1,
  balanced: 2,
  aggressive: 3,
};

function getRequiredPolicyForRisk(risk: RiskLevel): OptimizationPolicy {
  switch (risk) {
    case "none":
      return "safe";
    case "low":
      return "safe";
    case "medium":
      return "balanced";
    case "high":
      return "aggressive";
  }
}

/**
 * Filter and convert graph opportunities into an actionable OptimizationPlan.
 */
export function createOptimizationPlan(
  graph: AssetGraph,
  policy: OptimizationPolicy = "safe",
  dryRun = false,
): OptimizationPlan {
  const isAudit = policy === "audit";
  const effectivePolicy = isAudit ? "safe" : policy;
  const currentPolicyLevel = POLICY_LEVELS[effectivePolicy];
  const isDry = dryRun || isAudit;
  const tasks: OptimizationTask[] = [];
  let estimatedTotalSavingsBytes = 0;

  for (let i = 0; i < graph.opportunities.length; i++) {
    const opp = graph.opportunities[i]!;
    const reqPolicy = getRequiredPolicyForRisk(opp.risk);

    // If task requires format conversion but current policy does not allow it (e.g. safe policy),
    // adapt into a lossless, same-extension compression task!
    if (
      opp.action === "convert-format" &&
      currentPolicyLevel < POLICY_LEVELS.balanced
    ) {
      tasks.push({
        id: `task-${i + 1}`,
        assetPath: opp.asset.path,
        assetType: opp.asset.type,
        action: "compress",
        estimatedSavingsBytes: Math.round(opp.asset.sizeBytes * 0.15),
        confidence: 0.7,
        risk: "none",
        requiredPolicy: "safe",
        reason: `${opp.asset.extension.toUpperCase().slice(1)} (${(opp.asset.sizeBytes / 1024).toFixed(0)}KB) — lossless in-place compression under safe policy`,
      });

      estimatedTotalSavingsBytes += Math.round(
        opp.asset.sizeBytes * 0.15 * 0.7,
      );
      continue;
    }

    // Only include tasks permitted by current policy level
    if (POLICY_LEVELS[reqPolicy] <= currentPolicyLevel) {
      tasks.push({
        id: `task-${i + 1}`,
        assetPath: opp.asset.path,
        assetType: opp.asset.type,
        action: opp.action,
        estimatedSavingsBytes: opp.estimatedSavingsBytes,
        confidence: opp.confidence,
        risk: opp.risk,
        requiredPolicy: reqPolicy,
        reason: opp.reason,
      });

      estimatedTotalSavingsBytes += Math.round(
        opp.estimatedSavingsBytes * opp.confidence,
      );
    }
  }

  return {
    totalTasks: tasks.length,
    estimatedTotalSavingsBytes,
    tasks,
    dryRun,
  };
}
