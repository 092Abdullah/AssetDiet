import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { detectFFmpeg, optimizeVideo } from "../index.js";

describe("Video Optimizer", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), "assetdiet-video-test-"),
    );
  });

  afterAll(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  it("probes system for FFmpeg without throwing", async () => {
    const caps = await detectFFmpeg();
    expect(typeof caps.available).toBe("boolean");
    expect(Array.isArray(caps.codecs)).toBe(true);
  });

  it("respects audit policy without modifying files", async () => {
    const videoFile = path.join(tempDir, "dummy.mp4");
    await fs.promises.writeFile(
      videoFile,
      "fake mp4 bytes for policy testing",
      "utf-8",
    );

    const res = await optimizeVideo(videoFile, videoFile, {}, "audit");
    expect(res.skipped).toBe(true);
    expect(res.reason).toContain("Audit policy");
    expect(await fs.promises.readFile(videoFile, "utf-8")).toBe(
      "fake mp4 bytes for policy testing",
    );
  });

  it("respects safe policy by skipping lossy transcoding", async () => {
    const videoFile = path.join(tempDir, "safe-test.mp4");
    const content = "safe mp4 bytes";
    await fs.promises.writeFile(videoFile, content, "utf-8");

    const res = await optimizeVideo(videoFile, videoFile, {}, "safe");
    expect(res.skipped).toBe(true);
    expect(res.reason).toContain("safe");
    expect(await fs.promises.readFile(videoFile, "utf-8")).toBe(content);
  });
});
