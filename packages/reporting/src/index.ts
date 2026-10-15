/**
 * AssetDiet Reporting Engine
 * Formats optimization results into Markdown, JSON, and HTML.
 */

export interface ReportItem {
  path: string;
  type: string;
  originalBytes: number;
  optimizedBytes: number;
  savedBytes: number;
  savedPercentage: number;
  status: 'optimized' | 'skipped' | 'failed';
  reason?: string | undefined;
}

export interface ReportData {
  runId: string;
  createdAt: string;
  rootPath: string;
  policy: string;
  totalAssets: number;
  optimizedCount: number;
  skippedCount: number;
  failedCount: number;
  originalTotalBytes: number;
  optimizedTotalBytes: number;
  totalSavedBytes: number;
  totalSavedPercentage: number;
  items: ReportItem[];
  warnings: string[];
  errors: string[];
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Generate a GitHub Flavored Markdown report.
 */
export function generateMarkdownReport(data: ReportData): string {
  return `# AssetDiet Run Report — ${data.runId}

**Generated at**: ${data.createdAt}  
**Workspace**: \`${data.rootPath}\`  
**Policy**: \`${data.policy}\`

---

## 📊 Summary

| Metric | Value |
|---|---|
| Total Assets Scanned | **${data.totalAssets}** |
| Assets Optimized | **${data.optimizedCount}** |
| Assets Skipped (already optimal) | **${data.skippedCount}** |
| Failures | **${data.failedCount}** |
| Original Size | **${formatBytes(data.originalTotalBytes)}** |
| Optimized Size | **${formatBytes(data.optimizedTotalBytes)}** |
| **Total Bytes Saved** | **${formatBytes(data.totalSavedBytes)} (${data.totalSavedPercentage}%)** |

---

## 🚀 Optimization Details

| File | Type | Original | Optimized | Saved | Status |
|---|---|---|---|---|---|
${data.items
  .slice(0, 50)
  .map(
    (item) =>
      `| \`${item.path}\` | ${item.type} | ${formatBytes(item.originalBytes)} | ${formatBytes(
        item.optimizedBytes
      )} | ${formatBytes(item.savedBytes)} (${item.savedPercentage}%) | ${item.status} |`
  )
  .join('\n')}
${data.items.length > 50 ? `\n*...and ${data.items.length - 50} more files*` : ''}

${
  data.warnings.length > 0
    ? `---

## ⚠️ Warnings
${data.warnings.map((w) => `- ${w}`).join('\n')}
`
    : ''
}

${
  data.errors.length > 0
    ? `---

## ❌ Errors
${data.errors.map((e) => `- ${e}`).join('\n')}
`
    : ''
}

---

## 🔄 Rollback
To restore all files modified in this run back to their exact original state:

\`\`\`bash
assetdiet restore --run ${data.runId}
\`\`\`
`;
}

/**
 * Generate a JSON report string.
 */
export function generateJsonReport(data: ReportData): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Generate a standalone HTML report.
 */
export function generateHtmlReport(data: ReportData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>AssetDiet Report — ${data.runId}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 2rem; }
    .card { background: #1e293b; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; border: 1px solid #334155; }
    h1 { color: #38bdf8; margin-top: 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { text-align: left; padding: 0.75rem; border-bottom: 1px solid #334155; font-size: 0.9rem; }
    th { color: #94a3b8; }
    .badge-saved { color: #4ade80; font-weight: bold; }
    code { background: #0f172a; padding: 0.2rem 0.4rem; border-radius: 4px; font-family: monospace; }
  </style>
</head>
<body>
  <div class="card">
    <h1>AssetDiet Optimization Report</h1>
    <p>Run ID: <code>${data.runId}</code> | Policy: <code>${data.policy}</code></p>
    <p>Saved <strong>${formatBytes(data.totalSavedBytes)}</strong> (${data.totalSavedPercentage}%) across ${data.optimizedCount} assets.</p>
  </div>
  <div class="card">
    <h2>Details</h2>
    <table>
      <thead>
        <tr><th>File</th><th>Type</th><th>Original</th><th>Optimized</th><th>Savings</th></tr>
      </thead>
      <tbody>
        ${data.items
          .map(
            (i) =>
              `<tr><td><code>${i.path}</code></td><td>${i.type}</td><td>${formatBytes(
                i.originalBytes
              )}</td><td>${formatBytes(i.optimizedBytes)}</td><td class="badge-saved">-${formatBytes(
                i.savedBytes
              )} (${i.savedPercentage}%)</td></tr>`
          )
          .join('')}
      </tbody>
    </table>
  </div>
</body>
</html>`;
}
