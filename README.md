# 🥗 AssetDiet MCP

> **Full-Repository Asset Intelligence & Optimization Toolkit for AI Coding Assistants and Developers**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![pnpm](https://img.shields.io/badge/maintained%20with-pnpm-cc00ff.svg)](https://pnpm.io/)
[![Turborepo](https://img.shields.io/badge/built%20with-Turborepo-000.svg)](https://turbo.build/)

AssetDiet is a local-first, open-source Model Context Protocol (MCP) server and developer CLI that gives AI coding assistants (Claude Code, Cursor, Windsurf, Copilot) the superpowers to inventory, audit, optimize, verify, and safely migrate repository assets across images, SVGs, videos, 3D models, and fonts.

---

## ✨ Features (Verified & Tested)

- **🤖 16 Discrete MCP Tools**: Full coverage from scanning and auditing to atomic optimization and rollback via `registerTool()`.
- **🖼️ Multi-Format Image Optimization**: Powered by Sharp (JPEG, PNG, WebP, AVIF, GIF, TIFF) with transparency and animation preservation.
- **📐 Clean SVG Optimization**: Powered by SVGO with strict structure validation and viewBox/ID preservation.
- **🎬 Atomic Video Transcoding**: Direct subprocess execution of FFmpeg & FFprobe using temporary output files to safely prevent in-place file corruption.
- **🧊 3D Asset Compression**: glTF-Transform pipeline for GLB/GLTF deduplication, welding, pruning, resample, and geometry compression where supported.
- **🔤 Font Analysis & Fingerprinting**: Automatic detection of duplicate font families and weight distributions (_font subsetting is experimental in v1_).
- **🔎 Static Reference Analysis & Migration**: Traces and safely rewrites asset references across TypeScript, JavaScript, CSS, HTML, and JSON.
- **🛡️ 100% Reversible Rollback Engine**: Every optimization creates byte-for-byte original backups in `.assetdiet/backups/<runId>`. Transactions are journaled immediately to ensure interrupted and failed runs remain fully recoverable.
- **🔍 Deep Independent Quality Gates**: Independent decode and comparison checks across dimensions, alpha transparency, audio tracks, and 3D mesh integrity.
- **📊 Multi-Format Reporting**: Generates GitHub Flavored Markdown, machine-readable JSON, and standalone HTML reports from recorded runs.

---

## 🛠️ Architecture

```
                    ┌─────────────────────────────────────────┐
                    │   AI Coding Assistant (MCP Client)      │
                    │   Cursor / Claude Desktop / Windsurf    │
                    └───────────────────┬─────────────────────┘
                                        │ stdio JSON-RPC
                    ┌───────────────────▼─────────────────────┐
                    │          apps/mcp-server                │
                    │   McpServer + registerTool() (16 tools) │
                    └───────────────────┬─────────────────────┘
                                        │
      ┌─────────────────────────────────┼─────────────────────────────────┐
      ▼                                 ▼                                 ▼
┌──────────────┐              ┌──────────────────┐              ┌──────────────────┐
│packages/core │              │ packages/scanner │              │packages/planner  │
│Policies,     │              │ Walk, metadata,  │              │Opportunity       │
│Config, Path  │              │ hashing, ignore  │              │ranking & tasks   │
└──────────────┘              └──────────────────┘              └──────────────────┘
      ▼                                 ▼                                 ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                 Optimizers                                       │
│  @assetdiet/optimizer-images  ·  @assetdiet/optimizer-svg  ·  @assetdiet/video   │
│  @assetdiet/optimizer-3d      ·  @assetdiet/optimizer-fonts                      │
└───────────────────────────────────────┬──────────────────────────────────────────┘
                                        ▼
┌──────────────────┐          ┌──────────────────┐              ┌──────────────────┐
│packages/         │          │packages/         │              │packages/         │
│validation        │◄─────────┤transactions      ├─────────────►│reporting         │
│Quality gates     │          │Backup & rollback │              │Markdown, JSON,   │
│decodability check│          │journal           │              │HTML generator    │
└──────────────────┘          └──────────────────┘              └──────────────────┘
```

---

## 🚀 Quick Start

### 1. Claude Desktop Setup

Add AssetDiet MCP to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "assetdiet": {
      "command": "node",
      "args": ["<path-to-repo>/apps/mcp-server/dist/index.js"]
    }
  }
}
```

### 2. Cursor IDE Setup

In Cursor Settings → Features → MCP:

- **Name**: `assetdiet`
- **Type**: `command`
- **Command**: `node <path-to-repo>/apps/mcp-server/dist/index.js`

---

## 🧰 Available MCP Tools

| Tool                           | Description                                                                     | Status         |
| ------------------------------ | ------------------------------------------------------------------------------- | -------------- |
| `assetdiet_scan`               | Inventory repository assets and extract metadata + SHA-256 hashes               | ✅ Implemented |
| `assetdiet_audit`              | Find optimization opportunities and rank by potential savings (read-only)       | ✅ Implemented |
| `assetdiet_estimate`           | Dry-run estimate of repository-wide savings                                     | ✅ Implemented |
| `assetdiet_optimize`           | Optimize specific files with transaction and rollback protection                | ✅ Implemented |
| `assetdiet_optimize_all`       | Execute a repository-wide optimization pass across all eligible assets          | ✅ Implemented |
| `assetdiet_inspect`            | Inspect detailed metadata, dimensions, and compression potential                | ✅ Implemented |
| `assetdiet_find_references`    | Trace source code references (`import`, `url()`, `<img src>`) to an asset       | ✅ Implemented |
| `assetdiet_find_duplicates`    | Detect exact duplicate assets and duplicate font families                       | ✅ Implemented |
| `assetdiet_validate`           | Quality gate: independently check decodability, dimension parity, and integrity | ✅ Implemented |
| `assetdiet_compare`            | Compare original and optimized versions side-by-side                            | ✅ Implemented |
| `assetdiet_preview`            | Generate preview thumbnails (base64 Data URI) and structure summaries           | ✅ Implemented |
| `assetdiet_migrate_references` | Propose or apply safe source code reference updates (`.png` → `.webp`)          | ✅ Implemented |
| `assetdiet_unused_assets`      | Report potentially unreferenced or orphan assets with confidence scores         | ✅ Implemented |
| `assetdiet_restore`            | Rollback all files modified in a run back to exact original bytes               | ✅ Implemented |
| `assetdiet_report`             | Output Markdown, JSON, or HTML summary report from recorded runs                | ✅ Implemented |
| `assetdiet_capabilities`       | Probe system for Sharp, SVGO, FFmpeg, FFprobe, and glTF-Transform               | ✅ Implemented |

---

## 💻 CLI Usage

AssetDiet also includes a standalone developer CLI:

```bash
# Scan repository assets
assetdiet scan ./my-project

# Audit opportunities (read-only)
assetdiet audit ./my-project --policy safe

# Optimize with dry-run preview
assetdiet optimize ./my-project --dry-run

# Apply optimization under safe policy
assetdiet optimize ./my-project --policy safe

# Rollback any optimization run (supports committed, pending, and failed runs)
assetdiet restore --run <run-id>
```

---

## 🎯 Production-Ready vs Experimental Capabilities

| Capability                         | Category                       | Engine                 | Tested Status       | Notes                                                                                                                      |
| ---------------------------------- | ------------------------------ | ---------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Image Optimization**             | Images (PNG, JPEG, WebP, AVIF) | Sharp                  | ✅ Production-Ready | Lossless under `safe`, lossy under `balanced`/`aggressive`. Transparency & animation preserved.                            |
| **SVG Optimization**               | Vector graphics (`.svg`)       | SVGO                   | ✅ Production-Ready | XML entity cleanup, comment/metadata stripping, viewBox & unique ID preservation.                                          |
| **3D Model Optimization**          | 3D Assets (`.glb`, `.gltf`)    | glTF-Transform         | ✅ Production-Ready | Mesh deduplication, node pruning, index reordering, vertex welding.                                                        |
| **In-Place Video Processing**      | Video (`.mp4`, `.webm`)        | FFmpeg / FFprobe       | ✅ Production-Ready | Atomic temporary file replacement; skipped under `safe`/`audit`.                                                           |
| **Rollback & Transaction Journal** | Safety Engine                  | Native fs + Journal    | ✅ Production-Ready | 100% bit-for-bit SHA-256 restoration across committed, failed, or interrupted runs.                                        |
| **Quality Gate Validation**        | Validation Engine              | Sharp, NodeIO, FFprobe | ✅ Production-Ready | Independent decodability, dimension parity, audio stream, and mesh integrity gates.                                        |
| **Reference Migration**            | Source Code Refactoring        | Native AST / Regex     | ✅ Production-Ready | Rewrites references across TSX, JSX, HTML, CSS with dry-run unified diffs.                                                 |
| **Font Subsetting**                | Web Fonts (`.woff2`, `.ttf`)   | FontTools / Canvas     | ⚠️ Experimental     | Font scanning & duplicate family detection is production-ready; character subsetting requires explicit subset definitions. |

---

## ⚠️ Known Limitations & Host Prerequisites

1. **FFmpeg for Video Transcoding**: Video optimization and poster frame previews require `ffmpeg` and `ffprobe` installed on the host system PATH. If FFmpeg is missing, AssetDiet safely skips video transcoding without failing the run or corrupting files.
2. **Read-Only / Protected Files**: Files marked read-only by OS permissions or locked by running processes cannot be atomically replaced until permissions allow write access.
3. **Font Subsetting**: Automated repository-wide optimization passes skip web font files by default because arbitrary subsetting can strip glyphs needed by dynamic runtime strings.

---

## 📦 How to Install and Try AssetDiet

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 9.0.0 (for monorepo development)

### Try the Developer CLI

```bash
# Clone the repository
git clone https://github.com/092Abdullah/AssetDiet.git
cd AssetDiet

# Install dependencies and build
pnpm install
pnpm build

# Link CLI globally (or run directly)
node apps/cli/dist/index.js --help

# Run a read-only audit on any web project
node apps/cli/dist/index.js audit /path/to/project --policy safe

# Optimize with rollback protection
node apps/cli/dist/index.js optimize /path/to/project --policy safe

# Restore any run if needed
node apps/cli/dist/index.js restore /path/to/project --run <run-id>
```

### Try with Claude Desktop or Cursor (MCP)

Add the built MCP server to your MCP configuration:

```json
{
  "mcpServers": {
    "assetdiet": {
      "command": "node",
      "args": ["<absolute-path-to-AssetDiet>/apps/mcp-server/dist/index.js"]
    }
  }
}
```

---

## 🧪 Testing & Verification

```bash
# Run all tests across the monorepo
pnpm test

# Run TypeScript typechecks across all 16 packages
pnpm typecheck

# Run linter
pnpm lint

# Build all packages
pnpm build
```

---

## 📄 License

[MIT](LICENSE) © 2026 AssetDiet Contributors
