/**
 * AssetDiet Transactions — Backup, Journal, and Rollback
 * Ensures all modifications can be fully and cleanly undone.
 */

import fs from 'node:fs';
import path from 'node:path';
import { safeResolve, normalizePath } from '@assetdiet/core';

export interface TransactionOp {
  type: 'write' | 'delete' | 'reference_change';
  originalPath: string;
  backupPath?: string | undefined;
  newPath?: string | undefined;
  diff?: string | undefined;
}

export interface Transaction {
  id: string;
  runId: string;
  root: string;
  createdAt: string;
  operations: TransactionOp[];
  status: 'pending' | 'committed' | 'rolled_back';
}

/**
 * Begin a new optimization transaction.
 * Creates the .assetdiet storage folders if they do not exist.
 */
export async function beginTransaction(root: string, runId: string): Promise<Transaction> {
  const backupDir = safeResolve(root, path.join('.assetdiet', 'backups', runId));
  const runsDir = safeResolve(root, path.join('.assetdiet', 'runs'));

  await fs.promises.mkdir(backupDir, { recursive: true });
  await fs.promises.mkdir(runsDir, { recursive: true });

  return {
    id: runId,
    runId,
    root,
    createdAt: new Date().toISOString(),
    operations: [],
    status: 'pending',
  };
}

/**
 * Stage a file modification: copy the original to backup before touching it.
 */
export async function stageFileModification(
  tx: Transaction,
  originalPath: string,
  newPath?: string
): Promise<string> {
  safeResolve(tx.root, originalPath);

  const backupDir = path.join(tx.root, '.assetdiet', 'backups', tx.runId);
  const relPath = path.relative(tx.root, originalPath);
  const backupPath = path.join(backupDir, relPath);

  await fs.promises.mkdir(path.dirname(backupPath), { recursive: true });

  // Only copy if file currently exists on disk
  if (fs.existsSync(originalPath)) {
    await fs.promises.copyFile(originalPath, backupPath);
  }

  tx.operations.push({
    type: 'write',
    originalPath: normalizePath(originalPath),
    backupPath: normalizePath(backupPath),
    newPath: newPath ? normalizePath(newPath) : undefined,
  });

  return backupPath;
}

/**
 * Commit the transaction by persisting the journal record to disk.
 */
export async function commitTransaction(tx: Transaction): Promise<void> {
  tx.status = 'committed';
  const journalPath = path.join(tx.root, '.assetdiet', 'runs', `${tx.runId}.json`);
  await fs.promises.writeFile(journalPath, JSON.stringify(tx, null, 2), 'utf-8');
}

/**
 * Rollback all changes made in a specific optimization run.
 */
export async function rollbackTransaction(
  root: string,
  runId: string
): Promise<{ restoredCount: number; deletedCount: number }> {
  const journalPath = path.join(root, '.assetdiet', 'runs', `${runId}.json`);

  if (!fs.existsSync(journalPath)) {
    throw new Error(`No transaction journal found for runId: ${runId}`);
  }

  const tx: Transaction = JSON.parse(await fs.promises.readFile(journalPath, 'utf-8'));
  let restoredCount = 0;
  let deletedCount = 0;

  // Restore operations in reverse order
  for (const op of tx.operations.slice().reverse()) {
    if (op.backupPath && fs.existsSync(op.backupPath)) {
      await fs.promises.mkdir(path.dirname(op.originalPath), { recursive: true });
      await fs.promises.copyFile(op.backupPath, op.originalPath);
      restoredCount++;
    }

    // If a brand new output file was created at a different path, delete it
    if (op.newPath && op.newPath !== op.originalPath && fs.existsSync(op.newPath)) {
      await fs.promises.unlink(op.newPath);
      deletedCount++;
    }
  }

  tx.status = 'rolled_back';
  await fs.promises.writeFile(journalPath, JSON.stringify(tx, null, 2), 'utf-8');

  return { restoredCount, deletedCount };
}
