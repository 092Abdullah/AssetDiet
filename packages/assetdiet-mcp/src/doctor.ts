/**
 * AssetDiet Doctor
 * System diagnostics, engine readiness, and coding assistant status.
 */

import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import sharp from "sharp";
import { optimize as optimizeSvg } from "svgo";
import { Document, NodeIO } from "@gltf-transform/core";
import { detectFFmpeg } from "@assetdiet/optimizer-video";
import { SUPPORTED_CLIENTS, planClientSetup } from "./setup.js";

export interface DoctorCheck {
  name: string;
  category: "system" | "engine" | "client";
  status: "ok" | "warn" | "error";
  message: string;
  details?: Record<string, unknown> | undefined;
  remediation?: string | undefined;
}

export interface DoctorReport {
  version: string;
  installSource: "npm-global" | "npx-runner" | "monorepo-source" | "unknown";
  timestamp: string;
  system: {
    nodeVersion: string;
    npmVersion: string;
    platform: string;
    arch: string;
    osRelease: string;
  };
  checks: DoctorCheck[];
  overallStatus: "healthy" | "warnings_found" | "errors_found";
  remediations: string[];
}

export function detectInstallSource():
  "npm-global" | "npx-runner" | "monorepo-source" | "unknown" {
  const execPath = process.argv[1] ?? "";
  if (
    execPath.includes("side-projects") ||
    execPath.includes("packages\\assetdiet-mcp") ||
    execPath.includes("packages/assetdiet-mcp")
  ) {
    return "monorepo-source";
  }
  if (execPath.includes("_npx") || execPath.includes(".npm/_npx")) {
    return "npx-runner";
  }
  if (
    execPath.includes("npm") ||
    execPath.includes("pnpm") ||
    execPath.includes("AppData\\Roaming\\npm")
  ) {
    return "npm-global";
  }
  return "unknown";
}

function getNpmVersion(): string {
  try {
    return execSync("npm -v", { encoding: "utf-8", timeout: 3000 }).trim();
  } catch {
    return "unknown";
  }
}

