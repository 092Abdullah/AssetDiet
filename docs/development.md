# Development & Contributing Guide

This guide covers setting up your local development environment, running tests, and validating the distribution package within the AssetDiet monorepo.

---

## Prerequisites

- **Node.js**: `>= 20.0.0`
- **pnpm**: `>= 9.15.0` (`npm install -g pnpm`)
- **Git**

---

## Local Setup

1. **Clone the repository**:

   ```bash
   git clone https://github.com/092Abdullah/AssetDiet.git
   cd AssetDiet
   ```

2. **Install all dependencies**:

   ```bash
   pnpm install
   ```

3. **Build all workspace packages**:
   ```bash
   pnpm build
   ```

---

## Development Scripts

The monorepo uses **Turborepo** to orchestrate tasks across workspaces:

```bash
# Run unit and integration tests across all packages
pnpm test

# Run TypeScript typechecks across all packages
pnpm typecheck

# Check code formatting with Prettier
pnpm format:check

# Auto-format all code
pnpm format

# Run ESLint across packages
pnpm lint

# Start incremental watch mode
pnpm dev
```

---

## Validating the Public npm Package Artifact

To ensure the public package (`assetdiet-mcp`) builds correctly, bundles internal packages, and works outside the monorepo:

1. **Build the public package**:

   ```bash
   pnpm --filter assetdiet-mcp build
   ```

2. **Create the real tarball**:

   ```bash
   cd packages/assetdiet-mcp
   npm pack
   ```

3. **Test in a clean directory outside the monorepo**:
   Install the generated `.tgz` archive in a disposable directory and verify CLI and MCP commands:
   ```bash
   mkdir /tmp/test-assetdiet && cd /tmp/test-assetdiet
   npm init -y
   npm install /path/to/AssetDiet/packages/assetdiet-mcp/assetdiet-mcp-0.1.0.tgz
   npx assetdiet --help
   npx assetdiet doctor
   ```

---

## Project Structure Overview

- `apps/mcp-server`: Stdio MCP server application entry point.
- `apps/cli`: CLI development entry point.
- `packages/assetdiet-mcp`: Self-contained public npm distribution package.
- `packages/core`: Core types, configuration parser, and policy schemas.
- `packages/scanner`: Filesystem walker and MIME/dimension extractors.
- `packages/planner`: Optimization task generator and size estimator.
- `packages/optimizer-*`: Individual format engines (images, SVG, video, 3D, fonts).
- `packages/validation`: Independent verification quality gates.
- `packages/transactions`: Transaction logging and rollback engine.
- `packages/reporting`: Markdown, JSON, and HTML report emitters.
