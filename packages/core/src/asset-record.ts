/**
 * AssetDiet Core — Asset Record Types
 * The canonical data shape for a discovered asset.
 */

import type { AssetType } from "./asset-types.js";

export interface ImageMetadata {
  width: number;
  height: number;
  channels: number;
  hasAlpha: boolean;
  isAnimated: boolean;
  format: string;
  colorSpace?: string | undefined;
  orientation?: number | undefined;
  frameCount?: number | undefined;
}

export interface VideoMetadata {
  width: number;
  height: number;
  duration: number;
  fps: number;
  codec: string;
  bitrate: number;
  hasAudio: boolean;
  hasSubtitles: boolean;
  format: string;
}

export interface Model3DMetadata {
  meshCount: number;
  materialCount: number;
  animationCount: number;
  textureCount: number;
  vertexCount: number;
  triangleCount: number;
  hasSkins: boolean;
  extensions: string[];
}

export interface FontMetadata {
  familyName: string;
  subFamilyName: string;
  glyphCount: number;
  format: string;
  unicodeRanges?: string[] | undefined;
}

export interface SvgMetadata {
  hasViewBox: boolean;
  hasAnimations: boolean;
  hasExternalResources: boolean;
  hasEmbeddedRaster: boolean;
  hasScripts: boolean;
  width?: string | undefined;
  height?: string | undefined;
  idCount: number;
}

export type AssetMetadata =
  | { type: "image"; data: ImageMetadata }
  | { type: "video"; data: VideoMetadata }
  | { type: "3d"; data: Model3DMetadata }
  | { type: "font"; data: FontMetadata }
  | { type: "svg"; data: SvgMetadata }
  | { type: "unknown"; data: Record<string, unknown> };

export type ReferenceConfidence = "confirmed" | "probable" | "uncertain";

export interface ReferenceRecord {
  /** Absolute path of the source file containing the reference */
  sourcePath: string;
  /** Type of reference */
  kind:
    | "import"
    | "require"
    | "css-url"
    | "html-src"
    | "html-srcset"
    | "json-string"
    | "dynamic";
  /** Line number in the source file */
  line: number;
  /** Confidence in this reference being real */
  confidence: ReferenceConfidence;
  /** The raw reference string found */
  rawRef: string;
}

export interface AssetRecord {
  /** Absolute path on disk */
  path: string;
  /** Path relative to the workspace root */
  relativePath: string;
  /** Detected asset type */
  type: AssetType;
  /** File size in bytes */
  sizeBytes: number;
  /** SHA-256 hex of file content */
  hash: string;
  /** Type-specific metadata (may be partial if extraction failed) */
  metadata: AssetMetadata | null;
  /** Known references to this file in the codebase */
  references: ReferenceRecord[];
  /** True if another asset has the same content hash */
  isDuplicate: boolean;
  /** Hash of the file this duplicates (if isDuplicate) */
  duplicateOf?: string;
  /**
   * Whether this asset appears unreferenced.
   * 'uncertain' means no static reference was found but dynamic usage is possible.
   */
  isUnreferenced: boolean | "uncertain";
  /** File extension (lowercase, with leading dot) */
  extension: string;
  /** Last modified timestamp */
  lastModified: Date;
}
