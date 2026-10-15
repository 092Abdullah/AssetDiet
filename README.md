# 🥗 AssetDiet MCP

> **Full-Repository Asset Intelligence & Optimization Toolkit for AI Coding Assistants and Developers**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![pnpm](https://img.shields.io/badge/maintained%20with-pnpm-cc00ff.svg)](https://pnpm.io/)
[![Turborepo](https://img.shields.io/badge/built%20with-Turborepo-000.svg)](https://turbo.build/)

AssetDiet is a local-first, open-source Model Context Protocol (MCP) server and developer CLI that gives AI coding assistants (Claude Code, Cursor, Windsurf, Copilot) the superpowers to inventory, audit, optimize, verify, and safely migrate repository assets across images, SVGs, videos, 3D models, and fonts.

---

## ✨ Features

- **🤖 16 Discrete MCP Tools**: Full coverage from scanning and auditing to atomic optimization and rollback.
- **🖼️ Multi-Format Image Optimization**: Powered by Sharp (JPEG, PNG, WebP, AVIF, GIF, TIFF).
- **📐 Clean SVG Optimization**: Powered by SVGO with strict structure validation and viewBox preservation.
- **🎬 Modern Video Transcoding**: Direct subprocess execution of FFmpeg & FFprobe (no unmaintained `fluent-ffmpeg`).
- **🧊 3D Asset Compression**: glTF-Transform pipeline for GLB/GLTF dedup, welding, pruning, and Draco compression.
- **🔤 Font Analysis & Fingerprinting**: Automatic detection of duplicate font families and weight distributions (experimental subsetting).
- **🔎 Static Reference Analysis**: Traces imports, `require()`, CSS `url()`, and HTML `<img src>` across TypeScript, JavaScript, CSS, HTML, and JSON.
- **🛡️ 100% Reversible Rollback Engine**: Every optimization creates byte-for-byte original backups in `.assetdiet/backups/<runId>` with a single-command restore.
- **📊 Multi-Format Reporting**: Generates GitHub Flavored Markdown, machine-readable JSON, and standalone HTML reports.

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

| Tool | Description |
|---|---|
| `assetdiet_scan` | Inventory repository assets and extract metadata + SHA-256 hashes |
| `assetdiet_audit` | Find optimization opportunities and rank by potential savings |
| `assetdiet_estimate` | Dry-run estimate of repository-wide savings |
| `assetdiet_optimize` | Optimize specific files with transaction and rollback protection |
| `assetdiet_optimize_all` | Execute a repository-wide optimization pass under an approved policy |
| `assetdiet_inspect` | Inspect detailed metadata and compression potential of a single asset |
| `assetdiet_find_references` | Trace source code references (`import`, `url()`, `<img src>`) to an asset |
| `assetdiet_find_duplicates` | Detect exact duplicate assets across the codebase |
| `assetdiet_validate` | Quality gate: check decodability, dimension parity, and alpha presence |
| `assetdiet_compare` | Compare original and optimized versions side-by-side |
| `assetdiet_preview` | Generate preview artifacts where supported |
| `assetdiet_migrate_references`| Propose or apply safe reference updates (e.g., `.png` → `.webp`) |
| `assetdiet_unused_assets` | Report potentially unreferenced or orphan assets |
| `assetdiet_restore` | Rollback all files modified in a run back to exact original bytes |
| `assetdiet_report` | Output Markdown, JSON, or HTML summary report |
| `assetdiet_capabilities` | Probe system for Sharp, SVGO, FFmpeg, FFprobe, and glTF-Transform |

---

## 💻 CLI Usage

AssetDiet also includes a standalone developer CLI:

```bash
# Scan repository assets
assetdiet scan ./my-project

# Audit opportunities
assetdiet audit ./my-project --policy safe

# Optimize with dry-run preview
assetdiet optimize ./my-project --dry-run

# Apply optimization
assetdiet optimize ./my-project --policy safe

# Rollback any optimization run
assetdiet restore --run <run-id>
```

---

## 🔒 Optimization Policies

AssetDiet enforces a strict safety hierarchy:

- **`audit`**: Read-only inspection. Zero file changes allowed.
- **`safe`** *(Default)*: Lossless or visually imperceptible optimizations only. Keeps original format, preserves alpha channels, maintains SVG IDs, never emits larger files.
- **`balanced`**: Modern web formats (WebP, AVIF, H.264 CRF 28), removes redundant metadata.
- **`aggressive`**: Palette quantization, lossy SVG transform optimization, video CRF 32.

---

## 🧪 Testing

```bash
# Run all tests across the monorepo
pnpm test

# Build all packages
pnpm build
```

---

## 📄 License

[MIT](LICENSE) © 2026 AssetDiet Contributors
