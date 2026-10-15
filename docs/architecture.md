# Architecture & Package Design

AssetDiet is organized as a modular TypeScript monorepo powered by **pnpm workspaces** and **Turborepo**, designed for both high-velocity internal development and clean, zero-friction external distribution.

---

## Monorepo Layout

```
assetdiet-monorepo/
├── apps/
│   ├── cli/                     # Development CLI entry point
│   └── mcp-server/              # Stdio MCP server application
├── packages/
│   ├── assetdiet-mcp/           # [PUBLIC DISTRIBUTION] Standalone published npm package
│   ├── core/                    # Policies, shared configuration, types, path utilities
│   ├── scanner/                 # Filesystem walker, asset metadata extraction, SHA-256
│   ├── planner/                 # Optimization opportunity ranking & task planning
│   ├── optimizer-images/        # Sharp-based image optimization engine
│   ├── optimizer-svg/           # SVGO-based SVG optimization engine
│   ├── optimizer-video/         # Direct FFmpeg / FFprobe subprocess transcoding
│   ├── optimizer-3d/            # glTF-Transform 3D model compression pipeline
│   ├── optimizer-fonts/         # Font metadata parser and duplicate family detection
│   ├── reference-analyzer/      # Static code analyzer for imports and asset URLs
│   ├── validation/              # Independent quality gates (decode, SSIM, parity checks)
│   ├── transactions/            # Atomic backup manager & rollback transaction journal
│   ├── reporting/               # Markdown, JSON, and standalone HTML report generators
│   └── typescript-config/       # Shared TypeScript compiler configurations
├── docs/                        # Project documentation guides
└── examples/                    # Sample integration projects
```

---

## Distribution Architecture

### The Problem

In a monorepo, packages typically reference each other via `workspace:*` dependencies. If published directly, end users would need access to internal monorepo packages, resulting in broken dependencies and requiring complex multistep installations.

### The Solution: Dedicated Self-Contained Distribution Package (`packages/assetdiet-mcp`)

We maintain a dedicated distribution package: `packages/assetdiet-mcp`.

- **Bundled Workspace Code**: Uses `tsup` / `esbuild` to compile and bundle all internal `@assetdiet/*` workspace packages into standalone ESM output (`dist/cli.js`, `dist/mcp.js`, `dist/index.js`).
- **Zero Monorepo Leakage**: No `workspace:*` dependencies exist in the published package artifact.
- **Explicit External Dependencies**: Only native and heavy third-party runtime dependencies (`sharp`, `svgo`, `@gltf-transform/*`, `@modelcontextprotocol/sdk`, `commander`, `fast-glob`, `ignore`, `zod`) are declared in `dependencies`.
- **Clean Executable Aliases**: Exposes both `assetdiet` and `assetdiet-mcp` executables pointing to `dist/cli.js`.

---

## Data Flow: Optimization Lifecycle

```
[ User / AI Assistant ]
         │
         │  (1) scan / audit
         ▼
┌─────────────────────────┐
│     @assetdiet/scanner  │ ──► Identifies files, hashes, and metadata
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│     @assetdiet/planner  │ ──► Ranks opportunities and builds execution tasks
└───────────┬─────────────┘
            │
            │  (2) optimize
            ▼
┌─────────────────────────┐
│  @assetdiet/transactions│ ──► Copies original to .assetdiet/backups/<runId>/
└───────────┬─────────────┘     Logs pending transaction in journal
            │
            ▼
┌─────────────────────────┐
│  Target Optimizer       │ ──► Optimizes into temporary file (.tmp)
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  @assetdiet/validation  │ ──► Independent decode, parity, and SSIM verification
└───────────┬─────────────┘
            │
      [ Quality Check ]
      ├── PASS ──► Atomically renames .tmp to target path; journals COMMIT
      └── FAIL ──► Discards .tmp; preserves original; journals ABORT
            │
            ▼
┌─────────────────────────┐
│  @assetdiet/reporting   │ ──► Emits Markdown, JSON, and HTML summary reports
└─────────────────────────┘
```

---

## stdio MCP Server Isolation

A critical requirement of the Model Context Protocol is that **stdout must remain 100% clean JSON-RPC traffic**. Any extraneous logging, banners, ANSI escape sequences, or debug output on `stdout` immediately breaks client JSON parsing.

In AssetDiet:

1. All diagnostic logging, warnings, and informational banners are directed strictly to `process.stderr`.
2. The MCP server entry point (`assetdiet mcp`) attaches the SDK's `StdioServerTransport` directly to standard streams without monkey-patching stdout.
3. Subprocesses (such as `ffmpeg` and `ffprobe`) are spawned with `stdio: ['ignore', 'pipe', 'pipe']` and captured via buffered pipes, never inheriting stdout.
