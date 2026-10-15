import { describe, it, expect } from "vitest";
import { createOptimizationPlan } from "../index.js";
import type { AssetGraph } from "@assetdiet/asset-graph";

describe("createOptimizationPlan", () => {
  const mockGraph: AssetGraph = {
    assets: new Map(),
    duplicateGroups: [],
    opportunities: [
      {
        asset: {
          path: "/repo/logo.png",
          relativePath: "logo.png",
          type: "image",
          sizeBytes: 100_000,
          hash: "abc",
          metadata: null,
          references: [],
          isDuplicate: false,
          isUnreferenced: false,
          extension: ".png",
          lastModified: new Date(),
        },
        action: "compress",
        estimatedSavingsBytes: 30_000,
        confidence: 0.8,
        risk: "none",
        reason: "Image compression",
      },
      {
        asset: {
          path: "/repo/video.mp4",
          relativePath: "video.mp4",
          type: "video",
          sizeBytes: 5_000_000,
          hash: "vid",
          metadata: null,
          references: [],
          isDuplicate: false,
          isUnreferenced: false,
          extension: ".mp4",
          lastModified: new Date(),
        },
        action: "transcode",
        estimatedSavingsBytes: 2_000_000,
        confidence: 0.5,
        risk: "medium",
        reason: "Video transcoding",
      },
    ],
  };

  it("filters tasks based on policy level", () => {
    // Under 'safe' policy, medium risk (video) should be excluded
    const safePlan = createOptimizationPlan(mockGraph, "safe");
    expect(safePlan.totalTasks).toBe(1);
    expect(safePlan.tasks[0]?.assetType).toBe("image");

    // Under 'balanced' policy, medium risk tasks are included
    const balancedPlan = createOptimizationPlan(mockGraph, "balanced");
    expect(balancedPlan.totalTasks).toBe(2);
  });
});