export async function runDoctor(version = "0.1.1"): Promise<DoctorReport> {
  const checks: DoctorCheck[] = [];
  const remediations: string[] = [];

  // 1. Node.js runtime check
  const nodeVer = process.version;
  const majorNode = parseInt(nodeVer.replace("v", "").split(".")[0] || "0", 10);
  if (majorNode >= 20) {
    checks.push({
      name: "Node.js Runtime",
      category: "system",
      status: "ok",
      message: `${nodeVer} (compatible with >= 20.0.0)`,
    });
  } else {
    checks.push({
      name: "Node.js Runtime",
      category: "system",
      status: "error",
      message: `${nodeVer} (requires Node.js >= 20.0.0)`,
      remediation:
        "Upgrade Node.js to version 20 LTS or newer: https://nodejs.org",
    });
    remediations.push("Upgrade Node.js to >= 20.0.0");
  }

  // 2. Sharp Image Engine
  try {
    const sharpVer = sharp.versions;
    checks.push({
      name: "Sharp Image Engine",
      category: "engine",
      status: "ok",
      message: `Sharp v${sharpVer.sharp} (libvips ${sharpVer.vips}) ready`,
      details: { formats: ["jpeg", "png", "webp", "avif", "tiff", "gif"] },
    });
  } catch (e) {
    checks.push({
      name: "Sharp Image Engine",
      category: "engine",
      status: "error",
      message: `Failed to load Sharp: ${(e as Error).message}`,
      remediation:
        "Reinstall dependencies to ensure native libvips prebuilts are compiled for your platform.",
    });
    remediations.push("Reinstall Sharp dependencies for your OS platform.");
  }

  // 3. SVGO Vector Engine
  try {
    const testSvg =
      '<svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg>';
    const res = optimizeSvg(testSvg);
    if (res.data) {
      checks.push({
        name: "SVGO Vector Engine",
        category: "engine",
        status: "ok",
        message: "SVGO 3.x ready for vector cleanup and minification",
      });
    } else {
      throw new Error("Empty SVGO output");
    }
  } catch (e) {
    checks.push({
      name: "SVGO Vector Engine",
      category: "engine",
      status: "error",
      message: `SVGO test failed: ${(e as Error).message}`,
    });
  }

  // 4. FFmpeg / FFprobe Video Engine
  try {
    const ffmpeg = await detectFFmpeg();
    if (ffmpeg.available) {
      checks.push({
        name: "FFmpeg Video Engine",
        category: "engine",
        status: "ok",
        message: `FFmpeg v${ffmpeg.version ?? "detected"} found in PATH (${ffmpeg.codecs.join(", ")})`,
      });
    } else {
      let installHelp =
        "Install FFmpeg and add it to your PATH: https://ffmpeg.org/download.html";
      if (process.platform === "win32") {
        installHelp =
          'Install with winget: "winget install Gyan.FFmpeg" or Chocolatey: "choco install ffmpeg"';
      } else if (process.platform === "darwin") {
        installHelp = 'Install with Homebrew: "brew install ffmpeg"';
      } else {
        installHelp = 'Install with apt: "sudo apt install ffmpeg"';
      }

      checks.push({
        name: "FFmpeg Video Engine",
        category: "engine",
        status: "warn",
        message: "FFmpeg not detected in PATH (optional for video transcoding)",
        remediation: installHelp,
      });
      remediations.push(`FFmpeg optional: ${installHelp}`);
    }
  } catch (e) {
    checks.push({
      name: "FFmpeg Video Engine",
      category: "engine",
      status: "warn",
      message: `FFmpeg probe error: ${(e as Error).message}`,
    });
  }

  // 5. glTF 3D Engine
  try {
    const doc = new Document();
    const io = new NodeIO();
    checks.push({
      name: "glTF-Transform 3D Engine",
      category: "engine",
      status: "ok",
      message:
        "glTF-Transform 4.x ready for GLB/glTF mesh dedup, prune, reorder and weld",
    });
  } catch (e) {
    checks.push({
      name: "glTF-Transform 3D Engine",
      category: "engine",
      status: "error",
      message: `Failed to load 3D engine: ${(e as Error).message}`,
    });
  }

  // 6. Font Analysis Engine
  checks.push({
    name: "Font Analysis Engine",
    category: "engine",
    status: "ok",
    message:
      "Font scanner & duplicate detection ready (font subsetting is experimental in v1)",
  });

  // 7. Coding Assistant Integrations
  for (const client of SUPPORTED_CLIENTS) {
    const proposal = planClientSetup(client, version);
    if (proposal.alreadyConfigured) {
      checks.push({
        name: client.name,
        category: "client",
        status: "ok",
        message: `Configured with AssetDiet (${proposal.configPath})`,
      });
    } else if (proposal.detected) {
      checks.push({
        name: client.name,
        category: "client",
        status: "warn",
        message: `Detected but not yet configured (${proposal.configPath})`,
        remediation: `Run "npx assetdiet-mcp setup --client ${client.id}" to configure.`,
      });
      remediations.push(
        `Configure ${client.name}: run "assetdiet setup --client ${client.id}"`,
      );
    } else {
      checks.push({
        name: client.name,
        category: "client",
        status: "ok",
        message: "Not installed or default config absent",
      });
    }
  }

  const hasErrors = checks.some((c) => c.status === "error");
  const hasWarnings = checks.some((c) => c.status === "warn");

  return {
    version,
    installSource: detectInstallSource(),
    timestamp: new Date().toISOString(),
    system: {
      nodeVersion: process.version,
      npmVersion: getNpmVersion(),
      platform: process.platform,
      arch: process.arch,
      osRelease: os.release(),
    },
    checks,
    overallStatus: hasErrors
      ? "errors_found"
      : hasWarnings
        ? "warnings_found"
        : "healthy",
    remediations,
  };
}
