# AI Agent Behavior

## General

- Read `CLAUDE.md` / `AGENTS.md` before taking action in an unfamiliar part of the codebase
- Prefer editing existing files over creating new ones
- Do not add features, refactoring, or "improvements" beyond what was asked
- Do not add error handling for scenarios that cannot happen
- Do not add comments unless the logic is non-obvious

## Working in This Repo

- All source code lives in `src/` — do not create files outside `src/`, `dist/`, `.ai/`, or `docs/`
- Environment variables are in `.env` (gitignored) — never hardcode API keys
- Run `pnpm build` to verify TypeScript after changes to `src/`
- Use `pnpm dev` for live-reload during development
