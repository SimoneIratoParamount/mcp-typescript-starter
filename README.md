# Meal Planner MCP Server

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![MCP](https://img.shields.io/badge/MCP-Model%20Context%20Protocol-purple)](https://modelcontextprotocol.io/)

A [Model Context Protocol](https://modelcontextprotocol.io/) server that recommends restaurants based on cuisine preferences, location, weather conditions, and hunger level. Built on top of the [mcp-typescript-starter](https://github.com/SamMorrowDrums/mcp-typescript-starter) template.

## What It Does

The core feature is the `recommend_meal` tool, which helps users decide where to eat by combining several data sources:

- **Restaurant search** — finds nearby restaurants matching the requested cuisine using the Google Maps Places API
- **Weather awareness** — fetches current conditions via OpenWeatherMap and adjusts recommendations accordingly (e.g. prioritises nearby venues in bad weather and adds travel advisories)
- **Craving level** — accepts a hunger score from 1–100 and balances proximity vs. rating based on how hungry the user is
- **Opening hours** — optionally filters restaurants that are open at a specific time (HH:MM)
- **Rich UI** — returns a React-rendered card interface embedded inside the MCP response (via `@modelcontextprotocol/ext-apps`)

### Tools

| Tool | Description |
|------|-------------|
| `recommend_meal` | Find a weather-aware restaurant near you by cuisine type |
| `get_weather` | Current weather for any city (or auto-detected from IP) |

## Prerequisites

- [Node.js 20+](https://nodejs.org/)
- pnpm (`npm install -g pnpm`)
- A [Google Maps API key](https://console.cloud.google.com/) with **Geocoding API** and **Places API (Legacy)** enabled
- An [OpenWeatherMap API key](https://openweathermap.org/api) (free tier works)

## Quick Start

```bash
# Clone
git clone <your-repo-url>
cd mcp-typescript-starter

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# Edit .env and add your API keys

# Build
pnpm build

# Run (stdio transport, for use with Cursor / Claude Desktop)
pnpm start:stdio
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GOOGLE_MAPS_API_KEY` | Google Maps key (Geocoding + Places API Legacy) | Yes, for `recommend_meal` |
| `OPEN_WEATHER_API_KEY` | OpenWeatherMap key (free at openweathermap.org) | Yes, for weather features |
| `PORT` | HTTP server port | No (default: `3000`) |

## MCP Configuration

The server supports two transports: **stdio** (recommended for local development) and **HTTP** (for remote or multi-client setups).

### Cursor

A `.vscode/mcp.json` is included and picked up by Cursor automatically when you open the project. It runs the server in dev mode via `tsx` so there is no build step needed:

```jsonc
{
  "servers": {
    "meal-planner": {
      "type": "stdio",
      "command": "npx",
      "args": ["tsx", "src/stdio.ts"],
      "env": {
        "GOOGLE_MAPS_API_KEY": "<your-key>",
        "OPEN_WEATHER_API_KEY": "<your-key>"
      }
    }
  }
}
```

After running `pnpm build` you can point to the compiled output instead:

```jsonc
"args": ["dist/stdio.js"],
"command": "node"
```

### Claude Desktop

Add the server to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or the equivalent path on your OS:

```jsonc
{
  "mcpServers": {
    "meal-planner": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-typescript-starter/dist/stdio.js"],
      "env": {
        "GOOGLE_MAPS_API_KEY": "<your-key>",
        "OPEN_WEATHER_API_KEY": "<your-key>"
      }
    }
  }
}
```

Run `pnpm build` first so `dist/stdio.js` exists.

### HTTP Transport

The HTTP transport is useful when you want to connect multiple clients to the same running server instance, or when the server runs on a remote machine.

Start the server:

```bash
pnpm dev:http          # development, live reload
# or
pnpm start:http        # production build (runs on http://localhost:3000)
```

Then configure your client to connect via HTTP:

```jsonc
{
  "servers": {
    "meal-planner": {
      "type": "http",
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

> **Note:** API keys must be set in `.env` (or the shell environment) when using HTTP transport, since there is no per-client `env` block.

## Development Guide

### Project Structure

```
.
├── src/
│   ├── tools.ts            # All tool definitions
│   ├── server.ts           # Server orchestration
│   ├── stdio.ts            # stdio transport entrypoint
│   ├── http.ts             # HTTP transport entrypoint
│   ├── mcp-app.tsx         # React UI for general tools
│   ├── mcp-app-meal.tsx    # React UI for recommend_meal
│   └── services/
│       ├── google-places.ts  # Google Maps integration
│       └── openweather.ts    # OpenWeatherMap integration
├── .vscode/
│   ├── mcp.json            # MCP server config for Cursor/VS Code
│   └── tasks.json          # Build/run tasks
├── .devcontainer/
│   └── devcontainer.json
├── package.json
├── tsconfig.json
├── tsconfig.server.json    # Server-only build config
└── tsconfig.app.json       # React UI build config
```

### Dev Commands

```bash
# Development with live reload (stdio)
pnpm dev

# Development with live reload (HTTP)
pnpm dev:http

# Build everything (UI + server)
pnpm build

# Build UI only (React apps bundled via Vite)
pnpm build:ui

# Lint
pnpm lint
pnpm lint:fix

# Format
pnpm format

# Clean build artifacts
pnpm clean && pnpm build
```

### Live Reload

`pnpm dev` uses `tsx watch` — any change to a `.ts` or `.tsx` file in `src/` restarts the server instantly. The UI components (`mcp-app.tsx`, `mcp-app-meal.tsx`) are bundled separately by Vite and inlined as single-file HTML.

### Adding a New Tool

1. Open `src/tools.ts`
2. Write a `registerMyTool(server: McpServer)` function following the existing patterns
3. Call it from `registerTools(server)` at the top of the file
4. Rebuild or rely on `pnpm dev` for live reload

### MCP Inspector

The [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector) lets you test tools interactively without an AI client:

```bash
npx @modelcontextprotocol/inspector -- npx tsx src/stdio.ts
```

Use the **Tools** tab to invoke `recommend_meal` directly, the **Logs** tab to inspect JSON-RPC payloads, and the **Resources** tab to browse available content.

## Forked From

This project is forked from [SamMorrowDrums/mcp-typescript-starter](https://github.com/SamMorrowDrums/mcp-typescript-starter), a feature-complete MCP server template covering tools, resources, templates, prompts, progress updates, dynamic tool loading, and elicitation.

## License

MIT — see [LICENSE](LICENSE) for details.
