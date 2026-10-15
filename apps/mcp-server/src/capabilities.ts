/**
 * AssetDiet MCP Server — Capability Detection
 * Probes the runtime environment for available engines and binaries.
 */

import { spawn } from "node:child_process";
import os from "node:os";
import type { CapabilityReport } from "@assetdiet/core";

const ASSETDIET_VERSION = "0.1.0";

/**
 * Run a command and return its stdout, or null if it fails.
 */
async function tryRun(cmd: string, args: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { timeout: 5000 });
    let out = "";
    proc.stdout.on("data", (d: Buffer) => {
      out += d.toString();
    });
    proc.on("close", (code) => resolve(code === 0 ? out.trim() : null));
    proc.on("error", () => resolve(null));
  });
}

/**
 * Try to import a module and return its version, or null.
 */
async function tryImportVersion(pkg: string): Promise<string | null> {
  try {
    // Dynamic import with a version field check
    const mod = (await import(pkg)) as Record<string, unknown>;
    if (typeof mod["version"] === "string") return mod["version"];
    // Try package.json
    const pkgJson = (await import(`${pkg}/package.json`, {
      assert: { type: "json" },
    })) as { default: { version?: string } };
    return pkgJson.default.version ?? null;
  } catch {
    return null;
  }
}

async function checkSharp(): Promise<CapabilityReport["images"]["sharp"]> {
  try {
    const sharp = await import("sharp");
    const formats = Object.keys(sharp.default.format ?? {});
    const versionInfo = (
      sharp.default as unknown as { versions?: { vips?: string } }
    ).versions;
    return {
      available: true,
      version: versionInfo?.vips ?? "unknown",
      formats,
      supportsAvif: formats.includes("avif"),
      supportsWebP: formats.includes("webp"),
    };
  } catch {
    return {
      available: false,
      formats: [],
      supportsAvif: false,
      supportsWebP: false,
    };
  }
}

async function checkFFmpeg(): Promise<CapabilityReport["video"]> {
  const ffmpegVersion = await tryRun("ffmpeg", ["-version"]);
  const ffprobeVersion = await tryRun("ffprobe", ["-version"]);

  // Parse codec list if ffmpeg available
  let encoders: string[] = [];
  let decoders: string[] = [];
  if (ffmpegVersion) {
    const encoderOut = await tryRun("ffmpeg", ["-encoders", "-v", "quiet"]);
    if (encoderOut) {
      encoders = encoderOut
        .split("\n")
        .filter((l) => /^\s+V/.test(l))
        .map((l) => l.trim().split(/\s+/)[1] ?? "")
        .filter(Boolean);
    }
    const decoderOut = await tryRun("ffmpeg", ["-decoders", "-v", "quiet"]);
    if (decoderOut) {
      decoders = decoderOut
        .split("\n")
        .filter((l) => /^\s+V/.test(l))
        .map((l) => l.trim().split(/\s+/)[1] ?? "")
        .filter(Boolean);
    }
  }

  const parseVersion = (out: string | null) =>
    out?.split("\n")[0]?.match(/version\s+([\d.]+)/)?.[1];

  return {
    ffmpeg: {
      available: ffmpegVersion !== null,
      version: parseVersion(ffmpegVersion),
      error:
        ffmpegVersion === null
          ? "FFmpeg not found in PATH. Install from https://ffmpeg.org"
          : undefined,
    },
    ffprobe: {
      available: ffprobeVersion !== null,
      version: parseVersion(ffprobeVersion),
      error: ffprobeVersion === null ? "FFprobe not found in PATH" : undefined,
    },
    encoders,
    decoders,
  };
}

async function checkGltfTransform(): Promise<CapabilityReport["model3d"]> {
  const gltfVersion = await tryImportVersion("@gltf-transform/core");
  const dracoVersion = await tryImportVersion("draco3dgltf");

  return {
    gltfTransform: {
      available: gltfVersion !== null,
      version: gltfVersion ?? undefined,
    },
    draco: {
      available: dracoVersion !== null,
      version: dracoVersion ?? undefined,
    },
  };
}

async function checkSvgo(): Promise<CapabilityReport["svg"]> {
  const version = await tryImportVersion("svgo");
  return {
    svgo: {
      available: version !== null,
      version: version ?? undefined,
    },
  };
}

export async function detectCapabilities(): Promise<CapabilityReport> {
  const [images, video, model3d, svg] = await Promise.all([
    checkSharp().then((sharp) => ({ sharp })),
    checkFFmpeg(),
    checkGltfTransform(),
    checkSvgo(),
  ]);

  const limitations: string[] = [];
  const supportedFormats: string[] = [];

  if (images.sharp.available) {
    supportedFormats.push(...images.sharp.formats.map((f) => `Image: ${f}`));
  } else {
    limitations.push(
      "Sharp not available — image optimization disabled. Run: npm install sharp",
    );
  }

  if (!images.sharp.supportsAvif) {
    limitations.push("AVIF encoding not supported by this Sharp build");
  }

  if (video.ffmpeg.available) {
    supportedFormats.push("Video: mp4, webm, mov (via FFmpeg)");
  } else {
    limitations.push(video.ffmpeg.error ?? "FFmpeg not available");
  }

  if (model3d.gltfTransform.available) {
    supportedFormats.push("3D: glb, gltf (via glTF-Transform)");
  } else {
    limitations.push(
      "@gltf-transform/core not available — 3D optimization disabled",
    );
  }

  if (svg.svgo.available) {
    supportedFormats.push("SVG (via SVGO)");
  } else {
    limitations.push("SVGO not available — SVG optimization disabled");
  }

  supportedFormats.push(
    "Font: woff, woff2, ttf, otf (analysis only — subsetting experimental)",
  );

  return {
    platform: {
      os: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      assetDietVersion: ASSETDIET_VERSION,
    },
    images,
    video,
    model3d,
    fonts: { analysis: true, subsetting: false },
    svg,
    supportedFormats,
    limitations,
  };
}
