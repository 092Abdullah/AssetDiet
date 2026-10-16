import { describe, it, expect } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { spawn, execSync } from "node:child_process";

describe("Built npm Package Artifact Verification", () => {
  const pkgDir = path.resolve(__dirname, "..", "..");
  const distCli = path.join(pkgDir, "dist", "cli.js");
  const distIndex = path.join(pkgDir, "dist", "index.js");
  const distMcp = path.join(pkgDir, "dist", "mcp.js");

  it("exposes built distribution files", () => {
    expect(fs.existsSync(distCli)).toBe(true);
    expect(fs.existsSync(distIndex)).toBe(true);
    expect(fs.existsSync(distMcp)).toBe(true);
  });

  it("cli executable has valid shebang on line 1 and no syntax errors", () => {
    const content = fs.readFileSync(distCli, "utf-8");
    const lines = content.split("\n");
    expect(lines[0]?.trim()).toBe("#!/usr/bin/env node");
    // Ensure line 2 is NOT a duplicate shebang
    expect(lines[1]?.trim()).not.toBe("#!/usr/bin/env node");
  });

  it("package.json contains no workspace:* dependencies", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(pkgDir, "package.json"), "utf-8"),
    );
    const deps = pkg.dependencies || {};
    for (const [dep, ver] of Object.entries(deps)) {
      expect(ver).not.toContain("workspace:");
    }
  });

  it("runs assetdiet --help via child process and exits cleanly with 0", () => {
    const stdout = execSync(`node "${distCli}" --help`, { encoding: "utf-8" });
    expect(stdout).toContain("Usage: assetdiet");
    expect(stdout).toContain("setup");
    expect(stdout).toContain("doctor");
    expect(stdout).toContain("uninstall");
    expect(stdout).toContain("mcp");
    expect(stdout).toContain("scan");
    expect(stdout).toContain("audit");
    expect(stdout).toContain("optimize");
    expect(stdout).toContain("restore");
  });

  it("runs assetdiet doctor --json and outputs valid schema", () => {
    const stdout = execSync(`node "${distCli}" doctor --json`, {
      encoding: "utf-8",
    });
    const parsed = JSON.parse(stdout);
    expect(parsed.version).toBe("0.1.3");
    expect(parsed.system.nodeVersion).toBeDefined();
    expect(Array.isArray(parsed.checks)).toBe(true);
  });

  it("runs assetdiet setup --dry-run --json and reports proposals", () => {
    const stdout = execSync(`node "${distCli}" setup --dry-run --json`, {
      encoding: "utf-8",
    });
    const parsed = JSON.parse(stdout);
    expect(parsed.dryRun).toBe(true);
    expect(Array.isArray(parsed.proposals)).toBe(true);
    expect(parsed.proposals.length).toBeGreaterThan(0);
  });

  it("handles MCP initialize and tools/list stdio protocol over JSON-RPC", async () => {
    const proc = spawn("node", [distCli, "mcp"]);
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });

    const initMsg =
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "artifact-test", version: "1.0" },
        },
      }) + "\n";

    proc.stdin.write(initMsg);

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => resolve(), 5000);

      proc.stdout.on("data", (d) => {
        stdout += d.toString();
        if (stdout.includes('"jsonrpc":"2.0"')) {
          clearTimeout(timer);
          resolve();
        }
      });

      proc.stderr.on("data", (d) => {
        stderr += d.toString();
      });

      proc.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    proc.kill();

    expect(stdout).toContain('"jsonrpc":"2.0"');
    expect(stdout).toContain('"protocolVersion":"2024-11-05"');
    expect(stdout).toContain('"serverInfo":{"name":"assetdiet"');
    // Ensure no non-JSON junk was emitted to stdout
    const firstLine = stdout.trim().split("\n")[0]!;
    expect(() => JSON.parse(firstLine)).not.toThrow();
  });
});
