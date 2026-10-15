/**
 * Scanner — Font Metadata Extractor
 * Basic binary inspection of WOFF/WOFF2/TTF/OTF files.
 * Full subsetting is experimental and not implemented in v1.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { AssetMetadata } from '@assetdiet/core';

/**
 * Read a 4-byte big-endian uint32 from a buffer.
 */
function readUint32BE(buf: Buffer, offset: number): number {
  return (
    ((buf[offset] ?? 0) << 24) |
    ((buf[offset + 1] ?? 0) << 16) |
    ((buf[offset + 2] ?? 0) << 8) |
    (buf[offset + 3] ?? 0)
  ) >>> 0;
}

/**
 * Detect font format from magic bytes.
 */
function detectFontFormat(buf: Buffer, ext: string): string {
  // WOFF: 'wOFF' = 0x774F4646
  if (buf[0] === 0x77 && buf[1] === 0x4f && buf[2] === 0x46 && buf[3] === 0x46) return 'woff';
  // WOFF2: 'wOF2' = 0x774F4632
  if (buf[0] === 0x77 && buf[1] === 0x4f && buf[2] === 0x46 && buf[3] === 0x32) return 'woff2';
  // TrueType: 0x00010000
  if (buf[0] === 0x00 && buf[1] === 0x01 && buf[2] === 0x00 && buf[3] === 0x00) return 'ttf';
  // OpenType CFF: 'OTTO' = 0x4F54544F
  if (buf[0] === 0x4f && buf[1] === 0x54 && buf[2] === 0x54 && buf[3] === 0x4f) return 'otf';
  // Fallback to extension
  return ext.replace('.', '') || 'unknown';
}

export async function extractFontMetadata(filePath: string): Promise<AssetMetadata> {
  const ext = path.extname(filePath).toLowerCase();

  try {
    const buf = Buffer.alloc(4);
    const fd = await fs.promises.open(filePath, 'r');
    await fd.read(buf, 0, 4, 0);
    await fd.close();

    const format = detectFontFormat(buf, ext);

    return {
      type: 'font',
      data: {
        familyName: 'unknown', // Would require full font parsing (opentype.js etc.)
        subFamilyName: 'unknown',
        glyphCount: 0,
        format,
        unicodeRanges: [],
      },
    };
  } catch {
    return {
      type: 'font',
      data: {
        familyName: 'unknown',
        subFamilyName: 'unknown',
        glyphCount: 0,
        format: ext.replace('.', '') || 'unknown',
        unicodeRanges: [],
      },
    };
  }
}
