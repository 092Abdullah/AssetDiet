/**
 * AssetDiet Core — Path Security Utilities
 * All path operations must go through these guards.
 */

import path from "node:path";
import fs from "node:fs";

/**
 * Resolve a path and assert it stays within the allowed root.
 * Throws if the resolved path escapes the root (path traversal protection).
 */
export function safeResolve(root: string, relativePath: string): string {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(root, relativePath);
  const prefix = resolvedRoot.endsWith(path.sep)
    ? resolvedRoot
    : resolvedRoot + path.sep;

  if (!resolved.startsWith(prefix) && resolved !== resolvedRoot) {
    throw new Error(
      `Path traversal detected: "${relativePath}" resolves to "${resolved}" which is outside root "${resolvedRoot}"`,
    );
  }

  return resolved;
}

/**
 * Check if a path is within the allowed root WITHOUT throwing.
 */
export function isWithinRoot(root: string, absolutePath: string): boolean {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(absolutePath);
  const prefix = resolvedRoot.endsWith(path.sep)
    ? resolvedRoot
    : resolvedRoot + path.sep;
  return resolved === resolvedRoot || resolved.startsWith(prefix);
}

/**
 * Resolve a symlink and check it stays within root.
 * Returns the real path, or throws if the symlink escapes.
 */
export async function safeRealpath(
  root: string,
  filePath: string,
): Promise<string> {
  try {
    const real = await fs.promises.realpath(filePath);
    if (!isWithinRoot(root, real)) {
      throw new Error(
        `Symlink escape detected: "${filePath}" resolves to "${real}" outside root "${root}"`,
      );
    }
    return real;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`File not found: "${filePath}"`);
    }
    throw err;
  }
}

/**
 * Normalize a path to use forward slashes (for consistent reporting).
 */
export function normalizePath(p: string): string {
  return p.replace(/\\/g, "/");
}

/**
 * Get extension in lowercase with leading dot.
 */
export function getExtension(filePath: string): string {
  return path.extname(filePath).toLowerCase();
}
