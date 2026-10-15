import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { optimizeSvg } from '../index.js';

describe('optimizeSvg', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'assetdiet-svg-test-'));
  });

  afterAll(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  it('optimizes SVG and preserves viewBox', async () => {
    const src = path.join(tempDir, 'sample.svg');
    const dest = path.join(tempDir, 'sample.opt.svg');

    const svgWithComments = `
      <!-- Generator: Adobe Illustrator -->
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <desc>Sample SVG Description</desc>
        <rect x="0" y="0" width="100" height="100" fill="#ff0000"/>
      </svg>
    `;

    await fs.promises.writeFile(src, svgWithComments, 'utf-8');

    const result = await optimizeSvg(src, dest, {}, 'safe');

    expect(result.skipped).toBe(false);
    expect(result.savedBytes).toBeGreaterThan(0);

    const optimizedContent = await fs.promises.readFile(dest, 'utf-8');
    expect(optimizedContent).toContain('viewBox="0 0 100 100"');
    expect(optimizedContent).not.toContain('Adobe Illustrator');
  });
});
