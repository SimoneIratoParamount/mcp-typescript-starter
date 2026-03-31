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
