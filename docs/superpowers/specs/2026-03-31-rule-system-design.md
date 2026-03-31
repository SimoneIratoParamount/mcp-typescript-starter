# Rule System Design

**Date:** 2026-03-31
**Status:** Approved

## Overview

A single-source-of-truth rule system for the mcp-typescript-starter project. All rules live under `.ai/rules/`, organized by topic. Tool-specific files (CLAUDE.md, `.cursor/rules/`) are thin pointers that import from the source of truth using each tool's native include syntax.

## Source of Truth Structure

```
.ai/rules/
  01-project/
    01-overview.md          # purpose, stack, key files
    02-architecture.md      # dual transport, services, UI build
  02-typescript/
    01-conventions.md       # ESM, strict mode, Zod, Prettier
  03-mcp/
    01-setup.md             # 3 ways to start: stdio/tsx, stdio/node, HTTP
    02-tools.md             # tool authoring patterns
  04-git/
    01-workflow.md          # feature branches, no direct main commits
  05-ai-agents/
    01-behavior.md          # general agent guidance
    02-dependencies.md      # superpowers plugin required for Claude + Cursor
```

Folders and files are prefixed with a numerical index for stable ordering.

## Claude Integration

Two scoped CLAUDE.md files, each importing from `.ai/rules/` using `@path` syntax:

**`/CLAUDE.md`** (always loaded) — imports:
- `01-project/01-overview.md`
- `01-project/02-architecture.md`
- `04-git/01-workflow.md`
- `05-ai-agents/01-behavior.md`
- `05-ai-agents/02-dependencies.md`

**`/src/CLAUDE.md`** (loaded when working in `src/`) — imports:
- `02-typescript/01-conventions.md`
- `03-mcp/01-setup.md`
- `03-mcp/02-tools.md`

The existing commands/reference content in `/CLAUDE.md` stays below the imports.

## Cursor Integration

**`.cursor/rules/`** — one `.mdc` per top-level rule folder, each pointing to its `.ai/rules/` files via `@file` references in the body:

| File | globs / scope | Imports |
|------|--------------|---------|
| `01-project.mdc` | `alwaysApply: true` | `01-project/**` |
| `02-typescript.mdc` | `**/*.ts, **/*.tsx` | `02-typescript/**` |
| `03-mcp.mdc` | `src/**` | `03-mcp/**` |
| `04-git.mdc` | `alwaysApply: true` | `04-git/**` |
| `05-ai-agents.mdc` | `alwaysApply: true` | `05-ai-agents/**` |

**`.cursor/mcp.json`** — updated to expose all three startup methods:
1. `stdio/tsx` — `npx tsx src/stdio.ts` (dev, no build needed)
2. `stdio/node` — `node dist/stdio.js` (compiled)
3. `http` — `http://localhost:3000/mcp` (remote/web clients)

## Superpowers Dependency

`05-ai-agents/02-dependencies.md` declares superpowers as a required plugin for both tools:

- **Claude Code:** `enabledPlugins: { "superpowers@claude-plugins-official": true }` in `.claude/settings.local.json`
- **Cursor:** superpowers agent present in `.cursor/agents/superpowers/`

This ensures both tools load the superpowers skill system before acting.

## Key Principles

- **No duplication:** rule content lives only in `.ai/rules/`. Tool files contain zero duplicated content.
- **Native includes:** each tool uses its own import mechanism — no scripts, no sync step.
- **Scoped activation:** Claude uses directory-scoped CLAUDE.md; Cursor uses glob frontmatter in `.mdc` files.
- **Stable ordering:** numeric prefixes on folders and files ensure consistent load order.
