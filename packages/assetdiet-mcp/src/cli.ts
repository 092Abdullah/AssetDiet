#!/usr/bin/env node
/**
 * AssetDiet CLI & MCP Server
 * Unified developer CLI and AI Coding Assistant MCP server.
 */

import { Command } from "commander";
import path from "node:path";

import { createContext, type OptimizationPolicy } from "@assetdiet/core";
import { scanRepository } from "@assetdiet/scanner";
import { buildAssetGraph } from "@assetdiet/asset-graph";
import { createOptimizationPlan } from "@assetdiet/planner";
import { optimizeImage } from "@assetdiet/optimizer-images";
import { optimizeSvg } from "@assetdiet/optimizer-svg";
import { optimizeVideo } from "@assetdiet/optimizer-video";
import { optimize3D } from "@assetdiet/optimizer-3d";
import {
  beginTransaction,
  stageFileModification,
  commitTransaction,
  rollbackTransaction,
} from "@assetdiet/transactions";

import { runSetup, type SetupOptions } from "./setup.js";
import { runDoctor } from "./doctor.js";
import { runUninstall } from "./uninstall.js";
import { startMcpServer } from "./mcp.js";

const PACKAGE_VERSION = "0.1.0";

const program = new Command();

program
  .name("assetdiet")
  .description(
    "AssetDiet: Full-repository asset intelligence, optimization and MCP server for AI coding assistants",
  )
  .version(PACKAGE_VERSION);

// 1. setup
program
  .command("setup")
  .description(
    "Configure AssetDiet MCP integration for Cursor, Claude Desktop, Claude Code, Windsurf, or Codex",
  )
  .option(
    "-c, --client <client>",
    "Target client: cursor, claude-desktop, claude-code, windsurf, codex, all",
    "all",
  )
  .option(
    "--project [dir]",
    "Configure project-level MCP settings instead of global/user settings",
  )
  .option("--dry-run", "Show proposed changes without writing files", false)
  .option(
    "-y, --yes",
    "Automatically approve non-destructive configuration changes",
    false,
  )
  .option("--json", "Output results as JSON", false)
  .action(async (options) => {
    try {
      const setupOpts: SetupOptions = {
        dryRun: Boolean(options.dryRun),
        yes: Boolean(options.yes),
        json: Boolean(options.json),
        version: PACKAGE_VERSION,
      };
      if (typeof options.client === "string") {
        setupOpts.client = options.client;
      }
      if (typeof options.project === "string") {
        setupOpts.project = path.resolve(options.project);
      } else if (options.project) {
        setupOpts.project = process.cwd();
      }

      const result = await runSetup(setupOpts);

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      console.log("\n🥗 AssetDiet MCP Setup\n");

      for (const prop of result.proposals) {
        console.log(`• ${prop.clientName}:`);
        console.log(`  Path: ${prop.configPath}`);
        if (prop.alreadyConfigured) {
          console.log(
            "  Status: Already configured with latest AssetDiet registration.",
          );
        } else if (prop.action === "skip") {
          console.log("  Status: Skipped (no changes required).");
        } else {
          console.log(
            `  Action: ${prop.action === "update" ? "Update existing registration" : "Add new registration"}`,
          );
          console.log(
            `  Proposal:\n${JSON.stringify(prop.proposedRegistration, null, 4).replace(/^/gm, "    ")}`,
          );
        }
        console.log();
      }

      if (result.dryRun) {
        console.log("🔍 Dry run complete. No files were modified.");
        console.log(
          'Run "assetdiet setup --yes" or run without --dry-run to apply changes.',
        );
        return;
      }

      if (result.applied.length > 0) {
        console.log("✅ Configuration successfully updated for:");
        for (const app of result.applied) {
          console.log(`  - ${app.clientId} -> ${app.configPath}`);
          if (app.backupPath) {
            console.log(`    (Backup saved to: ${app.backupPath})`);
          }
        }
        console.log("\nRestart instructions:");
        for (const prop of result.proposals.filter((p) =>
          result.applied.some((a) => a.clientId === p.clientId),
        )) {
          console.log(`  - ${prop.clientName}: ${prop.restartInstructions}`);
        }
      } else if (result.proposals.every((p) => p.alreadyConfigured)) {
        console.log("✅ All detected clients are already up to date.");
      }

      if (result.errors.length > 0) {
        console.error("\n⚠️ Errors encountered during setup:");
        for (const err of result.errors) {
          console.error(`  - ${err.clientId}: ${err.error}`);
        }
      }
    } catch (err) {
      console.error(`\n❌ Setup failed: ${(err as Error).message}`);
      process.exit(1);
    }
  });

