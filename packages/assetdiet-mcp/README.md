<div align="center">

<img src="https://raw.githubusercontent.com/092Abdullah/AssetDiet/master/docs/assets/assetdiet-hero.svg" alt="AssetDiet — Local-first asset intelligence &amp; optimization for AI coding assistants" width="960" />

<br /><br />

# assetdiet-mcp

**Local-first CLI and Model Context Protocol (MCP) server for auditing, optimizing, and safely managing images, SVGs, videos, and 3D assets in codebases.**

[![CI](https://github.com/092Abdullah/AssetDiet/actions/workflows/ci.yml/badge.svg)](https://github.com/092Abdullah/AssetDiet/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-C4F269.svg?labelColor=151719)](https://github.com/092Abdullah/AssetDiet/blob/master/LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-F6F7F2.svg?labelColor=151719)](https://nodejs.org)
[![MCP Tools](https://img.shields.io/badge/MCP-16_Tools-8B83FF.svg?labelColor=151719)](https://github.com/092Abdullah/AssetDiet/blob/master/docs/mcp-tools.md)
[![Privacy](https://img.shields.io/badge/Privacy-100%25_Local-C4F269.svg?labelColor=151719)](https://github.com/092Abdullah/AssetDiet/blob/master/docs/security.md)

</div>

---

## Overview

`assetdiet-mcp` is the self-contained distribution package of AssetDiet. It exposes both the developer command-line interface (`assetdiet`) and the stdio Model Context Protocol server for AI coding assistants like **Cursor**, **Claude Desktop**, **Claude Code**, **Windsurf**, and **Codex**.

### Core Philosophy

> _“Many heavy assets go in. Lean, verified assets come out.”_

- **100% Local**: All processing runs on your local machine using embedded native libraries (libvips) and WebAssembly. No files are uploaded to external APIs or remote buckets.
- **Zero Telemetry**: No tracking beacons, analytics, or phone-home requests.
- **Byte-for-Byte Rollback**: Automatic pre-optimization backups in `.assetdiet/backups/` and atomic journaled recovery via `assetdiet restore`.

---

## Quick Start

### 1. Setup with Your AI Coding Assistant

Configure your installed assistants with interactive verification and automatic `.bak` backups:

```bash
npx -y assetdiet-mcp setup
```

To preview proposed configuration changes without touching files on disk:

```bash
npx -y assetdiet-mcp setup --dry-run
```

### 2. Run Diagnostics

Verify that your system meets all engine requirements and inspect detected coding assistants:

```bash
npx -y assetdiet-mcp doctor
```

### 3. Read-Only Codebase Audit

Analyze assets in your project and calculate potential byte savings without modifying files:

```bash
npx -y assetdiet-mcp audit . --policy safe
```

### 4. Optimize with Rollback Protection

```bash
npx -y assetdiet-mcp optimize . --policy safe
```

To rollback anytime:

```bash
npx -y assetdiet-mcp restore --run <runId>
```

---

## Supported Formats & Engines

- **Images** (`.png`, `.jpg`, `.webp`, `.avif`, `.tiff`, `.gif`): Powered by **Sharp (libvips)**.
- **Vectors** (`.svg`): Powered by **SVGO**.
- **3D Models** (`.glb`, `.gltf`): Powered by **glTF-Transform**.
- **Video** (`.mp4`, `.webm`): Direct subprocess execution with host **FFmpeg / FFprobe** (safely skipped if missing).
- **Fonts** (`.woff2`, `.woff`, `.ttf`, `.otf`): Header metadata parsing & duplicate family detection.

---

## Documentation Links

- [GitHub Repository](https://github.com/092Abdullah/AssetDiet)
- [Installation Guide](https://github.com/092Abdullah/AssetDiet/blob/master/docs/installation.md)
- [CLI Reference](https://github.com/092Abdullah/AssetDiet/blob/master/docs/cli.md)
- [MCP Tools Catalog (16 Tools)](https://github.com/092Abdullah/AssetDiet/blob/master/docs/mcp-tools.md)
- [Architecture & Design](https://github.com/092Abdullah/AssetDiet/blob/master/docs/architecture.md)
- [Troubleshooting & FAQs](https://github.com/092Abdullah/AssetDiet/blob/master/docs/troubleshooting.md)

---

## License

[MIT](https://github.com/092Abdullah/AssetDiet/blob/master/LICENSE) © 2026 AssetDiet Contributors
