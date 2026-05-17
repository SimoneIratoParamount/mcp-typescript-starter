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