// 2. doctor
program
  .command("doctor")
  .description(
    "Run health checks on installed engines, dependencies, and coding assistant configurations",
  )
  .option("--json", "Output report as JSON", false)
  .action(async (options) => {
    try {
      const report = await runDoctor(PACKAGE_VERSION);

      if (options.json) {
        console.log(JSON.stringify(report, null, 2));
        return;
      }

      console.log(`\n🩺 AssetDiet Doctor v${report.version}`);
      console.log(
        `System: ${report.system.platform} (${report.system.arch}) | Node: ${report.system.nodeVersion} | npm: ${report.system.npmVersion}`,
      );
      console.log(`Installation Source: ${report.installSource}\n`);

      console.log("Checks:");
      for (const check of report.checks) {
        const icon =
          check.status === "ok" ? "✓" : check.status === "warn" ? "⚠" : "✗";
        console.log(
          `  ${icon} [${check.category.toUpperCase()}] ${check.name}: ${check.message}`,
        );
        if (check.remediation) {
          console.log(`    ↳ Remediation: ${check.remediation}`);
        }
      }

      console.log(
        `\nStatus: ${report.overallStatus === "healthy" ? "✅ All systems healthy" : report.overallStatus === "warnings_found" ? "⚠️ Warnings found (optional engines or unconfigured clients)" : "❌ Errors detected"}`,
      );

      if (report.remediations.length > 0) {
        console.log("\nRecommended actions:");
        for (const rem of report.remediations) {
          console.log(`  • ${rem}`);
        }
      }
      console.log();
    } catch (err) {
      console.error(`\n❌ Doctor failed: ${(err as Error).message}`);
      process.exit(1);
    }
  });

// 3. uninstall
program
  .command("uninstall")
  .description(
    "Safely remove AssetDiet MCP server registrations from coding assistant configs",
  )
  .option(
    "-c, --client <client>",
    "Target client: cursor, claude-desktop, claude-code, windsurf, codex, all",
    "all",
  )
  .option("-y, --yes", "Automatically confirm removal", false)
  .option("--json", "Output results as JSON", false)
  .action(async (options) => {
    try {
      const result = await runUninstall({
        client: options.client,
        yes: options.yes,
        json: options.json,
      });

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      console.log("\n🗑️ AssetDiet MCP Uninstaller\n");
      if (result.removed.length > 0) {
        console.log("✅ Successfully removed AssetDiet from:");
        for (const rem of result.removed) {
          console.log(`  - ${rem.clientName} (${rem.configPath})`);
          console.log(`    (Backup saved to: ${rem.backupPath})`);
        }
      } else {
        console.log("No active AssetDiet registrations found to remove.");
      }

      if (result.skipped.length > 0) {
        console.log("\nSkipped:");
        for (const skip of result.skipped) {
          console.log(`  - ${skip.clientName}: ${skip.reason}`);
        }
      }

      if (result.errors.length > 0) {
        console.error("\n⚠️ Errors:");
        for (const err of result.errors) {
          console.error(`  - ${err.clientId}: ${err.error}`);
        }
      }
      console.log();
    } catch (err) {
      console.error(`\n❌ Uninstall failed: ${(err as Error).message}`);
      process.exit(1);
    }
  });

// 4. mcp
program
  .command("mcp")
  .description(
    "Launch the stdio Model Context Protocol (MCP) server for AI coding assistants",
  )
  .action(async () => {
    try {
      await startMcpServer();
    } catch (err) {
      console.error("Fatal MCP Server Error:", err);
      process.exit(1);
    }
  });

// 5. scan
program
  .command("scan [targetPath]")
  .description(
    "Inventory repository assets and extract metadata + content hashes",
  )
  .option("--json", "Output results as JSON")
  .action(async (targetPath = ".", options) => {
    const root = path.resolve(targetPath);
    const ctx = createContext({ root });
    const result = await scanRepository(ctx);

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`\n📦 Scanned ${root}`);
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

// 6. audit
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

// 7. optimize
program
  .command("optimize [targetPath]")
  .description(
    "Run optimization plan on repository assets with rollback safety",
  )
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
    }
  });

// 8. restore
program
  .command("restore")
  .description("Restore assets from a previous optimization run")
  .requiredOption("-r, --run <runId>", "Run ID to restore")
  .option("-p, --path <targetPath>", "Workspace root", ".")
  .action(async (options) => {
    const root = path.resolve(options.path);
    console.log(`\n🔄 Restoring run ${options.run} in ${root}...`);
    try {
      const res = await rollbackTransaction(root, options.run);
      console.log(
        `✅ Rollback successful: ${res.restoredCount} file(s) restored, ${res.deletedCount} temporary file(s) removed.`,
      );
    } catch (err) {
      console.error(`❌ Rollback failed: ${(err as Error).message}`);
      process.exit(1);
    }
  });

// Default action: if no args, show help
if (process.argv.length <= 2) {
  program.outputHelp();
} else {
  program.parse(process.argv);
}
