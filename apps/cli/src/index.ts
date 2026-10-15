#!/usr/bin/env node
/**
 * AssetDiet Standalone Developer CLI
 */

import { Command } from "commander";
import path from "node:path";
import fs from "node:fs";

import {
  createContext,
  safeResolve,
  type OptimizationPolicy,
} from "@assetdiet/core";
import { scanRepository } from "@assetdiet/scanner";
import { buildAssetGraph } from "@assetdiet/asset-graph";
import { createOptimizationPlan } from "@assetdiet/planner";
import { optimizeImage } from "@assetdiet/optimizer-images";
import { optimizeSvg } from "@assetdiet/optimizer-svg";
import { optimizeVideo } from "@assetdiet/optimizer-video";
import { optimize3D } from "@assetdiet/optimizer-3d";
import {
  rollbackTransaction,
  beginTransaction,
  stageFileModification,
  commitTransaction,
} from "@assetdiet/transactions";
import { generateMarkdownReport, type ReportData } from "@assetdiet/reporting";

const program = new Command();

program
  .name("assetdiet")
  .description(
    "AssetDiet: Full-repository asset intelligence and optimization toolkit",
  )
  .version("0.1.0");

// scan
program
  .command("scan [targetPath]")
  .description("Inventory repository assets")
  .option("--json", "Output results as JSON")
  .action(async (targetPath = ".", options) => {
    const root = path.resolve(targetPath);
    const ctx = createContext({ root });
    const result = await scanRepository(ctx);

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`\n📦 Scanned ${result.rootPath}`);
      console.log(`Total assets found: ${result.assets.length}\n`);
      for (const asset of result.assets.slice(0, 30)) {
        console.log(
          `  [${asset.type.toUpperCase()}] ${asset.relativePath} (${(asset.sizeBytes / 1024).toFixed(1)} KB)`,
        );
      }
      if (result.assets.length > 30) {
        console.log(`  ...and ${result.assets.length - 30} more`);
      }
    }
  });

// audit
program
  .command("audit [targetPath]")
  .description(
    "Audit repository assets for optimization opportunities (read-only)",
  )
  .option(
    "-p, --policy <policy>",
    "Policy: audit, safe, balanced, aggressive",
    "safe",
  )
  .option("--json", "Output results as JSON")
  .action(async (targetPath = ".", options) => {
    const root = path.resolve(targetPath);
    const ctx = createContext({
      root,
      policy: options.policy as OptimizationPolicy,
      dryRun: true,
    });
    const scan = await scanRepository(ctx);
    const graph = buildAssetGraph(scan);
    const plan = createOptimizationPlan(
      graph,
      options.policy as OptimizationPolicy,
      true,
    );

    if (options.json) {
      console.log(
        JSON.stringify({ plan, duplicates: graph.duplicateGroups }, null, 2),
      );
    } else {
      console.log(`\n🔍 AssetDiet Audit Report for ${root}`);
      console.log(`Policy: ${options.policy}`);
      console.log(`Opportunities found: ${plan.totalTasks}`);
      console.log(
        `Potential savings: ${(plan.estimatedTotalSavingsBytes / 1024).toFixed(1)} KB`,
      );
      console.log(`Duplicate groups: ${graph.duplicateGroups.length}\n`);

      for (const task of plan.tasks.slice(0, 20)) {
        console.log(
          `  • [${task.action.toUpperCase()}] ${path.relative(root, task.assetPath)}`,
        );
        console.log(
          `    Savings: ~${(task.estimatedSavingsBytes / 1024).toFixed(1)} KB (${task.reason})`,
        );
      }
    }
  });

