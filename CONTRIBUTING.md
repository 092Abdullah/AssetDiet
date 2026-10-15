# Contributing to AssetDiet

Thank you for your interest in contributing to AssetDiet! We welcome bug reports, pull requests, and documentation improvements.

---

## Code of Conduct

Please maintain a respectful, inclusive, and professional environment across all issues, pull requests, and discussions.

---

## Development Setup

1. **Fork and clone the repository**:

   ```bash
   git clone https://github.com/092Abdullah/AssetDiet.git
   cd AssetDiet
   ```

2. **Ensure you have Node.js 20+ and pnpm 9+**:

   ```bash
   node --version  # >= 20.0.0
   pnpm --version  # >= 9.0.0
   ```

3. **Install dependencies**:

   ```bash
   pnpm install
   ```

4. **Build the packages**:
   ```bash
   pnpm build
   ```

---

## Submitting Pull Requests

1. **Create a branch**:

   ```bash
   git checkout -b feature/my-new-feature
   ```

2. **Write clean, tested code**:
   - Add unit or integration tests for new functionality or bug fixes.
   - Ensure all existing tests pass:
     ```bash
     pnpm test
     pnpm typecheck
     pnpm lint
     pnpm format:check
     ```

3. **Verify the distribution package artifact**:
   If modifying internal packages or CLI commands, ensure the public distribution package builds cleanly:

   ```bash
   pnpm --filter assetdiet-mcp build
   pnpm --filter assetdiet-mcp test
   ```

4. **Commit discipline**:
   - Use descriptive commit messages following Conventional Commits (e.g. `feat:`, `fix:`, `docs:`, `test:`).
   - Never commit private tokens, passwords, machine-specific paths, or generated test assets.

5. **Open a Pull Request**:
   - Describe what changed and provide reproducible steps or test results.
