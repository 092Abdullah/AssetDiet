# AssetDiet Example: React Three Fiber (R3F) 3D Scene

This example demonstrates using AssetDiet to audit, inspect, deduplicate, and optimize 3D assets (`.glb` / `.gltf`) in a Three.js / React Three Fiber application.

## 3D Optimization Engine

AssetDiet utilizes `@gltf-transform` to compress 3D models:

- **Mesh Deduplication**: Merges identical mesh geometries sharing buffer data.
- **Vertex Welding**: Welds coincident vertices within micro-tolerances to drastically reduce draw calls and vertex buffers.
- **Node Pruning**: Strips invisible nodes, unused texture samplers, and unreferenced materials.
- **Texture Resampling**: Cleans up embedded textures inside the GLB container.

---

## 1. Inspect a 3D Model via CLI

Inspect geometry details, mesh count, and texture usage:

```bash
npx -y assetdiet-mcp@latest scan ./public/models --type model3d
```

---

## 2. Optimize 3D Assets

```bash
npx -y assetdiet-mcp@latest optimize ./public/models --type model3d --policy safe
```

The output model maintains complete visual fidelity and vertex skinning attributes while reducing transfer size.

---

## 3. Reversing Changes

If you need to restore uncompressed source models:

```bash
npx -y assetdiet-mcp@latest restore
```
