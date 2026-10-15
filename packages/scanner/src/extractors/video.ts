/**
 * Scanner — Video Metadata Extractor
 * Uses FFprobe (direct subprocess) to inspect video streams.
 * Returns a degraded metadata object if FFprobe is unavailable.
 */

import { spawn } from "node:child_process";
import type { AssetMetadata } from "@assetdiet/core";

interface FFprobeOutput {
  streams?: Array<{
    codec_type?: string;
    codec_name?: string;
    width?: number;
    height?: number;
    r_frame_rate?: string;
    duration?: string;
    bit_rate?: string;
  }>;
  format?: {
    duration?: string;
    bit_rate?: string;
    format_name?: string;
  };
}

/**
 * Run FFprobe and return parsed JSON output.
 * Throws if FFprobe is not found or exits with non-zero code.
 */
async function runFFprobe(filePath: string): Promise<FFprobeOutput> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffprobe", [
      "-v",
      "quiet",
      "-print_format",
      "json",
      "-show_streams",
      "-show_format",
      filePath,
    ]);

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on("error", (err) => {
      reject(new Error(`FFprobe not found or failed to start: ${err.message}`));
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`FFprobe exited with code ${code}: ${stderr}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout) as FFprobeOutput);
      } catch {
        reject(
          new Error(`Failed to parse FFprobe output: ${stdout.slice(0, 200)}`),
        );
      }
    });
  });
}

function parseFrameRate(r_frame_rate?: string): number {
  if (!r_frame_rate) return 0;
  const parts = r_frame_rate.split("/");
  if (parts.length === 2) {
    const num = parseFloat(parts[0] ?? "0");
    const den = parseFloat(parts[1] ?? "1");
    return den === 0 ? 0 : Math.round((num / den) * 100) / 100;
  }
  return parseFloat(r_frame_rate);
}

export async function extractVideoMetadata(
  filePath: string,
): Promise<AssetMetadata> {
  try {
    const info = await runFFprobe(filePath);

    const videoStream = info.streams?.find((s) => s.codec_type === "video");
    const audioStream = info.streams?.find((s) => s.codec_type === "audio");
    const subtitleStream = info.streams?.find(
      (s) => s.codec_type === "subtitle",
    );

    const duration = parseFloat(
      info.format?.duration ?? videoStream?.duration ?? "0",
    );
    const bitrate = parseInt(
      info.format?.bit_rate ?? videoStream?.bit_rate ?? "0",
      10,
    );

    return {
      type: "video",
      data: {
        width: videoStream?.width ?? 0,
        height: videoStream?.height ?? 0,
        duration,
        fps: parseFrameRate(videoStream?.r_frame_rate),
        codec: videoStream?.codec_name ?? "unknown",
        bitrate,
        hasAudio: audioStream !== undefined,
        hasSubtitles: subtitleStream !== undefined,
        format: info.format?.format_name ?? "unknown",
      },
    };
  } catch {
    // FFprobe unavailable — return empty metadata
    return {
      type: "video",
      data: {
        width: 0,
        height: 0,
        duration: 0,
        fps: 0,
        codec: "unknown",
        bitrate: 0,
        hasAudio: false,
        hasSubtitles: false,
        format: "unknown",
      },
    };
  }
}
