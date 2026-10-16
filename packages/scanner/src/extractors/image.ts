/**
 * Scanner — Image Metadata Extractor
 * Uses Sharp to extract image metadata without modifying files.
 */

import sharp from "sharp";
import fs from "node:fs";
import type { AssetMetadata } from "@assetdiet/core";

sharp.cache(false);

export async function extractImageMetadata(
  filePath: string,
): Promise<AssetMetadata> {
  const buf = await fs.promises.readFile(filePath);
  const meta = await sharp(buf).metadata();

  return {
    type: "image",
    data: {
      width: meta.width ?? 0,
      height: meta.height ?? 0,
      channels: meta.channels ?? 0,
      hasAlpha: meta.hasAlpha ?? false,
      isAnimated: (meta.pages ?? 1) > 1,
      format: meta.format ?? "unknown",
      colorSpace: meta.space,
      orientation: meta.orientation,
      frameCount: meta.pages,
    },
  };
}
