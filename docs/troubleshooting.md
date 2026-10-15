# Troubleshooting & FAQs

This guide addresses common issues, diagnostic procedures, and resolutions when working with AssetDiet.

---

## 1. Quick Diagnostics

Whenever you encounter unexpected behavior, run the diagnostic check first:

```bash
assetdiet doctor
# or
npx -y assetdiet-mcp@latest doctor
```

Review the output to verify that your Node.js version, platform libraries, and optional tools are correctly detected.

---

## 2. Common Issues and Solutions

### Node.js Version Error (`engines: >=20.0.0`)

**Symptom**: `SyntaxError` or engine warning when launching the CLI or MCP server.  
**Cause**: AssetDiet utilizes modern Node.js standard APIs (such as global `crypto.subtle`, native fetch, and recursive file system watchers) requiring Node 20 or newer.  
**Solution**: Upgrade Node.js using your preferred version manager (`nvm`, `fnm`, or `volta`):

```bash
nvm install 20
nvm use 20
```

---

### FFmpeg / FFprobe Not Found

**Symptom**: `assetdiet doctor` reports `[OPTIONAL] FFmpeg: Not found on system PATH`. Video files are safely skipped during optimization passes.  
**Cause**: Video transcoding and poster generation require `ffmpeg` and `ffprobe` binaries to be accessible on your system `PATH`.  
**Solution**:

- **macOS**: `brew install ffmpeg`
- **Ubuntu/Debian**: `sudo apt update && sudo apt install ffmpeg`
- **Windows**: `winget install Gyan.FFmpeg` or `choco install ffmpeg`
- Verify installation: `ffmpeg -version` and `ffprobe -version`.

---

### MCP Client Reports "Connection Closed" or "Invalid JSON"

**Symptom**: Cursor or Claude Desktop shows an error connecting to the `assetdiet` server.  
**Cause**: Extraneous output on `stdout` corrupts the MCP stdio JSON-RPC transport stream.  
**Resolution**:

1. Check that you are invoking `assetdiet mcp` (not `assetdiet` without arguments, which prints help text).
2. If using custom wrapper scripts, ensure all debug output, `console.log` calls, or banners are redirected to `stderr`.

---

### Restoring Files After an Interrupted Run

**Symptom**: An optimization run was interrupted (e.g. system reboot or terminal closed), leaving partial files.  
**Solution**: Use the rollback engine to restore files from the recorded journal:

```bash
# List and restore the most recent run
assetdiet restore

# Restore a specific run ID
assetdiet restore --run <runId>
```

Backups are preserved in `.assetdiet/backups/<runId>/`.

---

### Sharp Installation or Native Library Error

**Symptom**: `Error: Could not load the "sharp" module using the ... runtime`.  
**Cause**: Sharp includes prebuilt native binaries for common architectures. On less common platforms (such as Alpine Linux or musl systems), native bindings may need additional dependencies.  
**Solution**:

- Ensure your platform supports Node-API (N-API).
- On Alpine Linux, install `vips-dev` or use glibc-based containers.
- Re-install dependencies with clean npm cache:
  ```bash
  npm cache clean --force
  npm install -g assetdiet-mcp
  ```

---

### Windows Long Path or Path Separator Issues

**Symptom**: File not found errors on deep nested directory paths on Windows.  
**Solution**:

- AssetDiet standardizes all internal path comparisons using normalized POSIX separators while respecting OS-specific system paths for disk I/O.
- Ensure Windows Long Paths support is enabled in your registry if nesting exceeds 260 characters:
  ```powershell
  New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" `
    -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
  ```
