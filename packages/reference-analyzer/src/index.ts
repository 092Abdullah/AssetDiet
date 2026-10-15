/**
 * AssetDiet Reference Analyzer
 * Discovers and parses references to assets in JS/TS/CSS/HTML/JSON source files.
 */

import path from 'node:path';
import fs from 'node:fs';
import { glob } from 'fast-glob';
import ignoreFactory, { type Ignore } from 'ignore';
import {
  type AssetRecord,
  type ReferenceRecord,
  type ReferenceConfidence,
  EXTENSION_TO_TYPE,
  normalizePath,
} from '@assetdiet/core';

export interface ReferenceAnalysisResult {
  totalSourceFiles: number;
  totalReferencesFound: number;
  unreferencedAssets: AssetRecord[];
  uncertainAssets: AssetRecord[];
  referencedAssets: AssetRecord[];
}

/**
 * Regex patterns for finding asset references in code.
 */
const IMPORT_REQUIRE_REGEX = /(?:import\s+(?:[\w*\s{},]+from\s+)?['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)|import\(\s*['"]([^'"]+)['"]\s*\)|new\s+URL\(\s*['"]([^'"]+)['"]\s*,\s*import\.meta\.url\))/g;
const CSS_URL_REGEX = /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi;
const HTML_SRC_REGEX = /<(?:img|video|audio|source|link)\b[^>]*?\b(?:src|srcset|href)\s*=\s*["']([^"']+)["']/gi;
const JSON_STRING_REGEX = /"([^"\\]*(?:\\.[^"\\]*)*)"/g;

/**
 * Determine if a target string has an asset extension.
 */
function hasAssetExtension(target: string): boolean {
  const ext = path.extname(target.split('?')[0]?.split('#')[0] ?? '').toLowerCase();
  return ext in EXTENSION_TO_TYPE;
}

/**
 * Extract all asset reference occurrences from a source file's text content.
 */
export function extractReferencesFromSource(
  sourcePath: string,
  content: string
): ReferenceRecord[] {
  const records: ReferenceRecord[] = [];
  const ext = path.extname(sourcePath).toLowerCase();
  const lines = content.split('\n');

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex] ?? '';
    const lineNumber = lineIndex + 1;

    // 1. JS / TS / JSX / TSX / Vue / Svelte
    if (['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.vue', '.svelte'].includes(ext)) {
      let match: RegExpExecArray | null;
      IMPORT_REQUIRE_REGEX.lastIndex = 0;
      while ((match = IMPORT_REQUIRE_REGEX.exec(line)) !== null) {
        const rawRef = match[1] ?? match[2] ?? match[3] ?? match[4];
        if (rawRef && hasAssetExtension(rawRef)) {
          const isDynamic = line.includes('import(');
          records.push({
            sourcePath,
            kind: line.includes('require(') ? 'require' : isDynamic ? 'dynamic' : 'import',
            line: lineNumber,
            confidence: isDynamic ? 'uncertain' : 'confirmed',
            rawRef,
          });
        }
      }
    }

    // 2. CSS / SCSS / LESS
    if (['.css', '.scss', '.sass', '.less', '.vue', '.svelte', '.html'].includes(ext)) {
      let match: RegExpExecArray | null;
      CSS_URL_REGEX.lastIndex = 0;
      while ((match = CSS_URL_REGEX.exec(line)) !== null) {
        const rawRef = match[1]?.trim();
        if (rawRef && !rawRef.startsWith('data:') && hasAssetExtension(rawRef)) {
          records.push({
            sourcePath,
            kind: 'css-url',
            line: lineNumber,
            confidence: 'confirmed',
            rawRef,
          });
        }
      }
    }

    // 3. HTML / Templates
    if (['.html', '.htm', '.php', '.vue', '.svelte', '.jsx', '.tsx'].includes(ext)) {
      let match: RegExpExecArray | null;
      HTML_SRC_REGEX.lastIndex = 0;
      while ((match = HTML_SRC_REGEX.exec(line)) !== null) {
        const rawRef = match[1]?.trim();
        if (rawRef && !rawRef.startsWith('data:') && hasAssetExtension(rawRef)) {
          records.push({
            sourcePath,
            kind: 'html-src',
            line: lineNumber,
            confidence: 'confirmed',
            rawRef,
          });
        }
      }
    }

    // 4. JSON manifests
    if (['.json', '.json5'].includes(ext)) {
      let match: RegExpExecArray | null;
      JSON_STRING_REGEX.lastIndex = 0;
      while ((match = JSON_STRING_REGEX.exec(line)) !== null) {
        const rawRef = match[1]?.trim();
        if (rawRef && hasAssetExtension(rawRef)) {
          records.push({
            sourcePath,
            kind: 'json-string',
            line: lineNumber,
            confidence: 'probable',
            rawRef,
          });
        }
      }
    }
  }

  return records;
}

