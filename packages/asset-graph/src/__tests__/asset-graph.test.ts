import { describe, it, expect } from 'vitest';
import { buildAssetGraph } from '../index.js';
import type { ScanResult } from '@assetdiet/scanner';
import type { AssetRecord } from '@assetdiet/core';

function makeMockAsset(overrides: Partial<AssetRecord>): AssetRecord {
  return {
    path: '/repo/assets/img.png',
    relativePath: 'assets/img.png',
    type: 'image',
    sizeBytes: 50_000,
    hash: 'hash-1',
    metadata: null,
    references: [],
    isDuplicate: false,
    isUnreferenced: false,
    extension: '.png',
    lastModified: new Date(),
    ...overrides,
  };
}

describe('buildAssetGraph', () => {
  it('detects duplicate assets by identical content hash', () => {
    const asset1 = makeMockAsset({ path: '/repo/a.png', relativePath: 'a.png', hash: 'abc123' });
    const asset2 = makeMockAsset({ path: '/repo/b.png', relativePath: 'b.png', hash: 'abc123' });
    const asset3 = makeMockAsset({ path: '/repo/c.png', relativePath: 'c.png', hash: 'def456' });

    const scan: ScanResult = {
      assets: [asset1, asset2, asset3],
      totalFiles: 3,
      scannedAt: new Date().toISOString(),
      rootPath: '/repo',
      errors: [],
    };

    const graph = buildAssetGraph(scan);

    expect(graph.duplicateGroups.length).toBe(1);
    expect(graph.duplicateGroups[0]?.hash).toBe('abc123');
    expect(graph.duplicateGroups[0]?.assets.length).toBe(2);
    expect(graph.duplicateGroups[0]?.wastedBytes).toBe(50_000);
    expect(asset2.isDuplicate).toBe(true);
    expect(asset2.duplicateOf).toBe('abc123');
  });

  it('ranks opportunities with duplicate removal prioritized', () => {
    const asset1 = makeMockAsset({ path: '/repo/a.png', relativePath: 'a.png', hash: 'abc123', sizeBytes: 100_000 });
    const asset2 = makeMockAsset({ path: '/repo/b.png', relativePath: 'b.png', hash: 'abc123', sizeBytes: 100_000 });

    const scan: ScanResult = {
      assets: [asset1, asset2],
      totalFiles: 2,
      scannedAt: new Date().toISOString(),
      rootPath: '/repo',
      errors: [],
    };

    const graph = buildAssetGraph(scan);
    expect(graph.opportunities.length).toBeGreaterThan(0);
    expect(graph.opportunities[0]?.action).toBe('remove-duplicate');
  });

  it('identifies SVG compression opportunities', () => {
    const svgAsset = makeMockAsset({
      path: '/repo/icon.svg',
      relativePath: 'icon.svg',
      type: 'svg',
      extension: '.svg',
      sizeBytes: 10_000,
      hash: 'svg-hash',
    });

    const scan: ScanResult = {
      assets: [svgAsset],
      totalFiles: 1,
      scannedAt: new Date().toISOString(),
      rootPath: '/repo',
      errors: [],
    };

    const graph = buildAssetGraph(scan);
    const svgOpp = graph.opportunities.find((o) => o.asset.type === 'svg');
    expect(svgOpp).toBeDefined();
    expect(svgOpp?.action).toBe('compress');
    expect(svgOpp?.risk).toBe('none');
  });
});
