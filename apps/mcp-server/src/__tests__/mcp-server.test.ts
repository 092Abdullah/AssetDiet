import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { server } from '../index.js';

describe('AssetDiet MCP Server', () => {
  const EXPECTED_TOOLS = [
    'assetdiet_scan',
    'assetdiet_audit',
    'assetdiet_estimate',
    'assetdiet_optimize',
    'assetdiet_optimize_all',
    'assetdiet_inspect',
    'assetdiet_find_references',
    'assetdiet_find_duplicates',
    'assetdiet_validate',
    'assetdiet_compare',
    'assetdiet_preview',
    'assetdiet_migrate_references',
    'assetdiet_unused_assets',
    'assetdiet_restore',
    'assetdiet_report',
    'assetdiet_capabilities',
  ];

  let tempDir: string;

  beforeAll(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'assetdiet-mcp-test-'));
  });

  afterAll(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  it('initializes McpServer with name assetdiet', () => {
    expect(server).toBeDefined();
  });

  it('has all 16 discrete tools registered via registerTool()', () => {
    const registered = (server as unknown as { _registeredTools: Record<string, unknown> })._registeredTools;
    expect(registered).toBeDefined();

    for (const toolName of EXPECTED_TOOLS) {
      expect(registered[toolName], `Tool ${toolName} should be registered`).toBeDefined();
    }

    expect(Object.keys(registered).length).toBe(16);
  });

  it('executes assetdiet_preview returning real SVG data URI', async () => {
    const registered = (server as unknown as { _registeredTools: Record<string, { handler: Function }> })._registeredTools;
    const previewTool = registered['assetdiet_preview'];
    expect(previewTool).toBeDefined();

    const svgFile = path.join(tempDir, 'logo.svg');
    await fs.promises.writeFile(svgFile, '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="50"/></svg>');

    const response = await previewTool!.handler({ file: svgFile, root: tempDir });
    expect(response.content?.[0]?.text).toBeDefined();
    const parsed = JSON.parse(response.content[0].text);
    expect(parsed.previewAvailable).toBe(true);
    expect(parsed.previewDataUri).toContain('data:image/svg+xml;base64,');
  });

  it('executes assetdiet_migrate_references with real reference migration', async () => {
    const registered = (server as unknown as { _registeredTools: Record<string, { handler: Function }> })._registeredTools;
    const migrateTool = registered['assetdiet_migrate_references'];
    expect(migrateTool).toBeDefined();

    const srcDir = path.join(tempDir, 'src');
    await fs.promises.mkdir(srcDir, { recursive: true });
    const codeFile = path.join(srcDir, 'App.tsx');
    await fs.promises.writeFile(codeFile, "import hero from './hero.png';\n");

    const response = await migrateTool!.handler({
      originalFile: 'src/hero.png',
      newFile: 'src/hero.webp',
      root: tempDir,
      dryRun: false,
    });

    const parsed = JSON.parse(response.content[0].text);
    expect(parsed.totalOccurrences).toBe(1);
    expect(parsed.filesModified).toBe(1);

    const updatedCode = await fs.promises.readFile(codeFile, 'utf-8');
    expect(updatedCode).toContain('hero.webp');
    expect(updatedCode).not.toContain('hero.png');
  });
});
