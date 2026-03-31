# Rule System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a single-source-of-truth rule system under `.ai/rules/` with native pointer integration for both Claude Code and Cursor.

**Architecture:** All rule content lives in `.ai/rules/` organized by numbered topic folders and files. CLAUDE.md files use `@path` imports scoped by directory; Cursor uses `.mdc` files with glob frontmatter pointing to the same source files. No content duplication.

**Tech Stack:** Markdown, Cursor `.mdc` frontmatter, Claude Code `@`-import syntax.

---

## File Map

**Create:**
- `.ai/rules/01-project/01-overview.md`
- `.ai/rules/01-project/02-architecture.md`
- `.ai/rules/02-typescript/01-conventions.md`
- `.ai/rules/03-mcp/01-setup.md`
- `.ai/rules/03-mcp/02-tools.md`
- `.ai/rules/04-git/01-workflow.md`
- `.ai/rules/05-ai-agents/01-behavior.md`
- `.ai/rules/05-ai-agents/02-dependencies.md`
- `src/CLAUDE.md`
- `.cursor/rules/01-project.mdc`
- `.cursor/rules/02-typescript.mdc`
- `.cursor/rules/03-mcp.mdc`
- `.cursor/rules/04-git.mdc`
- `.cursor/rules/05-ai-agents.mdc`

**Modify:**
- `CLAUDE.md` — prepend `@` imports for project/git/ai-agents rules
- `.cursor/mcp.json` — uncomment and add all three startup methods

---

### Task 1: Scaffold `.ai/rules/` folder structure

**Files:**
- Create: `.ai/rules/01-project/01-overview.md`
- Create: `.ai/rules/01-project/02-architecture.md`
- Create: `.ai/rules/02-typescript/01-conventions.md`
- Create: `.ai/rules/03-mcp/01-setup.md`
- Create: `.ai/rules/03-mcp/02-tools.md`
- Create: `.ai/rules/04-git/01-workflow.md`
- Create: `.ai/rules/05-ai-agents/01-behavior.md`
- Create: `.ai/rules/05-ai-agents/02-dependencies.md`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p .ai/rules/01-project
mkdir -p .ai/rules/02-typescript
mkdir -p .ai/rules/03-mcp
mkdir -p .ai/rules/04-git
mkdir -p .ai/rules/05-ai-agents
```

- [ ] **Step 2: Write `.ai/rules/01-project/01-overview.md`**

```markdown
# Project Overview

**Name:** mcp-typescript-starter
**Purpose:** Workshop starter template — a Model Context Protocol (MCP) server that recommends restaurants based on cuisine, location, weather, and hunger level.

## Stack

- Runtime: Node.js >=20.0.0
- Language: TypeScript 5.5+ (ESM)
- MCP SDK: `@modelcontextprotocol/sdk`
- Schema validation: Zod
- HTTP server: Express
- Package manager: pnpm
- Formatter: Prettier
- Linter: ESLint

## Key Files

| File | Purpose |
|------|---------|
| `src/server.ts` | `createServer()` factory — registers tools, resources, server instructions |
| `src/tools.ts` | Tool definitions (`get_weather`, `recommend_meal`) |
| `src/stdio.ts` | Stdio transport entrypoint |
| `src/http.ts` | HTTP/SSE transport entrypoint (Express, port 3000) |
| `src/services/google-places.ts` | Geocoding, Places search, photo URLs, IP→coordinates |
| `src/services/openweather.ts` | Weather data by city or coordinates |
| `src/mcp-app.tsx` | React weather card UI → `dist/mcp-app.html` |
| `src/mcp-app-meal.tsx` | React restaurant carousel UI → `dist/mcp-app-meal.html` |

## Environment Variables

Copy `.env.example` to `.env`:
- `GOOGLE_MAPS_API_KEY` — Geocoding + Places API
- `OPEN_WEATHER_API_KEY` — OpenWeatherMap
- `PORT` — HTTP server port (default 3000)
```

- [ ] **Step 3: Write `.ai/rules/01-project/02-architecture.md`**

```markdown
# Architecture

## Dual Transport

Both transports share the same `createServer()` factory from `src/server.ts`:

- **stdio** (`src/stdio.ts`) — for local clients: Cursor, VS Code, Claude Desktop
- **HTTP/SSE** (`src/http.ts`) — for remote/web clients via Express on port 3000

## Tools

Two tools registered in `src/tools.ts`:

1. **`get_weather`** — city name → OpenWeatherMap data + React UI card
2. **`recommend_meal`** — cuisine + optional location/cravingLevel/hour:
   - Resolves location via Google Geocoding or IP geolocation fallback
   - Searches restaurants via Google Places API
   - Fetches weather for travel advisories
   - Sorts by craving-level algorithm (1–25: proximity; 26–50: proximity+rating; 51–75: rating+proximity; 76–100: rating only)
   - Filters by opening hours, returns top 5 with photos
   - Uses **elicitation** to request location if omitted

## React UIs

