import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import {
  extractReferencesFromSource,
  matchReferencesToAssets,
  analyzeReferences,
  migrateReferences,
} from '../index.js';
import type { AssetRecord } from '@assetdiet/core';

function mockAsset(p: string, ext: string): AssetRecord {
  return {
    path: p,
    relativePath: path.relative(path.dirname(p), p),
    type: 'image',
    sizeBytes: 1000,
    hash: 'mockhash',
    metadata: null,
    references: [],
    isDuplicate: false,
    isUnreferenced: true,
    extension: ext,
    lastModified: new Date(),
  };
}

describe('extractReferencesFromSource', () => {
  it('detects static ESM imports and requires', () => {
    const code = `
      import logo from './assets/logo.png';
      const icon = require('./icons/star.svg');
      import('./dynamic/heavy.png');
      const ignoreMe = import('./other.js');
    `;
    const refs = extractReferencesFromSource('/src/App.tsx', code);
    expect(refs.length).toBe(3);
    expect(refs[0]?.kind).toBe('import');
    expect(refs[0]?.rawRef).toBe('./assets/logo.png');
    expect(refs[0]?.confidence).toBe('confirmed');

    expect(refs[1]?.kind).toBe('require');
    expect(refs[1]?.rawRef).toBe('./icons/star.svg');
    expect(refs[1]?.confidence).toBe('confirmed');

    expect(refs[2]?.kind).toBe('dynamic');
    expect(refs[2]?.confidence).toBe('uncertain');
  });

  it('detects CSS url() references', () => {
    const css = `
      .hero {
        background-image: url('../images/hero.webp');
      }
      .font {
        src: url('/fonts/inter.woff2');
      }
    `;
    const refs = extractReferencesFromSource('/src/styles.css', css);
    expect(refs.length).toBe(2);
    expect(refs[0]?.kind).toBe('css-url');
    expect(refs[0]?.rawRef).toBe('../images/hero.webp');
  });

  it('detects HTML img and video tags', () => {
    const html = `
      <img src="/static/banner.png" alt="Banner" />
      <video src="./media/intro.mp4" controls></video>
    `;
    const refs = extractReferencesFromSource('/index.html', html);
    expect(refs.length).toBe(2);
    expect(refs[0]?.rawRef).toBe('/static/banner.png');
    expect(refs[1]?.rawRef).toBe('./media/intro.mp4');
  });
});

describe('analyzeReferences (integration)', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'assetdiet-ref-test-'));
    const srcDir = path.join(tempDir, 'src');
    const assetsDir = path.join(tempDir, 'assets');
    await fs.promises.mkdir(srcDir, { recursive: true });
    await fs.promises.mkdir(assetsDir, { recursive: true });

    await fs.promises.writeFile(
      path.join(srcDir, 'index.ts'),
      "import logo from '../assets/used.png';\nconsole.log(logo);\n"
    );
  });

  afterAll(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  it('identifies referenced vs unreferenced assets', async () => {
    const usedAsset = mockAsset(path.join(tempDir, 'assets', 'used.png'), '.png');
    const unusedAsset = mockAsset(path.join(tempDir, 'assets', 'orphan.png'), '.png');

    const result = await analyzeReferences(tempDir, [usedAsset, unusedAsset]);

    expect(result.referencedAssets.length).toBe(1);
    expect(result.unreferencedAssets.length).toBe(1);
    expect(usedAsset.isUnreferenced).toBe(false);
    expect(unusedAsset.isUnreferenced).toBe(true);
  });

  it('proposes migration changes in dryRun mode without modifying files', async () => {
    const srcFile = path.join(tempDir, 'src', 'index.ts');
    const contentBefore = await fs.promises.readFile(srcFile, 'utf-8');

    const result = await migrateReferences(
      tempDir,
      path.join(tempDir, 'assets', 'used.png'),
      path.join(tempDir, 'assets', 'used.webp'),
      { dryRun: true }
    );

    expect(result.dryRun).toBe(true);
    expect(result.totalOccurrences).toBe(1);
    expect(result.filesModified).toBe(1);
    expect(result.changes[0]?.newReference).toBe('used.webp');

    // Content should remain unmodified
    expect(await fs.promises.readFile(srcFile, 'utf-8')).toBe(contentBefore);
  });

  it('applies reference migration changes in write mode', async () => {
    const srcFile = path.join(tempDir, 'src', 'index.ts');

    const result = await migrateReferences(
      tempDir,
      path.join(tempDir, 'assets', 'used.png'),
      path.join(tempDir, 'assets', 'used.webp'),
      { dryRun: false }
    );

    expect(result.dryRun).toBe(false);
    expect(result.totalOccurrences).toBe(1);
    const updatedContent = await fs.promises.readFile(srcFile, 'utf-8');
    expect(updatedContent).toContain("used.webp");
    expect(updatedContent).not.toContain("used.png");
  });
});
