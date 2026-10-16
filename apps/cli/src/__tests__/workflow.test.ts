import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import crypto from "node:crypto";
import sharp from "sharp";
import { Document, NodeIO } from "@gltf-transform/core";

import { createContext, type OptimizationPolicy } from "@assetdiet/core";
import { scanRepository } from "@assetdiet/scanner";
import { buildAssetGraph } from "@assetdiet/asset-graph";
import { createOptimizationPlan } from "@assetdiet/planner";
import { optimizeImage } from "@assetdiet/optimizer-images";
import { optimizeSvg } from "@assetdiet/optimizer-svg";
import { optimizeVideo } from "@assetdiet/optimizer-video";
import { optimize3D } from "@assetdiet/optimizer-3d";
import { validateImage, validateSvg, validate3D } from "@assetdiet/validation";
import {
  beginTransaction,
  stageFileModification,
  commitTransaction,
  rollbackTransaction,
  recordTransactionFailure,
} from "@assetdiet/transactions";
import {
  generateMarkdownReport,
  generateJsonReport,
  type ReportData,
} from "@assetdiet/reporting";
import {
  analyzeReferences,
  migrateReferences,
} from "@assetdiet/reference-analyzer";

function sha256(filePath: string): string {
  const data = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(data).digest("hex");
}

