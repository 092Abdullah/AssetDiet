/**
 * Scanner — Image Metadata Extractor
 * Uses Sharp to extract image metadata without modifying files.
 */

import sharp from "sharp";
import type { AssetMetadata } from "@assetdiet/core";

export async function extractImageMetadata(
  filePath: string,
): Promise<AssetMetadata> {
  const meta = await sharp(filePath).metadata();

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
