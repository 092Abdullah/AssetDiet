# MCP Tools Reference

AssetDiet exposes 16 discrete Model Context Protocol (MCP) tools implemented with the official `@modelcontextprotocol/sdk` and `registerTool()`.

All tools communicate with AI coding assistants (e.g. Cursor, Claude Desktop, Windsurf, Claude Code) over standard stdio using JSON-RPC 2.0.

---

## Tool Catalog

| Tool Name                      | Scope         | Mode            | Description                                                             |
| ------------------------------ | ------------- | --------------- | ----------------------------------------------------------------------- |
| `assetdiet_scan`               | Discovery     | Read-Only       | Inventories assets, extracts dimensions, MIME types, and SHA-256 hashes |
| `assetdiet_audit`              | Discovery     | Read-Only       | Identifies optimization opportunities with estimated savings            |
| `assetdiet_estimate`           | Estimation    | Read-Only       | Quick aggregate byte savings calculation across eligible assets         |
| `assetdiet_inspect`            | Deep Analysis | Read-Only       | Inspects deep metadata, color depth, geometry stats, and audio tracks   |
| `assetdiet_capabilities`       | Diagnostics   | Read-Only       | Reports system engine availability (Sharp, SVGO, FFmpeg, glTF)          |
| `assetdiet_find_duplicates`    | Hygiene       | Read-Only       | Locates byte-identical duplicates and duplicate font family variants    |
| `assetdiet_find_references`    | Source Graph  | Read-Only       | Traces where an asset is referenced in code, CSS, JSX, or HTML          |
| `assetdiet_unused_assets`      | Hygiene       | Read-Only       | Flags assets with zero detected code references and confidence scores   |
| `assetdiet_preview`            | Inspection    | Read-Only       | Generates inline Base64 data URIs or structure previews for inspection  |
| `assetdiet_validate`           | Quality Gate  | Read-Only       | Performs independent decode, dimension, and integrity checks            |
| `assetdiet_compare`            | Comparison    | Read-Only       | Side-by-side comparison of original vs. optimized file metrics          |
| `assetdiet_optimize`           | Optimization  | Write (Atomic)  | Optimizes specified files with journaled rollback protection            |
| `assetdiet_optimize_all`       | Optimization  | Write (Atomic)  | Executes batch optimization across all eligible files in repository     |
| `assetdiet_migrate_references` | Refactoring   | Write / Dry-Run | Updates code import paths after format conversion (`.png` → `.webp`)    |
| `assetdiet_restore`            | Safety        | Write (Restore) | Restores original files from backup for any recorded run                |
| `assetdiet_report`             | Documentation | Read / Write    | Generates Markdown, JSON, or HTML reports for an optimization run       |

---

## Detailed Tool Specifications

### 1. `assetdiet_scan`

- **Purpose**: Walk the workspace and discover all supported asset files (images, SVGs, videos, 3D models, fonts).
- **Parameters**:
  - `path` _(string, optional)_: Subdirectory to scan relative to workspace root. Default: `.`.
  - `type` _(string, optional)_: Filter by asset type (`image`, `svg`, `video`, `model3d`, `font`).
- **Safety**: Purely read-only. Respects `.gitignore` and `.assetdietignore`.

### 2. `assetdiet_audit`

- **Purpose**: Evaluates all scanned assets against optimization policies and calculates potential byte savings without altering files.
- **Parameters**:
  - `path` _(string, optional)_: Directory path.
  - `policy` _(enum: `safe` \| `balanced` \| `aggressive`, optional)_: Target policy. Default: `safe`.
- **Safety**: Purely read-only. Never modifies repository files.

### 3. `assetdiet_optimize`

- **Purpose**: Atomically optimizes designated asset files under specified quality and policy guidelines.
- **Parameters**:
  - `paths` _(string[], required)_: Relative paths of assets to optimize.
  - `policy` _(enum: `safe` \| `balanced` \| `aggressive`, optional)_: Optimization aggressiveness. Default: `safe`.
  - `dryRun` _(boolean, optional)_: If true, runs optimization in memory and returns planned changes without writing. Default: `false`.
- **Safety**: Creates bit-for-bit backups in `.assetdiet/backups/<runId>/` and records immediate transaction journal entries.

### 4. `assetdiet_optimize_all`

- **Purpose**: Runs a repository-wide optimization pass across all eligible assets in the project.
- **Parameters**:
  - `path` _(string, optional)_: Root path for optimization pass.
  - `policy` _(enum: `safe` \| `balanced` \| `aggressive`, optional)_: Policy level. Default: `safe`.
  - `types` _(string[], optional)_: Filter specific asset types to include.
  - `dryRun` _(boolean, optional)_: Preview only. Default: `false`.
- **Safety**: Fully journaled and reversible with `assetdiet_restore`.

### 5. `assetdiet_find_references`

- **Purpose**: Scans code files (`.ts`, `.tsx`, `.js`, `.jsx`, `.html`, `.css`, `.json`) to find all imports and URL references to an asset.
- **Parameters**:
  - `assetPath` _(string, required)_: Relative path to the asset.
- **Returns**: Array of occurrences with file paths, line numbers, and matching text snippets.

### 6. `assetdiet_migrate_references`

- **Purpose**: Updates source code references when an asset format changes (for example, from `hero.png` to `hero.webp`).
- **Parameters**:
  - `oldPath` _(string, required)_: Previous asset reference.
  - `newPath` _(string, required)_: New asset reference.
  - `dryRun` _(boolean, optional)_: If true, returns unified diffs of proposed code edits without writing to disk. Default: `true`.
- **Safety**: Defaults to `dryRun: true` so the assistant and developer can inspect code diffs before applying.

### 7. `assetdiet_validate`

- **Purpose**: Independent quality assurance gate. Verifies that optimized files decode without error, maintain dimensional parity, preserve alpha transparency, and contain valid mesh/audio structures.
- **Parameters**:
  - `originalPath` _(string, required)_: Path to original file.
  - `optimizedPath` _(string, required)_: Path to optimized file.
- **Returns**: Status (`PASS` or `FAIL`), visual similarity metric (SSIM where applicable), and detailed gate check breakdown.

### 8. `assetdiet_restore`

- **Purpose**: Restores all files modified in a run back to their exact original byte contents using recorded backups.
- **Parameters**:
  - `runId` _(string, required)_: Identifier of the run to reverse.
- **Safety**: Reads original files from `.assetdiet/backups/<runId>` and verifies matching SHA-256 hashes upon restoration.

### 9. `assetdiet_capabilities`

- **Purpose**: Returns the operational capabilities of the host system.
- **Output**: JSON object detailing availability of:
  - `sharp` (libvips version, supported decode/encode codecs)
  - `svgo` (SVG parser version)
  - `ffmpeg` & `ffprobe` (binary paths, H.264/AV1/VP9 codec support)
  - `gltf-transform` (mesh optimizer, Draco geometry compression readiness)
