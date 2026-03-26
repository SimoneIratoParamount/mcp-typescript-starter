# AGENTS.md

This file provides context for AI coding agents working in this repository.

## Quick Reference

| Task | Command |
|------|---------|
| Install | `pnpm install` (see `package.json` engines) |
| Build | `pnpm run build` |
| Full check | `pnpm run check` (format + lint + build) |
| Test | `pnpm test` (when implemented) |
| Lint | `pnpm run lint` |
| Lint fix | `pnpm run lint:fix` |
| Format | `pnpm run format` |
| Format check | `pnpm run format:check` |
| Run (stdio) | `pnpm run start:stdio` |
| Run (HTTP) | `pnpm run start:http` |
| Dev mode | `pnpm run dev` |

## Project Overview

**Meal Planner MCP** (based on an MCP TypeScript starter) is a Model Context Protocol server that recommends restaurants using Google Places, OpenWeatherMap, and hunger/cuisine inputs, with rich UI via `@modelcontextprotocol/ext-apps`.

**Purpose:** Workshop / learning template for MCP server development.

## Technology Stack

- **Runtime**: Node.js >=20.0.0
- **Language**: TypeScript 5.5+ (ESM)
- **Bundler**: Vite 7 (UI single-file builds + Node SSR bundle for `stdio` / `http` transports)
- **MCP SDK**: `@modelcontextprotocol/sdk`, `@modelcontextprotocol/ext-apps`
- **Schema Validation**: Zod
- **HTTP Server**: Express
- **Package Manager**: pnpm (see `package.json` `engines`)
- **Formatter**: Prettier
- **Linter**: ESLint + typescript-eslint

## Project Structure

```
src/
├── server.ts              # createServer() — McpServer + registerTools
├── tools/                 # Tool registrations (weather, meal planner UI)
│   ├── index.ts
│   ├── register-weather.ts
│   └── register-meal.ts
├── tools-bundle-path.ts   # dist/ path for embedded UI HTML (import.meta layout)
├── stdio.ts               # stdio transport entry
├── http.ts                # HTTP entry (static, weather demo, `/mcp`, health)
├── http/                  # Streamable MCP route + weather demo helpers
├── mcp-app.tsx            # Vite client bundle for generic MCP UI demo
├── mcp-app-meal.tsx       # Vite entry for meal tool embedded UI
├── mcp-app-meal/          # Meal UI (carousel, cards, hooks, themes)
├── services/
│   ├── google-places/     # Geocoding, Places, opening hours, IP geo
│   ├── openweather.ts     # OpenWeatherMap API
│   └── weather-ui.ts      # HTML UI resource helpers (@mcp-ui/server)
└── utils/
    └── import-meta.ts     # importMetaPaths(import.meta.url) helper

vite.config.ts             # UI build (requires INPUT=mcp-app.html | mcp-app-meal.html)
vite.server.config.ts      # Node server bundle (stdio + http entries → dist/, chunks/)

.vscode/
├── tasks.json
└── extensions.json

.devcontainer/
└── devcontainer.json
```

## Build & Run Commands

```bash
pnpm install

# Production build: UI (twice) then Node server bundle — all output under dist/
pnpm run build

# Server outputs dist/stdio.js, dist/http.js, dist/chunks/*.js (run from repo root)
pnpm run start:stdio
pnpm run start:http
```

**Typecheck (optional, no emit):**

```bash
pnpm exec tsc -p tsconfig.server.json --noEmit
pnpm exec tsc -p tsconfig.app.json --noEmit
```

## Linting & Formatting

```bash
pnpm run lint
pnpm run lint:fix
pnpm run format
pnpm run format:check
pnpm run check          # format:check + lint + build
```

## Testing

```bash
pnpm test
```

(Placeholder until a test runner is added.)

## Key Files to Modify

- **Tools**: `src/tools/index.ts` → `registerTools(server)`
- **Server metadata / instructions**: `src/server.ts` → `createServer()`
- **HTTP routes / static files**: `src/http.ts`
- **Places / weather services**: `src/services/google-places.ts`, `src/services/openweather.ts`

## MCP Features Implemented

| Feature | Location | Description |
|---------|----------|-------------|
| `get_weather` | `tools/register-weather.ts` | Weather + optional embedded UI |
| `recommend_meal` | `tools/register-meal.ts` | Restaurant search + weather-aware ranking + embedded meal UI |
| Transports | `stdio.ts`, `http.ts` | stdio and streamable HTTP |

## Environment Variables

- `PORT` — HTTP server port (default: 3000)
- `GOOGLE_MAPS_API_KEY` — Geocoding + Places API Legacy; required for `recommend_meal`
- `OPEN_WEATHER_API_KEY` — required for weather in tools

## Conventions

- Use Zod schemas for tool inputs
- ESM (`import`/`export`); extensionless relative imports in source; Vite emits Node-compatible chunks under `dist/chunks/`
- TypeScript strict mode (`tsconfig.base.json` + overlays)
- Format with Prettier before committing
- Run `pnpm run check` before PRs

## Documentation Links

- [MCP Specification](https://modelcontextprotocol.io/)
- [TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Building Servers](https://modelcontextprotocol.io/docs/develop/build-server)
