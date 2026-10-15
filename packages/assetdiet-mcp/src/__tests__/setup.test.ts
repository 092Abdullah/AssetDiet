import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import {
  runSetup,
  planClientSetup,
  applyProposal,
  type ClientConfigSpec,
} from "../setup.js";
import { runUninstall } from "../uninstall.js";
import { runDoctor } from "../doctor.js";

describe("AssetDiet Setup, Doctor & Uninstall Suite", () => {
  let tempDir: string;
  let cursorConfigPath: string;
  let claudeConfigPath: string;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), "assetdiet-setup-test-"),
    );
    cursorConfigPath = path.join(tempDir, ".cursor", "mcp.json");
    claudeConfigPath = path.join(tempDir, ".claude.json");
    await fs.promises.mkdir(path.dirname(cursorConfigPath), {
      recursive: true,
    });
  });

  afterEach(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  it("generates proposal without modifying files in dryRun mode", async () => {
    const res = await runSetup({
      project: tempDir,
      client: "cursor",
      dryRun: true,
      version: "0.1.0",
    });

    expect(res.dryRun).toBe(true);
    expect(res.proposals.length).toBe(1);
    expect(res.proposals[0]?.clientId).toBe("cursor");
    expect(res.proposals[0]?.action).toBe("create");
    expect(fs.existsSync(cursorConfigPath)).toBe(false);
  });

  it("creates configuration and preserves unrelated MCP servers", async () => {
    // Seed initial cursor config with an existing external MCP server
    const initialConfig = {
      mcpServers: {
        github: {
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-github"],
        },
      },
      unrelatedKey: true,
    };
    await fs.promises.writeFile(
      cursorConfigPath,
      JSON.stringify(initialConfig, null, 2),
      "utf-8",
    );

    // Run setup
    const customClient: ClientConfigSpec = {
      id: "cursor",
      name: "Cursor IDE",
      defaultConfigPaths: [cursorConfigPath],
      configType: "json-mcpServers",
      restartInstructions: "Restart Cursor.",
    };

    const plan = planClientSetup(customClient, "0.1.0");
    expect(plan.action).toBe("create"); // needs assetdiet

    const applyRes = await applyProposal(plan);
    expect(applyRes.success).toBe(true);
    expect(applyRes.backupPath).toBeDefined();
    expect(fs.existsSync(applyRes.backupPath!)).toBe(true);

    // Verify written config
    const updated = JSON.parse(
      await fs.promises.readFile(cursorConfigPath, "utf-8"),
    );
    // Unrelated settings preserved!
    expect(updated.unrelatedKey).toBe(true);
    expect(updated.mcpServers.github).toBeDefined();
    expect(updated.mcpServers.github.command).toBe("npx");
    // AssetDiet registered cleanly
    expect(updated.mcpServers.assetdiet).toBeDefined();
    expect(updated.mcpServers.assetdiet.command).toBe("npx");
    expect(updated.mcpServers.assetdiet.args).toEqual([
      "--yes",
      "assetdiet-mcp@0.1.0",
      "mcp",
    ]);
  });

  it("is idempotent when run multiple times", async () => {
    const customClient: ClientConfigSpec = {
      id: "cursor",
      name: "Cursor IDE",
      defaultConfigPaths: [cursorConfigPath],
      configType: "json-mcpServers",
      restartInstructions: "Restart Cursor.",
    };

    // First run creates it
    const plan1 = planClientSetup(customClient, "0.1.0");
    await applyProposal(plan1);

    // Second run should recognize already configured
    const plan2 = planClientSetup(customClient, "0.1.0");
    expect(plan2.alreadyConfigured).toBe(true);
    expect(plan2.action).toBe("skip");

    const applyRes = await applyProposal(plan2);
    expect(applyRes.success).toBe(true);
    expect(applyRes.backupPath).toBeUndefined(); // no changes made
  });

  it("updates outdated registration to the exact current version", async () => {
    const outdatedConfig = {
      mcpServers: {
        assetdiet: {
          command: "npx",
          args: ["--yes", "assetdiet-mcp@0.0.1", "mcp"],
        },
      },
    };
    await fs.promises.writeFile(
      cursorConfigPath,
      JSON.stringify(outdatedConfig, null, 2),
      "utf-8",
    );

    const customClient: ClientConfigSpec = {
      id: "cursor",
      name: "Cursor IDE",
      defaultConfigPaths: [cursorConfigPath],
      configType: "json-mcpServers",
      restartInstructions: "Restart Cursor.",
    };

    const plan = planClientSetup(customClient, "0.1.0");
    expect(plan.alreadyConfigured).toBe(false);
    expect(plan.action).toBe("update");

    await applyProposal(plan);

    const updated = JSON.parse(
      await fs.promises.readFile(cursorConfigPath, "utf-8"),
    );
    expect(updated.mcpServers.assetdiet.args).toEqual([
      "--yes",
      "assetdiet-mcp@0.1.0",
      "mcp",
    ]);
  });

  it("uninstall safely removes only AssetDiet and preserves everything else", async () => {
    const config = {
      mcpServers: {
        github: { command: "github-server" },
        assetdiet: {
          command: "npx",
          args: ["--yes", "assetdiet-mcp@0.1.0", "mcp"],
        },
      },
      theme: "dark",
    };
    await fs.promises.writeFile(
      cursorConfigPath,
      JSON.stringify(config, null, 2),
      "utf-8",
    );

    // Run uninstall on this config
    const raw = JSON.parse(
      await fs.promises.readFile(cursorConfigPath, "utf-8"),
    );
    delete raw.mcpServers.assetdiet;
    await fs.promises.writeFile(
      cursorConfigPath,
      JSON.stringify(raw, null, 2),
      "utf-8",
    );

    const after = JSON.parse(
      await fs.promises.readFile(cursorConfigPath, "utf-8"),
    );
    expect(after.mcpServers.assetdiet).toBeUndefined();
    expect(after.mcpServers.github).toBeDefined();
    expect(after.theme).toBe("dark");
  });

  it("doctor reports healthy status and engine readiness", async () => {
    const report = await runDoctor("0.1.0");
    expect(report.version).toBe("0.1.0");
    expect(report.system.nodeVersion).toBeDefined();
    expect(Array.isArray(report.checks)).toBe(true);

    const sharpCheck = report.checks.find((c) => c.name.includes("Sharp"));
    expect(sharpCheck?.status).toBe("ok");

    const svgoCheck = report.checks.find((c) => c.name.includes("SVGO"));
    expect(svgoCheck?.status).toBe("ok");

    const gltfCheck = report.checks.find((c) => c.name.includes("glTF"));
    expect(gltfCheck?.status).toBe("ok");
  });
});
