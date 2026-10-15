/**
 * Scanner — 3D Model Metadata Extractor
 * Uses @gltf-transform/core to read GLB/GLTF model metadata.
 */

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import type { AssetMetadata } from "@assetdiet/core";

let io: NodeIO | null = null;

function getIO(): NodeIO {
  if (!io) {
    io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  }
  return io;
}

export async function extract3DMetadata(
  filePath: string,
): Promise<AssetMetadata> {
  try {
    const document = await getIO().read(filePath);
    const root = document.getRoot();

    const meshes = root.listMeshes();
    const materials = root.listMaterials();
    const animations = root.listAnimations();
    const textures = root.listTextures();
    const skins = root.listSkins();

    let vertexCount = 0;
    let triangleCount = 0;

    for (const mesh of meshes) {
      for (const primitive of mesh.listPrimitives()) {
        const position = primitive.getAttribute("POSITION");
        if (position) {
          vertexCount += position.getCount();
        }
        const indices = primitive.getIndices();
        if (indices) {
          triangleCount += Math.floor(indices.getCount() / 3);
        }
      }
    }

    // Collect extension names used
    const extensionNames = root
      .listExtensionsUsed()
      .map((e: { extensionName: string }) => e.extensionName);

    return {
      type: "3d",
      data: {
        meshCount: meshes.length,
        materialCount: materials.length,
        animationCount: animations.length,
        textureCount: textures.length,
        vertexCount,
        triangleCount,
        hasSkins: skins.length > 0,
        extensions: extensionNames,
      },
    };
  } catch {
    return {
      type: "3d",
      data: {
        meshCount: 0,
        materialCount: 0,
        animationCount: 0,
        textureCount: 0,
        vertexCount: 0,
        triangleCount: 0,
        hasSkins: false,
        extensions: [],
      },
    };
  }
}
