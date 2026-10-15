import { describe, it, expect } from 'vitest';
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

  it('initializes McpServer with name assetdiet', () => {
    expect(server).toBeDefined();
  });

  it('has all 16 discrete tools registered via registerTool()', () => {
    // _registeredTools holds registered tools in McpServer
    const registered = (server as unknown as { _registeredTools: Record<string, unknown> })._registeredTools;
    expect(registered).toBeDefined();

    for (const toolName of EXPECTED_TOOLS) {
      expect(registered[toolName], `Tool ${toolName} should be registered`).toBeDefined();
    }

    expect(Object.keys(registered).length).toBe(16);
  });
});
