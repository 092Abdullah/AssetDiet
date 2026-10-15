import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import {
  beginTransaction,
  stageFileModification,
  commitTransaction,
  rollbackTransaction,
} from '../index.js';

describe('Transactions and Rollback', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'assetdiet-tx-test-'));
  });

  afterAll(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  it('stages, commits and rolls back modifications restoring byte-for-byte original', async () => {
    const filePath = path.join(tempDir, 'sample.txt');
    const originalContent = 'original uncompressed content';
    await fs.promises.writeFile(filePath, originalContent, 'utf-8');

    const tx = await beginTransaction(tempDir, 'run-123');

    // Stage modification
    await stageFileModification(tx, filePath);

    // Overwrite with "optimized" content
    await fs.promises.writeFile(filePath, 'new content', 'utf-8');
    expect(await fs.promises.readFile(filePath, 'utf-8')).toBe('new content');

    // Commit transaction
    await commitTransaction(tx);

    // Verify rollback restores original
    const rollbackResult = await rollbackTransaction(tempDir, 'run-123');
    expect(rollbackResult.restoredCount).toBe(1);

    const restoredContent = await fs.promises.readFile(filePath, 'utf-8');
    expect(restoredContent).toBe(originalContent);
  });
});
