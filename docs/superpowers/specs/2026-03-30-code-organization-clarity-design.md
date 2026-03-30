# Code Organisation & Clarity — Design Spec

**Date:** 2026-03-30
**Scope:** `src/tools.ts`, `src/mcp-app.tsx`, `src/mcp-app-meal.tsx`
**Approach:** Structural extraction (Approach B)
**Goals:** Readability, testability, DRY

---

## Problem Statement

Two files concentrate too much responsibility:

- **`src/tools.ts`** — the `registerMealRecommendationTool` handler is ~260 lines of mixed concerns: location resolution, restaurant sorting, opening-hours filtering, photo URL resolution, and text formatting all live inside one async closure. Pure business logic is untestable in isolation.
- **`src/mcp-app-meal.tsx`** — `CravingMeter` and `PopularTimes` are large inline components (150+ lines combined) inside a 826-line file.
- **Both TSX files** — `WEATHER_PHOTOS`, `getWeatherPhotoUrl`, `getWeatherTheme`, and the `WeatherData`/`WeatherSnapshot` types are duplicated verbatim (different names, same logic).

---

## Design

### 1. `src/services/meal-planner.ts` (new)

Owns all meal recommendation business logic extracted from `tools.ts`. Exports domain-logic functions only — no MCP SDK imports. Pure functions where possible; `filterOpenCandidates` and `resolvePhotoUrls` are async orchestration helpers that call into `google-places.ts` but have no MCP SDK dependency.

| Export | Signature | Responsibility |
|---|---|---|
| `buildTravelAdvisory` | `(conditions: string, distanceKm: number) => string` | Weather-aware travel advisory text |
| `sortRestaurants` | `(restaurants, craving, weatherSeverity) => RestaurantResult[]` | 4-tier craving sort (moved from inline) |
| `parseHour` | `(hour: string \| undefined) => string \| null \| Error` | Validates HH:MM format, returns `null` if omitted |
| `filterOpenCandidates` | `(sorted, apiKey, hhmm, dayOfWeek) => Promise<DetailResult[]>` | Fetches opening hours for top 15, returns open subset |
| `resolvePhotoUrls` | `(top5: DetailResult[], apiKey: string) => Promise<(string \| null)[]>` | Parallel photo CDN URL resolution |
| `buildRecommendations` | `(openPlaces, photoUrls, weather) => Recommendation[]` | Maps internal results to the output schema shape |
| `toWeatherSnapshot` | `(weather: WeatherResult \| null) => WeatherSnapshot \| undefined` | Maps WeatherResult to structured output shape |
| `formatTextOutput` | `(recs, cuisine, location, craving, weather, hour) => string` | Produces markdown text lines for the MCP text response |

### 2. `src/tools.ts` (modified)

Keeps: tool registration, input/output schema definitions, API key guards, elicitation block, location resolution calls, and the parallel `Promise.allSettled`. Calls `meal-planner.ts` functions for everything else.

The `registerMealRecommendationTool` handler reduces from ~260 lines to ~40 lines of sequential orchestration:

```
guard API key
→ resolve effective location (elicitation / IP / Google fallback)
→ resolve coords
→ fetch restaurants + weather in parallel
→ sort (meal-planner)
→ filter open candidates (meal-planner)
→ resolve photo URLs (meal-planner)
→ build recommendations (meal-planner)
→ return { content, structuredContent }
```

### 3. `src/ui/weather-utils.ts` (new)

Single source of truth for weather presentation logic shared by both UIs.

Exports:
- `WEATHER_PHOTOS: Array<[string, string]>` — Unsplash photo ID map
- `getWeatherPhotoUrl(conditions: string): string | null`
- `getWeatherTheme(conditions: string): { emoji: string; gradient: string }`
- Types: `WeatherData` (has `unit` field, used by `mcp-app.tsx`) and `WeatherSnapshot` (no `unit`, used by `mcp-app-meal.tsx`) — kept as two separate types since they have different shapes

### 4. `src/ui/WeatherCard.tsx` (new)

Unified weather card component. Accepts a `variant` prop:

- `'full'` — fullscreen background card (used in `mcp-app.tsx`). Renders with `minHeight: 100vh`, center-aligned, refresh button. Requires additional props: `app: App` and `inputCity: string` for the refresh action.
- `'compact'` — horizontal pill card (used in `mcp-app-meal.tsx`). Fixed `maxWidth: 420`, inline stats, no refresh button. No `app`/`inputCity` props needed.

Both variants source photo URL and theme from `weather-utils.ts`.

### 5. `src/ui/CravingMeter.tsx` (new)

Extracted from `mcp-app-meal.tsx` as-is. Props: `{ level: number }`.

### 6. `src/ui/PopularTimes.tsx` (new)

Extracted from `mcp-app-meal.tsx` as-is. Includes `busynessAt` and `getRushStatus` as module-private helpers. No props.

### 7. `src/mcp-app.tsx` (modified)

Removes: inline `WEATHER_PHOTOS`, `getWeatherPhotoUrl`, `getTheme`, `WeatherData` type, inline `WeatherCard`.
Imports: `WeatherCard` from `ui/WeatherCard`, weather types from `ui/weather-utils`.
Keeps: `WeatherApp` root component, `parseWeather`, mount code.

### 8. `src/mcp-app-meal.tsx` (modified)

Removes: `WEATHER_PHOTOS_MEAL`, `getWeatherPhotoUrlMeal`, `getWeatherTheme`, inline `WeatherCard`, inline `CravingMeter`, inline `PopularTimes`, `busynessAt`, `getRushStatus`.
Imports: `WeatherCard`, `CravingMeter`, `PopularTimes` from `ui/`, weather types from `ui/weather-utils`.
Keeps: `MealApp` root component, `Carousel`, `RestaurantCard`, `useBrowserLocation`, `parseMealData`, helper fns, mount code.

---

## File Map

| File | Status |
|---|---|
| `src/services/meal-planner.ts` | New |
| `src/ui/weather-utils.ts` | New |
| `src/ui/WeatherCard.tsx` | New |
| `src/ui/CravingMeter.tsx` | New |
| `src/ui/PopularTimes.tsx` | New |
| `src/tools.ts` | Modified |
| `src/mcp-app.tsx` | Modified |
| `src/mcp-app-meal.tsx` | Modified |
| `src/services/google-places.ts` | No change |
| `src/services/openweather.ts` | No change |
| `src/server.ts` | No change |
| `src/http.ts` / `src/stdio.ts` | No change |

---

## Constraints

- No new dependencies
- No build config changes (Vite handles cross-file imports within `src/`)
- `meal-planner.ts` has no MCP SDK imports — purely domain logic
- `ui/` components are framework-level only — no MCP SDK imports
