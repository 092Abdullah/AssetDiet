import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import sharp from 'sharp';
import { validateImage, validateSvg } from '../index.js';

describe('Validation Engine', () => {
  let tempDir: string;
  let samplePng: string;

  beforeAll(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'assetdiet-val-test-'));
    samplePng = path.join(tempDir, 'valid.png');

    await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 0, g: 255, b: 0, alpha: 1 },
      },
    })
      .png()
      .toFile(samplePng);
  });

  afterAll(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  it('validates decodability and dimension parity for images', async () => {
    const res = await validateImage(samplePng, samplePng);
    expect(res.valid).toBe(true);
    expect(res.errors.length).toBe(0);
  });

  it('detects corrupted or invalid image', async () => {
    const corrupted = path.join(tempDir, 'corrupted.png');
    await fs.promises.writeFile(corrupted, 'not a valid image');
    const res = await validateImage(samplePng, corrupted);
    expect(res.valid).toBe(false);
    expect(res.errors.length).toBeGreaterThan(0);
  });

  it('validates SVG content structure and viewBox', async () => {
    const validSvg = path.join(tempDir, 'valid.svg');
    await fs.promises.writeFile(validSvg, '<svg viewBox="0 0 10 10"><rect/></svg>');
    const res = await validateSvg(validSvg);
    expect(res.valid).toBe(true);
    expect(res.errors.length).toBe(0);
  });
});