Built as single-file bundles via `vite-plugin-singlefile`:
- `src/mcp-app.tsx` → `dist/mcp-app.html` served as `ui://get-weather/mcp-app.html`
- `src/mcp-app-meal.tsx` → `dist/mcp-app-meal.html` served as `ui://recommend-meal/mcp-app-meal.html`

## TypeScript Build Split

- `tsconfig.server.json` — Node.js backend, outputs to `dist/`
- `tsconfig.app.json` — React UI, type-check only (Vite handles output)
```

- [ ] **Step 4: Write `.ai/rules/02-typescript/01-conventions.md`**

```markdown
# TypeScript Conventions

- Use ESM module syntax (`import`/`export`) throughout — no CommonJS
- Enable TypeScript strict mode (already set in tsconfig)
- Use **Zod** for all tool input schemas — do not use plain TypeScript types for MCP tool inputs
- Format with **Prettier** before committing (`pnpm format`)
- Lint with **ESLint** (`pnpm lint`)
- Run `pnpm build` to verify no TypeScript errors before committing
- Do not use `any` — prefer `unknown` and narrow with type guards or Zod
- Use named exports; avoid default exports except for React components
```

- [ ] **Step 5: Write `.ai/rules/03-mcp/01-setup.md`**

```markdown
# MCP Server Setup

## Three Ways to Start

### 1. stdio/tsx — development (no build needed)
```json
{
  "type": "stdio",
  "command": "npx",
  "args": ["tsx", "src/stdio.ts"]
}
```
Use this during development. Requires `tsx` available via npx.

### 2. stdio/node — compiled
```json
{
  "type": "stdio",
  "command": "node",
  "args": ["dist/stdio.js"]
}
```
Run `pnpm build` first. Faster startup, no transpilation overhead.

### 3. HTTP transport — remote/web clients
```json
{
  "type": "http",
  "url": "http://localhost:3000/mcp"
}
```
Run `pnpm start:http` (or `pnpm dev:http`) first. Use for browser-based or remote MCP clients.

## Interactive Testing

```bash
npx @modelcontextprotocol/inspector -- npx tsx src/stdio.ts
```

## Client Config Locations

- **Cursor:** `.cursor/mcp.json`
- **Claude Desktop:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **VS Code:** `.vscode/mcp.json`
```

- [ ] **Step 6: Write `.ai/rules/03-mcp/02-tools.md`**

```markdown
# MCP Tool Authoring Patterns

- Define tool input schemas with Zod in `src/tools.ts`
- Register tools inside `createServer()` in `src/server.ts` using `server.tool()`
- Return `{ content: [{ type: "text", text: "..." }] }` for plain text responses
- Return embedded resources for UI responses (HTML cards served from `dist/`)
- Use **elicitation** (`server.elicit()`) to request missing required info from the user at runtime — do not make location or other context assumptions
- Keep tool handler functions pure where possible; put API logic in `src/services/`
- Every tool input field must have a Zod `.describe()` — this becomes the MCP schema description
```

- [ ] **Step 7: Write `.ai/rules/04-git/01-workflow.md`**

```markdown
# Git Workflow

- **Never commit or push directly to `main`** — always create a feature branch first
- Branch naming: `<type>/<short-description>` (e.g. `feat/rule-system`, `fix/weather-timeout`)
- Keep commits small and focused — one logical change per commit
- Run `pnpm lint && pnpm format:check && pnpm build` before committing
- Use conventional commit prefixes: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
- Open a PR to merge into `main`; do not force-push to shared branches
```

- [ ] **Step 8: Write `.ai/rules/05-ai-agents/01-behavior.md`**

```markdown
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
```

- [ ] **Step 9: Write `.ai/rules/05-ai-agents/02-dependencies.md`**

```markdown
# AI Tool Dependencies

Both Claude Code and Cursor must have the **superpowers** plugin enabled to work effectively in this repo. Superpowers provides skill-based workflows for brainstorming, planning, TDD, debugging, and code review.

## Claude Code

`superpowers` must be listed in `.claude/settings.local.json`:

```json
{
  "enabledPlugins": {
    "superpowers@claude-plugins-official": true
  }
}
```

## Cursor

The superpowers agent must be present in `.cursor/agents/superpowers/`.

If it is missing, install it via the Cursor plugin marketplace before proceeding with any implementation work in this repo.
```

- [ ] **Step 10: Commit**

```bash
git add .ai/
git commit -m "feat: add .ai/rules source of truth for rule system"
```

---

### Task 2: Wire up Claude Code integration

**Files:**
- Modify: `CLAUDE.md`
- Create: `src/CLAUDE.md`

- [ ] **Step 1: Prepend `@` imports to `CLAUDE.md`**

Open `CLAUDE.md` and add the following block at the very top, before the `# CLAUDE.md` heading:

```markdown
@.ai/rules/01-project/01-overview.md
@.ai/rules/01-project/02-architecture.md
@.ai/rules/04-git/01-workflow.md
@.ai/rules/05-ai-agents/01-behavior.md
@.ai/rules/05-ai-agents/02-dependencies.md

```

