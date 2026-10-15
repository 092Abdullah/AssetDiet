# CLI Reference

AssetDiet provides a unified command-line tool accessible as either `assetdiet` (when installed globally) or via `npx -y assetdiet-mcp@latest <command>`.

## Global Overview

```
Usage: assetdiet [options] [command]

Full-repository asset intelligence, optimization and MCP server

Options:
  -v, --version           Output the current version
  -h, --help              Display help for command

Commands:
  setup [options]         Detect and configure MCP coding assistants
  doctor [options]        Diagnose environment, optional tools, and integrations
  uninstall [options]     Safely remove AssetDiet from coding assistant configs
  scan [options] [path]   Inventory assets and print metadata
  audit [options] [path]  Find optimization opportunities (read-only)
  optimize [options] [path] Optimize repository assets with rollback protection
  restore [options] [path] Restore assets from a previous optimization run
  mcp                     Run the Model Context Protocol stdio server
```

---

## Commands

### `assetdiet setup`

Interactively detect installed AI coding assistants and add the AssetDiet MCP server registration.

```bash
assetdiet setup [options]
```

#### Options:

- `-d, --dry-run`: Preview configuration changes without writing to disk.
- `-c, --client <name>`: Target a specific client (`cursor`, `claude-desktop`, `claude-code`, `windsurf`, `codex`).
- `-y, --yes`: Apply proposed non-destructive changes without interactive prompting.
- `-j, --json`: Print results as structured JSON.
- `-h, --help`: Display help for setup.

#### Behavior:

- Never removes or overwrites existing servers configured by the user.
- Creates a timestamped `.bak` backup copy of every file before modifying it.
- Uses exact version pinning (`assetdiet-mcp@<version>`) rather than mutable `latest`.
- Validates the resulting JSON before completing.

---

### `assetdiet doctor`

Inspect system readiness, runtime engines, optional CLI tools, and detected MCP client configurations.

```bash
assetdiet doctor [options]
```

#### Options:

- `-j, --json`: Output diagnostics as machine-readable JSON.
- `-h, --help`: Display help for doctor.

#### Health Checks Performed:

- **Node.js runtime**: Verifies `>= 20.0.0`.
- **Sharp / libvips**: Verifies native image decoding, resizing, and encoding capabilities.
- **SVGO**: Verifies SVG parse and optimization capabilities.
- **FFmpeg / FFprobe**: Checks system PATH for video transcoding and duration extraction.
- **glTF-Transform**: Verifies 3D mesh analysis, deduplication, and optimization engines.
- **Font Scanner**: Verifies font header parsing and duplicate detection.
- **Client Configuration Checks**: Safe read-only inspection of detected client configs.

---

### `assetdiet uninstall`

Safely remove AssetDiet server registrations from supported assistant configurations.

```bash
assetdiet uninstall [options]
```

#### Options:

- `-c, --client <name>`: Only remove registration from a specific client.
- `-d, --dry-run`: Preview removals without modifying configuration files.
- `-y, --yes`: Confirm removal without interactive prompt.
- `-j, --json`: Output results as JSON.

#### Behavior:

- Removes **only** the `assetdiet` key from `mcpServers`. All other server configurations remain completely intact.
- Preserves configuration backups (`.bak`).

---

### `assetdiet scan`

Walk a directory tree, inventory all supported assets, extract dimensions, MIME types, byte sizes, and calculate SHA-256 hashes.

```bash
assetdiet scan [path] [options]
```

#### Options:

- `-j, --json`: Print full inventory in JSON format.
- `-t, --type <type>`: Filter assets by type (`image`, `svg`, `video`, `model3d`, `font`).
- `-h, --help`: Display help.

#### Example:

```bash
assetdiet scan ./public
```

---

### `assetdiet audit`

Perform a **strictly read-only** audit of repository assets to identify optimization candidates and calculate potential savings.

```bash
assetdiet audit [path] [options]
```

#### Options:

- `-p, --policy <policy>`: Optimization policy (`safe`, `balanced`, `aggressive`). Default: `safe`.
- `-j, --json`: Output audit findings as JSON.
- `-h, --help`: Display help.

> [!NOTE]
> `audit` never touches or modifies any repository files. It simulates optimizations in memory to compute realistic savings.

---

### `assetdiet optimize`

Execute an optimization pass across eligible assets with atomic file replacement and automatic transaction journaling.

```bash
assetdiet optimize [path] [options]
```

#### Options:

- `-p, --policy <policy>`: Optimization policy (`safe`, `balanced`, `aggressive`). Default: `safe`.
- `-d, --dry-run`: Preview planned optimizations and savings without writing changes.
- `-t, --type <type>`: Restrict optimizations to specific asset category (`image`, `svg`, `video`, `model3d`).
- `-o, --output-format <format>`: Generate a report (`markdown`, `json`, `html`). Default: `markdown`.
- `-h, --help`: Display help.

#### Behavior:

1. Backs up original files to `.assetdiet/backups/<runId>/`.
2. Records an atomic transaction journal entry before each file modification.
3. Optimizes files into temporary files, validates output integrity, then atomically swaps them.
4. Generates a summary report with run ID for instant reversibility.

---

### `assetdiet restore`

Rollback a previous optimization run to restore byte-for-byte original files.

```bash
assetdiet restore [path] [options]
```

#### Options:

- `-r, --run <runId>`: Specific run ID to restore. If omitted, prompts to restore the most recent run.
- `-h, --help`: Display help.

#### Example:

```bash
assetdiet restore ./my-project --run 2026-10-15T12-30-00-abc123
```

---

### `assetdiet mcp`

Launch the Model Context Protocol server over stdio.

```bash
assetdiet mcp
```

This command communicates with MCP clients using JSON-RPC over standard input/output. Diagnostic messages and logs are written exclusively to `stderr` to ensure the stdio transport stream remains uncorrupted.