// optimize
program
  .command("optimize [targetPath]")
  .description("Run optimization plan on repository assets")
  .option("-p, --policy <policy>", "Policy: safe, balanced, aggressive", "safe")
  .option("--dry-run", "Simulate changes without writing files", false)
  .action(async (targetPath = ".", options) => {
    const root = path.resolve(targetPath);
    const isAudit = options.policy === "audit";
    const isDry = options.dryRun || isAudit;

    const ctx = createContext({
      root,
      policy: options.policy as OptimizationPolicy,
      dryRun: isDry,
    });
    const scan = await scanRepository(ctx);
    const graph = buildAssetGraph(scan);
    const plan = createOptimizationPlan(
      graph,
      options.policy as OptimizationPolicy,
      isDry,
    );

    console.log(
      `\n⚡ Running AssetDiet Optimization on ${root} (${isDry ? "DRY RUN" : "APPLYING"})`,
    );
    console.log(`Tasks to execute: ${plan.totalTasks}\n`);

    const tx = isDry ? null : await beginTransaction(root, ctx.runId);
    let savedBytesTotal = 0;

    for (const task of plan.tasks) {
      if (isDry) {
        console.log(
          `  [SIMULATED] ${path.relative(root, task.assetPath)}: -${(task.estimatedSavingsBytes / 1024).toFixed(1)} KB`,
        );
        savedBytesTotal += task.estimatedSavingsBytes;
        continue;
      }

      if (tx) {
        await stageFileModification(tx, task.assetPath);
      }

      try {
        if (task.assetType === "image") {
          const res = await optimizeImage(
            task.assetPath,
            task.assetPath,
            {},
            options.policy as OptimizationPolicy,
          );
          if (!res.skipped) {
            console.log(
              `  [OPTIMIZED] ${path.relative(root, task.assetPath)}: ${(res.originalSizeBytes / 1024).toFixed(1)}KB -> ${(res.optimizedSizeBytes / 1024).toFixed(1)}KB (-${res.savedPercentage}%)`,
            );
            savedBytesTotal += res.savedBytes;
          } else {
            console.log(
              `  [SKIPPED] ${path.relative(root, task.assetPath)}: ${res.reason ?? "already optimal"}`,
            );
          }
        } else if (task.assetType === "svg") {
          const res = await optimizeSvg(
            task.assetPath,
            task.assetPath,
            {},
            options.policy as OptimizationPolicy,
          );
          if (!res.skipped) {
            console.log(
              `  [OPTIMIZED] ${path.relative(root, task.assetPath)}: ${(res.originalSizeBytes / 1024).toFixed(1)}KB -> ${(res.optimizedSizeBytes / 1024).toFixed(1)}KB (-${res.savedPercentage}%)`,
            );
            savedBytesTotal += res.savedBytes;
          } else {
            console.log(
              `  [SKIPPED] ${path.relative(root, task.assetPath)}: ${res.reason ?? "already optimal"}`,
            );
          }
        } else if (task.assetType === "video") {
          const res = await optimizeVideo(
            task.assetPath,
            task.assetPath,
            {},
            options.policy as OptimizationPolicy,
          );
          if (!res.skipped) {
            console.log(
              `  [OPTIMIZED] ${path.relative(root, task.assetPath)}: ${(res.originalSizeBytes / 1024).toFixed(1)}KB -> ${(res.optimizedSizeBytes / 1024).toFixed(1)}KB (-${res.savedPercentage}%)`,
            );
            savedBytesTotal += res.savedBytes;
          } else {
            console.log(
              `  [SKIPPED] ${path.relative(root, task.assetPath)}: ${res.reason ?? "already optimal"}`,
            );
          }
        } else if (task.assetType === "3d") {
          const res = await optimize3D(
            task.assetPath,
            task.assetPath,
            {},
            options.policy as OptimizationPolicy,
          );
          if (!res.skipped) {
            console.log(
              `  [OPTIMIZED] ${path.relative(root, task.assetPath)}: ${(res.originalSizeBytes / 1024).toFixed(1)}KB -> ${(res.optimizedSizeBytes / 1024).toFixed(1)}KB (-${res.savedPercentage}%)`,
            );
            savedBytesTotal += res.savedBytes;
          } else {
            console.log(
              `  [SKIPPED] ${path.relative(root, task.assetPath)}: ${res.reason ?? "already optimal"}`,
            );
          }
        }
      } catch (err) {
        console.error(
          `  [ERROR] ${path.relative(root, task.assetPath)}: ${(err as Error).message}`,
        );
      }
    }

    if (tx) {
      await commitTransaction(tx);
      console.log(`\n✅ Optimization complete! Run ID: ${ctx.runId}`);
      console.log(`Total saved: ${(savedBytesTotal / 1024).toFixed(1)} KB`);
      console.log(`To rollback: assetdiet restore --run ${ctx.runId}`);
    } else {
      console.log(
        `\n✅ Dry run finished. Estimated total savings: ${(savedBytesTotal / 1024).toFixed(1)} KB`,
      );
    }
  });

// restore
program
  .command("restore")
  .description("Restore assets from a previous optimization run")
  .requiredOption("-r, --run <runId>", "Run ID to restore")
  .option("-t, --targetPath <path>", "Workspace root", ".")
  .action(async (options) => {
    const root = path.resolve(options.targetPath);
    console.log(`\n🔄 Restoring run ${options.run} in ${root}...`);
    const res = await rollbackTransaction(root, options.run);
    console.log(
      `✅ Rollback successful: restored ${res.restoredCount} files, deleted ${res.deletedCount} files.`,
    );
  });

program.parse(process.argv);
