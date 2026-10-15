/**
 * AssetDiet Transactions — Backup, Journal, and Rollback
 * Ensures all modifications can be fully and cleanly undone under success,
 * failure, and interrupted runs.
 */

import fs from "node:fs";
import path from "node:path";
import { safeResolve, normalizePath } from "@assetdiet/core";

export interface TransactionOp {
  type: "write" | "delete" | "reference_change";
  originalPath: string;
  backupPath?: string | undefined;
  newPath?: string | undefined;
  diff?: string | undefined;
}

export type TransactionStatus =
  "pending" | "committed" | "failed" | "rolled_back";

export interface Transaction {
  id: string;
  runId: string;
  root: string;
  createdAt: string;
  updatedAt: string;
  operations: TransactionOp[];
  status: TransactionStatus;
  error?: string | undefined;
}

function getJournalPath(root: string, runId: string): string {
  return path.join(root, ".assetdiet", "runs", `${runId}.json`);
}

async function persistJournal(tx: Transaction): Promise<void> {
  tx.updatedAt = new Date().toISOString();
  const journalPath = getJournalPath(tx.root, tx.runId);
  await fs.promises.mkdir(path.dirname(journalPath), { recursive: true });
  await fs.promises.writeFile(
    journalPath,
    JSON.stringify(tx, null, 2),
    "utf-8",
  );
}

/**
 * Begin a new optimization transaction.
 * Immediately persists the journal file so interrupted runs remain recoverable.
 */
export async function beginTransaction(
  root: string,
  runId: string,
): Promise<Transaction> {
  const backupDir = safeResolve(
    root,
    path.join(".assetdiet", "backups", runId),
  );
  const runsDir = safeResolve(root, path.join(".assetdiet", "runs"));

  await fs.promises.mkdir(backupDir, { recursive: true });
  await fs.promises.mkdir(runsDir, { recursive: true });

  const now = new Date().toISOString();
  const tx: Transaction = {
    id: runId,
    runId,
    root,
    createdAt: now,
    updatedAt: now,
    operations: [],
    status: "pending",
  };

  await persistJournal(tx);
  return tx;
}

/**
 * Stage a file modification: copy the original to backup before touching it,
 * and immediately update the journal on disk so crashed/interrupted runs can be restored.
 */
export async function stageFileModification(
  tx: Transaction,
  originalPath: string,
  newPath?: string,
): Promise<string> {
  safeResolve(tx.root, originalPath);

  const backupDir = path.join(tx.root, ".assetdiet", "backups", tx.runId);
  const relPath = path.relative(tx.root, originalPath);
  const backupPath = path.join(backupDir, relPath);

  await fs.promises.mkdir(path.dirname(backupPath), { recursive: true });

  // Copy original file if it exists and hasn't already been backed up in this transaction
  const existingOp = tx.operations.find(
    (op) => op.originalPath === normalizePath(originalPath),
  );
  if (!existingOp) {
    if (fs.existsSync(originalPath)) {
      await fs.promises.copyFile(originalPath, backupPath);
    }

    tx.operations.push({
      type: "write",
      originalPath: normalizePath(originalPath),
      backupPath: normalizePath(backupPath),
      newPath: newPath ? normalizePath(newPath) : undefined,
    });

    // Update journal on disk immediately after staging
    await persistJournal(tx);
  }

  return backupPath;
}

/**
 * Record a transaction failure and persist the error state to disk.
 */
export async function recordTransactionFailure(
  tx: Transaction,
  error: Error | string,
): Promise<void> {
  tx.status = "failed";
  tx.error = typeof error === "string" ? error : error.message;
  await persistJournal(tx);
}

/**
 * Commit the transaction by persisting the journal record with committed status.
 */
export async function commitTransaction(tx: Transaction): Promise<void> {
  tx.status = "committed";
  await persistJournal(tx);
}

/**
 * Rollback all changes made in a specific optimization run.
 * Supports committed, pending (interrupted), and failed runs.
 */
export async function rollbackTransaction(
  rootOrTx: string | Transaction,
  maybeRunId?: string,
): Promise<{
  restoredCount: number;
  deletedCount: number;
  status: TransactionStatus;
}> {
  let root: string;
  let runId: string;

  if (typeof rootOrTx === "object" && rootOrTx !== null) {
    root = rootOrTx.root;
    runId = rootOrTx.runId;
  } else {
    root = rootOrTx;
    runId = maybeRunId ?? "";
  }

  const journalPath = getJournalPath(root, runId);

  if (!fs.existsSync(journalPath)) {
    throw new Error(`No transaction journal found for runId: ${runId}`);
  }

  const tx: Transaction = JSON.parse(
    await fs.promises.readFile(journalPath, "utf-8"),
  );
  let restoredCount = 0;
  let deletedCount = 0;

  // Restore operations in reverse order
  for (const op of tx.operations.slice().reverse()) {
    if (op.backupPath && fs.existsSync(op.backupPath)) {
      await fs.promises.mkdir(path.dirname(op.originalPath), {
        recursive: true,
      });
      await fs.promises.copyFile(op.backupPath, op.originalPath);
      restoredCount++;
    }

    // If a brand new output file was created at a different path, delete it
    if (
      op.newPath &&
      op.newPath !== op.originalPath &&
      fs.existsSync(op.newPath)
    ) {
      await fs.promises.unlink(op.newPath);
      deletedCount++;
    }
  }

  tx.status = "rolled_back";
  await persistJournal(tx);

  return { restoredCount, deletedCount, status: tx.status };
}