The existing content (`# CLAUDE.md`, `## Commands`, etc.) stays unchanged below.

- [ ] **Step 2: Create `src/CLAUDE.md`**

```markdown
@../.ai/rules/02-typescript/01-conventions.md
@../.ai/rules/03-mcp/01-setup.md
@../.ai/rules/03-mcp/02-tools.md
```

- [ ] **Step 3: Verify imports resolve**

Open Claude Code in this repo and run `/context` — confirm token count increases and no "file not found" warnings appear for the new imports.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md src/CLAUDE.md
git commit -m "feat: wire Claude Code @ imports to .ai/rules"
```

---

### Task 3: Wire up Cursor `.mdc` rules

**Files:**
- Create: `.cursor/rules/01-project.mdc`
- Create: `.cursor/rules/02-typescript.mdc`
- Create: `.cursor/rules/03-mcp.mdc`
- Create: `.cursor/rules/04-git.mdc`
- Create: `.cursor/rules/05-ai-agents.mdc`

- [ ] **Step 1: Create `.cursor/rules/` directory**

```bash
mkdir -p .cursor/rules
```

- [ ] **Step 2: Write `.cursor/rules/01-project.mdc`**

```markdown
---
description: Project overview and architecture — always apply
alwaysApply: true
---

@.ai/rules/01-project/01-overview.md
@.ai/rules/01-project/02-architecture.md
```

- [ ] **Step 3: Write `.cursor/rules/02-typescript.mdc`**

```markdown
---
description: TypeScript conventions for this project
globs: ["**/*.ts", "**/*.tsx"]
alwaysApply: false
---

@.ai/rules/02-typescript/01-conventions.md
```

- [ ] **Step 4: Write `.cursor/rules/03-mcp.mdc`**

```markdown
---
description: MCP server setup and tool authoring patterns
globs: ["src/**"]
alwaysApply: false
---

@.ai/rules/03-mcp/01-setup.md
@.ai/rules/03-mcp/02-tools.md
```

- [ ] **Step 5: Write `.cursor/rules/04-git.mdc`**

```markdown
---
description: Git workflow — always apply
alwaysApply: true
---

@.ai/rules/04-git/01-workflow.md
```

- [ ] **Step 6: Write `.cursor/rules/05-ai-agents.mdc`**

```markdown
---
description: AI agent behavior and required dependencies — always apply
alwaysApply: true
---

@.ai/rules/05-ai-agents/01-behavior.md
@.ai/rules/05-ai-agents/02-dependencies.md
```

- [ ] **Step 7: Verify in Cursor**

Open Cursor in this repo. Go to **Cursor Settings → Rules**. Confirm the five rules appear with their correct descriptions and glob scopes.

- [ ] **Step 8: Commit**

```bash
git add .cursor/rules/
git commit -m "feat: add Cursor .mdc rule pointers to .ai/rules"
```

---

### Task 4: Update `.cursor/mcp.json` with all three startup methods

**Files:**
- Modify: `.cursor/mcp.json`

- [ ] **Step 1: Replace `.cursor/mcp.json` content**

```json
{
  "mcpServers": {
    "meal-planner": {
      "type": "stdio",
      "command": "npx",
      "args": ["tsx", "src/stdio.ts"]
    },
    "meal-planner-compiled": {
      "type": "stdio",
      "command": "node",
      "args": ["dist/stdio.js"]
    },
    "meal-planner-http": {
      "type": "http",
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

- [ ] **Step 2: Verify Cursor picks up the config**

In Cursor, open **Settings → MCP**. Confirm all three server entries appear: `meal-planner`, `meal-planner-compiled`, `meal-planner-http`.

- [ ] **Step 3: Commit**

```bash
git add .cursor/mcp.json
git commit -m "feat: expose all three MCP startup methods in .cursor/mcp.json"
```

---

### Task 5: Open PR

- [ ] **Step 1: Push branch and open PR**

```bash
git push -u origin HEAD
gh pr create --title "feat: add .ai/rules single-source-of-truth rule system" --body "$(cat <<'EOF'
## Summary

- Adds `.ai/rules/` as single source of truth for all project, TypeScript, MCP, git, and AI agent rules
- Wires Claude Code via `@` imports in `CLAUDE.md` (project-scoped) and `src/CLAUDE.md` (src-scoped)
- Wires Cursor via `.cursor/rules/*.mdc` with glob-scoped frontmatter
- Exposes all three MCP startup methods in `.cursor/mcp.json`
- Documents superpowers plugin dependency for both Claude and Cursor

## Test plan

- [ ] Claude Code: run `/context` and confirm rule files load without errors
- [ ] Cursor: check Settings → Rules for all 5 entries with correct scopes
- [ ] Cursor: check Settings → MCP for all 3 server entries
- [ ] No rule content duplicated between `.ai/rules/` and tool pointer files

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
