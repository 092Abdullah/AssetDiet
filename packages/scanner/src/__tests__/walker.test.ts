import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { scanRepository } from "../walker.js";
import { createContext } from "@assetdiet/core";

describe("scanRepository", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), "assetdiet-scanner-test-"),
    );

    // Create test folder structure
    const publicDir = path.join(tempDir, "public");
    const ignoredDir = path.join(tempDir, "ignored");
    await fs.promises.mkdir(publicDir, { recursive: true });
    await fs.promises.mkdir(ignoredDir, { recursive: true });

    // Create .gitignore
    await fs.promises.writeFile(
      path.join(tempDir, ".gitignore"),
      "ignored/\n*.tmp\n",
    );

    // Create dummy assets
    await fs.promises.writeFile(
      path.join(publicDir, "logo.svg"),
      '<svg viewBox="0 0 100 100" id="main"><rect width="100" height="100"/></svg>',
    );
    await fs.promises.writeFile(
      path.join(publicDir, "notes.txt"),
      "hello world",
    );
    await fs.promises.writeFile(
      path.join(ignoredDir, "secret.png"),
      "fake image content",
    );
  });

  afterAll(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  it("scans assets while respecting gitignore and asset extensions", async () => {
    const ctx = createContext({ root: tempDir });
    const result = await scanRepository(ctx);

    expect(result.rootPath).toBe(tempDir);
    expect(result.assets.length).toBe(1);
    const asset = result.assets[0]!;
    expect(asset.type).toBe("svg");
    expect(asset.relativePath.replace(/\\/g, "/")).toBe("public/logo.svg");
    expect(asset.hash).toBeDefined();
    expect(asset.metadata?.type).toBe("svg");
    if (asset.metadata?.type === "svg") {
      expect(asset.metadata.data.hasViewBox).toBe(true);
      expect(asset.metadata.data.idCount).toBe(1);
    }
  });

  it("skips non-asset files like .txt", async () => {
    const ctx = createContext({ root: tempDir });
    const result = await scanRepository(ctx);
    const hasTxt = result.assets.some((a) => a.relativePath.endsWith(".txt"));
    expect(hasTxt).toBe(false);
  });
});
