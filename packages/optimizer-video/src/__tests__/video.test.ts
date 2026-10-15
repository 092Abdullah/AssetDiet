import { describe, it, expect } from 'vitest';
import { detectFFmpeg } from '../index.js';

describe('detectFFmpeg', () => {
  it('probes system for FFmpeg without throwing', async () => {
    const caps = await detectFFmpeg();
    expect(typeof caps.available).toBe('boolean');
    expect(Array.isArray(caps.codecs)).toBe(true);
  });
});
