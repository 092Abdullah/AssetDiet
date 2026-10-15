import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import sharp from "sharp";
import { Document, NodeIO } from "@gltf-transform/core";
import {
  validateImage,
  validateSvg,
  validateVideo,
  validate3D,
} from "../index.js";

describe("Validation Engine", () => {
  let tempDir: string;
  let samplePng: string;
  let sampleGlb: string;

  beforeAll(async () => {
    tempDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), "assetdiet-val-test-"),
    );
    samplePng = path.join(tempDir, "valid.png");

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

    // Create valid GLB
    sampleGlb = path.join(tempDir, "cube.glb");
    const doc = new Document();
    const buffer = doc.createBuffer();
    const positionAccessor = doc
      .createAccessor()
      .setType("VEC3")
      .setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]))
      .setBuffer(buffer);

    const prim = doc
      .createPrimitive()
      .setAttribute("POSITION", positionAccessor);
    const mesh = doc.createMesh().addPrimitive(prim);
    const node = doc.createNode().setMesh(mesh);
    doc.createScene().addChild(node);

    const io = new NodeIO();
    await io.write(sampleGlb, doc);
  });

  afterAll(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  it("validates decodability and dimension parity for images", async () => {
    const res = await validateImage(samplePng, samplePng);
    expect(res.valid).toBe(true);
    expect(res.errors.length).toBe(0);
  });

  it("detects corrupted or invalid image", async () => {
    const corrupted = path.join(tempDir, "corrupted.png");
    await fs.promises.writeFile(corrupted, "not a valid image");
    const res = await validateImage(samplePng, corrupted);
    expect(res.valid).toBe(false);
    expect(res.errors.length).toBeGreaterThan(0);
  });

  it("detects image dimension mismatch when resize is disallowed", async () => {
    const smallerPng = path.join(tempDir, "smaller.png");
    await sharp({
      create: {
        width: 50,
        height: 50,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 },
      },
    })
      .png()
      .toFile(smallerPng);

    const res = await validateImage(samplePng, smallerPng, {
      allowResize: false,
    });
    expect(res.valid).toBe(false);
    expect(res.errors[0]).toContain("dimensions changed unexpectedly");
  });

  it("validates SVG content structure and viewBox", async () => {
    const origSvg = path.join(tempDir, "orig.svg");
    const optSvg = path.join(tempDir, "opt.svg");
    await fs.promises.writeFile(
      origSvg,
      '<svg viewBox="0 0 10 10"><rect/></svg>',
    );
    await fs.promises.writeFile(
      optSvg,
      '<svg viewBox="0 0 10 10"><rect/></svg>',
    );
    const res = await validateSvg(origSvg, optSvg);
    expect(res.valid).toBe(true);
    expect(res.errors.length).toBe(0);
  });

  it("detects when optimized SVG strips viewBox from original", async () => {
    const origSvg = path.join(tempDir, "orig-viewbox.svg");
    const strippedSvg = path.join(tempDir, "stripped.svg");
    await fs.promises.writeFile(
      origSvg,
      '<svg viewBox="0 0 10 10"><rect/></svg>',
    );
    await fs.promises.writeFile(
      strippedSvg,
      '<svg width="10" height="10"><rect/></svg>',
    );
    const res = await validateSvg(origSvg, strippedSvg);
    expect(res.valid).toBe(false);
    expect(res.errors[0]).toContain("removed the viewBox");
  });

  it("validates video outputs independently and detects empty files", async () => {
    const origVideo = path.join(tempDir, "dummy.mp4");
    const emptyVideo = path.join(tempDir, "empty.mp4");
    await fs.promises.writeFile(origVideo, "placeholder video content");
    await fs.promises.writeFile(emptyVideo, "");

    const res = await validateVideo(origVideo, emptyVideo);
    expect(res.valid).toBe(false);
    expect(res.errors[0]).toContain("empty");
  });

  it("validates 3D GLB assets independently", async () => {
    const res = await validate3D(sampleGlb, sampleGlb);
    expect(res.valid).toBe(true);
    expect(res.errors.length).toBe(0);
  });

  it("detects corrupted 3D model files", async () => {
    const corruptedGlb = path.join(tempDir, "corrupt.glb");
    await fs.promises.writeFile(corruptedGlb, "invalid binary header");
    const res = await validate3D(sampleGlb, corruptedGlb);
    expect(res.valid).toBe(false);
    expect(res.errors.length).toBeGreaterThan(0);
  });
});