/**
 * Match discovered references back to AssetRecord items in the repository.
 */
export function matchReferencesToAssets(
  references: ReferenceRecord[],
  assets: AssetRecord[],
  root: string
): void {
  // Build lookup maps for fast matching
  const byExactPath = new Map<string, AssetRecord>();
  const byBasename = new Map<string, AssetRecord[]>();

  for (const asset of assets) {
    byExactPath.set(normalizePath(asset.path), asset);
    const base = path.basename(asset.path).toLowerCase();
    const existing = byBasename.get(base) ?? [];
    existing.push(asset);
    byBasename.set(base, existing);
  }

  for (const ref of references) {
    const rawClean = ref.rawRef.split('?')[0]?.split('#')[0] ?? '';
    
    // Attempt 1: Resolve relative to source file
    const resolvedFromSource = normalizePath(path.resolve(path.dirname(ref.sourcePath), rawClean));
    let matched = byExactPath.get(resolvedFromSource);

    // Attempt 2: Resolve relative to root (public folder references like /images/logo.png)
    if (!matched && rawClean.startsWith('/')) {
      const publicPath = normalizePath(path.resolve(root, 'public', rawClean.slice(1)));
      matched = byExactPath.get(publicPath);
      if (!matched) {
        const directRoot = normalizePath(path.resolve(root, rawClean.slice(1)));
        matched = byExactPath.get(directRoot);
      }
    }

    // Attempt 3: Match by unique basename if unambiguous
    if (!matched) {
      const base = path.basename(rawClean).toLowerCase();
      const candidates = byBasename.get(base);
      if (candidates && candidates.length === 1) {
        matched = candidates[0];
      }
    }

    if (matched) {
      matched.references.push(ref);
      if (ref.confidence === 'confirmed') {
        matched.isUnreferenced = false;
      } else if (ref.confidence === 'uncertain' && matched.isUnreferenced === true) {
        matched.isUnreferenced = 'uncertain';
      }
    }
  }

  // Update assets that have confirmed references
  for (const asset of assets) {
    if (asset.references.length > 0) {
      const hasConfirmed = asset.references.some((r) => r.confidence === 'confirmed');
      asset.isUnreferenced = hasConfirmed ? false : 'uncertain';
    } else {
      asset.isUnreferenced = true;
    }
  }
}

/**
 * Full repository reference analysis.
 * Scans code files, parses references, and updates asset records.
 */
export async function analyzeReferences(
  root: string,
  assets: AssetRecord[],
  excludes: string[] = []
): Promise<ReferenceAnalysisResult> {
  const createIgnore =
    typeof ignoreFactory === 'function'
      ? ignoreFactory
      : (ignoreFactory as unknown as { default: () => Ignore }).default;
  const ig = createIgnore();

  try {
    const gitignore = await fs.promises.readFile(path.join(root, '.gitignore'), 'utf-8');
    ig.add(gitignore);
  } catch {
    // Ignore missing .gitignore
  }
  ig.add(excludes);
  ig.add(['node_modules/**', '.git/**', 'dist/**', '.turbo/**', '.assetdiet/**']);

  const sourceFiles = await glob(
    '**/*.{js,jsx,ts,tsx,mjs,cjs,vue,svelte,css,scss,sass,less,html,htm,json}',
    {
      cwd: root,
      absolute: true,
      onlyFiles: true,
    }
  );

  const filteredFiles = sourceFiles.filter((file) => {
    const rel = normalizePath(path.relative(root, file));
    return !ig.ignores(rel);
  });

  const allReferences: ReferenceRecord[] = [];

  for (const file of filteredFiles) {
    try {
      const content = await fs.promises.readFile(file, 'utf-8');
      const refs = extractReferencesFromSource(file, content);
      allReferences.push(...refs);
    } catch {
      // Continue if unreadable
    }
  }

  matchReferencesToAssets(allReferences, assets, root);

  const unreferencedAssets = assets.filter((a) => a.isUnreferenced === true);
  const uncertainAssets = assets.filter((a) => a.isUnreferenced === 'uncertain');
  const referencedAssets = assets.filter((a) => a.isUnreferenced === false);

  return {
    totalSourceFiles: filteredFiles.length,
    totalReferencesFound: allReferences.length,
    unreferencedAssets,
    uncertainAssets,
    referencedAssets,
  };
}
