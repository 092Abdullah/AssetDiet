import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import {
  beginTransaction,
  stageFileModification,
  commitTransaction,
  recordTransactionFailure,
  rollbackTransaction,
} from "../index.js";

describe("Transactions and Rollback", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), "assetdiet-tx-test-"),
    );
  });

  afterAll(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  it("stages, commits and rolls back modifications restoring byte-for-byte original", async () => {
    const filePath = path.join(tempDir, "sample.txt");
    const originalContent = "original uncompressed content";
    await fs.promises.writeFile(filePath, originalContent, "utf-8");

    const tx = await beginTransaction(tempDir, "run-123");

    // Stage modification
    await stageFileModification(tx, filePath);

    // Overwrite with "optimized" content
    await fs.promises.writeFile(filePath, "new content", "utf-8");
    expect(await fs.promises.readFile(filePath, "utf-8")).toBe("new content");

    // Commit transaction
    await commitTransaction(tx);

    // Verify rollback restores original
    const rollbackResult = await rollbackTransaction(tempDir, "run-123");
    expect(rollbackResult.restoredCount).toBe(1);

    const restoredContent = await fs.promises.readFile(filePath, "utf-8");
    expect(restoredContent).toBe(originalContent);
  });

  it("rolls back an interrupted (pending) transaction without commit", async () => {
    const filePath = path.join(tempDir, "interrupted.txt");
    const originalContent = "intact content before crash";
    await fs.promises.writeFile(filePath, originalContent, "utf-8");

    const tx = await beginTransaction(tempDir, "run-interrupted");
    await stageFileModification(tx, filePath);

    // Simulate crash/interruption after modifying the file
    await fs.promises.writeFile(filePath, "corrupted during crash", "utf-8");

    // Rollback directly without calling commitTransaction
    const rollbackResult = await rollbackTransaction(
      tempDir,
      "run-interrupted",
    );
    expect(rollbackResult.restoredCount).toBe(1);
    expect(rollbackResult.status).toBe("rolled_back");

    const restoredContent = await fs.promises.readFile(filePath, "utf-8");
    expect(restoredContent).toBe(originalContent);
  });

  it("rolls back a failed transaction and cleans up newly generated destination files", async () => {
    const originalFile = path.join(tempDir, "source.png");
    const newOutputFile = path.join(tempDir, "output.webp");
    const originalContent = "original image binary content";
    await fs.promises.writeFile(originalFile, originalContent, "utf-8");

    const tx = await beginTransaction(tempDir, "run-failed");
    await stageFileModification(tx, originalFile, newOutputFile);

    // Create the new output file
    await fs.promises.writeFile(
      newOutputFile,
      "converted webp binary",
      "utf-8",
    );
    // Modify original file
    await fs.promises.writeFile(
      originalFile,
      "partially modified source",
      "utf-8",
    );

    // Record failure
    await recordTransactionFailure(
      tx,
      new Error("Validation failed on output.webp"),
    );

    // Rollback failed transaction
    const rollbackResult = await rollbackTransaction(tempDir, "run-failed");
    expect(rollbackResult.restoredCount).toBe(1);
    expect(rollbackResult.deletedCount).toBe(1);

    // Source is restored byte-for-byte
    expect(await fs.promises.readFile(originalFile, "utf-8")).toBe(
      originalContent,
    );
    // Newly generated destination file is deleted
    expect(fs.existsSync(newOutputFile)).toBe(false);
  });
});
