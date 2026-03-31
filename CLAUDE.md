# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (live reload)
pnpm dev          # stdio transport (for Cursor/Claude Desktop)
pnpm dev:http     # HTTP transport (for web clients)
pnpm dev:ui       # Watch mode for React UI components

# Build
pnpm build        # Full build: UI (Vite) + server (tsc)
pnpm build:ui     # Build only React UI components

# Lint & format
pnpm lint         # ESLint check
pnpm lint:fix     # ESLint with auto-fix
pnpm format       # Prettier format
pnpm format:check # Prettier validation

# Production
pnpm start:stdio  # Run compiled stdio server
pnpm start:http   # Run compiled HTTP server on PORT (default 3000)

# Test tools interactively
npx @modelcontextprotocol/inspector -- npx tsx src/stdio.ts
```

## Architecture

This is a **Model Context Protocol (MCP) server** — a meal planner that recommends restaurants based on cuisine, location, weather, and hunger level (craving).

### Dual Transport

The server supports two transport mechanisms sharing the same logic:

- **`src/stdio.ts`** — Stdio transport for local clients (Cursor, VS Code, Claude Desktop)
- **`src/http.ts`** — HTTP/SSE transport for remote/web clients (Express on port 3000)
- **`src/server.ts`** — `createServer()` factory used by both transports; registers tools and server instructions

### Tools (`src/tools.ts`)

Two tools are registered:

1. **`get_weather`** — Takes a city name, calls OpenWeatherMap, returns weather data + React UI card
2. **`recommend_meal`** — Takes cuisine + optional location/cravingLevel/hour. Core logic:
   - Resolves location via Google Geocoding or IP geolocation fallback
   - Searches restaurants via Google Places API
   - Fetches weather to factor in travel advisories
   - Sorts restaurants by a craving-level algorithm (1–25: proximity, 26–50: proximity+rating, 51–75: rating+proximity, 76–100: rating only)
   - Filters by opening hours, returns top 5 with photos
   - Uses **elicitation** to request location from the user if omitted

### Services (`src/services/`)

- **`google-places.ts`** — Geocoding, Places search, opening hours, photo URLs, IP→coordinates
- **`openweather.ts`** — Weather data by city name or coordinates
- **`weather-ui.ts`** — Generates HTML weather card for HTTP demo endpoint

### React UIs

- **`src/mcp-app.tsx`** → compiled to `dist/mcp-app.html` — Weather card UI
- **`src/mcp-app-meal.tsx`** → compiled to `dist/mcp-app-meal.html` — Restaurant carousel UI

UIs are built as single-file bundles (via `vite-plugin-singlefile`) and served as MCP UI resources (`ui://get-weather/mcp-app.html`, `ui://recommend-meal/mcp-app-meal.html`).

### TypeScript Build Split

Two `tsconfig` projects exist:
- **`tsconfig.server.json`** — Node.js backend (excludes `.tsx`, outputs to `dist/`)
- **`tsconfig.app.json`** — React UI (browser, no emit — type-check only; Vite handles output)

### Environment Variables

Copy `.env.example` to `.env` and set:
- `GOOGLE_MAPS_API_KEY` — required for restaurant search and geocoding
- `OPEN_WEATHER_API_KEY` — required for weather data
- `PORT` — HTTP server port (default 3000)

### Client Configuration

- **Cursor:** `.cursor/mcp.json` configures the stdio server via `npx tsx src/stdio.ts`
- **Claude Desktop:** configure manually in `~/Library/Application Support/Claude/claude_desktop_config.json`
- **HTTP clients:** point to `http://localhost:3000/mcp` with `type: "http"`
