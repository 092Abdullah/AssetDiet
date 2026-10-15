# Changelog

All notable changes to AssetDiet will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] - 2026-10-15

### Added

- **Public npm Distribution Package (`assetdiet-mcp`)**: Dedicated self-contained bundle combining all internal `@assetdiet/*` packages without workspace dependencies for standalone use via `npx` or global install.
- **Guided Assistant Setup Wizard (`assetdiet setup`)**: Automated detection and configuration for Cursor, Claude Desktop, Claude Code, Windsurf, and Codex. Supports `--dry-run`, `--client`, `--yes`, and `--json` with timestamped `.bak` backups and non-destructive JSON merges.
- **Diagnostics (`assetdiet doctor`)**: Full system readiness probe inspecting Node.js, Sharp/libvips, SVGO, FFmpeg/FFprobe, glTF-Transform, font scanners, and assistant configuration files.
- **Safe Removal (`assetdiet uninstall`)**: Targeted removal of AssetDiet registrations while preserving user-defined MCP servers.
- **16 Discrete MCP Tools**: Implemented with `@modelcontextprotocol/sdk` and `registerTool()` for discovery, auditing, optimization, inspection, reference migration, independent validation, and rollback.
- **Atomic Rollback Engine**: Reversible transaction journal storing original byte-for-byte copies in `.assetdiet/backups/<runId>`.
- **Multi-Format Processing Engines**:
  - Image optimization via Sharp (PNG, JPEG, WebP, AVIF, TIFF, GIF).
  - SVG optimization via SVGO with viewBox and ID preservation.
  - Video processing via direct FFmpeg / FFprobe subprocess execution with atomic temporary file swapping.
  - 3D mesh optimization via glTF-Transform (deduplication, vertex welding, texture pruning).
  - Font analysis and duplicate family detection.
- **Multi-Format Reporting**: Markdown, JSON, and standalone HTML summary report generators.
- **End-to-End Tarball Test Suite**: Automated pack-and-test validation ensuring the published `.tgz` installs and runs cleanly outside the monorepo.
