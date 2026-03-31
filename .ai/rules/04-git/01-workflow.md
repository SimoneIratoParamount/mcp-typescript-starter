# Git Workflow

- **Never commit or push directly to `main`** — always create a feature branch first
- Branch naming: `<type>/<short-description>` (e.g. `feat/rule-system`, `fix/weather-timeout`)
- Keep commits small and focused — one logical change per commit
- Run `pnpm lint && pnpm format:check && pnpm build` before committing
- Use conventional commit prefixes: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
- Open a PR to merge into `main`; do not force-push to shared branches
