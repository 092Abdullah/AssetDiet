/**
 * AssetDiet Video Optimizer — Direct Subprocess FFmpeg/FFprobe Adapter
 * Executes FFmpeg and FFprobe directly via child_process.spawn.
 * No deprecated fluent-ffmpeg dependency.
 *
 * Guarantees:
 * - Always uses temporary output files during transcoding so in-place operations
 *   never truncate or corrupt original media.
 * - Enforces policy gates: 'audit' never writes files, and 'safe' avoids lossy transcoding.
 * - Atomically replaces destination only after verifying smaller, valid output.
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { OptimizationPolicy } from "@assetdiet/core";

export interface FFmpegCapability {
  available: boolean;
  version?: string | undefined;
  codecs: string[];
}

export interface VideoMetadata {
  format: string;
  duration: number;
  width: number;
  height: number;
  codec: string;
  bitrate: number;
  hasAudio: boolean;
}

export interface VideoOptimizeOptions {
  codec?: "libx264" | "libx265" | "libvpx-vp9" | "libaom-av1";
  crf?: number | undefined;
  maxWidth?: number | undefined;
  maxHeight?: number | undefined;
  stripAudio?: boolean | undefined;
}

export interface VideoOptimizeResult {
  sourcePath: string;
  outputPath: string;
  originalSizeBytes: number;
  optimizedSizeBytes: number;
  savedBytes: number;
  savedPercentage: number;
  skipped: boolean;
  reason?: string | undefined;
}

/**
 * Detect FFmpeg presence in the system PATH.
 */
export async function detectFFmpeg(): Promise<FFmpegCapability> {
  return new Promise((resolve) => {
    try {
      const proc = spawn("ffmpeg", ["-version"]);
      let output = "";

      proc.stdout.on("data", (d) => {
        output += d.toString();
      });

      proc.on("close", (code) => {
        if (code === 0) {
          const match = output.match(/ffmpeg version ([^\s]+)/);
          resolve({
            available: true,
            version: match?.[1],
            codecs: ["h264", "hevc", "vp9", "av1"],
          });
        } else {
          resolve({ available: false, codecs: [] });
        }
      });

      proc.on("error", () => {
        resolve({ available: false, codecs: [] });
      });
    } catch {
      resolve({ available: false, codecs: [] });
    }
  });
}

/**
 * Inspect video streams using ffprobe directly.
 */
export async function inspectVideo(filePath: string): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const args = [
      "-v",
      "quiet",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      filePath,
    ];

    const proc = spawn("ffprobe", args);
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        return reject(
          new Error(
            `FFprobe failed on ${filePath} with exit code ${code}: ${stderr}`,
          ),
        );
      }

      try {
        const parsed = JSON.parse(stdout);
        const videoStream = parsed.streams?.find(
          (s: { codec_type?: string }) => s.codec_type === "video",
        );
        const audioStream = parsed.streams?.find(
          (s: { codec_type?: string }) => s.codec_type === "audio",
        );

        resolve({
          format: parsed.format?.format_name ?? "unknown",
          duration: parseFloat(parsed.format?.duration ?? "0"),
          width: videoStream?.width ?? 0,
          height: videoStream?.height ?? 0,
          codec: videoStream?.codec_name ?? "unknown",
          bitrate: parseInt(parsed.format?.bit_rate ?? "0", 10),
          hasAudio: !!audioStream,
        });
      } catch (e) {
        reject(new Error(`Failed to parse FFprobe output: ${e}`));
      }
    });

    proc.on("error", (err) => {
      reject(
        new Error(`FFprobe is not installed or not in PATH: ${err.message}`),
      );
    });
  });
}

/**
 * Optimize a video file using FFmpeg direct execution with atomic tempfile replacement.
 */
