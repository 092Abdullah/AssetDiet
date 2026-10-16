/**
 * AssetDiet Scanner — File Walker
 * Recursively discovers all supported asset files in a directory,
 * respecting .gitignore rules and configured exclusions.
 */

import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import fg from "fast-glob";
const glob =
  typeof fg === "function"
    ? fg
    : (fg as unknown as { default: typeof fg }).default;
import ignoreFactory, { type Ignore } from "ignore";
import {
  type RunContext,
  type AssetRecord,
  type AssetMetadata,
  getAssetType,
  SUPPORTED_EXTENSIONS,
  isWithinRoot,
  emitProgress,
  isCancelled,
  ErrorCodes,
} from "@assetdiet/core";

import { extractImageMetadata } from "./extractors/image.js";
import { extractSvgMetadata } from "./extractors/svg.js";
import { extractVideoMetadata } from "./extractors/video.js";
import { extract3DMetadata } from "./extractors/model3d.js";
import { extractFontMetadata } from "./extractors/font.js";

export interface ScanResult {
  assets: AssetRecord[];
  totalFiles: number;
  scannedAt: string;
  rootPath: string;
  errors: Array<{ path: string; code: string; message: string }>;
}

/**
 * Build an ignore filter from .gitignore + configured exclusions.
 */
async function buildIgnoreFilter(
  root: string,
  excludes: string[],
): Promise<Ignore> {
  const createIgnore =
    typeof ignoreFactory === "function"
      ? ignoreFactory
      : (ignoreFactory as unknown as { default: () => Ignore }).default;
  const ig = createIgnore();

  // Load .gitignore if present
  const gitignorePath = path.join(root, ".gitignore");
  try {
    const gitignoreContent = await fs.promises.readFile(gitignorePath, "utf-8");
    ig.add(gitignoreContent);
  } catch {
    // No .gitignore — that's fine
  }

  // Load .assetdietignore if present
  const assetdietignorePath = path.join(root, ".assetdietignore");
  try {
    const assetdietignoreContent = await fs.promises.readFile(
      assetdietignorePath,
      "utf-8",
    );
    ig.add(assetdietignoreContent);
  } catch {
    // No .assetdietignore — that's fine
  }

  // Add configured exclusions
  ig.add(excludes);

  return ig;
}

/**
 * Compute SHA-256 hash of a file's content.
 */
async function hashFile(filePath: string): Promise<string> {
  const hash = crypto.createHash("sha256");
  const stream = fs.createReadStream(filePath);

  return new Promise<string>((resolve, reject) => {
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

/**
 * Extract type-specific metadata for an asset.
 * Returns null on failure (error is recorded separately).
 */
async function extractMetadata(
  filePath: string,
  ext: string,
): Promise<AssetMetadata | null> {
  const type = getAssetType(ext);

  try {
    switch (type) {
      case "image":
        return await extractImageMetadata(filePath);
      case "svg":
        return await extractSvgMetadata(filePath);
      case "video":
        return await extractVideoMetadata(filePath);
      case "3d":
        return await extract3DMetadata(filePath);
      case "font":
        return await extractFontMetadata(filePath);
      default:
        return { type: "unknown", data: {} };
    }
  } catch {
    return null;
  }
}

/**
 * Main scanner — walks the repository and builds AssetRecord[].
 */
export async function scanRepository(ctx: RunContext): Promise<ScanResult> {
  const { root, config } = ctx;
  const errors: ScanResult["errors"] = [];
  const assets: AssetRecord[] = [];
  const startTime = Date.now();

  emitProgress(ctx, `Scanning repository: ${root}`);

  // Build ignore filter
  const ig = await buildIgnoreFilter(root, config.exclude);

  // Build glob pattern for all supported extensions
  const extPattern = SUPPORTED_EXTENSIONS.map((e) => `**/*${e}`);

  emitProgress(ctx, "Discovering asset files...");

  // Discover files
  const files = await glob(extPattern, {
    cwd: root,
    absolute: true,
    followSymbolicLinks: false, // We'll handle symlinks manually
    dot: false,
    ignore: config.exclude.map((e) => `**/${e}/**`),
  });

  // Filter through gitignore rules
  const filteredFiles = files.filter((f) => {
    const relative = path.relative(root, f);
    // Safety: must be within root
    if (!isWithinRoot(root, f)) return false;
    // Apply gitignore filter
    if (ig.ignores(relative)) return false;
    return true;
  });

  emitProgress(
    ctx,
    `Found ${filteredFiles.length} asset files. Extracting metadata...`,
  );

  let processed = 0;
  for (const filePath of filteredFiles) {
    if (isCancelled(ctx)) {
      break;
    }

    try {
      const stat = await fs.promises.stat(filePath);

      // Skip files over the size limit
      if (stat.size > config.limits.maxFileSizeBytes) {
        errors.push({
          path: filePath,
          code: ErrorCodes.FILE_TOO_LARGE,
          message: `File size ${stat.size} bytes exceeds limit ${config.limits.maxFileSizeBytes} bytes`,
        });
        continue;
      }

      const ext = path.extname(filePath).toLowerCase();
      const hash = await hashFile(filePath);
      const metadata = await extractMetadata(filePath, ext);
      const relativePath = path.relative(root, filePath).replace(/\\/g, "/");

      const record: AssetRecord = {
        path: filePath,
        relativePath,
        type: getAssetType(ext),
        sizeBytes: stat.size,
        hash,
        metadata,
        references: [], // Populated by reference-analyzer
        isDuplicate: false, // Populated by asset-graph
        isUnreferenced: "uncertain", // Populated by reference-analyzer
        extension: ext,
        lastModified: stat.mtime,
      };

      assets.push(record);
      processed++;

      if (processed % 50 === 0) {
        emitProgress(
          ctx,
          `Processed ${processed}/${filteredFiles.length} files...`,
        );
      }
    } catch (err) {
      errors.push({
        path: filePath,
        code: ErrorCodes.METADATA_EXTRACTION_FAILED,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  emitProgress(
    ctx,
    `Scan complete: ${assets.length} assets found in ${Date.now() - startTime}ms`,
  );

  return {
    assets,
    totalFiles: filteredFiles.length,
    scannedAt: new Date().toISOString(),
    rootPath: root,
    errors,
  };
}
