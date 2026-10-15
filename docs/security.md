# Security & Privacy Policy

AssetDiet is designed with a **local-first** security model. This document details how AssetDiet handles your files, processes data, and interacts with AI coding assistants.

---

## 1. Local-First Processing

- **No Remote Asset Uploads**: AssetDiet processes all assets (images, SVGs, videos, 3D models, fonts) entirely on your local machine using embedded WebAssembly and native libraries (`libvips`, `SVGO`, `@gltf-transform`). Your media files are never transmitted to any external cloud, API, or remote telemetry server.
- **No Analytics / Telemetry**: AssetDiet contains zero analytics trackers, telemetry beacons, or external reporting endpoints.

---

## 2. AI Coding Assistant Telemetry & Context

While AssetDiet operates locally, please understand how the Model Context Protocol interacts with your AI assistant:

- When you ask an AI assistant (such as Cursor, Claude Desktop, or Windsurf) to run an AssetDiet tool (e.g. `assetdiet_audit` or `assetdiet_inspect`), the tool returns metadata (such as file names, dimensions, byte sizes, and estimated savings) over local stdio to the assistant.
- Your AI assistant may include these tool outputs in the prompt context sent to its AI model provider (e.g. Anthropic, OpenAI, or Google) according to that provider's privacy policy and terms of service.
- AssetDiet itself never communicates with those model providers.

---

## 3. Filesystem Safety & Rollback Guarantees

AssetDiet implements strict safety guarantees to prevent data loss or project corruption:

1. **Mandatory Backups**: Before any asset file is modified, an exact byte-for-byte copy is stored in `.assetdiet/backups/<runId>/`.
2. **Transaction Journaling**: Modifications are recorded in `.assetdiet/journal.json` using write-ahead logging. If a process is terminated mid-optimization (e.g. power loss or SIGINT), the transaction journal identifies interrupted operations and allows complete restoration.
3. **Atomic File Swaps**: Optimizers write outputs to temporary files first (`.tmp.<random>`), run independent decodability and validation checks, and only then atomically replace the target file using OS-level renames (`fs.promises.rename`).
4. **Non-Destructive Setup**: The `setup` wizard creates timestamped `.bak` files before touching any configuration files and validates the written JSON syntax before exiting.

---

## 4. Subprocess Execution Security

AssetDiet executes `ffmpeg` and `ffprobe` as system subprocesses when available:

- **No Shell Execution**: Subprocesses are spawned directly using `child_process.spawn` with argument arrays, preventing shell injection vulnerabilities.
- **Path Sanitization**: All file paths passed to child processes are validated against workspace boundaries.

---

## 5. Reporting a Security Vulnerability

If you discover a security vulnerability in AssetDiet, please review our [SECURITY.md](file:///d:/6th%20SEM/side-projects/assetdiet-mcp/SECURITY.md) for disclosure guidelines.
