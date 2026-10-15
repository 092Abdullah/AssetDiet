import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { Document, NodeIO } from '@gltf-transform/core';
import { optimize3D } from '../index.js';

describe('optimize3D', () => {
  let tempDir: string;
  let sampleGlb: string;

  beforeAll(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'assetdiet-3d-test-'));
    sampleGlb = path.join(tempDir, 'cube.glb');

    // Create a minimal glTF document and save as GLB
    const doc = new Document();
    const buffer = doc.createBuffer();
    const positionAccessor = doc.createAccessor()
      .setType('VEC3')
      .setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]))
      .setBuffer(buffer);

    const prim = doc.createPrimitive().setAttribute('POSITION', positionAccessor);
    const mesh = doc.createMesh().addPrimitive(prim);
    const node = doc.createNode().setMesh(mesh);
    doc.createScene().addChild(node);

    const io = new NodeIO();
    await io.write(sampleGlb, doc);
  });

  afterAll(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  it('optimizes 3D GLB model and produces valid output', async () => {
    const destGlb = path.join(tempDir, 'cube.opt.glb');
    const result = await optimize3D(sampleGlb, destGlb, {}, 'safe');

    expect(fs.existsSync(destGlb)).toBe(true);
    expect(result.sourcePath).toBe(sampleGlb);

    // Assert the output document is readable
    const io = new NodeIO();
    const doc = await io.read(destGlb);
    expect(doc.getRoot().listMeshes().length).toBeGreaterThan(0);
  });
});
