import { describe, it, expect } from 'vitest';
import { detectDuplicateFonts, subsetFontExperimental } from '../index.js';
import type { AssetRecord } from '@assetdiet/core';

describe('detectDuplicateFonts', () => {
  it('groups duplicate fonts by family and format', () => {
    const font1: AssetRecord = {
      path: '/fonts/Inter-Regular.woff2',
      relativePath: 'fonts/Inter-Regular.woff2',
      type: 'font',
      sizeBytes: 20_000,
      hash: 'h1',
      metadata: {
        type: 'font',
        data: { familyName: 'Inter', subFamilyName: 'Regular', glyphCount: 100, format: 'woff2' },
      },
      references: [],
      isDuplicate: false,
      isUnreferenced: false,
      extension: '.woff2',
      lastModified: new Date(),
    };

    const font2: AssetRecord = {
      path: '/vendor/Inter-Regular.woff2',
      relativePath: 'vendor/Inter-Regular.woff2',
      type: 'font',
      sizeBytes: 20_000,
      hash: 'h2',
      metadata: {
        type: 'font',
        data: { familyName: 'Inter', subFamilyName: 'Regular', glyphCount: 100, format: 'woff2' },
      },
      references: [],
      isDuplicate: false,
      isUnreferenced: false,
      extension: '.woff2',
      lastModified: new Date(),
    };

    const dupes = detectDuplicateFonts([font1, font2]);
    expect(dupes.length).toBe(1);
    expect(dupes[0]?.familyName).toBe('Inter');
    expect(dupes[0]?.files.length).toBe(2);
  });

  it('reports subsetting as experimental', async () => {
    const res = await subsetFontExperimental('a.ttf', 'b.ttf', ['U+0020']);
    expect(res.success).toBe(false);
    expect(res.message).toContain('experimental');
  });
});