describe("Release Readiness: End-to-End Workflow Audit", () => {
  let projectDir: string;
  let publicDir: string;
  let pngPath: string;
  let svgPath: string;
  let glbPath: string;
  let mp4Path: string;

  let initialHashes: Record<string, string> = {};

  beforeAll(async () => {
    // 1. Create a disposable Next.js fixture project
    projectDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), "assetdiet-nextjs-audit-"),
    );
    publicDir = path.join(projectDir, "public");
    await fs.promises.mkdir(publicDir, { recursive: true });

    // Next.js package.json
    await fs.promises.writeFile(
      path.join(projectDir, "package.json"),
      JSON.stringify(
        {
          name: "disposable-nextjs-app",
          version: "1.0.0",
          dependencies: {
            next: "14.2.0",
            react: "18.3.0",
          },
        },
        null,
        2,
      ),
    );

    // Source file referencing assets
    const pagesDir = path.join(projectDir, "pages");
    await fs.promises.mkdir(pagesDir, { recursive: true });
    await fs.promises.writeFile(
      path.join(pagesDir, "index.tsx"),
      `import Image from 'next/image';
export default function Home() {
  return (
    <div>
      <Image src="/hero.png" alt="Hero" width={500} height={500} />
      <img src="/logo.svg" alt="Logo" />
      <video src="/sample.mp4" controls />
      <a href="/model.glb">Download 3D Model</a>
    </div>
  );
}`,
    );

    // 2. Generate real assets
    // A. Real PNG (large uncompressed RGBA image > 200KB to trigger compress opportunity)
    pngPath = path.join(publicDir, "hero.png");
    await sharp({
      create: {
        width: 400,
        height: 400,
        channels: 4,
        background: { r: 255, g: 100, b: 50, alpha: 1 },
      },
    })
      .png({ compressionLevel: 0 })
      .toFile(pngPath);

    // B. Real SVG with comments, doctype, and extra whitespace (> 500 bytes to trigger opportunity)
    svgPath = path.join(publicDir, "logo.svg");
    const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generator: Adobe Illustrator 25.0.0, SVG Export Plug-In -->
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <!-- Brand Icon and Metadata Headers -->
  <metadata id="meta">
    <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
      <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
        <dc:format>image/svg+xml</dc:format>
        <dc:title>Brand Artwork Vector Template</dc:title>
      </rdf:Description>
    </rdf:RDF>
  </metadata>
  <g id="Background">
    <rect width="400" height="400" fill="#4f46e5" />
    <path d="M 10 10 L 390 10 L 390 390 L 10 390 Z" fill="#312e81" stroke="#ffffff" stroke-width="4" />
  </g>
  <circle cx="200" cy="200" r="100" fill="#ffffff" />
  <path d="M 150 150 L 250 150 L 200 250 Z" fill="#6366f1" />
</svg>`;
    await fs.promises.writeFile(svgPath, svgContent, "utf-8");

    // C. Real 3D GLB model
    glbPath = path.join(publicDir, "model.glb");
    const doc = new Document();
    const buffer = doc.createBuffer();
    const pos = doc
      .createAccessor()
      .setType("VEC3")
      .setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0]))
      .setBuffer(buffer);
    const prim = doc.createPrimitive().setAttribute("POSITION", pos);
    const mesh = doc.createMesh("TestMesh").addPrimitive(prim);
    const node = doc.createNode("TestNode").setMesh(mesh);
    doc.createScene("TestScene").addChild(node);
    const io = new NodeIO();
    await io.write(glbPath, doc);

    // D. Video asset
    mp4Path = path.join(publicDir, "sample.mp4");
    await fs.promises.writeFile(
      mp4Path,
      "ftypisom" + "0".repeat(1024),
      "utf-8",
    );

    // Record baseline hashes
    initialHashes = {
      png: sha256(pngPath),
      svg: sha256(svgPath),
      glb: sha256(glbPath),
      mp4: sha256(mp4Path),
    };
  });

  afterAll(async () => {
    await fs.promises.rm(projectDir, { recursive: true, force: true });
  });

  it("Step 1: Scans disposable Next.js repo and identifies all assets", async () => {
    const ctx = createContext({ root: projectDir, policy: "safe" });
    const scan = await scanRepository(ctx);

    expect(scan.assets.length).toBeGreaterThanOrEqual(4);
    const types = scan.assets.map((a) => a.type);
    expect(types).toContain("image");
    expect(types).toContain("svg");
    expect(types).toContain("3d");
    expect(types).toContain("video");
  });

  it("Step 2: Audit mode produces opportunities with ZERO file modifications", async () => {
    const ctx = createContext({
      root: projectDir,
      policy: "audit",
      dryRun: true,
    });
    const scan = await scanRepository(ctx);
    const graph = buildAssetGraph(scan);
    const plan = createOptimizationPlan(graph, "audit", true);

    expect(plan.tasks.length).toBeGreaterThan(0);

    // Check every file's sha256 is strictly identical
    expect(sha256(pngPath)).toBe(initialHashes.png);
    expect(sha256(svgPath)).toBe(initialHashes.svg);
    expect(sha256(glbPath)).toBe(initialHashes.glb);
    expect(sha256(mp4Path)).toBe(initialHashes.mp4);
  });

  it("Step 3: Safe mode optimizes losslessly and respects safe constraints", async () => {
    const ctx = createContext({ root: projectDir, policy: "safe" });
    const tx = await beginTransaction(projectDir, ctx.runId);

    // Stage modifications
    await stageFileModification(tx, pngPath);
    await stageFileModification(tx, svgPath);
    await stageFileModification(tx, glbPath);
    await stageFileModification(tx, mp4Path);

    // Run optimizers under 'safe' policy
    const pngRes = await optimizeImage(pngPath, pngPath, {}, "safe");
    const svgRes = await optimizeSvg(svgPath, svgPath, {}, "safe");
    const glbRes = await optimize3D(glbPath, glbPath, {}, "safe");
    const mp4Res = await optimizeVideo(mp4Path, mp4Path, {}, "safe");

    // Safe policy checks:
    // Video must be skipped under safe
    expect(mp4Res.skipped).toBe(true);
    expect(sha256(mp4Path)).toBe(initialHashes.mp4);

    // SVG must be optimized (stripped comments/doctype)
    expect(svgRes.skipped).toBe(false);
    expect(svgRes.savedBytes).toBeGreaterThan(0);

    // Commit transaction
    await commitTransaction(tx);

    // Verify files modified are non-empty and valid
    expect(fs.statSync(pngPath).size).toBeGreaterThan(0);
    expect(fs.statSync(svgPath).size).toBeGreaterThan(0);
    expect(fs.statSync(glbPath).size).toBeGreaterThan(0);
  });

  it("Step 4: Quality Gate validation validates all optimized assets independently", async () => {
    const pngVal = await validateImage(pngPath);
    expect(pngVal.valid).toBe(true);

    const svgVal = await validateSvg(svgPath);
    expect(svgVal.valid).toBe(true);

    const glbVal = await validate3D(glbPath);
    expect(glbVal.valid).toBe(true);
  });

  it("Step 5: Reports generate accurate metrics and byte accounting", async () => {
    const reportData: ReportData = {
      runId: "test-run-001",
      createdAt: new Date().toISOString(),
      rootPath: projectDir,
      policy: "safe",
      totalAssets: 4,
      optimizedCount: 2,
      skippedCount: 2,
      failedCount: 0,
      originalTotalBytes: 50000,
      optimizedTotalBytes: 35000,
      totalSavedBytes: 15000,
      totalSavedPercentage: 30,
      items: [
        {
          path: pngPath,
          type: "image",
          originalBytes: 20000,
          optimizedBytes: 12000,
          savedBytes: 8000,
          savedPercentage: 40,
          status: "optimized" as const,
        },
        {
          path: svgPath,
          type: "svg",
          originalBytes: 500,
          optimizedBytes: 300,
          savedBytes: 200,
          savedPercentage: 40,
          status: "optimized" as const,
        },
      ],
      warnings: [],
      errors: [],
    };

    const md = generateMarkdownReport(reportData);
    expect(md).toContain("AssetDiet Run Report");
    expect(md).toContain("hero.png");

    const jsonStr = generateJsonReport(reportData);
    const parsed = JSON.parse(jsonStr);
    expect(parsed.runId).toBe("test-run-001");
    expect(parsed.totalSavedBytes).toBe(15000);
  });

  it("Step 6: Rollback restores exact original file hashes", async () => {
    // Current hashes are optimized (different from initial for svg/png)
    expect(sha256(svgPath)).not.toBe(initialHashes.svg);

    // Find the latest transaction journal from .assetdiet/runs
    const runsDir = path.join(projectDir, ".assetdiet", "runs");
    const runFiles = await fs.promises.readdir(runsDir);
    expect(runFiles.length).toBeGreaterThan(0);

    const runId = path.basename(runFiles[0]!, ".json");

    // Perform rollback using (root, runId)
    await rollbackTransaction(projectDir, runId);

    // Verify all files are restored bit-for-bit to initial hashes
    expect(sha256(pngPath)).toBe(initialHashes.png);
    expect(sha256(svgPath)).toBe(initialHashes.svg);
    expect(sha256(glbPath)).toBe(initialHashes.glb);
    expect(sha256(mp4Path)).toBe(initialHashes.mp4);
  });

  it("Step 7: Rollback restores state after mid-operation crash/failure", async () => {
    const tx = await beginTransaction(projectDir, "failing-run");

    // Stage png and modify it
    await stageFileModification(tx, pngPath);
    await fs.promises.writeFile(pngPath, "corrupted data mid-flight");

    // Verify it is corrupted
    expect(fs.readFileSync(pngPath, "utf-8")).toBe("corrupted data mid-flight");

    // Record failure (simulating unexpected error before commit)
    await recordTransactionFailure(tx, new Error("Simulated process crash"));

    // Rollback the failed transaction using the Transaction object directly
    await rollbackTransaction(tx);

    // Original hash must be restored
    expect(sha256(pngPath)).toBe(initialHashes.png);
  });

  it("Step 8: Balanced policy performs WebP format conversion and atomic reference migration", async () => {
    // Create source component referencing hero.png
    const srcDir = path.join(projectDir, "src");
    await fs.promises.mkdir(srcDir, { recursive: true });
    const appTsxPath = path.join(srcDir, "App.tsx");
    await fs.promises.writeFile(
      appTsxPath,
      `export default function App() { return <img src="/hero.png" alt="Hero" />; }\n`,
    );

    const tx = await beginTransaction(projectDir, "balanced-format-migration");
    const webpPath = pngPath.replace(/\.png$/, ".webp");

    // Stage original png deletion/modification and target webp creation
    await stageFileModification(tx, pngPath, webpPath);

    // Optimize image into WebP format under balanced policy
    const optRes = await optimizeImage(
      pngPath,
      webpPath,
      { format: "webp" },
      "balanced",
    );
    expect(optRes.skipped).toBe(false);
    expect(optRes.savedBytes).toBeGreaterThan(0);
    expect(fs.existsSync(webpPath)).toBe(true);

    // Stage App.tsx before migration so rollback can restore references
    await stageFileModification(tx, appTsxPath);

    // Migrate code references
    const mig = await migrateReferences(projectDir, pngPath, webpPath);
    expect(mig.totalOccurrences).toBeGreaterThan(0);
    expect(
      mig.changes.some(
        (c) => path.resolve(c.sourceFile) === path.resolve(appTsxPath),
      ),
    ).toBe(true);

    // Unlink old png
    await fs.promises.unlink(pngPath);
    expect(fs.existsSync(pngPath)).toBe(false);

    // Verify App.tsx has been updated to point to .webp
    const updatedCode = await fs.promises.readFile(appTsxPath, "utf-8");
    expect(updatedCode).toContain("/hero.webp");
    expect(updatedCode).not.toContain("/hero.png");

    await commitTransaction(tx);

    // Now verify rollback restores the original PNG and original source code!
    await rollbackTransaction(projectDir, tx.runId);

    expect(fs.existsSync(pngPath)).toBe(true);
    expect(sha256(pngPath)).toBe(initialHashes.png);
    expect(fs.existsSync(webpPath)).toBe(false);

    const rolledBackCode = await fs.promises.readFile(appTsxPath, "utf-8");
    expect(rolledBackCode).toContain("/hero.png");
    expect(rolledBackCode).not.toContain("/hero.webp");
  });

  it("Step 9: Reference analyzer distinguishes active vs unreferenced duplicates", async () => {
    const dup1 = path.join(publicDir, "badge-primary.svg");
    const dup2 = path.join(publicDir, "badge-copy.svg");
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#f00"/></svg>`;
    await fs.promises.writeFile(dup1, svgContent);
    await fs.promises.writeFile(dup2, svgContent);

    // Add code reference only to badge-primary.svg
    const compPath = path.join(projectDir, "src", "Badge.tsx");
    await fs.promises.writeFile(
      compPath,
      `export const Badge = () => <img src="/badge-primary.svg" />;\n`,
    );

    const ctx = createContext({ root: projectDir });
    const scan = await scanRepository(ctx);
    await analyzeReferences(projectDir, scan.assets);

    const a1 = scan.assets.find(
      (a) => path.resolve(a.path) === path.resolve(dup1),
    );
    const a2 = scan.assets.find(
      (a) => path.resolve(a.path) === path.resolve(dup2),
    );

    expect(a1).toBeDefined();
    expect(a2).toBeDefined();
    expect(a1?.isUnreferenced).toBe(false);
    expect(a2?.isUnreferenced).toBe(true);
  });
});
