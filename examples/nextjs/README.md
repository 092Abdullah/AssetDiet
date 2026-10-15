# AssetDiet Example: Next.js Web Application

This example demonstrates using AssetDiet to audit and optimize images, SVGs, and responsive media in a Next.js project.

## Project Structure

A typical Next.js project houses assets in `public/` and imports them in React components:

```
my-next-app/
├── public/
│   ├── images/
│   │   ├── hero-banner.png       # 4.2 MB raw screenshot
│   │   └── avatar.jpg            # 850 KB uncompressed photo
│   └── icons/
│       └── logo.svg              # 120 KB SVG with editor metadata
├── app/
│   └── page.tsx                  # References /images/hero-banner.png
└── .cursor/mcp.json              # Configured AssetDiet MCP server
```

---

## 1. Audit Assets via CLI

Run a read-only audit to identify high-savings candidates:

```bash
npx -y assetdiet-mcp@latest audit . --policy safe
```

Output:

```
[AUDIT] Found 3 optimizable assets:
  - public/images/hero-banner.png (4.2 MB) -> Est. 1.1 MB (73% savings)
  - public/images/avatar.jpg (850 KB) -> Est. 380 KB (55% savings)
  - public/icons/logo.svg (120 KB) -> Est. 34 KB (71% savings)

Total potential savings: 3.63 MB (69%)
```

---

## 2. Optimize Assets with Rollback Protection

```bash
npx -y assetdiet-mcp@latest optimize . --policy safe
```

This creates an original backup in `.assetdiet/backups/<runId>/`, validates each image independently, and atomically replaces the files in place.

---

## 3. Asking Your Assistant (Cursor / Claude Code)

With AssetDiet configured in your assistant, you can simply ask in chat:

> _"Run an asset audit on this project and tell me which images are slowing down our initial page load."_

The assistant will invoke `assetdiet_audit`, provide the findings, and can execute `assetdiet_optimize` when you approve.
