#!/usr/bin/env node
/**
 * AssetDiet MCP Server
 * Exposes 16 discrete asset intelligence and optimization tools to AI coding agents.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";
import sharp from "sharp";
import {
  createContext,
  safeResolve,
  normalizePath,
  getAssetType,
  type AssetRecord,
} from "@assetdiet/core";
import { scanRepository, extract3DMetadata } from "@assetdiet/scanner";
import { buildAssetGraph } from "@assetdiet/asset-graph";
import { createOptimizationPlan } from "@assetdiet/planner";
import { optimizeImage } from "@assetdiet/optimizer-images";
import { optimizeSvg } from "@assetdiet/optimizer-svg";
import { optimizeVideo, detectFFmpeg } from "@assetdiet/optimizer-video";
import { optimize3D } from "@assetdiet/optimizer-3d";
import { inspectFont, detectDuplicateFonts } from "@assetdiet/optimizer-fonts";
import {
  analyzeReferences,
  migrateReferences,
} from "@assetdiet/reference-analyzer";
import {
  validateImage,
  validateSvg,
  validateVideo,
  validate3D,
} from "@assetdiet/validation";
import {
  beginTransaction,
  stageFileModification,
  commitTransaction,
  recordTransactionFailure,
  rollbackTransaction,
} from "@assetdiet/transactions";
import {
  generateMarkdownReport,
  generateJsonReport,
  generateHtmlReport,
  type ReportData,
  type ReportItem,
} from "@assetdiet/reporting";

import {
  ScanInputSchema,
  AuditInputSchema,
  EstimateInputSchema,
  OptimizeInputSchema,
  OptimizeAllInputSchema,
  InspectInputSchema,
  FindReferencesInputSchema,
  FindDuplicatesInputSchema,
  ValidateInputSchema,
  CompareInputSchema,
  PreviewInputSchema,
  MigrateReferencesInputSchema,
  UnusedAssetsInputSchema,
  RestoreInputSchema,
  ReportInputSchema,
  CapabilitiesInputSchema,
} from "./schemas.js";
import { detectCapabilities } from "./capabilities.js";

export const server = new McpServer({
  name: "assetdiet",
  version: "0.1.0",
});

// Helper for wrapping JSON responses
function jsonResponse(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

// 1. assetdiet_scan
server.registerTool(
  "assetdiet_scan",
  {
    description:
      "Inventory all supported repository assets with metadata and content hashes",
    inputSchema: ScanInputSchema,
  },
  async ({ root, types, exclude }) => {
    const ctx = createContext({ root, config: { exclude: exclude ?? [] } });
    const result = await scanRepository(ctx);
    let assets = result.assets;
    if (types && types.length > 0) {
      assets = assets.filter((a) => (types as string[]).includes(a.type));
    }
    return jsonResponse({
      totalAssets: assets.length,
      root: result.rootPath,
      scannedAt: result.scannedAt,
      assets: assets.map((a) => ({
        path: a.path,
        relativePath: a.relativePath,
        type: a.type,
        sizeBytes: a.sizeBytes,
        hash: a.hash,
        metadata: a.metadata,
      })),
    });
  },
);

// 2. assetdiet_audit
server.registerTool(
  "assetdiet_audit",
  {
    description:
      "Find asset optimization opportunities and rank them by potential savings (read-only)",
    inputSchema: AuditInputSchema,
  },
  async ({ root, policy, types, limit }) => {
    const ctx = createContext({ root, policy: policy ?? "safe", dryRun: true });
    const scan = await scanRepository(ctx);
    let assets = scan.assets;
    if (types && types.length > 0) {
      assets = assets.filter((a) => (types as string[]).includes(a.type));
    }
    const graph = buildAssetGraph({ ...scan, assets });
    const plan = createOptimizationPlan(graph, policy ?? "safe", true);

    return jsonResponse({
      summary: {
        totalAssets: assets.length,
        opportunitiesFound: plan.totalTasks,
        estimatedTotalSavingsBytes: plan.estimatedTotalSavingsBytes,
        policy: policy ?? "safe",
      },
      opportunities: plan.tasks.slice(0, limit ?? 50),
      duplicates: graph.duplicateGroups,
    });
  },
);

// 3. assetdiet_estimate
server.registerTool(
  "assetdiet_estimate",
  {
    description:
      "Estimate repository-wide savings from asset optimization without modifying files",
    inputSchema: EstimateInputSchema,
  },
  async ({ root, policy, types }) => {
    const ctx = createContext({ root, policy: policy ?? "safe", dryRun: true });
    const scan = await scanRepository(ctx);
    let assets = scan.assets;
    if (types && types.length > 0) {
      assets = assets.filter((a) => (types as string[]).includes(a.type));
    }
    const graph = buildAssetGraph({ ...scan, assets });
    const plan = createOptimizationPlan(graph, policy ?? "safe", true);

    return jsonResponse({
      dryRun: true,
      totalAssetsAnalyzed: assets.length,
      tasksPlanned: plan.totalTasks,
      estimatedTotalSavingsBytes: plan.estimatedTotalSavingsBytes,
      tasks: plan.tasks,
    });
  },
);

// 4. assetdiet_optimize
server.registerTool(
  "assetdiet_optimize",
  {
    description:
      "Optimize specific asset files under an approved policy with rollback protection",
    inputSchema: OptimizeInputSchema,
  },
  async ({ files, root, policy, dryRun, outputDir }) => {
    const runId = `run-${Date.now().toString(36)}`;
    const isAudit = policy === "audit";
    const isDry = dryRun || isAudit;

    const tx = isDry ? null : await beginTransaction(root, runId);
    const results: unknown[] = [];

    try {
      for (const file of files) {
        const resolved = safeResolve(root, file);
        const ext = path.extname(resolved).toLowerCase();
        const type = getAssetType(ext);
        const dest = outputDir
          ? safeResolve(root, path.join(outputDir, path.basename(resolved)))
          : resolved;

        if (tx) {
          await stageFileModification(
            tx,
            resolved,
            dest !== resolved ? dest : undefined,
          );
        }

        if (isDry) {
          results.push({
            file: resolved,
            status: "dry_run_simulated",
            type,
            policy,
          });
          continue;
        }

        if (type === "image") {
          results.push(await optimizeImage(resolved, dest, {}, policy));
        } else if (type === "svg") {
          results.push(await optimizeSvg(resolved, dest, {}, policy));
        } else if (type === "video") {
          results.push(await optimizeVideo(resolved, dest, {}, policy));
        } else if (type === "3d") {
          results.push(await optimize3D(resolved, dest, {}, policy));
        } else {
          results.push({
            file: resolved,
            status: "skipped",
            reason: `No optimizer for type: ${type}`,
          });
        }
      }

      if (tx) {
        await commitTransaction(tx);
      }
    } catch (err) {
      if (tx) {
        await recordTransactionFailure(tx, err as Error);
      }
      throw err;
    }

    return jsonResponse({
      runId,
      dryRun: isDry,
      policy,
      results,
    });
  },
);

// 5. assetdiet_optimize_all
server.registerTool(
  "assetdiet_optimize_all",
  {
    description:
      "Execute an automated optimization pass across all eligible assets in the repo",
    inputSchema: OptimizeAllInputSchema,
  },
  async ({ root, policy, dryRun, types, limit }) => {
    const isAudit = policy === "audit";
    const isDry = dryRun || isAudit;

    const ctx = createContext({ root, policy, dryRun: isDry });
    const scan = await scanRepository(ctx);
    let assets = scan.assets;
    if (types && types.length > 0) {
      assets = assets.filter((a) => (types as string[]).includes(a.type));
    }
    const graph = buildAssetGraph({ ...scan, assets });
    const plan = createOptimizationPlan(graph, policy, isDry);

    const tasksToRun = limit ? plan.tasks.slice(0, limit) : plan.tasks;
    const runId = ctx.runId;
    const tx = isDry ? null : await beginTransaction(root, runId);

    const reportItems: ReportItem[] = [];
    let originalTotalBytes = 0;
    let optimizedTotalBytes = 0;

    for (const task of tasksToRun) {
      const stat = await fs.promises.stat(task.assetPath).catch(() => null);
      if (!stat) continue;

      originalTotalBytes += stat.size;

      if (isDry) {
        const estSaved = task.estimatedSavingsBytes;
        const optSize = Math.max(0, stat.size - estSaved);
        reportItems.push({
          path: task.assetPath,
          type: task.assetType,
          originalBytes: stat.size,
          optimizedBytes: optSize,
          savedBytes: estSaved,
          savedPercentage:
            stat.size > 0
              ? Number(((estSaved / stat.size) * 100).toFixed(2))
              : 0,
          status: "optimized",
        });
        optimizedTotalBytes += optSize;
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
            policy,
          );
          reportItems.push({
            path: task.assetPath,
            type: task.assetType,
            originalBytes: res.originalSizeBytes,
            optimizedBytes: res.optimizedSizeBytes,
            savedBytes: res.savedBytes,
            savedPercentage: res.savedPercentage,
            status: res.skipped ? "skipped" : "optimized",
            reason: res.reason,
          });
          optimizedTotalBytes += res.optimizedSizeBytes;
        } else if (task.assetType === "svg") {
          const res = await optimizeSvg(
            task.assetPath,
            task.assetPath,
            {},
            policy,
          );
          reportItems.push({
            path: task.assetPath,
            type: task.assetType,
            originalBytes: res.originalSizeBytes,
            optimizedBytes: res.optimizedSizeBytes,
            savedBytes: res.savedBytes,
            savedPercentage: res.savedPercentage,
            status: res.skipped ? "skipped" : "optimized",
            reason: res.reason,
          });
          optimizedTotalBytes += res.optimizedSizeBytes;
        } else if (task.assetType === "video") {
          const res = await optimizeVideo(
            task.assetPath,
            task.assetPath,
            {},
            policy,
          );
          reportItems.push({
            path: task.assetPath,
            type: task.assetType,
            originalBytes: res.originalSizeBytes,
            optimizedBytes: res.optimizedSizeBytes,
            savedBytes: res.savedBytes,
            savedPercentage: res.savedPercentage,
            status: res.skipped ? "skipped" : "optimized",
            reason: res.reason,
          });
          optimizedTotalBytes += res.optimizedSizeBytes;
        } else if (task.assetType === "3d") {
          const res = await optimize3D(
            task.assetPath,
            task.assetPath,
            {},
            policy,
          );
          reportItems.push({
            path: task.assetPath,
            type: task.assetType,
            originalBytes: res.originalSizeBytes,
            optimizedBytes: res.optimizedSizeBytes,
            savedBytes: res.savedBytes,
            savedPercentage: res.savedPercentage,
            status: res.skipped ? "skipped" : "optimized",
            reason: res.reason,
          });
          optimizedTotalBytes += res.optimizedSizeBytes;
        } else if (task.assetType === "font") {
          reportItems.push({
            path: task.assetPath,
            type: task.assetType,
            originalBytes: stat.size,
            optimizedBytes: stat.size,
            savedBytes: 0,
            savedPercentage: 0,
            status: "skipped",
            reason: "Font subsetting is experimental in v1; font skipped",
          });
          optimizedTotalBytes += stat.size;
        } else {
          reportItems.push({
            path: task.assetPath,
            type: task.assetType,
            originalBytes: stat.size,
            optimizedBytes: stat.size,
            savedBytes: 0,
            savedPercentage: 0,
            status: "skipped",
            reason: `Unsupported asset type: ${task.assetType}`,
          });
          optimizedTotalBytes += stat.size;
        }
      } catch (err) {
        reportItems.push({
          path: task.assetPath,
          type: task.assetType,
          originalBytes: stat.size,
          optimizedBytes: stat.size,
          savedBytes: 0,
          savedPercentage: 0,
          status: "failed",
          reason: (err as Error).message,
        });
        optimizedTotalBytes += stat.size;
      }
    }

    if (tx) {
      await commitTransaction(tx);
    }

    const totalSaved = Math.max(0, originalTotalBytes - optimizedTotalBytes);
    const savedPct =
      originalTotalBytes > 0
        ? Number(((totalSaved / originalTotalBytes) * 100).toFixed(2))
        : 0;

    const reportData: ReportData = {
      runId,
      createdAt: new Date().toISOString(),
      rootPath: root,
      policy,
      totalAssets: tasksToRun.length,
      optimizedCount: reportItems.filter((i) => i.status === "optimized")
        .length,
      skippedCount: reportItems.filter((i) => i.status === "skipped").length,
      failedCount: reportItems.filter((i) => i.status === "failed").length,
      originalTotalBytes,
      optimizedTotalBytes,
      totalSavedBytes: totalSaved,
      totalSavedPercentage: savedPct,
      items: reportItems,
      warnings: [],
      errors: [],
    };

    // Save report data for retrieval by assetdiet_report tool
    const reportsDir = path.join(root, ".assetdiet", "reports");
    await fs.promises.mkdir(reportsDir, { recursive: true }).catch(() => {});
    await fs.promises
      .writeFile(
        path.join(reportsDir, `${runId}.json`),
        JSON.stringify(reportData, null, 2),
        "utf-8",
      )
      .catch(() => {});

    return jsonResponse({
      runId,
      dryRun: isDry,
      policy,
      totalProcessed: tasksToRun.length,
      originalTotalBytes,
      optimizedTotalBytes,
      totalSavedBytes: totalSaved,
      totalSavedPercentage: savedPct,
      items: reportItems,
    });
  },
);

// 6. assetdiet_inspect
server.registerTool(
  "assetdiet_inspect",
  {
    description:
      "Inspect detailed metadata, dimensions, and compression potential of a single asset",
    inputSchema: InspectInputSchema,
  },
  async ({ file, root }) => {
    const resolved = safeResolve(root, file);
    const ext = path.extname(resolved).toLowerCase();
    const type = getAssetType(ext);
    const stat = await fs.promises.stat(resolved);

    let metadata: unknown = null;
    if (type === "font") {
      metadata = await inspectFont(resolved);
    } else if (type === "image") {
      metadata = await sharp(resolved).metadata();
    } else if (type === "3d") {
      try {
        const meta = await extract3DMetadata(resolved);
        metadata = meta.data;
      } catch (e) {
        metadata = { error: (e as Error).message };
      }
    }

    return jsonResponse({
      path: resolved,
      type,
      sizeBytes: stat.size,
      lastModified: stat.mtime,
      metadata,
    });
  },
);

// 7. assetdiet_find_references
server.registerTool(
  "assetdiet_find_references",
  {
    description:
      "Find all source code references (imports, CSS url(), HTML tags) pointing to an asset",
    inputSchema: FindReferencesInputSchema,
  },
  async ({ file, root }) => {
    const resolved = safeResolve(root, file);
    const stat = await fs.promises.stat(resolved);
    const mockAsset: AssetRecord = {
      path: resolved,
      relativePath: path.relative(root, resolved),
      type: getAssetType(path.extname(resolved)),
      sizeBytes: stat.size,
      hash: "lookup",
      metadata: null,
      references: [],
      isDuplicate: false,
      isUnreferenced: true,
      extension: path.extname(resolved).toLowerCase(),
      lastModified: stat.mtime,
    };

    const analysis = await analyzeReferences(root, [mockAsset]);
    return jsonResponse({
      asset: resolved,
      isUnreferenced: mockAsset.isUnreferenced,
      referencesCount: mockAsset.references.length,
      references: mockAsset.references,
      totalSourceFilesScanned: analysis.totalSourceFiles,
    });
  },
);

// 8. assetdiet_find_duplicates
server.registerTool(
  "assetdiet_find_duplicates",
  {
    description:
      "Identify exact and probable duplicate assets by content hash and metadata",
    inputSchema: FindDuplicatesInputSchema,
  },
  async ({ root, types }) => {
    const ctx = createContext({ root });
    const scan = await scanRepository(ctx);
    let assets = scan.assets;
    if (types && types.length > 0) {
      assets = assets.filter((a) => (types as string[]).includes(a.type));
    }
    const graph = buildAssetGraph({ ...scan, assets });
    const fontDuplicates = detectDuplicateFonts(assets);

    return jsonResponse({
      duplicateGroups: graph.duplicateGroups,
      totalDuplicateGroups: graph.duplicateGroups.length,
      fontDuplicates,
    });
  },
);

// 9. assetdiet_validate
server.registerTool(
  "assetdiet_validate",
  {
    description:
      "Validate optimized asset outputs for decodability, dimension parity, and integrity",
    inputSchema: ValidateInputSchema,
  },
  async ({ files, root }) => {
    const validationResults: unknown[] = [];
    const targetFiles = files ?? [];

    for (const f of targetFiles) {
      const resolved = safeResolve(root, f);
      const ext = path.extname(resolved).toLowerCase();
      const type = getAssetType(ext);

      // Check if an original backup exists for this file in .assetdiet/backups
      const rel = path.relative(root, resolved);
      let originalPath = resolved;
      const backupDir = path.join(root, ".assetdiet", "backups");
      if (fs.existsSync(backupDir)) {
        const runs = await fs.promises.readdir(backupDir).catch(() => []);
        for (const run of runs.reverse()) {
          const candidate = path.join(backupDir, run, rel);
          if (fs.existsSync(candidate)) {
            originalPath = candidate;
            break;
          }
        }
      }

      if (type === "image") {
        validationResults.push({
          file: resolved,
          ...(await validateImage(originalPath, resolved)),
        });
      } else if (type === "svg") {
        validationResults.push({
          file: resolved,
          ...(await validateSvg(originalPath, resolved)),
        });
      } else if (type === "video") {
        validationResults.push({
          file: resolved,
          ...(await validateVideo(originalPath, resolved)),
        });
      } else if (type === "3d") {
        validationResults.push({
          file: resolved,
          ...(await validate3D(originalPath, resolved)),
        });
      } else {
        validationResults.push({
          file: resolved,
          valid: true,
          note: "No deep validation required",
        });
      }
    }

    return jsonResponse({
      validatedCount: validationResults.length,
      results: validationResults,
    });
  },
);

// 10. assetdiet_compare
server.registerTool(
  "assetdiet_compare",
  {
    description:
      "Compare original and optimized versions of an asset (size, savings, decodability)",
    inputSchema: CompareInputSchema,
  },
  async ({ original, optimized, root }) => {
    const origPath = safeResolve(root, original);
    const optPath = safeResolve(root, optimized);

    const origStat = await fs.promises.stat(origPath);
    const optStat = await fs.promises.stat(optPath);

    const savedBytes = origStat.size - optStat.size;
    const savedPercentage = Number(
      ((savedBytes / origStat.size) * 100).toFixed(2),
    );

    return jsonResponse({
      original: { path: origPath, sizeBytes: origStat.size },
      optimized: { path: optPath, sizeBytes: optStat.size },
      savedBytes,
      savedPercentage,
      ratio: Number((optStat.size / origStat.size).toFixed(3)),
    });
  },
);

// 11. assetdiet_preview
server.registerTool(
  "assetdiet_preview",
  {
    description:
      "Generate preview artifacts and representations where supported",
    inputSchema: PreviewInputSchema,
  },
  async ({ file, root }) => {
    const resolved = safeResolve(root, file);
    const ext = path.extname(resolved).toLowerCase();
    const type = getAssetType(ext);
    const stat = await fs.promises.stat(resolved);

    // 1. Image preview: generate real base64 thumbnail
    if (type === "image") {
      try {
        const thumbBuffer = await sharp(resolved)
          .resize(256, 256, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: 80 })
          .toBuffer();

        const meta = await sharp(resolved).metadata();
        return jsonResponse({
          file: resolved,
          type: "image",
          sizeBytes: stat.size,
          dimensions: { width: meta.width, height: meta.height },
          channels: meta.channels,
          hasAlpha: meta.hasAlpha,
          format: meta.format,
          previewAvailable: true,
          previewDataUri: `data:image/webp;base64,${thumbBuffer.toString("base64")}`,
        });
      } catch (err) {
        return jsonResponse({
          file: resolved,
          previewAvailable: false,
          status: "error",
          reason: `Failed to render image thumbnail: ${(err as Error).message}`,
        });
      }
    }

    // 2. SVG preview: read text content and return inline data URI
    if (type === "svg") {
      try {
        const content = await fs.promises.readFile(resolved, "utf-8");
        return jsonResponse({
          file: resolved,
          type: "svg",
          sizeBytes: stat.size,
          hasViewBox: content.includes("viewBox"),
          previewAvailable: true,
          previewDataUri: `data:image/svg+xml;base64,${Buffer.from(content).toString("base64")}`,
        });
      } catch (err) {
        return jsonResponse({
          file: resolved,
          previewAvailable: false,
          status: "error",
          reason: `Failed to read SVG: ${(err as Error).message}`,
        });
      }
    }

    // 3. Font preview: inspect font details
    if (type === "font") {
      try {
        const fontMeta = await inspectFont(resolved);
        return jsonResponse({
          file: resolved,
          type: "font",
          sizeBytes: stat.size,
          previewAvailable: true,
          fontDetails: fontMeta,
        });
      } catch (err) {
        return jsonResponse({
          file: resolved,
          previewAvailable: false,
          status: "error",
          reason: (err as Error).message,
        });
      }
    }

    // 4. Video preview: probe for FFmpeg and extract poster frame if possible
    if (type === "video") {
      const caps = await detectFFmpeg();
      if (!caps.available) {
        return jsonResponse({
          file: resolved,
          type: "video",
          sizeBytes: stat.size,
          previewAvailable: false,
          status: "unsupported",
          reason: "FFmpeg is required in PATH to generate video preview frames",
        });
      }

      try {
        const thumbBuffer = await new Promise<Buffer>((resolve, reject) => {
          const proc = spawn("ffmpeg", [
            "-ss",
            "00:00:01",
            "-i",
            resolved,
            "-frames:v",
            "1",
            "-vf",
            "scale=320:-1",
            "-f",
            "image2pipe",
            "-vcodec",
            "mjpeg",
            "pipe:1",
          ]);

          const chunks: Buffer[] = [];
          proc.stdout.on("data", (d) => chunks.push(d));
          proc.on("close", (code) => {
            if (code === 0 && chunks.length > 0) {
              resolve(Buffer.concat(chunks));
            } else {
              reject(new Error(`FFmpeg exited with code ${code}`));
            }
          });
          proc.on("error", reject);
        });

        return jsonResponse({
          file: resolved,
          type: "video",
          sizeBytes: stat.size,
          previewAvailable: true,
          previewDataUri: `data:image/jpeg;base64,${thumbBuffer.toString("base64")}`,
        });
      } catch {
        return jsonResponse({
          file: resolved,
          type: "video",
          sizeBytes: stat.size,
          previewAvailable: false,
          status: "unsupported",
          reason: "Unable to extract poster frame from video",
        });
      }
    }

    // 5. 3D Model preview: extract scene summary
    if (type === "3d") {
      try {
        const meta = await extract3DMetadata(resolved);
        return jsonResponse({
          file: resolved,
          type: "3d",
          sizeBytes: stat.size,
          previewAvailable: false,
          status: "unsupported_visual_render",
          reason:
            "Visual 3D rasterization requires WebGL rendering context; scene structure summary provided",
          sceneSummary: meta.data,
        });
      } catch (err) {
        return jsonResponse({
          file: resolved,
          type: "3d",
          sizeBytes: stat.size,
          previewAvailable: false,
          status: "error",
          reason: (err as Error).message,
        });
      }
    }

    return jsonResponse({
      file: resolved,
      type,
      sizeBytes: stat.size,
      previewAvailable: false,
      status: "unsupported",
      reason: `Format '.${ext}' does not support preview generation`,
    });
  },
);

// 12. assetdiet_migrate_references
server.registerTool(
  "assetdiet_migrate_references",
  {
    description:
      "Propose or apply safe source code reference changes (e.g. updating image.png to image.webp)",
    inputSchema: MigrateReferencesInputSchema,
  },
  async ({ originalFile, newFile, root, dryRun, updateCss, updateHtml }) => {
    const resolvedOriginal = safeResolve(root, originalFile);
    const resolvedNew = safeResolve(root, newFile);

    const result = await migrateReferences(
      root,
      resolvedOriginal,
      resolvedNew,
      {
        dryRun: dryRun ?? false,
        updateCss: updateCss ?? true,
        updateHtml: updateHtml ?? true,
      },
    );

    return jsonResponse(result);
  },
);

// 13. assetdiet_unused_assets
server.registerTool(
  "assetdiet_unused_assets",
  {
    description:
      "Report potentially unreferenced/orphan assets with confidence scores",
    inputSchema: UnusedAssetsInputSchema,
  },
  async ({ root, types, confirmedOnly }) => {
    const ctx = createContext({ root });
    const scan = await scanRepository(ctx);
    let assets = scan.assets;
    if (types && types.length > 0) {
      assets = assets.filter((a) => (types as string[]).includes(a.type));
    }
    const analysis = await analyzeReferences(root, assets);

    let unreferenced = analysis.unreferencedAssets;
    if (!confirmedOnly) {
      unreferenced = [...unreferenced, ...analysis.uncertainAssets];
    }

    return jsonResponse({
      totalUnused: unreferenced.length,
      wastedBytes: unreferenced.reduce((sum, a) => sum + a.sizeBytes, 0),
      unusedAssets: unreferenced.map((a) => ({
        path: a.path,
        relativePath: a.relativePath,
        type: a.type,
        sizeBytes: a.sizeBytes,
        isUnreferenced: a.isUnreferenced,
      })),
    });
  },
);

// 14. assetdiet_restore
server.registerTool(
  "assetdiet_restore",
  {
    description:
      "Restore files from a recorded optimization run using transaction rollback",
    inputSchema: RestoreInputSchema,
  },
  async ({ root, runId, dryRun }) => {
    if (dryRun) {
      return jsonResponse({
        dryRun: true,
        runId,
        message: `Dry run: rollback would restore all backups from .assetdiet/runs/${runId}.json`,
      });
    }

    const result = await rollbackTransaction(root, runId);
    return jsonResponse({
      runId,
      status: "rolled_back",
      restoredFilesCount: result.restoredCount,
      deletedFilesCount: result.deletedCount,
    });
  },
);

// 15. assetdiet_report
server.registerTool(
  "assetdiet_report",
  {
    description:
      "Generate a Markdown, JSON, or HTML report summarizing optimization results and rollback commands",
    inputSchema: ReportInputSchema,
  },
  async ({ root, runId, format, outputFile }) => {
    let reportData: ReportData | null = null;

    // Look for stored report in .assetdiet/reports/
    const reportsDir = path.join(root, ".assetdiet", "reports");
    const runsDir = path.join(root, ".assetdiet", "runs");

    let targetRunId = runId;
    if (!targetRunId || targetRunId === "latest") {
      // Find latest report or run
      if (fs.existsSync(reportsDir)) {
        const files = (await fs.promises.readdir(reportsDir)).filter((f) =>
          f.endsWith(".json"),
        );
        if (files.length > 0) {
          files.sort();
          targetRunId = path.basename(files[files.length - 1]!, ".json");
        }
      }
      if (!targetRunId && fs.existsSync(runsDir)) {
        const files = (await fs.promises.readdir(runsDir)).filter((f) =>
          f.endsWith(".json"),
        );
        if (files.length > 0) {
          files.sort();
          targetRunId = path.basename(files[files.length - 1]!, ".json");
        }
      }
    }

    if (targetRunId) {
      const reportFile = path.join(reportsDir, `${targetRunId}.json`);
      if (fs.existsSync(reportFile)) {
        try {
          reportData = JSON.parse(
            await fs.promises.readFile(reportFile, "utf-8"),
          );
        } catch {}
      }

      // If no report found, check transaction run journal
      if (!reportData) {
        const runFile = path.join(runsDir, `${targetRunId}.json`);
        if (fs.existsSync(runFile)) {
          try {
            const tx = JSON.parse(await fs.promises.readFile(runFile, "utf-8"));
            reportData = {
              runId: targetRunId,
              createdAt: tx.createdAt ?? new Date().toISOString(),
              rootPath: root,
              policy: "safe",
              totalAssets: tx.operations?.length ?? 0,
              optimizedCount: tx.operations?.length ?? 0,
              skippedCount: 0,
              failedCount: tx.status === "failed" ? 1 : 0,
              originalTotalBytes: 0,
              optimizedTotalBytes: 0,
              totalSavedBytes: 0,
              totalSavedPercentage: 0,
              items: (tx.operations ?? []).map((op: any) => ({
                path: op.originalPath,
                type: getAssetType(path.extname(op.originalPath)),
                originalBytes: 0,
                optimizedBytes: 0,
                savedBytes: 0,
                savedPercentage: 0,
                status: "optimized",
              })),
              warnings: [],
              errors: tx.error ? [tx.error] : [],
            };
          } catch {}
        }
      }
    }

    if (!reportData) {
      return jsonResponse({
        status: "error",
        message: targetRunId
          ? `No recorded optimization report or transaction found for runId: ${targetRunId}`
          : "No optimization runs recorded yet. Run assetdiet_optimize or assetdiet_optimize_all first.",
      });
    }

    let formatted = "";
    if (format === "markdown") {
      formatted = generateMarkdownReport(reportData);
    } else if (format === "html") {
      formatted = generateHtmlReport(reportData);
    } else {
      formatted = generateJsonReport(reportData);
    }

    if (outputFile) {
      const outPath = safeResolve(root, outputFile);
      await fs.promises.mkdir(path.dirname(outPath), { recursive: true });
      await fs.promises.writeFile(outPath, formatted, "utf-8");
    }

    return {
      content: [{ type: "text" as const, text: formatted }],
    };
  },
);

// 16. assetdiet_capabilities
server.registerTool(
  "assetdiet_capabilities",
  {
    description:
      "Show installed engines (Sharp, SVGO, FFmpeg, glTF-Transform), supported formats, and platform details",
    inputSchema: CapabilitiesInputSchema,
  },
  async () => {
    const caps = await detectCapabilities();
    return jsonResponse(caps);
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (process.env.NODE_ENV !== "test") {
  main().catch((err) => {
    console.error("Fatal MCP Server Error:", err);
    process.exit(1);
  });
}
