# CLI Reference

AssetDiet provides a unified command-line tool accessible directly via `node packages/assetdiet-mcp/dist/cli.js`, globally as `assetdiet` (once installed), or via `npx assetdiet-mcp <command>`.

## Global Overview

```
Usage: assetdiet [options] [command]

AssetDiet: Full-repository asset intelligence, optimization and MCP server for
AI coding assistants

Options:
  -V, --version                    output the version number
  -h, --help                       display help for command

Commands:
  setup [options]                  Configure AssetDiet MCP integration for
                                   Cursor, Claude Desktop, Claude Code,
                                   Windsurf, or Codex
  doctor [options]                 Run health checks on installed engines,
                                   dependencies, and coding assistant
                                   configurations
  uninstall [options]              Safely remove AssetDiet MCP server
                                   registrations from coding assistant configs
  mcp                              Launch the stdio Model Context Protocol
                                   (MCP) server for AI coding assistants
  scan [options] [targetPath]      Inventory repository assets and extract
                                   metadata + content hashes
  audit [options] [targetPath]     Audit repository assets for optimization
                                   opportunities (read-only)
  optimize [options] [targetPath]  Run optimization plan on repository assets
                                   with rollback safety
  restore [options]                Restore assets from a previous optimization
                                   run
  help [command]                   display help for command
```

---

## Commands

### `assetdiet setup`

Automatically detect installed AI coding assistants and configure AssetDiet as a registered MCP server.

```bash
assetdiet setup [options]
```

#### Options:

- `-c, --client <client>`: Target client (`cursor`, `claude-desktop`, `claude-code`, `windsurf`, `codex`, `all`). Default: `all`.
- `--project [dir]`: Configure project-level MCP settings instead of global/user settings.
- `--dry-run`: Show proposed configuration changes without writing files.
- `-y, --yes`: Automatically confirm and apply proposed non-destructive configuration changes.
- `--json`: Output results as structured JSON.

#### Safety Guarantees:

- Never removes or overwrites existing servers configured by the user.
- Creates a timestamped `.bak` backup copy of every file before modifying it.
- Uses exact version pinning (`assetdiet-mcp@<version>`) rather than mutable `latest`.
- Reads back the written configuration to verify valid JSON formatting.

---

### `assetdiet doctor`

Inspect system readiness, engine capabilities, optional host tools, and detected MCP client configurations.

```bash
assetdiet doctor [options]
```

#### Options:

- `--json`: Output diagnostic report as machine-readable JSON.
- `-h, --help`: Display help for doctor.

#### Health Checks Performed:

- **Node.js Runtime**: Verifies `>= 20.0.0`.
- **Sharp Image Engine**: Verifies native image decoding, resizing, and encoding capabilities via libvips.
- **SVGO Vector Engine**: Verifies SVG parse and optimization capabilities.
- **FFmpeg / FFprobe**: Checks system `PATH` for video transcoding and duration extraction. Safely skipped if absent.
- **glTF-Transform 3D Engine**: Verifies 3D mesh analysis, deduplication, and optimization engines.
- **Font Scanner**: Verifies font header parsing and duplicate detection.
- **Client Configuration Checks**: Safe read-only inspection of detected client configs.

---

### `assetdiet uninstall`

Safely remove AssetDiet server registrations from supported assistant configurations.

```bash
assetdiet uninstall [options]
```

#### Options:

- `-c, --client <client>`: Target client (`cursor`, `claude-desktop`, `claude-code`, `windsurf`, `codex`, `all`). Default: `all`.
- `-y, --yes`: Automatically confirm removal.
- `--json`: Output results as structured JSON.

#### Behavior:

- Removes **only** the `assetdiet` key from `mcpServers`. All other server configurations remain completely untouched.
- Preserves configuration backups (`.bak`).

---

### `assetdiet scan`

Walk a directory tree, inventory all supported assets, extract dimensions, MIME types, byte sizes, and calculate SHA-256 hashes.

```bash
assetdiet scan [options] [targetPath]
```

#### Options:

- `--json`: Print full inventory in JSON format.
- `-h, --help`: Display help.

#### Example:

```bash
assetdiet scan ./public
```

---

### `assetdiet audit`

Perform a **strictly read-only** audit of repository assets to identify optimization opportunities, compute potential byte savings, and detect duplicate groups.

```bash
assetdiet audit [options] [targetPath]
```

#### Options:

- `-p, --policy <policy>`: Policy level (`audit`, `safe`, `balanced`, `aggressive`). Default: `safe`.
- `--summary`: Output a concise 3-line scorecard summary of opportunities and savings.
- `--json`: Output audit findings and duplicate groups as JSON.
- `-h, --help`: Display help.

> [!NOTE]
> `audit` never modifies repository files. It simulates optimizations in memory to compute realistic byte savings.

---

### `assetdiet optimize`

Execute an optimization pass across eligible assets with atomic file replacement and automatic transaction journaling.

```bash
assetdiet optimize [options] [targetPath]
```

#### Options:

- `-p, --policy <policy>`: Policy level (`safe`, `balanced`, `aggressive`). Default: `safe`.
- `--dry-run`: Simulate changes without writing files to disk.
- `-h, --help`: Display help.

#### Execution Behavior:

1. Backs up original files to `.assetdiet/backups/<runId>/`.
2. Records an atomic transaction journal entry before each file modification.
3. Optimizes files into temporary files (`.tmp.<id>`), validates output integrity, then atomically swaps them via `fs.rename`.
4. Outputs the unique `Run ID` and exact rollback command.

---

### `assetdiet restore`

Rollback a previous optimization run to restore byte-for-byte original files.

```bash
assetdiet restore [options]
```

#### Options:

- `-r, --run <runId>`: _(Required)_ Specific run ID to restore.
- `-p, --path <targetPath>`: Workspace root path. Default: `.`.
- `-h, --help`: Display help.

#### Example:

```bash
assetdiet restore --run mv9uyorf-ctxnoq
```

---

### `assetdiet mcp`

Launch the Model Context Protocol stdio server for AI coding assistants.

```bash
assetdiet mcp
```

This command communicates with MCP clients using JSON-RPC 2.0 over standard input/output. Diagnostic messages and logs are written exclusively to `stderr` to ensure the stdio transport stream remains uncorrupted.
