/**
 * AssetDiet Core — Asset Type Definitions
 * Canonical union of all supported asset categories.
 */

export type AssetType = 'image' | 'svg' | 'video' | '3d' | 'font' | 'unknown';

export type ImageFormat = 'jpeg' | 'png' | 'webp' | 'avif' | 'gif' | 'tiff' | 'bmp' | 'ico';
export type VideoFormat = 'mp4' | 'webm' | 'mov' | 'avi' | 'mkv' | 'ogv';
export type ModelFormat = 'glb' | 'gltf';
export type FontFormat = 'woff' | 'woff2' | 'ttf' | 'otf';
export type SvgFormat = 'svg';

export type KnownFormat = ImageFormat | VideoFormat | ModelFormat | FontFormat | SvgFormat;

/** Supported extensions → asset type mapping */
export const EXTENSION_TO_TYPE: Readonly<Record<string, AssetType>> = {
  // Images
  '.jpg': 'image',
  '.jpeg': 'image',
  '.png': 'image',
  '.webp': 'image',
  '.avif': 'image',
  '.gif': 'image',
  '.tiff': 'image',
  '.tif': 'image',
  '.bmp': 'image',
  '.ico': 'image',
  // SVG
  '.svg': 'svg',
  // Video
  '.mp4': 'video',
  '.webm': 'video',
  '.mov': 'video',
  '.avi': 'video',
  '.mkv': 'video',
  '.ogv': 'video',
  // 3D
  '.glb': '3d',
  '.gltf': '3d',
  // Fonts
  '.woff': 'font',
  '.woff2': 'font',
  '.ttf': 'font',
  '.otf': 'font',
} as const;

export const SUPPORTED_EXTENSIONS = Object.keys(EXTENSION_TO_TYPE);

export function getAssetType(ext: string): AssetType {
  return EXTENSION_TO_TYPE[ext.toLowerCase()] ?? 'unknown';
}
