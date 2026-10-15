# Installation Guide

AssetDiet can be run on demand via `npx`, installed globally, configured directly into your AI coding assistant via its interactive setup command, or built from source in a local development environment.

## Requirements

### Supported Runtimes

- **Node.js**: `>= 20.0.0` (LTS versions 20.x or 22.x recommended)
- **npm**: `>= 9.0.0` or **pnpm**: `>= 9.0.0`

### Supported Platforms

- **macOS**: Apple Silicon (`arm64`) and Intel (`x64`)
- **Linux**: Ubuntu 20.04+, Debian 11+, Fedora 38+, Arch (`x64`, `arm64`)
- **Windows**: Windows 10 / 11 / Server 2022 (`x64`, native Command Prompt, PowerShell, or Windows Terminal)

---

## Method 1: Guided Assistant Setup (Recommended)

To automatically detect your installed AI coding assistants and configure AssetDiet as an MCP server:

```bash
npx -y assetdiet-mcp@latest setup
```

This interactive wizard:

1. Detects installed assistants: **Cursor**, **Claude Desktop**, **Claude Code**, **Windsurf**, and **Codex**.
2. Displays the exact JSON configuration changes for your review.
3. Creates a timestamped `.bak` backup of any configuration file before modifying it.
4. Registers AssetDiet using exact package pinning (`npx --yes assetdiet-mcp@<version> mcp`) to avoid unexpected floating-version breakage.
5. Reads back the modified file to verify valid JSON formatting.

### Setup Flags

```bash
# Non-destructive preview of configuration changes without writing to disk
npx -y assetdiet-mcp@latest setup --dry-run

# Target a specific client
npx -y assetdiet-mcp@latest setup --client cursor
npx -y assetdiet-mcp@latest setup --client claude-desktop

# Machine-readable output for scripts
npx -y assetdiet-mcp@latest setup --dry-run --json

# Non-interactive confirmation (applies only proposed AssetDiet changes)
npx -y assetdiet-mcp@latest setup --client cursor --yes
```

---

## Method 2: Global CLI Installation

Install AssetDiet as a standalone CLI on your system:

```bash
npm install -g assetdiet-mcp
```

Verify the installation and check system capabilities:

```bash
assetdiet --help
assetdiet doctor
```

Both `assetdiet` and `assetdiet-mcp` commands are exposed and point to the same binary.

---

## Method 3: One-Off Usage via npx

Run commands without installing:

```bash
# Run diagnostics
npx -y assetdiet-mcp@latest doctor

# Audit a repository in read-only mode
npx -y assetdiet-mcp@latest audit ./path/to/project --policy safe

# Optimize eligible assets with transaction rollback protection
npx -y assetdiet-mcp@latest optimize ./path/to/project --policy safe
```

---

## Method 4: Manual MCP Client Configuration

If you prefer to configure your assistants manually, add the following configuration to your client's configuration file. Replace `<version>` with the exact version (e.g. `0.1.0`).

### Cursor

Add to `.cursor/mcp.json` (project-level) or user settings:

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

### Claude Desktop

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

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

### Claude Code

Add to `~/.claude.json`:

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

### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

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

### Codex

Add to `~/.codex/config.json`:

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

---

## Method 5: Developer Installation from Source

To build and contribute to AssetDiet:

```bash
git clone https://github.com/092Abdullah/AssetDiet.git
cd AssetDiet
pnpm install
pnpm build
pnpm test
```

For developer commands, see [development.md](file:///d:/6th%20SEM/side-projects/assetdiet-mcp/docs/development.md).

---

## Verifying System Health

Run the diagnostic command after installation:

```bash
assetdiet doctor
```

Example output:

```
AssetDiet Doctor
================
Package:        assetdiet-mcp (v0.1.0)
Node.js:        v20.x.x
npm:            v10.x.x
Platform:       win32 (x64)

Core Engines:
  [PASS] Sharp (libvips): Image optimization ready
  [PASS] SVGO: Vector optimization ready
  [PASS] glTF-Transform: 3D model processing ready
  [PASS] Font Scanner: Font metadata & duplicate detection ready

Optional Tooling:
  [PASS] FFmpeg / FFprobe: Video transcoding ready
```
