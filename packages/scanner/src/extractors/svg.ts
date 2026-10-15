/**
 * Scanner — SVG Metadata Extractor
 * Parses SVG XML to extract structural metadata without executing anything.
 */

import fs from "node:fs";
import type { AssetMetadata } from "@assetdiet/core";

// Simple regex-based SVG analysis — no XML parser dependency needed for metadata
// We use basic patterns to avoid executing any embedded content.

export async function extractSvgMetadata(
  filePath: string,
): Promise<AssetMetadata> {
  const content = await fs.promises.readFile(filePath, "utf-8");

  const hasViewBox = /viewBox\s*=\s*["'][^"']*["']/.test(content);
  const hasAnimations = /<(animate|animateTransform|animateMotion|set)\b/.test(
    content,
  );
  const hasExternalResources =
    /\bhref\s*=\s*["']https?:\/\//.test(content) ||
    /xlink:href\s*=\s*["']https?:\/\//.test(content);
  const hasEmbeddedRaster = /data:image\//i.test(content);
  const hasScripts = /<script\b/i.test(content);

  // Count IDs
  const idMatches = content.match(/\bid\s*=\s*["'][^"']+["']/g);
  const idCount = idMatches?.length ?? 0;

  // Extract width/height from root SVG element
  const svgTagMatch = content.match(/<svg\b([^>]*)>/i);
  const svgAttrs = svgTagMatch?.[1] ?? "";
  const widthMatch = svgAttrs.match(/\bwidth\s*=\s*["']([^"']+)["']/);
  const heightMatch = svgAttrs.match(/\bheight\s*=\s*["']([^"']+)["']/);

  return {
    type: "svg",
    data: {
      hasViewBox,
      hasAnimations,
      hasExternalResources,
      hasEmbeddedRaster,
      hasScripts,
      width: widthMatch?.[1],
      height: heightMatch?.[1],
      idCount,
    },
  };
}
