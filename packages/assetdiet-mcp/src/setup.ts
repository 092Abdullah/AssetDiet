/**
 * AssetDiet Setup Wizard
 * Guides configuration of AI coding assistant MCP integrations.
 * Supports Cursor, Claude Desktop, Claude Code, Windsurf, and Codex.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import readline from "node:readline";

export interface ClientConfigSpec {
  id: string;
  name: string;
  defaultConfigPaths: string[];
  configType: "json-mcpServers" | "json-codex";
  restartInstructions: string;
}

export const SUPPORTED_CLIENTS: ClientConfigSpec[] = [
  {
    id: "cursor",
    name: "Cursor IDE",
    defaultConfigPaths: [
      path.join(process.env.USERPROFILE || os.homedir(), ".cursor", "mcp.json"),
      path.join(
        process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"),
        "Cursor",
        "User",
        "globalStorage",
        "cursor.mcp",
        "mcp.json",
      ),
      path.join(
        os.homedir(),
        "Library",
        "Application Support",
        "Cursor",
        "User",
        "globalStorage",
        "cursor.mcp",
        "mcp.json",
      ),
      path.join(
        os.homedir(),
        ".config",
        "Cursor",
        "User",
        "globalStorage",
        "cursor.mcp",
        "mcp.json",
      ),
    ],
    configType: "json-mcpServers",
    restartInstructions:
      "Restart Cursor or toggle the server in Settings -> Features -> MCP.",
  },
  {
    id: "claude-desktop",
    name: "Claude Desktop",
    defaultConfigPaths: [
      path.join(
        process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"),
        "Claude",
        "claude_desktop_config.json",
      ),
      path.join(
        os.homedir(),
        "Library",
        "Application Support",
        "Claude",
        "claude_desktop_config.json",
      ),
      path.join(
        os.homedir(),
        ".config",
        "Claude",
        "claude_desktop_config.json",
      ),
    ],
    configType: "json-mcpServers",
    restartInstructions: "Fully restart Claude Desktop (Quit and reopen).",
  },
  {
    id: "claude-code",
    name: "Claude Code CLI",
    defaultConfigPaths: [path.join(os.homedir(), ".claude.json")],
    configType: "json-mcpServers",
    restartInstructions: 'Start a new session with "claude" in your terminal.',
  },
  {
    id: "windsurf",
    name: "Windsurf (Codeium)",
    defaultConfigPaths: [
      path.join(
        process.env.USERPROFILE || os.homedir(),
        ".codeium",
        "windsurf",
        "mcp_config.json",
      ),
      path.join(os.homedir(), ".codeium", "windsurf", "mcp_config.json"),
    ],
    configType: "json-mcpServers",
    restartInstructions: "Reload Windsurf window or restart the application.",
  },
  {
    id: "codex",
    name: "Codex / Custom Agents",
    defaultConfigPaths: [
      path.join(
        process.env.USERPROFILE || os.homedir(),
        ".codex",
        "config.json",
      ),
      path.join(os.homedir(), ".codex", "config.json"),
    ],
    configType: "json-mcpServers",
    restartInstructions: "Restart your Codex agent or CLI session.",
  },
];

export interface SetupOptions {
  client?: string | undefined;
  project?: string | undefined;
  dryRun?: boolean | undefined;
  yes?: boolean | undefined;
  json?: boolean | undefined;
  version?: string | undefined;
}

export interface SetupProposal {
  clientId: string;
  clientName: string;
  configPath: string;
  detected: boolean;
  alreadyConfigured: boolean;
  action: "create" | "update" | "skip";
  currentRegistration?: Record<string, unknown> | undefined;
  proposedRegistration: Record<string, unknown>;
  restartInstructions: string;
}

export interface SetupResult {
  proposals: SetupProposal[];
  applied: Array<{
    clientId: string;
    configPath: string;
    backupPath?: string | undefined;
  }>;
  errors: Array<{ clientId: string; error: string }>;
  dryRun: boolean;
}

/**
 * Determine the exact MCP registration block for assetdiet-mcp.
 */
export function getMcpRegistration(version = "0.1.4") {
  return {
    command: "npx",
    args: ["--yes", `assetdiet-mcp@${version}`, "mcp"],
  };
}

/**
 * Find the active or primary configuration path for a client.
 */
export function resolveClientConfigPath(
  client: ClientConfigSpec,
  projectDir?: string,
): { path: string; exists: boolean } {
  if (projectDir) {
    if (client.id === "cursor") {
      const p = path.join(projectDir, ".cursor", "mcp.json");
      return { path: p, exists: fs.existsSync(p) };
    }
    if (client.id === "claude-code") {
      const p = path.join(projectDir, ".claude.json");
      return { path: p, exists: fs.existsSync(p) };
    }
  }

  for (const p of client.defaultConfigPaths) {
    if (fs.existsSync(p)) {
      return { path: p, exists: true };
    }
  }

  // Return the first path as default target if none currently exists
  return { path: client.defaultConfigPaths[0]!, exists: false };
}

/**
 * Inspect client config and generate proposal.
 */
