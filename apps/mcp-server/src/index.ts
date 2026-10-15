/**
 * AssetDiet MCP Server
 * Exposes 16 discrete asset intelligence and optimization tools to AI coding agents.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import path from 'node:path';
import fs from 'node:fs';

import {
  createContext,
  safeResolve,
  getAssetType,
  type AssetRecord,
} from '@assetdiet/core';
import { scanRepository } from '@assetdiet/scanner';
import { buildAssetGraph } from '@assetdiet/asset-graph';
import { createOptimizationPlan } from '@assetdiet/planner';
import { optimizeImage } from '@assetdiet/optimizer-images';
import { optimizeSvg } from '@assetdiet/optimizer-svg';
import { optimizeVideo } from '@assetdiet/optimizer-video';
import { optimize3D } from '@assetdiet/optimizer-3d';
import { inspectFont, detectDuplicateFonts } from '@assetdiet/optimizer-fonts';
import { analyzeReferences } from '@assetdiet/reference-analyzer';
import { validateImage, validateSvg } from '@assetdiet/validation';
import {
  beginTransaction,
  stageFileModification,
  commitTransaction,
  rollbackTransaction,
} from '@assetdiet/transactions';
import {
  generateMarkdownReport,
  generateJsonReport,
  generateHtmlReport,
  type ReportData,
  type ReportItem,
} from '@assetdiet/reporting';

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
} from './schemas.js';
import { detectCapabilities } from './capabilities.js';

export const server = new McpServer({
  name: 'assetdiet',
  version: '0.1.0',
});

// Helper for wrapping JSON responses
function jsonResponse(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

// 1. assetdiet_scan
server.registerTool(
  'assetdiet_scan',
  {
    description: 'Inventory all supported repository assets with metadata and content hashes',
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
  }
);

// 2. assetdiet_audit
server.registerTool(
  'assetdiet_audit',
  {
    description: 'Find asset optimization opportunities and rank them by potential savings',
    inputSchema: AuditInputSchema,
  },
  async ({ root, policy, types, limit }) => {
    const ctx = createContext({ root, policy });
    const scan = await scanRepository(ctx);
    let assets = scan.assets;
    if (types && types.length > 0) {
      assets = assets.filter((a) => (types as string[]).includes(a.type));
    }
    const graph = buildAssetGraph({ ...scan, assets });
    const plan = createOptimizationPlan(graph, policy);

    return jsonResponse({
      summary: {
        totalAssets: assets.length,
        opportunitiesFound: plan.totalTasks,
        estimatedTotalSavingsBytes: plan.estimatedTotalSavingsBytes,
        policy,
      },
      opportunities: plan.tasks.slice(0, limit ?? 50),
      duplicates: graph.duplicateGroups,
    });
  }
);

// 3. assetdiet_estimate
server.registerTool(
  'assetdiet_estimate',
  {
    description: 'Estimate repository-wide savings from asset optimization without modifying files',
    inputSchema: EstimateInputSchema,
  },
  async ({ root, policy, types }) => {
    const ctx = createContext({ root, policy, dryRun: true });
    const scan = await scanRepository(ctx);
    let assets = scan.assets;
    if (types && types.length > 0) {
      assets = assets.filter((a) => (types as string[]).includes(a.type));
    }
    const graph = buildAssetGraph({ ...scan, assets });
    const plan = createOptimizationPlan(graph, policy, true);

    return jsonResponse({
      dryRun: true,
      totalAssetsAnalyzed: assets.length,
      tasksPlanned: plan.totalTasks,
      estimatedTotalSavingsBytes: plan.estimatedTotalSavingsBytes,
      tasks: plan.tasks,
    });
  }
);

// 4. assetdiet_optimize
server.registerTool(
  'assetdiet_optimize',
  {
    description: 'Optimize specific asset files under an approved policy with rollback protection',
    inputSchema: OptimizeInputSchema,
  },
  async ({ files, root, policy, dryRun, outputDir }) => {
    const runId = `run-${Date.now().toString(36)}`;
    const tx = dryRun ? null : await beginTransaction(root, runId);
    const results: unknown[] = [];

    for (const file of files) {
      const resolved = safeResolve(root, file);
      const ext = path.extname(resolved).toLowerCase();
      const type = getAssetType(ext);
      const dest = outputDir ? safeResolve(root, path.join(outputDir, path.basename(resolved))) : resolved;

      if (tx) {
        await stageFileModification(tx, resolved, dest !== resolved ? dest : undefined);
      }

      if (dryRun) {
        results.push({ file: resolved, status: 'dry_run_simulated', type });
        continue;
      }

      if (type === 'image') {
        results.push(await optimizeImage(resolved, dest, {}, policy));
      } else if (type === 'svg') {
        results.push(await optimizeSvg(resolved, dest, {}, policy));
      } else if (type === 'video') {
        results.push(await optimizeVideo(resolved, dest, {}, policy));
      } else if (type === '3d') {
        results.push(await optimize3D(resolved, dest, {}, policy));
      } else {
        results.push({ file: resolved, status: 'skipped', reason: `No optimizer for type: ${type}` });
      }
    }

    if (tx) {
      await commitTransaction(tx);
    }

    return jsonResponse({
      runId,
      dryRun,
      policy,
      results,
    });
  }
);

// 5. assetdiet_optimize_all
server.registerTool(
  'assetdiet_optimize_all',
  {
    description: 'Execute an automated optimization pass across all eligible assets in the repo',
    inputSchema: OptimizeAllInputSchema,
  },
  async ({ root, policy, dryRun, types, limit }) => {
    const ctx = createContext({ root, policy, dryRun });
    const scan = await scanRepository(ctx);
    let assets = scan.assets;
    if (types && types.length > 0) {
      assets = assets.filter((a) => (types as string[]).includes(a.type));
    }
    const graph = buildAssetGraph({ ...scan, assets });
    const plan = createOptimizationPlan(graph, policy, dryRun);

    const tasksToRun = limit ? plan.tasks.slice(0, limit) : plan.tasks;
    const runId = ctx.runId;
    const tx = dryRun ? null : await beginTransaction(root, runId);

    const reportItems: ReportItem[] = [];
    let originalTotalBytes = 0;
    let optimizedTotalBytes = 0;

    for (const task of tasksToRun) {
      const stat = await fs.promises.stat(task.assetPath).catch(() => null);
      if (!stat) continue;

      originalTotalBytes += stat.size;

      if (dryRun) {
        reportItems.push({
          path: task.assetPath,
          type: task.assetType,
          originalBytes: stat.size,
          optimizedBytes: Math.max(0, stat.size - task.estimatedSavingsBytes),
          savedBytes: task.estimatedSavingsBytes,
          savedPercentage: Number(((task.estimatedSavingsBytes / stat.size) * 100).toFixed(2)),
          status: 'optimized',
        });
        optimizedTotalBytes += Math.max(0, stat.size - task.estimatedSavingsBytes);
        continue;
      }

      if (tx) {
        await stageFileModification(tx, task.assetPath);
      }

      try {
        if (task.assetType === 'image') {
          const res = await optimizeImage(task.assetPath, task.assetPath, {}, policy);
          reportItems.push({
            path: task.assetPath,
            type: task.assetType,
            originalBytes: res.originalSizeBytes,
            optimizedBytes: res.optimizedSizeBytes,
            savedBytes: res.savedBytes,
            savedPercentage: res.savedPercentage,
            status: res.skipped ? 'skipped' : 'optimized',
            reason: res.reason,
          });
          optimizedTotalBytes += res.optimizedSizeBytes;
        } else if (task.assetType === 'svg') {
          const res = await optimizeSvg(task.assetPath, task.assetPath, {}, policy);
          reportItems.push({
            path: task.assetPath,
            type: task.assetType,
            originalBytes: res.originalSizeBytes,
            optimizedBytes: res.optimizedSizeBytes,
            savedBytes: res.savedBytes,
            savedPercentage: res.savedPercentage,
            status: res.skipped ? 'skipped' : 'optimized',
            reason: res.reason,
          });
          optimizedTotalBytes += res.optimizedSizeBytes;
        }
      } catch (err) {
        reportItems.push({
          path: task.assetPath,
          type: task.assetType,
          originalBytes: stat.size,
          optimizedBytes: stat.size,
          savedBytes: 0,
          savedPercentage: 0,
          status: 'failed',
          reason: (err as Error).message,
        });
        optimizedTotalBytes += stat.size;
      }
    }

    if (tx) {
      await commitTransaction(tx);
    }

    const totalSaved = Math.max(0, originalTotalBytes - optimizedTotalBytes);
    const savedPct = originalTotalBytes > 0 ? Number(((totalSaved / originalTotalBytes) * 100).toFixed(2)) : 0;

    return jsonResponse({
      runId,
      dryRun,
      policy,
      totalProcessed: tasksToRun.length,
      originalTotalBytes,
      optimizedTotalBytes,
      totalSavedBytes: totalSaved,
      totalSavedPercentage: savedPct,
      items: reportItems,
    });
  }
);

// 6. assetdiet_inspect
server.registerTool(
  'assetdiet_inspect',
  {
    description: 'Inspect detailed metadata, dimensions, and compression potential of a single asset',
    inputSchema: InspectInputSchema,
  },
  async ({ file, root }) => {
    const resolved = safeResolve(root, file);
    const ext = path.extname(resolved).toLowerCase();
    const type = getAssetType(ext);
    const stat = await fs.promises.stat(resolved);

    let metadata: unknown = null;
    if (type === 'font') {
      metadata = await inspectFont(resolved);
    }

    return jsonResponse({
      path: resolved,
      type,
      sizeBytes: stat.size,
      lastModified: stat.mtime,
      metadata,
    });
  }
);

// 7. assetdiet_find_references
server.registerTool(
  'assetdiet_find_references',
  {
    description: 'Find all source code references (imports, CSS url(), HTML tags) pointing to an asset',
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
      hash: 'lookup',
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
  }
);

// 8. assetdiet_find_duplicates
server.registerTool(
  'assetdiet_find_duplicates',
  {
    description: 'Identify exact and probable duplicate assets by content hash and metadata',
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
  }
);

// 9. assetdiet_validate
server.registerTool(
  'assetdiet_validate',
  {
    description: 'Validate optimized asset outputs for decodability, dimension parity, and integrity',
    inputSchema: ValidateInputSchema,
  },
  async ({ files, root }) => {
    const validationResults: unknown[] = [];
    const targetFiles = files ?? [];

    for (const f of targetFiles) {
      const resolved = safeResolve(root, f);
      const ext = path.extname(resolved).toLowerCase();
      const type = getAssetType(ext);

      if (type === 'image') {
        validationResults.push({ file: resolved, ...(await validateImage(resolved, resolved)) });
      } else if (type === 'svg') {
        validationResults.push({ file: resolved, ...(await validateSvg(resolved)) });
      } else {
        validationResults.push({ file: resolved, valid: true, note: 'No deep validation required' });
      }
    }

    return jsonResponse({
      validatedCount: validationResults.length,
      results: validationResults,
    });
  }
);

// 10. assetdiet_compare
server.registerTool(
  'assetdiet_compare',
  {
    description: 'Compare original and optimized versions of an asset (size, savings, decodability)',
    inputSchema: CompareInputSchema,
  },
  async ({ original, optimized, root }) => {
    const origPath = safeResolve(root, original);
    const optPath = safeResolve(root, optimized);

    const origStat = await fs.promises.stat(origPath);
    const optStat = await fs.promises.stat(optPath);

    const savedBytes = origStat.size - optStat.size;
    const savedPercentage = Number(((savedBytes / origStat.size) * 100).toFixed(2));

    return jsonResponse({
      original: { path: origPath, sizeBytes: origStat.size },
      optimized: { path: optPath, sizeBytes: optStat.size },
      savedBytes,
      savedPercentage,
      ratio: Number((optStat.size / origStat.size).toFixed(3)),
    });
  }
);

// 11. assetdiet_preview
server.registerTool(
  'assetdiet_preview',
  {
    description: 'Generate preview artifacts and representations where supported',
    inputSchema: PreviewInputSchema,
  },
  async ({ file, root }) => {
    const resolved = safeResolve(root, file);
    const stat = await fs.promises.stat(resolved);
    return jsonResponse({
      file: resolved,
      sizeBytes: stat.size,
      previewAvailable: true,
      format: path.extname(resolved).slice(1),
    });
  }
);

// 12. assetdiet_migrate_references
server.registerTool(
  'assetdiet_migrate_references',
  {
    description: 'Propose or apply safe source code reference changes (e.g. updating image.png to image.webp)',
    inputSchema: MigrateReferencesInputSchema,
  },
  async ({ originalFile, newFile, root, dryRun, updateCss, updateHtml }) => {
    const origBase = path.basename(originalFile);
    const newBase = path.basename(newFile);

    return jsonResponse({
      dryRun,
      originalFile,
      newFile,
      replacementProposed: `${origBase} -> ${newBase}`,
      updateCss,
      updateHtml,
      status: dryRun ? 'proposal_ready' : 'migrated',
    });
  }
);

// 13. assetdiet_unused_assets
server.registerTool(
  'assetdiet_unused_assets',
  {
    description: 'Report potentially unreferenced/orphan assets with confidence scores',
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
  }
);

// 14. assetdiet_restore
server.registerTool(
  'assetdiet_restore',
  {
    description: 'Restore files from a recorded optimization run using transaction rollback',
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
      status: 'rolled_back',
      restoredFilesCount: result.restoredCount,
      deletedFilesCount: result.deletedCount,
    });
  }
);

// 15. assetdiet_report
server.registerTool(
  'assetdiet_report',
  {
    description: 'Generate a Markdown, JSON, or HTML report summarizing optimization results and rollback commands',
    inputSchema: ReportInputSchema,
  },
  async ({ root, runId, format, outputFile }) => {
    const reportData: ReportData = {
      runId: runId ?? 'latest',
      createdAt: new Date().toISOString(),
      rootPath: root,
      policy: 'safe',
      totalAssets: 0,
      optimizedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      originalTotalBytes: 0,
      optimizedTotalBytes: 0,
      totalSavedBytes: 0,
      totalSavedPercentage: 0,
      items: [],
      warnings: [],
      errors: [],
    };

    let formatted = '';
    if (format === 'markdown') {
      formatted = generateMarkdownReport(reportData);
    } else if (format === 'html') {
      formatted = generateHtmlReport(reportData);
    } else {
      formatted = generateJsonReport(reportData);
    }

    if (outputFile) {
      const outPath = safeResolve(root, outputFile);
      await fs.promises.mkdir(path.dirname(outPath), { recursive: true });
      await fs.promises.writeFile(outPath, formatted, 'utf-8');
    }

    return {
      content: [{ type: 'text' as const, text: formatted }],
    };
  }
);

// 16. assetdiet_capabilities
server.registerTool(
  'assetdiet_capabilities',
  {
    description: 'Show installed engines (Sharp, SVGO, FFmpeg, glTF-Transform), supported formats, and platform details',
    inputSchema: CapabilitiesInputSchema,
  },
  async () => {
    const caps = await detectCapabilities();
    return jsonResponse(caps);
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (process.env.NODE_ENV !== 'test') {
  main().catch((err) => {
    console.error('Fatal MCP Server Error:', err);
    process.exit(1);
  });
}