export async function optimizeVideo(
  src: string,
  dest: string,
  options: VideoOptimizeOptions = {},
  policy: OptimizationPolicy = "safe",
): Promise<VideoOptimizeResult> {
  const stat = await fs.promises.stat(src);
  const originalSizeBytes = stat.size;

  // 1. Audit Policy Guard: Never modify files
  if (policy === "audit") {
    return {
      sourcePath: src,
      outputPath: dest,
      originalSizeBytes,
      optimizedSizeBytes: originalSizeBytes,
      savedBytes: 0,
      savedPercentage: 0,
      skipped: true,
      reason: "Audit policy: file modification disabled",
    };
  }

  // 2. Safe Policy Guard: Prohibit lossy video transcoding
  if (policy === "safe") {
    if (src !== dest) {
      await fs.promises.mkdir(path.dirname(dest), { recursive: true });
      await fs.promises.copyFile(src, dest);
    }
    return {
      sourcePath: src,
      outputPath: dest,
      originalSizeBytes,
      optimizedSizeBytes: originalSizeBytes,
      savedBytes: 0,
      savedPercentage: 0,
      skipped: true,
      reason:
        "Video transcoding is not permitted under 'safe' policy (requires 'balanced' or 'aggressive')",
    };
  }

  // 3. Configure encoding parameters based on policy
  let crf = options.crf;
  if (crf === undefined) {
    switch (policy) {
      case "aggressive":
        crf = 32;
        break;
      case "balanced":
      default:
        crf = 28;
        break;
    }
  }

  const codec = options.codec ?? "libx264";
  const destDir = path.dirname(dest);
  await fs.promises.mkdir(destDir, { recursive: true });

  // Use a temporary output file so in-place (src === dest) or failed encodes never touch the original
  const tempOutputFile = path.join(
    destDir,
    `.${path.basename(dest)}.assetdiet-tmp-${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(dest)}`,
  );

  const args = ["-y", "-i", src, "-c:v", codec, "-crf", crf.toString()];

  if (options.stripAudio) {
    args.push("-an");
  } else {
    args.push("-c:a", "aac", "-b:a", "128k");
  }

  // Resolution cap filter
  if (options.maxWidth || options.maxHeight) {
    const w = options.maxWidth ? `min(iw\\,${options.maxWidth})` : "iw";
    const h = options.maxHeight ? `min(ih\\,${options.maxHeight})` : "ih";
    args.push("-vf", `scale='${w}:${h}:force_original_aspect_ratio=decrease'`);
  }

  args.push("-preset", "medium");
  args.push(tempOutputFile);

  try {
    await new Promise<void>((resolve, reject) => {
      const proc = spawn("ffmpeg", args);
      let stderr = "";

      proc.stderr.on("data", (d) => {
        stderr += d.toString();
      });

      proc.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`));
        } else {
          resolve();
        }
      });

      proc.on("error", (err) => {
        reject(
          new Error(`FFmpeg is not installed or not in PATH: ${err.message}`),
        );
      });
    });

    const tempStat = await fs.promises.stat(tempOutputFile);
    const optimizedSizeBytes = tempStat.size;

    // Safety guard: if output is larger or 0 bytes, discard tempfile and keep original
    if (optimizedSizeBytes >= originalSizeBytes || optimizedSizeBytes === 0) {
      await fs.promises.unlink(tempOutputFile).catch(() => {});
      if (src !== dest && !fs.existsSync(dest)) {
        await fs.promises.copyFile(src, dest);
      }
      return {
        sourcePath: src,
        outputPath: dest,
        originalSizeBytes,
        optimizedSizeBytes: originalSizeBytes,
        savedBytes: 0,
        savedPercentage: 0,
        skipped: true,
        reason:
          "Transcoded video was not smaller than original; original preserved",
      };
    }

    // Atomic replacement: rename temp file to dest
    try {
      await fs.promises.rename(tempOutputFile, dest);
    } catch {
      // Cross-device fallback
      await fs.promises.copyFile(tempOutputFile, dest);
      await fs.promises.unlink(tempOutputFile).catch(() => {});
    }

    const savedBytes = originalSizeBytes - optimizedSizeBytes;
    const savedPercentage = Number(
      ((savedBytes / originalSizeBytes) * 100).toFixed(2),
    );

    return {
      sourcePath: src,
      outputPath: dest,
      originalSizeBytes,
      optimizedSizeBytes,
      savedBytes,
      savedPercentage,
      skipped: false,
    };
  } catch (err) {
    // Clean up temporary file on failure
    await fs.promises.unlink(tempOutputFile).catch(() => {});
    throw err;
  }
}
