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
- **🔤 Font Analysis & Fingerprinting**: Automatic detection of duplicate font families and weight distributions (*font subsetting is experimental in v1*).
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
      "args": [
        "<path-to-repo>/apps/mcp-server/dist/index.js"
      ]
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

| Tool | Description | Status |
|---|---|---|
| `assetdiet_scan` | Inventory repository assets and extract metadata + SHA-256 hashes | ✅ Implemented |
| `assetdiet_audit` | Find optimization opportunities and rank by potential savings (read-only) | ✅ Implemented |
| `assetdiet_estimate` | Dry-run estimate of repository-wide savings | ✅ Implemented |
| `assetdiet_optimize` | Optimize specific files with transaction and rollback protection | ✅ Implemented |
| `assetdiet_optimize_all` | Execute a repository-wide optimization pass across all eligible assets | ✅ Implemented |
| `assetdiet_inspect` | Inspect detailed metadata, dimensions, and compression potential | ✅ Implemented |
| `assetdiet_find_references` | Trace source code references (`import`, `url()`, `<img src>`) to an asset | ✅ Implemented |
| `assetdiet_find_duplicates` | Detect exact duplicate assets and duplicate font families | ✅ Implemented |
| `assetdiet_validate` | Quality gate: independently check decodability, dimension parity, and integrity | ✅ Implemented |
| `assetdiet_compare` | Compare original and optimized versions side-by-side | ✅ Implemented |
| `assetdiet_preview` | Generate preview thumbnails (base64 Data URI) and structure summaries | ✅ Implemented |
| `assetdiet_migrate_references`| Propose or apply safe source code reference updates (`.png` → `.webp`) | ✅ Implemented |
| `assetdiet_unused_assets` | Report potentially unreferenced or orphan assets with confidence scores | ✅ Implemented |
| `assetdiet_restore` | Rollback all files modified in a run back to exact original bytes | ✅ Implemented |
| `assetdiet_report` | Output Markdown, JSON, or HTML summary report from recorded runs | ✅ Implemented |
| `assetdiet_capabilities` | Probe system for Sharp, SVGO, FFmpeg, FFprobe, and glTF-Transform | ✅ Implemented |

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

## 🔒 Optimization Policies

AssetDiet enforces a strict safety hierarchy:

- **`audit`**: Read-only inspection. Zero file changes allowed.
- **`safe`** *(Default)*: Lossless or visually imperceptible optimizations only. Keeps original format, preserves alpha channels, maintains SVG IDs, never emits larger files.
- **`balanced`**: Modern web formats (WebP, AVIF, H.264 CRF 28), removes redundant metadata.
- **`aggressive`**: Palette quantization, lossy SVG transform optimization, video CRF 32, geometry compression.

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
