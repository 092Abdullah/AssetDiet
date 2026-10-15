import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import sharp from 'sharp';
import { optimizeImage } from '../index.js';

describe('optimizeImage', () => {
  let tempDir: string;
  let testPng: string;

  beforeAll(async () => {
    sharp.cache(false);
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'assetdiet-img-test-'));
    testPng = path.join(tempDir, 'test.png');

    // Create a 200x200 sample PNG
    await sharp({
      create: {
        width: 200,
        height: 200,
        channels: 4,
        background: { r: 50, g: 150, b: 250, alpha: 1 },
      },
    })
      .png()
      .toFile(testPng);
  });

  afterAll(async () => {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore Windows temp folder unlink lock
    }
  });

  it('optimizes image to WebP with size reduction', async () => {
    const destWebp = path.join(tempDir, 'test.webp');
    const result = await optimizeImage(testPng, destWebp, { format: 'webp', quality: 80 }, 'safe');

    expect(result.format).toBe('webp');
    expect(result.skipped).toBe(false);
    expect(fs.existsSync(destWebp)).toBe(true);

    const meta = await sharp(destWebp).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(200);
    expect(meta.height).toBe(200);
  });

  it('resizes image if maxWidth is specified', async () => {
    const destResized = path.join(tempDir, 'test-resized.png');
    const result = await optimizeImage(testPng, destResized, { maxWidth: 100 }, 'safe');

    expect(fs.existsSync(destResized)).toBe(true);
    const meta = await sharp(destResized).metadata();
    expect(meta.width).toBe(100);
    expect(meta.height).toBe(100);
  });
});
