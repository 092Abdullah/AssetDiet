# Installation Guide

AssetDiet can be installed and verified directly from source for local monorepo development, or configured as a standalone CLI and MCP server for your AI coding assistants.

> [!IMPORTANT]
> **Source Installation Notice**: Until `assetdiet-mcp` is published to the public npm registry, **Method 1 (Verified Source Installation)** is the verified and tested path. Instructions for public `npx` and global `npm` installs are provided under **Method 2** for once the package is released.

---

## System Requirements

### Supported Runtimes

- **Node.js**: `>= 20.0.0` (LTS 20.x or 22.x recommended)
- **Package Manager**: `pnpm >= 9.0.0` (for building from source) or `npm >= 9.0.0`

### Supported Platforms

- **macOS**: Apple Silicon (`arm64`) and Intel (`x64`)
- **Linux**: Ubuntu 20.04+, Debian 11+, Fedora 38+, Arch (`x64`, `arm64`)
- **Windows**: Windows 10 / 11 / Server 2022 (`x64`, native PowerShell, Command Prompt, or Windows Terminal)

### Optional Host Tooling

- **FFmpeg & FFprobe**: Required only for video transcoding and poster generation. If absent from system `PATH`, AssetDiet safely skips video optimization passes without failing the run. Run `assetdiet doctor` to verify availability.

---

## Method 1: Verified Source Installation (Current Recommended Path)

Clone the repository and build the self-contained packages:

```bash
# 1. Clone the repository
git clone https://github.com/092Abdullah/AssetDiet.git
cd AssetDiet

# 2. Install workspace dependencies
pnpm install

# 3. Build all workspace packages and unified distribution bundle
pnpm build

# 4. Verify test suite (all tests pass)
pnpm test
```

### Running the Built CLI Directly

After building, you can invoke the unified CLI directly with Node.js:

```bash
# Check version and help
node packages/assetdiet-mcp/dist/cli.js --help

# Run system doctor diagnostics
node packages/assetdiet-mcp/dist/cli.js doctor

# Run an audit on any codebase
node packages/assetdiet-mcp/dist/cli.js audit /path/to/project --policy safe
```

### Running the Setup Wizard from Source

To automatically configure local AI coding assistants with the built package:

```bash
# Preview proposed MCP server changes (dry-run)
node packages/assetdiet-mcp/dist/cli.js setup --dry-run

# Apply configuration to detected assistants (Cursor, Claude, Windsurf, Codex)
node packages/assetdiet-mcp/dist/cli.js setup --yes
```

---

## Method 2: Published Package Usage (Post-Publication)

Once `assetdiet-mcp` is published to npm, you can use standard global and `npx` commands.

### One-Command Setup

```bash
npx -y assetdiet-mcp@latest setup
```

This interactive setup:

1. Detects installed assistants: **Cursor**, **Claude Desktop**, **Claude Code**, **Windsurf**, and **Codex**.
2. Displays the exact JSON configuration changes for your review.
3. Creates a timestamped `.bak` backup of any configuration file before modifying it.
4. Registers AssetDiet using exact package pinning (`npx --yes assetdiet-mcp@<version> mcp`) to avoid unexpected floating-version breakage.
5. Reads back the modified file to verify valid JSON formatting.

### Setup Flags

```bash
# Preview configuration changes without writing to disk
npx -y assetdiet-mcp@latest setup --dry-run

# Target a specific assistant
npx -y assetdiet-mcp@latest setup --client cursor
npx -y assetdiet-mcp@latest setup --client claude-desktop

# Machine-readable output for automated scripts
npx -y assetdiet-mcp@latest setup --dry-run --json

# Non-interactive confirmation
npx -y assetdiet-mcp@latest setup --client cursor --yes
```

### Global CLI Installation

```bash
npm install -g assetdiet-mcp
```

Verify the installation:

```bash
assetdiet --help
assetdiet doctor
```

Both `assetdiet` and `assetdiet-mcp` commands are exposed and point to the same binary.

---

## Method 3: Manual MCP Client Configuration

To configure AI assistants manually, add the following snippet to your assistant's MCP configuration file.

### For Local Source Build

Point the assistant to the built file on your machine:

```json
{
  "mcpServers": {
    "assetdiet": {
      "command": "node",
      "args": [
        "<ABSOLUTE_PATH_TO_REPO>/packages/assetdiet-mcp/dist/cli.js",
        "mcp"
      ]
    }
  }
}
```

### For Published npm Package

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

### Configuration File Locations by Client

- **Cursor**:
  - Project level: `.cursor/mcp.json`
  - Global: Cursor Settings → Features → MCP
- **Claude Desktop**:
  - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
  - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
  - Linux: `~/.config/Claude/claude_desktop_config.json`
- **Claude Code**: `~/.claude.json`
- **Windsurf (Codeium)**: `~/.codeium/windsurf/mcp_config.json`
- **Codex / Custom Agents**: `~/.codex/config.json`

---

## Verifying System Health

Run the diagnostic command after installation:

```bash
node packages/assetdiet-mcp/dist/cli.js doctor
```

Actual verified diagnostic output:

```
🩺 AssetDiet Doctor v0.1.0
System: win32 (x64) | Node: v22.14.0 | npm: 10.9.2
Installation Source: monorepo-source

Checks:
  ✓ [SYSTEM] Node.js Runtime: v22.14.0 (compatible with >= 20.0.0)
  ✓ [ENGINE] Sharp Image Engine: Sharp v0.33.5 (libvips 8.15.3) ready
  ✓ [ENGINE] SVGO Vector Engine: SVGO 3.x ready for vector cleanup and minification
  ⚠ [ENGINE] FFmpeg Video Engine: FFmpeg not detected in PATH (optional for video transcoding)
    ↳ Remediation: Install with winget: "winget install Gyan.FFmpeg" or Chocolatey: "choco install ffmpeg"
  ✓ [ENGINE] glTF-Transform 3D Engine: glTF-Transform 4.x ready for GLB/glTF mesh dedup, prune, reorder and weld
  ✓ [ENGINE] Font Analysis Engine: Font scanner & duplicate detection ready (font subsetting is experimental in v1)
  ✓ [CLIENT] Cursor IDE: Not installed or default config absent
  ✓ [CLIENT] Claude Desktop: Not installed or default config absent
  ⚠ [CLIENT] Claude Code CLI: Detected but not yet configured
    ↳ Remediation: Run "assetdiet setup --client claude-code" to configure.
  ✓ [CLIENT] Windsurf (Codeium): Not installed or default config absent
  ✓ [CLIENT] Codex / Custom Agents: Not installed or default config absent

Status: ⚠️ Warnings found (optional engines or unconfigured clients)
```
