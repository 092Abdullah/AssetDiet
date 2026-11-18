# Contributing to AssetDiet

Thank you for your interest in contributing to **AssetDiet**!  
We welcome bug reports, feature requests, documentation improvements, tests, and code contributions.

This document explains how to contribute effectively so that your work can be reviewed and merged quickly.

---

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md).  
By participating, you are expected to uphold this code. Please report unacceptable behavior to [security@assetdiet.dev](mailto:security@assetdiet.dev).

---

## Ways to Contribute

- **Report bugs** using the Bug Report issue template
- **Suggest features** or improvements using the Feature Request template
- Improve documentation (README, docs/, comments)
- Add or improve tests
- Fix bugs or implement approved features
- Help review pull requests

AI-assisted contributions are welcome, but **a human must take ownership** of the complete change (code, tests, documentation, and claims).

---

## Development Setup

### Prerequisites

- **Node.js** `>= 20.0.0`
- **pnpm** `>= 9.15.0`
- Git

### Steps

```bash
git clone https://github.com/092Abdullah/AssetDiet.git
cd AssetDiet
pnpm install
pnpm build
```

### Useful commands

```bash
pnpm test              # Run all tests
pnpm typecheck         # TypeScript checks
pnpm lint              # ESLint
pnpm format:check      # Prettier check
pnpm format            # Auto-format
pnpm dev               # Watch mode
```

For full development details see [docs/development.md](docs/development.md).

---

## Pull Request Process

1. **Search existing issues** first. Prefer linking your PR to an existing issue.
2. **Create a focused branch**:
   ```bash
   git checkout -b feature/short-description
   # or fix/issue-123, docs/improve-cli, test/add-coverage, etc.
   ```
3. **Make your changes**:
   - Keep the PR focused on **one** concern
   - Add/update tests for new behavior or bug fixes
   - Update documentation when behavior or public APIs change
   - Follow existing code style (ESLint + Prettier)
4. **Verify locally**:
   ```bash
   pnpm test
   pnpm typecheck
   pnpm lint
   pnpm format:check
   ```
   If you touched the public package:
   ```bash
   pnpm --filter assetdiet-mcp build
   pnpm --filter assetdiet-mcp test
   ```
5. **Commit** using [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat: ...`
   - `fix: ...`
   - `docs: ...`
   - `test: ...`
   - `chore: ...`
   - `refactor: ...`
6. **Open the Pull Request**:
   - Fill out the PR template completely
   - Link related issues (`Closes #123`)
   - Describe **what** changed and **why**
   - Include screenshots or before/after numbers when relevant (especially for optimization changes)

### Review Criteria

PRs are more likely to be merged when they:

- Pass CI (tests, typecheck, lint)
- Include appropriate tests
- Keep the change focused and well-scoped
- Update docs when needed
- Follow the Code of Conduct and contribution guidelines
- Do not introduce secrets, large binary assets, or unrelated reformatting

---

## Issue Guidelines

- Use the provided **issue templates**
- Provide clear reproduction steps for bugs
- For feature requests, explain the problem and the desired outcome
- Search for duplicates before opening a new issue

---

## Security Issues

**Do not** open public issues for security vulnerabilities.  
Please follow the process in [SECURITY.md](SECURITY.md).

---

## Questions?

Feel free to open a Discussion or an issue using the appropriate template.  
We appreciate every contribution — thank you for helping make AssetDiet better!
