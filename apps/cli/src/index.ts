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
  stageFileDeletion,
  commitTransaction,
} from "@assetdiet/transactions";
import { analyzeReferences } from "@assetdiet/reference-analyzer";
import { generateMarkdownReport, type ReportData } from "@assetdiet/reporting";

// Ensure low-level stream close EIO race conditions never crash the process
process.on("uncaughtException", (err: any) => {
  if (err && err.code === "EIO" && err.syscall === "close") {
    return;
  }
  console.error("Uncaught error:", err);
  process.exit(1);
});

const program = new Command();

program
  .name("assetdiet")
  .description(
    "AssetDiet: Full-repository asset intelligence and optimization toolkit",
  )
  .version("0.1.1");

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

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

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
  .option("--summary", "Output a concise scorecard summary", false)
  .option("--json", "Output results as JSON", false)
  .action(async (targetPath = ".", options) => {
    const root = path.resolve(targetPath);
    const ctx = createContext({
      root,
      policy: options.policy as OptimizationPolicy,
      dryRun: true,
      onProgress: (msg) => {
        if (!options.json) {
          process.stderr.write(`  [audit] ${msg}\r`);
        }
      },
    });
    const scan = await scanRepository(ctx);
    if (!options.json) {
      process.stderr.write("                                        \r");
    }
    const graph = buildAssetGraph(scan);
    const plan = createOptimizationPlan(
      graph,
      options.policy as OptimizationPolicy,
      true,
    );

    const totalAssetBytes = scan.assets.reduce(
      (acc, a) => acc + a.sizeBytes,
      0,
    );
    const totalSavingsBytes = plan.estimatedTotalSavingsBytes;
    const savingsPercent =
      totalAssetBytes > 0
        ? ((totalSavingsBytes / totalAssetBytes) * 100).toFixed(1)
        : "0";

    const duplicateFileCount = graph.duplicateGroups.reduce(
      (acc, g) => acc + g.assets.length,
      0,
    );
    const duplicateRecoverableBytes = graph.duplicateGroups.reduce((acc, g) => {
      const singleSize = g.assets[0]?.sizeBytes ?? 0;
      return acc + singleSize * Math.max(0, g.assets.length - 1);
    }, 0);

    if (options.json) {
      console.log(
        JSON.stringify(
          {
            summary: {
              root,
              policy: options.policy,
              totalAssets: scan.assets.length,
              totalAssetBytes,
              opportunitiesFound: plan.totalTasks,
              estimatedSavingsBytes: totalSavingsBytes,
              estimatedSavingsPercentage: parseFloat(savingsPercent),
              duplicateGroups: graph.duplicateGroups.length,
              duplicateFiles: duplicateFileCount,
              duplicateRecoverableBytes,
            },
            plan,
            duplicates: graph.duplicateGroups,
          },
          null,
          2,
        ),
      );
      return;
    }

    if (options.summary) {
      console.log(`\n🥗 AssetDiet Audit Summary (${options.policy})`);
      console.log(`  Target:        ${root}`);
      console.log(
        `  Total Media:   ${scan.assets.length} assets (${formatBytes(totalAssetBytes)})`,
      );
      console.log(`  Opportunities: ${plan.totalTasks} files`);
      console.log(
        `  Est. Savings:  -${formatBytes(totalSavingsBytes)} (-${savingsPercent}%)`,
      );
      if (graph.duplicateGroups.length > 0) {
        console.log(
          `  Duplicates:    ${graph.duplicateGroups.length} groups (${duplicateFileCount} files, -${formatBytes(duplicateRecoverableBytes)} recoverable)`,
        );
      }
      console.log();
      return;
    }

    // Default Human Output — High-signal, screenshot-ready, clear columns
    console.log(`\n🥗 AssetDiet Audit Report`);
    console.log(
      `─────────────────────────────────────────────────────────────────`,
    );
    console.log(
      `Policy:        ${options.policy} (read-only audit, 0 files modified)`,
    );
    console.log(`Target:        ${root}`);
    console.log(
      `Inventory:     ${scan.assets.length} assets (${formatBytes(totalAssetBytes)}) across project`,
    );
    console.log(
      `Opportunities: ${plan.totalTasks} optimizable files | Est. Savings: -${formatBytes(totalSavingsBytes)} (-${savingsPercent}%)`,
    );
    if (graph.duplicateGroups.length > 0) {
      console.log(
        `Duplicates:    ${graph.duplicateGroups.length} duplicate groups (${duplicateFileCount} files, -${formatBytes(duplicateRecoverableBytes)} recoverable)`,
      );
    }
    console.log(
      `─────────────────────────────────────────────────────────────────\n`,
    );

    if (plan.tasks.length > 0) {
      console.log(`Top Optimization Opportunities:`);
      for (const task of plan.tasks.slice(0, 15)) {
        const rel = path.relative(root, task.assetPath).replace(/\\/g, "/");
        const estSavings = formatBytes(task.estimatedSavingsBytes);
        console.log(
          `  • ${rel.padEnd(38)} -${estSavings.padStart(8)}  [${task.assetType.toUpperCase()}] ${task.reason}`,
        );
      }
      if (plan.tasks.length > 15) {
        console.log(`    ...and ${plan.tasks.length - 15} more opportunities`);
      }
      console.log();
    } else {
      console.log(
        `✨ All discovered assets are already optimal under the '${options.policy}' policy!\n`,
      );
    }

    if (graph.duplicateGroups.length > 0) {
      console.log(`Duplicate Assets Detected (Exact Byte Copies):`);
      for (const [idx, group] of graph.duplicateGroups.slice(0, 5).entries()) {
        const firstAsset = group.assets[0];
        const sz = firstAsset ? formatBytes(firstAsset.sizeBytes) : "";
        console.log(
          `  Group #${idx + 1} (${group.assets.length} copies, ${sz} each):`,
        );
        for (const a of group.assets) {
          console.log(`    ↳ ${a.relativePath}`);
        }
      }
      if (graph.duplicateGroups.length > 5) {
        console.log(
          `    ...and ${graph.duplicateGroups.length - 5} more duplicate groups`,
        );
      }
      console.log();
    }

    console.log(`Next Actions:`);
    console.log(
      `  • Apply optimizations: assetdiet optimize . --policy ${options.policy}`,
    );
    console.log(
      `  • Ask your AI assistant: "Run AssetDiet audit and apply safe optimizations"`,
    );
    console.log(
      `  • 100% reversible: every pass is backed by atomic backups & rollback journal.\n`,
    );
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

    // Run reference analysis so duplicate handling can detect active code references
    await analyzeReferences(root, scan.assets);

    console.log(
      `\n⚡ Running AssetDiet Optimization on ${root} (${isDry ? "DRY RUN" : "APPLYING"})`,
    );
    console.log(`Tasks to execute: ${plan.totalTasks}\n`);

    const tx = isDry ? null : await beginTransaction(root, ctx.runId);
    let savedBytesTotal = 0;

    for (const task of plan.tasks) {
      if (task.action === "remove-duplicate") {
        const matchingAsset = scan.assets.find(
          (a) => a.path === task.assetPath,
        );
        const hasCodeReferences =
          matchingAsset &&
          (matchingAsset.isUnreferenced === false ||
            matchingAsset.references.length > 0);

        if (isDry) {
          if (hasCodeReferences) {
            console.log(
              `  [SIMULATED] ${path.relative(root, task.assetPath)}: -${formatBytes(task.estimatedSavingsBytes)} (duplicate has active code references; would preserve and compress)`,
            );
          } else {
            console.log(
              `  [SIMULATED DEDUPLICATION] ${path.relative(root, task.assetPath)}: -${formatBytes(task.estimatedSavingsBytes)} (exact duplicate removed, 0 code references)`,
            );
          }
          savedBytesTotal += task.estimatedSavingsBytes;
          continue;
        }

        if (hasCodeReferences) {
          // If the file has active code references, DO NOT delete it in safe policy.
          // Instead, compress it in-place and preserve the filename so code imports never break!
          process.stderr.write(
            `  ⏳ Compressing referenced duplicate [${task.assetType.toUpperCase()}] ${path.relative(root, task.assetPath)}...\r`,
          );
          if (tx) {
            await stageFileModification(tx, task.assetPath);
          }
          if (task.assetType === "image") {
            const res = await optimizeImage(
              task.assetPath,
              task.assetPath,
              {},
              options.policy as OptimizationPolicy,
            );
            process.stderr.write(
              "                                                                                \r",
            );
            if (!res.skipped) {
              console.log(
                `  [OPTIMIZED] ${path.relative(root, task.assetPath)}: ${formatBytes(res.originalSizeBytes)} -> ${formatBytes(res.optimizedSizeBytes)} (-${res.savedPercentage}%) (duplicate preserved due to active code references)`,
              );
              savedBytesTotal += res.savedBytes;
            } else {
              console.log(
                `  [SKIPPED] ${path.relative(root, task.assetPath)}: preserved (active code references)`,
              );
            }
          } else if (task.assetType === "svg") {
            const res = await optimizeSvg(
              task.assetPath,
              task.assetPath,
              {},
              options.policy as OptimizationPolicy,
            );
            process.stderr.write(
              "                                                                                \r",
            );
            if (!res.skipped) {
              console.log(
                `  [OPTIMIZED] ${path.relative(root, task.assetPath)}: ${formatBytes(res.originalSizeBytes)} -> ${formatBytes(res.optimizedSizeBytes)} (-${res.savedPercentage}%) (duplicate preserved due to active code references)`,
              );
              savedBytesTotal += res.savedBytes;
            } else {
              console.log(
                `  [SKIPPED] ${path.relative(root, task.assetPath)}: preserved (active code references)`,
              );
            }
          }
          continue;
        }

        // 0 code references: Safe to deduplicate!
        if (tx) {
          await stageFileDeletion(tx, task.assetPath);
        }
        await fs.promises.unlink(task.assetPath);
        process.stderr.write(
          "                                                                                \r",
        );
        console.log(
          `  [DEDUPLICATED] ${path.relative(root, task.assetPath)}: -${formatBytes(task.estimatedSavingsBytes)} (exact duplicate removed, 0 code references)`,
        );
        savedBytesTotal += task.estimatedSavingsBytes;
        continue;
      }

      if (isDry) {
        console.log(
          `  [SIMULATED] ${path.relative(root, task.assetPath)}: -${formatBytes(task.estimatedSavingsBytes)}`,
        );
        savedBytesTotal += task.estimatedSavingsBytes;
        continue;
      }

      if (tx) {
        await stageFileModification(tx, task.assetPath);
      }

      process.stderr.write(
        `  ⏳ Processing [${task.assetType.toUpperCase()}] ${path.relative(root, task.assetPath)}...\r`,
      );

      try {
        if (task.assetType === "image") {
          const res = await optimizeImage(
            task.assetPath,
            task.assetPath,
            {},
            options.policy as OptimizationPolicy,
          );
          process.stderr.write(
            "                                                                                \r",
          );
          if (!res.skipped) {
            console.log(
              `  [OPTIMIZED] ${path.relative(root, task.assetPath)}: ${formatBytes(res.originalSizeBytes)} -> ${formatBytes(res.optimizedSizeBytes)} (-${res.savedPercentage}%)`,
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
          process.stderr.write(
            "                                                                                \r",
          );
          if (!res.skipped) {
            console.log(
              `  [OPTIMIZED] ${path.relative(root, task.assetPath)}: ${formatBytes(res.originalSizeBytes)} -> ${formatBytes(res.optimizedSizeBytes)} (-${res.savedPercentage}%)`,
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
          process.stderr.write(
            "                                                                                \r",
          );
          if (!res.skipped) {
            console.log(
              `  [OPTIMIZED] ${path.relative(root, task.assetPath)}: ${formatBytes(res.originalSizeBytes)} -> ${formatBytes(res.optimizedSizeBytes)} (-${res.savedPercentage}%)`,
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
          process.stderr.write(
            "                                                                                \r",
          );
          if (!res.skipped) {
            console.log(
              `  [OPTIMIZED] ${path.relative(root, task.assetPath)}: ${formatBytes(res.originalSizeBytes)} -> ${formatBytes(res.optimizedSizeBytes)} (-${res.savedPercentage}%)`,
            );
            savedBytesTotal += res.savedBytes;
          } else {
            console.log(
              `  [SKIPPED] ${path.relative(root, task.assetPath)}: ${res.reason ?? "already optimal"}`,
            );
          }
        }
      } catch (err) {
        process.stderr.write(
          "                                                                                \r",
        );
        console.error(
          `  [ERROR] ${path.relative(root, task.assetPath)}: ${(err as Error).message}`,
        );
      }
    }

    if (tx) {
      await commitTransaction(tx);
      console.log(`\n✅ Optimization complete! Run ID: ${ctx.runId}`);
      console.log(`Total saved: ${formatBytes(savedBytesTotal)}`);
      console.log(`To rollback: assetdiet restore --run ${ctx.runId}`);
    } else {
      console.log(
        `\n✅ Dry run finished. Estimated total savings: ${formatBytes(savedBytesTotal)}`,
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
