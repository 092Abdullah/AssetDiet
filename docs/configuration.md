# Configuration & Policies

AssetDiet is configured through command-line flags, policy profiles, ignore files, or an optional configuration file in your project root.

---

## Optimization Policies

AssetDiet uses three standardized policy levels to govern how aggressively files are processed.

| Policy               | Behavior                                                                                                                                          | Transformations                                                                                                | Typical Savings | Recommended Use                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------- | ----------------------------------------------------------------------------------- |
| **`safe`** (Default) | Strictly lossless or visually indistinguishable. Preserves original dimensions, transparency, format extensions, and frame rates.                 | Metadata/comment stripping, lossless re-compression, SVG clean-up, glTF vertex welding and mesh deduplication. | 15% – 45%       | Production deployments, automated CI workflows, and initial passes.                 |
| **`balanced`**       | Perceptually lossless quality with modern format opportunities. High quality compression thresholds (e.g. WebP/AVIF at quality 85, video CRF 23). | Controlled lossy quantization, texture downsampling if exceeding 4K, modern codec transcoding where supported. | 40% – 70%       | Web applications, marketing sites, and mobile applications where bandwidth matters. |
| **`aggressive`**     | Maximum byte reduction for bandwidth-constrained environments. Converts formats and aggressive quantization (quality 75, video CRF 28).           | Format conversion (`.png` → `.webp`/`.avif`), aggressive geometry simplification, frame rate normalization.    | 60% – 85%       | Bandwidth-limited deployments, offline bundles, or mobile web applications.         |

> [!IMPORTANT]
> The `audit` command is strictly read-only regardless of policy choice.

### Duplicate Asset Handling

- When exact byte duplicates are found (identical SHA-256 hash), AssetDiet determines if the duplicate copies are referenced in codebase files (HTML, JS, TS, CSS, JSON).
- **Unreferenced duplicates (0 code references)**: Safely deduplicated by removing the redundant copy and reclaiming disk space. Original files are backed up to `.assetdiet/backups/<runId>/`.
- **Referenced duplicates (active code references)**: Preserved and compressed in place so project imports and tags never break.

---

## Ignoring Files

AssetDiet automatically respects:

1. `.gitignore` rules in your repository.
2. Custom `.assetdietignore` rules in your repository root.
3. Standard build and dependency exclusions: `node_modules`, `.git`, `dist`, `build`, `out`, `.output`, `.next`, `.nuxt`, `.turbo`, `.cache`, `coverage`, and `.assetdiet`.

### Custom Ignore File: `.assetdietignore`

Create a `.assetdietignore` file in your repository root to exclude specific assets or directories:

```gitignore
# Exclude raw branding assets
public/brand/master-logo.svg
public/favicons/*

# Exclude high-resolution archival masters
assets/raw-footage/**/*.mp4

# Exclude specific 3D model
models/hero-character-uncompressed.glb
```

---

## Configuration File (`assetdiet.config.json`)

You can optionally place an `assetdiet.config.json` in your project root to define default policies:

```json
{
  "policy": "safe",
  "concurrency": 4,
  "images": {
    "preserveMetadata": false,
    "avif": {
      "quality": 80
    },
    "webp": {
      "quality": 85
    }
  },
  "svg": {
    "multipass": true,
    "plugins": ["removeDimensions"]
  },
  "video": {
    "crf": 23,
    "preset": "slow"
  },
  "model3d": {
    "weld": true,
    "dedup": true,
    "prune": true
  }
}
```

---

## Assistant Configuration Scopes

When running `assetdiet setup`, you can configure assistants at two different scopes:

### 1. User / Global Scope

Configures AssetDiet in the user's global assistant settings (e.g. `~/.claude.json` or Claude Desktop's user configuration). This makes AssetDiet available across all projects on your machine.

### 2. Project Scope

Configures AssetDiet inside the active repository (e.g. `.cursor/mcp.json` or `.vscode/mcp.json`). This ensures any team member opening the repository in that editor automatically has access to the AssetDiet server without manual machine-wide configuration.
