import { describe, it, expect } from 'vitest';
import {
  generateMarkdownReport,
  generateJsonReport,
  generateHtmlReport,
  type ReportData,
} from '../index.js';

describe('Reporting Engine', () => {
  const sampleData: ReportData = {
    runId: 'run-test-1',
    createdAt: '2026-10-15T12:00:00Z',
    rootPath: '/workspace',
    policy: 'safe',
    totalAssets: 10,
    optimizedCount: 5,
    skippedCount: 5,
    failedCount: 0,
    originalTotalBytes: 100_000,
    optimizedTotalBytes: 60_000,
    totalSavedBytes: 40_000,
    totalSavedPercentage: 40,
    items: [
      {
        path: 'assets/hero.png',
        type: 'image',
        originalBytes: 50_000,
        optimizedBytes: 30_000,
        savedBytes: 20_000,
        savedPercentage: 40,
        status: 'optimized',
      },
    ],
    warnings: ['1 file skipped due to format'],
    errors: [],
  };

  it('generates a valid Markdown report with rollback command', () => {
    const md = generateMarkdownReport(sampleData);
    expect(md).toContain('# AssetDiet Run Report — run-test-1');
    expect(md).toContain('39.06 KB (40%)');
    expect(md).toContain('assetdiet restore --run run-test-1');
  });

  it('generates valid JSON report', () => {
    const json = generateJsonReport(sampleData);
    const parsed = JSON.parse(json);
    expect(parsed.runId).toBe('run-test-1');
    expect(parsed.totalSavedBytes).toBe(40_000);
  });

  it('generates HTML report', () => {
    const html = generateHtmlReport(sampleData);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('run-test-1');
  });
});
