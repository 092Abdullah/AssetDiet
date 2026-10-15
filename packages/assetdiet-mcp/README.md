# AssetDiet

Full-repository asset intelligence, optimization, and Model Context Protocol (MCP) server for AI coding assistants and developers.

[![CI](https://github.com/092Abdullah/AssetDiet/actions/workflows/ci.yml/badge.svg)](https://github.com/092Abdullah/AssetDiet/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/assetdiet-mcp.svg)](https://www.npmjs.com/package/assetdiet-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](package.json)

---

## The Problem

Web and mobile applications routinely accumulate multi-megabyte images, unoptimized SVG icons with unused editor metadata, heavy background videos, and uncompressed 3D models. AI coding assistants generate features and UI code quickly, but treat binary assets as opaque files. They lack native capabilities to inspect metadata, safely compress assets, verify visual fidelity, update code import references, or restore files if an optimization fails.

AssetDiet equips AI coding assistants and developers with local, safety-guaranteed tools to inventory repository media, find high-value compression opportunities, optimize files atomically, independently verify decodability, and reverse changes byte-for-byte at any time.

---

## Quick Start: Guided Assistant Setup

Configure AssetDiet in your AI coding assistant with one command:

```bash
npx -y assetdiet-mcp@latest setup
```

The interactive setup wizard:

1. Detects installed assistants: **Cursor**, **Claude Desktop**, **Claude Code**, **Windsurf**, and **Codex**.
2. Previews proposed JSON configuration changes for your review.
3. Automatically creates timestamped `.bak` backup copies before modifying any existing configuration.
4. Preserves all existing MCP servers and unrelated user settings.
5. Registers AssetDiet using exact package version pinning:
   ```json
   {
     "mcpServers": {
       "assetdiet": {
         "command": "npx",
         "args": ["--yes", "assetdiet-mcp@0.1.0", "mcp"]
       }
     }
   }
   ```
6. Validates the modified configuration by reading it back from disk.

To preview changes non-destructively:

```bash
npx -y assetdiet-mcp@latest setup --dry-run
```

---

## Using with AI Coding Assistants

Once configured, your AI assistant can directly invoke AssetDiet's 16 discrete MCP tools.

### Example Prompt

> _"Run an asset audit on this project, identify which images and 3D models can be safely optimized, and estimate potential byte savings."_

### Assistant Execution Flow

1. The assistant calls `assetdiet_audit` to analyze the workspace without modifying any files.
2. The assistant summarizes findings:
   ```
   Asset Audit Summary:
   - public/hero-banner.png: 3.8 MB -> Est. 1.1 MB (71% savings) via WebP conversion
   - public/icons/logo.svg: 84 KB -> Est. 26 KB (69% savings) via SVG cleanup
   - public/models/robot.glb: 14.2 MB -> Est. 5.1 MB (64% savings) via mesh deduplication
   Total potential savings: 11.8 MB (65%)
   ```
3. When you confirm, the assistant calls `assetdiet_optimize`, which creates a backup in `.assetdiet/backups/<runId>/`, applies the optimizations, independently validates the outputs, and records the transaction.
4. If format migration is needed (`.png` → `.webp`), the assistant calls `assetdiet_migrate_references` to update source code imports across TSX, JSX, HTML, and CSS.

---

## Quick CLI Usage

AssetDiet can also be run directly from the command line without an assistant:

```bash
# Check environment and engine readiness
npx -y assetdiet-mcp@latest doctor

# Audit assets in read-only mode (no files are modified)
npx -y assetdiet-mcp@latest audit . --policy safe

# Optimize eligible assets under safe policy
npx -y assetdiet-mcp@latest optimize . --policy safe

# Preview optimizations without writing changes
npx -y assetdiet-mcp@latest optimize . --policy safe --dry-run

# Restore original files from any run
npx -y assetdiet-mcp@latest restore
```

To install the CLI globally:

```bash
npm install -g assetdiet-mcp
assetdiet --help
```

---

## Supported Formats & Processing Engines

| Format Category     | File Extensions                                            | Engine           | Status                    | Applied Transformations                                                                                                                     |
| ------------------- | ---------------------------------------------------------- | ---------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Raster Images**   | `.png`, `.jpg`, `.jpeg`, `.webp`, `.avif`, `.tiff`, `.gif` | Sharp (libvips)  | Tested / Production-Ready | Metadata stripping, lossless/lossy compression, dimension preservation, alpha transparency preservation.                                    |
| **Vector Graphics** | `.svg`                                                     | SVGO             | Tested / Production-Ready | XML cleanup, editor metadata removal, comment stripping, `viewBox` and ID preservation.                                                     |
| **3D Models**       | `.glb`, `.gltf`                                            | glTF-Transform   | Tested / Production-Ready | Coincident vertex welding, mesh deduplication, unused material/sampler pruning, texture re-encoding.                                        |
| **Video**           | `.mp4`, `.webm`                                            | FFmpeg / FFprobe | Optional Host Engine      | Direct subprocess execution, H.264/VP9 transcoding, atomic temporary file swaps. Requires FFmpeg on host `PATH`. Safely skipped if missing. |
| **Fonts**           | `.woff2`, `.woff`, `.ttf`, `.otf`                          | Font Scanner     | Partial / Experimental    | Font metadata extraction and duplicate family detection is production-ready. Character-level font subsetting is experimental.               |

---

## Optimization Policies

AssetDiet uses explicit policies to govern optimization intensity:

- **`audit`**: Strictly read-only mode. Computes realistic savings by analyzing file structures and running in-memory simulations without touching files on disk.
- **`safe`** _(Default)_: Strictly lossless or visually indistinguishable optimizations. Preserves exact file formats, dimensions, transparency, and audio streams. Ideal for automated CI pipelines and production codebases.
- **`balanced`**: Perceptually lossless transformations with modern format opportunities (WebP/AVIF at quality 85, video CRF 23). Best for web applications where transfer size directly impacts user experience.
- **`aggressive`**: Maximum byte reduction for mobile bundles or bandwidth-constrained deployments (quality 75, video CRF 28, geometry reduction).

---

## Validation, Rollback & Safety Engine

Every file modification in AssetDiet is governed by safety mechanisms:

1. **Pre-Optimization Backups**: Before any asset is modified, an exact byte-for-byte copy is archived in `.assetdiet/backups/<runId>/`.
2. **Atomic Write-Ahead Journal**: Operations are recorded in `.assetdiet/journal.json`. If a run is interrupted by power failure or user cancellation, the journal retains state for clean restoration.
3. **Atomic Replacements**: Optimizers write outputs to temporary files (`.tmp.<random>`), verify their integrity, and perform an atomic filesystem rename (`fs.rename`). Files are never modified in-place unsafely.
4. **Independent Quality Gates**: Validates that optimized files decode without error, preserve dimensional parity, maintain alpha transparency channels, and preserve audio tracks before replacing originals.
5. **Byte-for-Byte Rollback**: Run `assetdiet restore --run <runId>` to revert any committed or interrupted run back to its original SHA-256 state.

---

## MCP Assistant Setup & Manual Configuration

For automatic configuration, run:

```bash
npx -y assetdiet-mcp@latest setup
```

To configure clients manually, add the following to your assistant's MCP configuration file (replace `0.1.0` with the installed version):

```json
{
  "mcpServers": {
    "assetdiet": {
      "command": "npx",
      "args": ["--yes", "assetdiet-mcp@0.1.0", "mcp"]
    }
  }
}
```

Configuration file paths by client:

- **Cursor**: `.cursor/mcp.json` (project) or Cursor Settings → Features → MCP
- **Claude Desktop**:
  - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
  - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
  - Linux: `~/.config/Claude/claude_desktop_config.json`
- **Claude Code**: `~/.claude.json`
- **Windsurf**: `~/.codeium/windsurf/mcp_config.json`
- **Codex**: `~/.codex/config.json`

For full options and scopes, see the [Installation Guide](https://github.com/092Abdullah/AssetDiet/blob/main/docs/installation.md).

---

## System Requirements

- **Runtime**: Node.js `>= 20.0.0`
- **Package Manager**: npm `>= 9.0.0` or pnpm `>= 9.0.0`
- **Operating Systems**: macOS (`arm64`, `x64`), Linux (`x64`, `arm64`), Windows 10 / 11 (`x64`)
- **Optional Tools**:
  - `ffmpeg` and `ffprobe` (required only for video transcoding and poster generation). If not present on your system `PATH`, AssetDiet safely skips video files without failing the run. Run `assetdiet doctor` to verify availability.

---

## Security, Privacy & Local Execution

- **100% Local Processing**: All asset analysis and compression runs locally on your machine using embedded native libraries and WebAssembly. AssetDiet never uploads your media files to any external server, cloud bucket, or remote API.
- **Zero Telemetry**: AssetDiet contains no analytics tracking, phone-home mechanisms, or telemetry beacons.
- **AI Assistant Context**: When an AI coding assistant runs AssetDiet MCP tools, tool results (file paths, sizes, and savings metadata) are returned to the assistant over local stdio. Your assistant may transmit these text outputs to its model provider (such as Anthropic, OpenAI, or Google) according to that assistant's privacy configuration.
- **Non-Destructive Operations**: Backups are generated prior to file modifications, and assistant configuration files are backed up to `.bak` files prior to editing.

---

## Documentation Links

- [Installation Guide](https://github.com/092Abdullah/AssetDiet/blob/main/docs/installation.md)
- [CLI Reference](https://github.com/092Abdullah/AssetDiet/blob/main/docs/cli.md)
- [MCP Tools Reference](https://github.com/092Abdullah/AssetDiet/blob/main/docs/mcp-tools.md)
- [Configuration & Policies](https://github.com/092Abdullah/AssetDiet/blob/main/docs/configuration.md)
- [Architecture](https://github.com/092Abdullah/AssetDiet/blob/main/docs/architecture.md)
- [Security Policy](https://github.com/092Abdullah/AssetDiet/blob/main/SECURITY.md)
- [Troubleshooting](https://github.com/092Abdullah/AssetDiet/blob/main/docs/troubleshooting.md)
- [Development Guide](https://github.com/092Abdullah/AssetDiet/blob/main/docs/development.md)
- [Contributing](https://github.com/092Abdullah/AssetDiet/blob/main/CONTRIBUTING.md)
- [Changelog](https://github.com/092Abdullah/AssetDiet/blob/main/CHANGELOG.md)

---

## License

[MIT](LICENSE) © 2026 AssetDiet Contributors
