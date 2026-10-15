/**
 * AssetDiet Safe Removal
 * Removes AssetDiet MCP registrations from client configurations while preserving
 * all other servers and settings.
 */

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import {
  SUPPORTED_CLIENTS,
  resolveClientConfigPath,
  type ClientConfigSpec,
} from "./setup.js";

export interface UninstallOptions {
  client?: string;
  yes?: boolean;
  json?: boolean;
}

export interface UninstallResult {
  removed: Array<{
    clientId: string;
    clientName: string;
    configPath: string;
    backupPath: string;
  }>;
  skipped: Array<{ clientId: string; clientName: string; reason: string }>;
  errors: Array<{ clientId: string; error: string }>;
}

export async function runUninstall(
  options: UninstallOptions = {},
): Promise<UninstallResult> {
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

  const result: UninstallResult = {
    removed: [],
    skipped: [],
    errors: [],
  };

  const actionable: Array<{
    client: ClientConfigSpec;
    configPath: string;
    parsed: any;
  }> = [];

  for (const client of targetClients) {
    const { path: configPath, exists } = resolveClientConfigPath(client);
    if (!exists) {
      result.skipped.push({
        clientId: client.id,
        clientName: client.name,
        reason: "Configuration file does not exist",
      });
      continue;
    }

    try {
      const raw = await fs.promises.readFile(configPath, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed.mcpServers?.assetdiet) {
        actionable.push({ client, configPath, parsed });
      } else {
        result.skipped.push({
          clientId: client.id,
          clientName: client.name,
          reason: "AssetDiet is not registered in this configuration",
        });
      }
    } catch (e) {
      result.errors.push({
        clientId: client.id,
        error: `Could not parse configuration file: ${(e as Error).message}`,
      });
    }
  }

  if (actionable.length === 0) {
    return result;
  }

  // Ask for confirmation if interactive and not --yes
  if (!options.yes && process.stdin.isTTY && !options.json) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const answer = await new Promise<string>((resolve) => {
      rl.question(
        `\nRemove AssetDiet MCP server from ${actionable.length} client(s)? [y/N]: `,
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

  for (const { client, configPath, parsed } of actionable) {
    try {
      // 1. Create backup
      const backupPath = `${configPath}.bak-${Date.now()}`;
      await fs.promises.copyFile(configPath, backupPath);

      // 2. Remove ONLY assetdiet entry
      delete parsed.mcpServers.assetdiet;

      // 3. Write back
      await fs.promises.writeFile(
        configPath,
        JSON.stringify(parsed, null, 2) + "\n",
        "utf-8",
      );

      // 4. Validate readback
      const readback = JSON.parse(
        await fs.promises.readFile(configPath, "utf-8"),
      );
      if (readback.mcpServers?.assetdiet) {
        throw new Error(
          "Readback validation failed: assetdiet was not removed",
        );
      }

      result.removed.push({
        clientId: client.id,
        clientName: client.name,
        configPath,
        backupPath,
      });
    } catch (err) {
      result.errors.push({
        clientId: client.id,
        error: (err as Error).message,
      });
    }
  }

  return result;
}
