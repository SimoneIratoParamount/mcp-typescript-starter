# AGENTS.md

This file provides context for AI coding agents working in this repository.

## Quick Reference

| Task | Command |
|------|---------|
| Install | `npm ci` |
| Build | `npm run build` |
| Test | `npm test` |
| Lint | `npm run lint` |
| Lint fix | `npm run lint:fix` |
| Format | `npm run format` |
| Format check | `npm run format:check` |
| Run (stdio) | `npm run start:stdio` |
| Run (HTTP) | `npm run start:http` |
| Dev mode | `npm run dev` |

## Project Overview

**MCP TypeScript Starter** is a feature-complete Model Context Protocol (MCP) server template in TypeScript. It demonstrates all major MCP features including tools, resources, resource templates, prompts, sampling, progress updates, and dynamic tool loading.

**Purpose**: Workshop starter template for learning MCP server development.

## Technology Stack

- **Runtime**: Node.js >=20.0.0
- **Language**: TypeScript 5.5+ (ESM)
- **MCP SDK**: `@modelcontextprotocol/sdk`
- **Schema Validation**: Zod
- **HTTP Server**: Express
- **Package Manager**: npm (use `npm ci` for reproducible installs)
- **Formatter**: Prettier
- **Linter**: ESLint

## Project Structure

```
src/
├── server.ts           # Main server with all MCP features (tools, resources, prompts)
├── tools.ts            # Tool definitions (hello, weather, meal recommendation, etc.)
├── resources.ts        # Resource and resource template definitions
├── prompts.ts          # Prompt definitions
├── services/
│   └── google-places.ts  # Google Maps Geocoding + Places API integration
├── stdio.ts            # stdio transport entrypoint
└── http.ts             # HTTP/SSE transport entrypoint

.vscode/
├── mcp.json          # MCP server configuration for VS Code
├── tasks.json        # Build/run tasks
├── launch.json       # Debug configurations
└── extensions.json   # Recommended extensions

.devcontainer/
└── devcontainer.json # DevContainer configuration
```

## Build & Run Commands

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run in watch mode (development)
npm run dev

# Run server (stdio transport)
npm run start:stdio

# Run server (HTTP transport)
npm run start:http
```

## Linting & Formatting

```bash
# Lint code
npm run lint

# Fix lint issues
npm run lint:fix

# Format code with Prettier
npm run format

# Check formatting
npm run format:check

# Full check (lint + format + build)
npm run check
```

## Testing

```bash
# Run tests (when implemented)
npm test
```

## Key Files to Modify

- **Add/modify tools**: `src/server.ts` → `registerTools()` function
- **Add/modify resources**: `src/server.ts` → `registerResources()` function
- **Add/modify prompts**: `src/server.ts` → `registerPrompts()` function
- **Change server config**: `src/server.ts` → `createServer()` function
- **HTTP port/config**: `src/http.ts`

## MCP Features Implemented

| Feature | Location | Description |
|---------|----------|-------------|
| `hello` tool | `server.ts` | Basic tool with annotations |
| `get_weather` tool | `server.ts` | Structured JSON output |
| `ask_llm` tool | `server.ts` | Sampling/LLM invocation |
| `long_task` tool | `server.ts` | Progress updates |
| `load_bonus_tool` | `tools.ts` | Dynamic tool loading |
| `recommend_meal` | `tools.ts` | Restaurant search via Google Maps Places API |
| Resources | `resources.ts` | Static `about://server`, `doc://example` |
| Templates | `resources.ts` | `greeting://{name}`, `item://{id}` |
| Prompts | `prompts.ts` | `greet`, `code_review` with arguments |

## Environment Variables

- `PORT` - HTTP server port (default: 3000)
- `GOOGLE_MAPS_API_KEY` - API key for Google Maps (Geocoding + Places API Legacy); required by `recommend_meal`
- `OPEN_WEATHER_API_KEY` - API key for Open Weather Maps; required by `get_weather`

## Conventions

- Use Zod schemas for all tool inputs
- Follow ESM module syntax (`import`/`export`)
- Use TypeScript strict mode
- Format with Prettier before committing
- Run `npm run check` before PRs

## Documentation Links

- [MCP Specification](https://modelcontextprotocol.io/)
- [TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Building Servers](https://modelcontextprotocol.io/docs/develop/build-server)
