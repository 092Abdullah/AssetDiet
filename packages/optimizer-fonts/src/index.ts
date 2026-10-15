/**
 * AssetDiet Font Optimizer & Inspector
 * Provides font format inspection and duplicate font family detection.
 * Subsetting is marked experimental.
 */

import fs from "node:fs";
import path from "node:path";
import type { AssetRecord, FontMetadata } from "@assetdiet/core";

export interface DuplicateFontGroup {
  familyName: string;
  format: string;
  files: string[];
  wastedBytes: number;
}

/**
 * Inspect font file header to detect format and structure.
 */
export async function inspectFont(filePath: string): Promise<FontMetadata> {
  const buf = Buffer.alloc(16);
  const fd = await fs.promises.open(filePath, "r");
  try {
    await fd.read(buf, 0, 16, 0);
  } finally {
    await fd.close();
  }

  const tag = buf.subarray(0, 4).toString("utf-8");
  let format = "unknown";

  if (tag === "wOFF") {
    format = "woff";
  } else if (tag === "wOF2") {
    format = "woff2";
  } else if (tag === "OTTO") {
    format = "otf";
  } else if (tag === "\0\x01\0\0" || tag === "true") {
    format = "ttf";
  }

  const baseName = path.basename(filePath, path.extname(filePath));

  return {
    familyName: baseName.split("-")[0] ?? baseName,
    subFamilyName: baseName.split("-")[1] ?? "Regular",
    glyphCount: 0,
    format,
  };
}

/**
 * Find duplicate fonts by comparing family and format across assets.
 */
export function detectDuplicateFonts(
  assets: AssetRecord[],
): DuplicateFontGroup[] {
  const fontAssets = assets.filter((a) => a.type === "font");
  const groups = new Map<string, AssetRecord[]>();

  for (const asset of fontAssets) {
    const meta = asset.metadata?.type === "font" ? asset.metadata.data : null;
    const key = `${meta?.familyName ?? path.basename(asset.path)}:${asset.extension}`;
    const group = groups.get(key) ?? [];
    group.push(asset);
    groups.set(key, group);
  }

  const result: DuplicateFontGroup[] = [];

  for (const [key, group] of groups) {
    if (group.length > 1) {
      const [familyName = "Unknown", format = "unknown"] = key.split(":");
      const wastedBytes = (group.length - 1) * (group[0]?.sizeBytes ?? 0);
      result.push({
        familyName,
        format,
        files: group.map((g) => g.path),
        wastedBytes,
      });
    }
  }

  return result;
}

/**
 * Experimental font subsetting stub.
 * Marked experimental in v1.
 */
export async function subsetFontExperimental(
  _src: string,
  _dest: string,
  _unicodes: string[],
): Promise<{ success: boolean; message: string }> {
  return {
    success: false,
    message:
      "Font subsetting is experimental and requires native fonttools integration.",
  };
}
