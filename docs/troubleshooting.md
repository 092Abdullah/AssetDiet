# Troubleshooting & FAQs

This guide addresses common issues, diagnostic procedures, and resolutions when working with AssetDiet.

---

## 1. Quick Diagnostics

Whenever you encounter unexpected behavior, run the diagnostic check first:

```bash
# From repository root
node packages/assetdiet-mcp/dist/cli.js doctor

# Or when installed globally
assetdiet doctor
```

Review the output to verify that your Node.js runtime, engine packages, and optional tools are detected correctly.

---

## 2. Common Issues and Solutions

### Node.js Version Warning / Failure (`engines: >= 20.0.0`)

**Symptom**: `SyntaxError`, module loading failure, or engine warning when launching the CLI or MCP server.  
**Cause**: AssetDiet utilizes modern Node.js standard APIs (including global `crypto.subtle`, native fetch, and recursive file system watchers) requiring Node 20 or newer.  
**Solution**: Upgrade Node.js using your preferred version manager (`nvm`, `fnm`, or `volta`):

```bash
nvm install 20
nvm use 20
```

---

### FFmpeg / FFprobe Not Found

**Symptom**: `assetdiet doctor` reports:  
`⚠ [ENGINE] FFmpeg Video Engine: FFmpeg not detected in PATH (optional for video transcoding)`.  
Video files are safely skipped during optimization passes.  
**Cause**: Video transcoding and poster generation require host `ffmpeg` and `ffprobe` binaries on your system `PATH`.  
**Solution**:

- **macOS**: `brew install ffmpeg`
- **Ubuntu/Debian**: `sudo apt update && sudo apt install ffmpeg`
- **Windows**: `winget install Gyan.FFmpeg` or `choco install ffmpeg`
- Verify installation: `ffmpeg -version` and `ffprobe -version`.

---

### MCP Client Reports "Connection Closed" or "Invalid JSON"

**Symptom**: Cursor, Claude Desktop, or Windsurf shows an error connecting to the `assetdiet` server.  
**Cause**: Extraneous output on `stdout` corrupts the MCP stdio JSON-RPC transport stream.  
**Resolution**:

1. Verify that your client invokes `assetdiet mcp` (not bare `assetdiet` or `assetdiet --help`, which print text).
2. If using custom wrapper scripts, ensure all debug output, `console.log` calls, or banners are redirected to `stderr`.
3. Check the client logs:
   - **Claude Desktop**: `~/Library/Logs/Claude/mcp-server-assetdiet.log` or `%APPDATA%\Claude\logs\`
   - **Cursor**: Developer Tools → Console

---

### Restoring Files After an Interrupted Run

**Symptom**: An optimization pass was interrupted by a power failure or user cancellation (`Ctrl+C`).  
**Solution**: Use the rollback engine to restore files from the recorded journal and backup archive:

```bash
# Restore specific run using the Run ID from the terminal or journal
assetdiet restore --run <runId>

# Or running directly from source
node packages/assetdiet-mcp/dist/cli.js restore --run <runId>
```

Backups are preserved in `.assetdiet/backups/<runId>/` and run records are stored in `.assetdiet/runs/<runId>.json`.

---

### Sharp Installation or Native Library Error

**Symptom**: `Error: Could not load the "sharp" module using the ... runtime`.  
**Cause**: Sharp includes prebuilt native binaries (libvips) for common architectures. On less common platforms (such as Alpine Linux or musl systems), native bindings may need additional dependencies.  
**Solution**:

- Ensure your platform supports Node-API (N-API).
- On Alpine Linux, install `vips-dev` or use glibc-based containers.
- Clean and rebuild in monorepo:
  ```bash
  pnpm clean
  pnpm install
  pnpm build
  ```

---

### Windows Long Path or Path Separator Issues

**Symptom**: File not found errors on deep nested directory paths on Windows.  
**Solution**:

- AssetDiet standardizes all internal path comparisons using normalized POSIX separators while respecting OS-specific system paths for disk I/O.
- Ensure Windows Long Paths support is enabled in your registry if nesting exceeds 260 characters:
  ```powershell
  Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' -Name 'LongPathsEnabled' -Value 1
  ```
