# Changelog

All notable changes to AssetDiet will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-10-16

### Fixed

- **EIO Crash on Optimize Exit**: Fixed `[Error: EIO: i/o error, close] { errno: -5, code: 'EIO', syscall: 'close' }` happening on process close after successful optimization runs. Switched image extraction and optimization from direct file path binding to in-memory buffers with `sharp.cache(false)` globally disabled, migrated file hashing from unclosed streams to clean `readFile`, wrapped all low-level file descriptor handles in `try/finally` blocks, and implemented atomic write-to-temp-then-rename semantics.
- **Reference-Aware Duplicate Deduplication**: Resolved duplicate handling ambiguity under the `safe` policy. Exact byte duplicates with 0 code or markup references are now safely deduplicated (original backed up to `.assetdiet/backups/<runId>/` and unlinked), while duplicates that have active code references in project files are preserved and compressed in place to prevent broken imports.
- **`--summary` Flag in Published Distribution**: Shipped `--summary` option for `assetdiet audit` in the distributed `assetdiet-mcp` CLI bundle, displaying a concise 4-5 line scorecard for rapid agent context and CI workflows.

### Documentation

- Updated CLI and configuration guides to document reference-aware duplicate handling, atomic swap guarantees, and rollback semantics.

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

### Changed

- **High-Signal Terminal Audit Output**: Redesigned `assetdiet audit` with a screenshot-ready scorecard, clear tabular columns, explicit duplicate groupings, and normalized cross-platform paths.
- **Concise Scorecard Flag (`--summary`)**: Added `--summary` to `assetdiet audit` for quick CI checks and concise AI agent prompts.
- **Responsive Progress Feedback**: Long-running optimizations (video, 3D, batch images) stream real-time progress indicators to stderr without polluting stdout or MCP JSON-RPC streams.
- **Expanded Default Ignores**: Added `.assetdietignore` support and standard build exclusions (`out`, `.output`, `.nuxt`, `.cache`) alongside `.gitignore`.
- **Spotlight on Code Migration**: Elevated `assetdiet_find_references` and `assetdiet_migrate_references` in documentation as a key differentiator.