export function planClientSetup(
  client: ClientConfigSpec,
  version = "0.1.4",
  projectDir?: string,
): SetupProposal {
  const { path: configPath, exists } = resolveClientConfigPath(
    client,
    projectDir,
  );
  const proposedRegistration = getMcpRegistration(version);

  let alreadyConfigured = false;
  let currentRegistration: Record<string, unknown> | undefined;

  if (exists) {
    try {
      const raw = fs.readFileSync(configPath, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed.mcpServers?.assetdiet) {
        currentRegistration = parsed.mcpServers.assetdiet;
        const sameCmd =
          currentRegistration?.command === proposedRegistration.command;
        const currentArgs = Array.isArray(currentRegistration?.args)
          ? currentRegistration.args.join(" ")
          : "";
        const proposedArgs = proposedRegistration.args.join(" ");
        alreadyConfigured = sameCmd && currentArgs === proposedArgs;
      }
    } catch {
      // If file contains malformed JSON, action will be update/create with caution
    }
  }

  let action: "create" | "update" | "skip" = "create";
  if (alreadyConfigured) {
    action = "skip";
  } else if (exists && currentRegistration) {
    action = "update";
  }

  return {
    clientId: client.id,
    clientName: client.name,
    configPath,
    detected: exists || fs.existsSync(path.dirname(configPath)),
    alreadyConfigured,
    action,
    currentRegistration,
    proposedRegistration,
    restartInstructions: client.restartInstructions,
  };
}

/**
 * Apply a configuration proposal safely with backup and readback validation.
 */
export async function applyProposal(proposal: SetupProposal): Promise<{
  success: boolean;
  backupPath?: string | undefined;
  error?: string | undefined;
}> {
  if (proposal.action === "skip") {
    return { success: true };
  }

  const configPath = proposal.configPath;
  const configDir = path.dirname(configPath);
  let backupPath: string | undefined;

  try {
    let existingConfig: Record<string, any> = {};

    if (fs.existsSync(configPath)) {
      const raw = await fs.promises.readFile(configPath, "utf-8");
      try {
        existingConfig = JSON.parse(raw);
      } catch (e) {
        return {
          success: false,
          error: `Existing configuration file is corrupted (invalid JSON): ${(e as Error).message}`,
        };
      }

      // Create backup before touching anything
      backupPath = `${configPath}.bak-${Date.now()}`;
      await fs.promises.copyFile(configPath, backupPath);
    } else {
      await fs.promises.mkdir(configDir, { recursive: true });
    }

    if (!existingConfig.mcpServers) {
      existingConfig.mcpServers = {};
    }

    // Set ONLY assetdiet, preserving all other servers and settings
    existingConfig.mcpServers.assetdiet = proposal.proposedRegistration;

    const formatted = JSON.stringify(existingConfig, null, 2) + "\n";
    await fs.promises.writeFile(configPath, formatted, "utf-8");

    // Read back to validate
    const readback = await fs.promises.readFile(configPath, "utf-8");
    const parsedReadback = JSON.parse(readback);
    if (!parsedReadback.mcpServers?.assetdiet) {
      throw new Error("Readback validation failed: assetdiet entry missing");
    }

    return { success: true, backupPath };
  } catch (err) {
    // If we failed and had a backup, restore it immediately
    if (backupPath && fs.existsSync(backupPath)) {
      try {
        await fs.promises.copyFile(backupPath, configPath);
      } catch {
        // ignore restore failure during error cascade
      }
    }
    return { success: false, backupPath, error: (err as Error).message };
  }
}

/**
 * Run the setup wizard.
 */
export async function runSetup(
  options: SetupOptions = {},
): Promise<SetupResult> {
  const version = options.version ?? "0.1.4";
  const targetClients =
    options.client && options.client !== "all"
      ? SUPPORTED_CLIENTS.filter(
          (c) => c.id.toLowerCase() === options.client?.toLowerCase(),
        )
      : SUPPORTED_CLIENTS;

  if (targetClients.length === 0) {
    throw new Error(
      `Unknown client: "${options.client}". Supported: ${SUPPORTED_CLIENTS.map((c) => c.id).join(", ")}`,
    );
  }

  const proposals: SetupProposal[] = [];
  for (const client of targetClients) {
    proposals.push(planClientSetup(client, version, options.project));
  }

  const result: SetupResult = {
    proposals,
    applied: [],
    errors: [],
    dryRun: !!options.dryRun,
  };

  if (options.dryRun) {
    return result;
  }

  // Determine which proposals to apply
  const actionable = proposals.filter((p) => p.action !== "skip");

  if (actionable.length === 0) {
    return result;
  }

  // Check approval if interactive and not --yes
  if (!options.yes && process.stdin.isTTY && !options.json) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const answer = await new Promise<string>((resolve) => {
      rl.question(
        `\nApply configuration to ${actionable.length} client(s)? [y/N]: `,
        (ans) => {
          rl.close();
          resolve(ans.trim().toLowerCase());
        },
      );
    });

    if (answer !== "y" && answer !== "yes") {
      return result;
    }
  }

  // Apply changes
  for (const prop of actionable) {
    const res = await applyProposal(prop);
    if (res.success) {
      result.applied.push({
        clientId: prop.clientId,
        configPath: prop.configPath,
        backupPath: res.backupPath,
      });
    } else {
      result.errors.push({
        clientId: prop.clientId,
        error: res.error ?? "Unknown error",
      });
    }
  }

  return result;
}
