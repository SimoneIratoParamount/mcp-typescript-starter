# Code Organisation & Clarity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract business logic from `tools.ts` and deduplicate weather UI code into shared modules, improving readability, testability, and DRY across the codebase.

**Architecture:** New `src/services/meal-planner.ts` owns pure domain functions extracted from the 260-line meal handler. New `src/ui/` directory holds shared weather utilities and extracted React components. Both TSX entry-point files are updated to import from shared modules.

**Tech Stack:** TypeScript, React 18, Vite (UI), tsx/tsc (server), `@modelcontextprotocol/sdk`, `@modelcontextprotocol/ext-apps`

> **Note:** No test runner is configured in this project. Verification steps use `pnpm build` (TypeScript compile + Vite bundle) and `pnpm lint` (ESLint). Each task ends with a build check.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/services/meal-planner.ts` | Create | Domain functions for restaurant recommendation pipeline |
| `src/ui/weather-utils.ts` | Create | Shared weather photo map, theme fn, and types |
| `src/ui/WeatherCard.tsx` | Create | Unified weather card (`full` / `compact` variants) |
| `src/ui/CravingMeter.tsx` | Create | Craving level display component |
| `src/ui/PopularTimes.tsx` | Create | Popular times bar chart component |
| `src/tools.ts` | Modify | Tool registration + ~40-line orchestration handler |
| `src/mcp-app.tsx` | Modify | Remove duplicated weather code, import from `ui/` |
| `src/mcp-app-meal.tsx` | Modify | Remove duplicated code + inline components, import from `ui/` |

---

## Task 1: Create `src/services/meal-planner.ts`

**Files:**
- Create: `src/services/meal-planner.ts`

Extract all business logic from `tools.ts` into pure/domain functions with no MCP SDK dependency.

- [ ] **Step 1: Create the file with types and imports**

```typescript
/**
 * Meal Planner — domain logic for the recommend_meal tool.
 *
 * Pure functions and orchestration helpers with no MCP SDK imports.
 * Imported by tools.ts to keep the tool handler focused on registration
 * and request/response orchestration.
 */

import {
  getPlaceOpeningHours,
  getPlacePhotoUrl,
  isOpenAtHour,
} from './google-places.js';
import type { RestaurantResult, PlaceOpeningHours } from './google-places.js';
import { classifyWeather } from './openweather.js';
import type { WeatherResult } from './openweather.js';

export interface Recommendation {
  name: string;
  cuisine: string;
  address: string;
  rating: number;
  distanceKm: number;
  openNow: boolean;
  placeId?: string;
  photoUrl?: string;
  openingHours?: string;
  weatherConditions?: string;
  travelAdvisory?: string;
}

export interface WeatherSnapshot {
  location: string;
  temperature: number;
  conditions: string;
  humidity: number;
  windSpeed: number;
}

export interface DetailResult {
  restaurant: RestaurantResult;
  hours: PlaceOpeningHours | null;
}
```

Save this as `src/services/meal-planner.ts`.

- [ ] **Step 2: Add `buildTravelAdvisory`**

Append to `src/services/meal-planner.ts`:

```typescript
/**
 * Build a travel advisory based on weather conditions and distance to restaurant.
 * Returns empty string when weather is good.
 */
export function buildTravelAdvisory(conditions: string, distanceKm: number): string {
  const severity = classifyWeather(conditions);
  if (severity === 'good') return '';

  const lines: string[] = [`⚠️ Current weather: ${conditions}.`];

  if (distanceKm <= 0.3) {
    lines.push('The restaurant is very close — a short walk with an umbrella should be fine.');
  } else if (distanceKm <= 1.0) {
    lines.push('Consider bringing an umbrella or checking if there are covered walkways nearby.');
  } else {
    lines.push(
      'The restaurant is a fair distance away in bad weather. Recommended options:',
      '  • 🚇 Public transport (metro, tram, bus) — check local transit apps',
      '  • 🚕 Taxi or rideshare (Uber, Bolt, local cabs)',
      '  • 🏙️ Look for covered shopping-arcade or underground passages on the way'
    );
  }

  return lines.join('\n');
}
```

- [ ] **Step 3: Add `sortRestaurants`**

Append to `src/services/meal-planner.ts`:

```typescript
/**
 * Sort restaurants by a craving-level algorithm:
 *  1–25  → nearest first (barely hungry, want something quick)
 *  26–50 → nearest then best-rated (mild hunger or bad weather)
 *  51–75 → best-rated then nearest (properly hungry, quality matters)
 *  76–100 → pure rating (very hungry — brave any distance)
 * Bad weather caps strategy at 26–50 unless craving ≥ 80.
 */
export function sortRestaurants(
  restaurants: RestaurantResult[],
  craving: number,
  weatherSeverity: 'good' | 'bad'
): RestaurantResult[] {
  return [...restaurants].sort((a, b) => {
    if (craving <= 25) {
      return a.distanceKm - b.distanceKm;
    } else if (craving <= 50 || (weatherSeverity === 'bad' && craving < 80)) {
      return a.distanceKm - b.distanceKm || b.rating - a.rating;
    } else if (craving <= 75) {
      return b.rating - a.rating || a.distanceKm - b.distanceKm;
    } else {
      return b.rating - a.rating;
    }
  });
}
```

- [ ] **Step 4: Add `parseHour`**

Append to `src/services/meal-planner.ts`:

```typescript
/**
 * Validate and normalise an HH:MM time string.
 * Returns null if hour is undefined (no filter), Error if format is invalid,
 * or a normalised "HHMM" string (e.g. "1430") for use with isOpenAtHour.
 */
export function parseHour(hour: string | undefined): string | null | Error {
  if (!hour) return null;
  const match = hour.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return new Error(
      `Invalid hour format "${hour}". Use HH:MM in 24h format (e.g. "14:30").`
    );
  }
  return match[1].padStart(2, '0') + match[2];
}
```

- [ ] **Step 5: Add `filterOpenCandidates`**

Append to `src/services/meal-planner.ts`:

```typescript
/**
 * Fetch opening hours for the top 15 sorted restaurants and filter to those
 * confirmed open for the requested timeframe.
 * - If hhmm is provided: filter by that specific time using Place Details periods.
 * - If hhmm is null: use the real-time open_now flag from the initial search.
 */
export async function filterOpenCandidates(
  sorted: RestaurantResult[],
  apiKey: string,
  hhmm: string | null,
  dayOfWeek: number
): Promise<DetailResult[]> {
  const candidates = sorted.slice(0, 15);
  const detailResults = await Promise.all(
    candidates.map(async (r) => {
      if (!r.placeId) return { restaurant: r, hours: null };
      const hours = await getPlaceOpeningHours(r.placeId, apiKey);
      return { restaurant: r, hours };
    })
  );

  return detailResults.filter((d) => {
    if (!d.hours) return false;
    if (hhmm) return isOpenAtHour(d.hours.periods, dayOfWeek, hhmm);
    return d.restaurant.openNow;
  });
}
```

- [ ] **Step 6: Add `resolvePhotoUrls`**

Append to `src/services/meal-planner.ts`:

```typescript
/**
 * Resolve Google Places photo CDN URLs in parallel for the top results.
 * Silently returns null for any photo that fails to resolve.
 */
export async function resolvePhotoUrls(
  top5: DetailResult[],
  apiKey: string
): Promise<(string | null)[]> {
  return Promise.all(
    top5.map((d) =>
      d.restaurant.photoReference
        ? getPlacePhotoUrl(d.restaurant.photoReference, apiKey).catch(() => null)
        : Promise.resolve(null)
    )
  );
}
```

- [ ] **Step 7: Add `buildRecommendations`, `toWeatherSnapshot`, and `formatTextOutput`**

Append to `src/services/meal-planner.ts`:

```typescript
/**
 * Map detail results + photo URLs + weather into the Recommendation[] output shape.
 */
export function buildRecommendations(
  openPlaces: DetailResult[],
  photoUrls: (string | null)[],
  weather: WeatherResult | null
): Recommendation[] {
  return openPlaces.map((d, i) => {
    const r = d.restaurant;
    const schedule = d.hours?.weekdayText.join('\n');
    const advisory = weather ? buildTravelAdvisory(weather.conditions, r.distanceKm) : '';
    return {
      name: r.name,
      cuisine: r.cuisine,
      address: r.address,
      rating: r.rating,
      distanceKm: r.distanceKm,
      openNow: r.openNow,
      placeId: r.placeId || undefined,
      photoUrl: photoUrls[i] ?? undefined,
      openingHours: schedule,
      weatherConditions: weather?.conditions,
      travelAdvisory: advisory || undefined,
    };
  });
}

/**
 * Map WeatherResult to the structured output WeatherSnapshot shape.
 * Returns undefined if weather is null (key missing or call failed).
 */
export function toWeatherSnapshot(weather: WeatherResult | null): WeatherSnapshot | undefined {
  if (!weather) return undefined;
  return {
    location: weather.location,
    temperature: weather.temperature,
    conditions: weather.conditions,
    humidity: weather.humidity,
    windSpeed: weather.windSpeed,
  };
}

/**
 * Produce the markdown text lines for the MCP text response.
 */
export function formatTextOutput(
  recommendations: Recommendation[],
  cuisine: string,
  location: string | undefined,
  craving: number,
  weather: WeatherResult | null,
  hour: string | undefined
): string {
  const cravingLabel =
    craving === 100
      ? "🔥 Giovanni's level — only the absolute best will do"
      : craving >= 80
        ? `Very hungry (${craving}/100) — prioritised top-rated spots`
        : craving >= 51
          ? `Properly hungry (${craving}/100) — quality over proximity`
          : craving >= 26
            ? `Mildly hungry (${craving}/100) — balanced pick`
            : `Barely peckish (${craving}/100) — closest option wins`;

  const timeDesc = hour ? ` open at ${hour}` : '';
  const lines = [
    `**Top ${recommendations.length} ${cuisine} picks${timeDesc} near ${location ?? 'you'}:**`,
    `Craving level: ${cravingLabel}`,
    '',
    ...recommendations.map(
      (r, i) =>
        `${i + 1}. **${r.name}** — ${r.rating}/5 · ${r.distanceKm} km · ${r.address}`
    ),
  ];
  if (weather) lines.push('', `Weather: ${weather.temperature}°C, ${weather.conditions}`);
  return lines.join('\n');
}
```

- [ ] **Step 8: Verify TypeScript compiles**

```bash
cd /path/to/project && pnpm build
```

Expected: build succeeds (the new file is not yet imported anywhere, so no breakage).

- [ ] **Step 9: Commit**

```bash
git add src/services/meal-planner.ts
git commit -m "feat: add meal-planner service with extracted domain functions"
```

---

## Task 2: Refactor `src/tools.ts` to use `meal-planner.ts`

**Files:**
- Modify: `src/tools.ts`

Replace the 260-line inline handler with ~40 lines of orchestration that calls `meal-planner.ts`.

- [ ] **Step 1: Update imports at the top of `src/tools.ts`**

Replace the existing import block (lines 1–33) with:

```typescript
/**
 * Meal Planner MCP — Tools
 *
 * Tool definitions for the meal planner MCP server.
 *
 * @see https://modelcontextprotocol.io/docs/concepts/tools
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  resolveLocation,
  searchRestaurants,
  ipToLatLng,
  geolocateViaGoogle,
} from './services/google-places.js';
import { getWeather, fetchWeatherByCoords, classifyWeather } from './services/openweather.js';
import {
  parseHour,
  sortRestaurants,
  filterOpenCandidates,
  resolvePhotoUrls,
  buildRecommendations,
  toWeatherSnapshot,
  formatTextOutput,
} from './services/meal-planner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DIST_DIR = __filename.endsWith('.ts') ? join(__dirname, '..', 'dist') : __dirname;

interface ExtraMetadata {
  requestInfo?: { headers?: Record<string, string | string[] | undefined> };
}
```

- [ ] **Step 2: Replace the `registerMealRecommendationTool` handler**

Find the `registerMealRecommendationTool` function (starting at line ~158). Keep the function signature and everything up to and including the `registerAppTool` call's options object (schema, annotations, `_meta`). Replace only the async handler body with:

```typescript
    async ({ cuisine, location, hour, cravingLevel }, extra) => {
      const craving = cravingLevel ?? 50;
      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (!apiKey?.trim()) {
        return {
          content: [{ type: 'text', text: 'Google Maps API is not configured. Set GOOGLE_MAPS_API_KEY in your .env.' }],
          isError: true,
        };
      }

      // Resolve effective location: elicitation → provided value → IP → Google fallback
      let effectiveLocation = location;
      if (!effectiveLocation?.trim()) {
        try {
          const elicit = await server.server.elicitInput({
            mode: 'form',
            message:
              'Providing your location would improve recommendations. ' +
              'Please share a city, address, or neighbourhood so we can find the best spots nearby.',
            requestedSchema: {
              type: 'object',
              properties: {
                location: {
                  type: 'string',
                  title: 'Location',
                  description: 'City, address, or neighbourhood (e.g. "Buikslotermeerplein, Amsterdam")',
                },
              },
              required: ['location'],
            },
          });
          if (elicit.action === 'accept' && elicit.content) {
            const loc = (elicit.content as { location?: string }).location;
            if (loc?.trim()) effectiveLocation = loc;
          }
        } catch {
          // Elicitation not supported by client — fall through to IP/geolocation
        }
      }

      let coords: { lat: number; lng: number } | null = null;
      if (effectiveLocation?.trim()) {
        coords = await resolveLocation(effectiveLocation, apiKey);
      } else {
        const headers = (extra as ExtraMetadata).requestInfo?.headers;
        const ip =
          (headers?.['x-client-ip'] as string) ||
          (headers?.['x-forwarded-for'] as string) ||
          '';
        if (ip) coords = ipToLatLng(ip);
        if (!coords) coords = await geolocateViaGoogle(apiKey);
      }

      if (!coords) {
        return {
          content: [{ type: 'text', text: 'Could not determine your location. Please provide a city name, full address, or "lat,lng" (e.g. 52.52,13.405).' }],
          isError: true,
        };
      }

      const hhmm = parseHour(hour);
      if (hhmm instanceof Error) {
        return { content: [{ type: 'text', text: hhmm.message }], isError: true };
      }

      const weatherKey = process.env.OPEN_WEATHER_API_KEY;
      const [restaurantResult, weatherResult] = await Promise.allSettled([
        searchRestaurants(cuisine, coords.lat, coords.lng, apiKey),
        weatherKey?.trim()
          ? fetchWeatherByCoords(coords.lat, coords.lng, effectiveLocation ?? '', weatherKey)
          : Promise.reject(new Error('no key')),
      ]);

      if (restaurantResult.status === 'rejected') {
        const message =
          restaurantResult.reason instanceof Error
            ? restaurantResult.reason.message
            : String(restaurantResult.reason);
        return { content: [{ type: 'text', text: `Failed to search restaurants: ${message}` }], isError: true };
      }

      const restaurants = restaurantResult.value;
      if (restaurants.length === 0) {
        return {
          content: [{ type: 'text', text: `No restaurant found for cuisine "${cuisine}" near ${effectiveLocation ?? 'your location'}.` }],
          isError: true,
        };
      }

      const weather = weatherResult.status === 'fulfilled' ? weatherResult.value : null;
      const sorted = sortRestaurants(restaurants, craving, classifyWeather(weather?.conditions ?? ''));
      const openPlaces = await filterOpenCandidates(sorted, apiKey, hhmm, new Date().getDay());

      if (openPlaces.length === 0) {
        const timeDesc = hour ? `open at ${hour}` : 'currently open';
        return {
          content: [{ type: 'text', text: `No ${cuisine} restaurant ${timeDesc} found near ${effectiveLocation ?? 'your location'}. Try a different time or cuisine.` }],
          isError: true,
        };
      }

      const top5 = openPlaces.slice(0, 5);
      const photoUrls = await resolvePhotoUrls(top5, apiKey);
      const recommendations = buildRecommendations(top5, photoUrls, weather);

      return {
        content: [{ type: 'text', text: formatTextOutput(recommendations, cuisine, effectiveLocation, craving, weather, hour) }],
        structuredContent: {
          recommendations,
          weather: toWeatherSnapshot(weather),
          cravingLevel: craving,
        },
      };
    }
```

Also remove the now-deleted `buildTravelAdvisory` standalone function (lines ~130–151 in the original).

- [ ] **Step 3: Verify the build passes**

```bash
pnpm build
```

Expected: TypeScript compiles without errors. Server-side build should complete cleanly.

- [ ] **Step 4: Verify lint passes**

```bash
pnpm lint
```

Expected: No ESLint errors.

- [ ] **Step 5: Commit**

```bash
git add src/tools.ts
git commit -m "refactor: slim tools.ts handler to orchestration, delegate logic to meal-planner"
```

---

## Task 3: Create `src/ui/weather-utils.ts`

**Files:**
- Create: `src/ui/weather-utils.ts`

Single source of truth for weather presentation — replaces the duplicated constants, functions, and types in both TSX files.

- [ ] **Step 1: Create `src/ui/weather-utils.ts`**

```typescript
/**
 * Shared weather presentation utilities.
 *
 * Used by both mcp-app.tsx (weather tool UI) and mcp-app-meal.tsx (meal tool UI).
 * Eliminates the duplicate WEATHER_PHOTOS map, theme function, and types.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Returned by the get_weather tool via structuredContent. Has a `unit` field. */
export interface WeatherData {
  location: string;
  temperature: number;
  unit: string;
  conditions: string;
  humidity: number;
  windSpeed: number;
}

/** Embedded in the recommend_meal tool output. No `unit` field. */
export interface WeatherSnapshot {
  location: string;
  temperature: number;
  conditions: string;
  humidity: number;
  windSpeed: number;
}

// ---------------------------------------------------------------------------
// Photo map
// ---------------------------------------------------------------------------

/**
 * Curated Unsplash photo IDs per weather condition.
 * Stable CDN URLs — no API key needed.
 */
export const WEATHER_PHOTOS: Array<[string, string]> = [
  ['thunder', 'photo-1429552077091-836152271555'],
  ['storm',   'photo-1429552077091-836152271555'],
  ['snow',    'photo-1491002052546-bf38f186af56'],
  ['sleet',   'photo-1491002052546-bf38f186af56'],
  ['blizzard','photo-1491002052546-bf38f186af56'],
  ['rain',    'photo-1519692933481-e162a57d6721'],
  ['drizzle', 'photo-1519692933481-e162a57d6721'],
  ['fog',     'photo-1495107334309-fcf20504a5ab'],
  ['mist',    'photo-1495107334309-fcf20504a5ab'],
  ['haze',    'photo-1495107334309-fcf20504a5ab'],
  ['cloud',   'photo-1534088568595-a066f410bcda'],
  ['overcast','photo-1534088568595-a066f410bcda'],
  ['clear',   'photo-1507003211169-0a1dd7228f2d'],
  ['sunny',   'photo-1507003211169-0a1dd7228f2d'],
];

export function getWeatherPhotoUrl(conditions: string): string | null {
  const c = conditions.toLowerCase();
  for (const [key, id] of WEATHER_PHOTOS) {
    if (c.includes(key)) {
      return `https://images.unsplash.com/${id}?w=900&q=80&auto=format&fit=crop`;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

export interface WeatherTheme {
  emoji: string;
  gradient: string;
}

export function getWeatherTheme(conditions: string): WeatherTheme {
  const c = conditions.toLowerCase();
  if (c.includes('thunder') || c.includes('storm'))
    return { emoji: '⛈️', gradient: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)' };
  if (c.includes('snow') || c.includes('sleet') || c.includes('blizzard'))
    return { emoji: '❄️', gradient: 'linear-gradient(135deg, #83a4d4 0%, #b6fbff 100%)' };
  if (c.includes('rain'))
    return { emoji: '🌧️', gradient: 'linear-gradient(135deg, #373B44 0%, #4286f4 100%)' };
  if (c.includes('drizzle'))
    return { emoji: '🌦️', gradient: 'linear-gradient(135deg, #4b6cb7 0%, #182848 100%)' };
  if (c.includes('fog') || c.includes('mist') || c.includes('haze'))
    return { emoji: '🌫️', gradient: 'linear-gradient(135deg, #8e9eab 0%, #c8d6df 100%)' };
  if (c.includes('cloud') || c.includes('overcast'))
    return { emoji: '☁️', gradient: 'linear-gradient(135deg, #616161 0%, #9bc5c3 100%)' };
  if (c.includes('wind'))
    return { emoji: '💨', gradient: 'linear-gradient(135deg, #56CCF2 0%, #2F80ED 100%)' };
  return { emoji: '☀️', gradient: 'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)' };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/weather-utils.ts
git commit -m "feat: add shared weather-utils module for UI"
```

---

## Task 4: Create `src/ui/WeatherCard.tsx`

**Files:**
- Create: `src/ui/WeatherCard.tsx`

Unified weather card with `variant: 'full' | 'compact'`. Replaces the two separate `WeatherCard` components in `mcp-app.tsx` and `mcp-app-meal.tsx`.

- [ ] **Step 1: Create `src/ui/WeatherCard.tsx`**

```tsx
/**
 * Unified WeatherCard component.
 *
 * variant="full"    — fullscreen background card used in mcp-app.tsx.
 *                     Requires `app` and `inputCity` props for the refresh button.
 * variant="compact" — horizontal pill card used in mcp-app-meal.tsx.
 *                     No refresh button; no app/inputCity props needed.
 */
import type { App } from '@modelcontextprotocol/ext-apps';
import { useCallback, useState } from 'react';
import { getWeatherPhotoUrl, getWeatherTheme } from './weather-utils';
import type { WeatherData, WeatherSnapshot } from './weather-utils';

// ---------------------------------------------------------------------------
// Props — discriminated union so TypeScript enforces variant-specific props
// ---------------------------------------------------------------------------

type FullProps = {
  variant: 'full';
  weather: WeatherData;
  inputCity: string;
  app: App;
};

type CompactProps = {
  variant: 'compact';
  weather: WeatherSnapshot;
};

export type WeatherCardProps = FullProps | CompactProps;

// ---------------------------------------------------------------------------
// Full card (mcp-app.tsx)
// ---------------------------------------------------------------------------

function FullWeatherCard({ weather, inputCity, app }: Omit<FullProps, 'variant'>) {
  const [loading, setLoading] = useState(false);
  const { emoji, gradient } = getWeatherTheme(weather.conditions);
  const photoUrl = getWeatherPhotoUrl(weather.conditions);

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    try {
      await app.callServerTool({ name: 'get_weather', arguments: { city: inputCity } });
    } catch (e) {
      console.error('Refresh failed:', e);
    } finally {
      setLoading(false);
    }
  }, [app, inputCity]);

  return (
    <div
      style={{
        background: photoUrl ? `url(${photoUrl}) center/cover no-repeat` : gradient,
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        position: 'relative',
      }}
    >
      {photoUrl && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.2) 100%)',
        }} />
      )}
      <div className="card" style={{ position: 'relative', zIndex: 1 }}>
        <div className="card-left">
          <span className="emoji">{emoji}</span>
          <div className="temp">
            {weather.temperature}
            <span className="unit">°C</span>
          </div>
        </div>
        <div className="vdivider" />
        <div className="card-right">
          <div className="city">{weather.location}</div>
          <div className="conditions">{weather.conditions}</div>
          <div className="stats">
            <div>
              <div className="stat-value">{weather.humidity}%</div>
              <div className="stat-label">Humidity</div>
            </div>
            <div>
              <div className="stat-value">{weather.windSpeed} m/s</div>
              <div className="stat-label">Wind</div>
            </div>
          </div>
          <button className="btn" onClick={handleRefresh} disabled={loading}>
            {loading ? 'Refreshing…' : '↻  Refresh'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compact card (mcp-app-meal.tsx)
// ---------------------------------------------------------------------------

function CompactWeatherCard({ weather }: Omit<CompactProps, 'variant'>) {
  const { emoji, gradient } = getWeatherTheme(weather.conditions);
  const photoUrl = getWeatherPhotoUrl(weather.conditions);

  return (
    <div
      style={{
        background: photoUrl ? `url(${photoUrl}) center/cover no-repeat` : gradient,
        borderRadius: 16,
        padding: '16px 20px',
        width: '100%',
        maxWidth: 420,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {photoUrl && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, rgba(0,0,0,0.50) 0%, rgba(0,0,0,0.25) 100%)',
        }} />
      )}
      <span style={{ fontSize: 44, lineHeight: 1, flexShrink: 0, position: 'relative', zIndex: 1 }}>{emoji}</span>
      <div style={{ flex: 1, position: 'relative', zIndex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '1.2px', textTransform: 'uppercase', opacity: 0.85 }}>
          {weather.location}
        </div>
        <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.1, letterSpacing: -1 }}>
          {weather.temperature}
          <span style={{ fontSize: 16, fontWeight: 300, verticalAlign: 'super' }}>°C</span>
        </div>
        <div style={{ fontSize: 13, textTransform: 'capitalize', opacity: 0.9, marginTop: 2 }}>
          {weather.conditions}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'right', flexShrink: 0, position: 'relative', zIndex: 1 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{weather.humidity}%</div>
          <div style={{ fontSize: 10, opacity: 0.72, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Humidity</div>
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{weather.windSpeed} m/s</div>
          <div style={{ fontSize: 10, opacity: 0.72, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Wind</div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public export — dispatches by variant
// ---------------------------------------------------------------------------

export function WeatherCard(props: WeatherCardProps) {
  if (props.variant === 'full') {
    return <FullWeatherCard weather={props.weather} inputCity={props.inputCity} app={props.app} />;
  }
  return <CompactWeatherCard weather={props.weather} />;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/WeatherCard.tsx
git commit -m "feat: add shared WeatherCard component with full/compact variants"
```

---

## Task 5: Create `src/ui/CravingMeter.tsx`

**Files:**
- Create: `src/ui/CravingMeter.tsx`

- [ ] **Step 1: Create `src/ui/CravingMeter.tsx`**

```tsx
/**
 * Craving level display — shows a fire-meter and label based on hunger 1–100.
 */

interface CravingMeterProps {
  level: number;
}

export function CravingMeter({ level }: CravingMeterProps) {
  const isGiovanni = level === 100;
  const filled = Math.round((level / 100) * 5);
  const fires = '🔥'.repeat(filled) + '🫥'.repeat(5 - filled);

  const label =
    isGiovanni   ? "Giovanni's level"    :
    level >= 80  ? 'Very hungry'         :
    level >= 51  ? 'Properly hungry'     :
    level >= 26  ? 'Mildly hungry'       :
                   'Barely peckish';

  const color =
    isGiovanni  ? '#c5221f' :
    level >= 80 ? '#ea4335' :
    level >= 51 ? '#f59e0b' :
    level >= 26 ? '#34a853' :
                  '#70757a';

  const bg =
    isGiovanni  ? '#fce8e6' :
    level >= 80 ? '#fdecea' :
    level >= 51 ? '#fef3c7' :
    level >= 26 ? '#e6f4ea' :
                  '#f1f3f4';

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#3c4043' }}>Craving level</span>
        <span style={{ fontSize: 18, letterSpacing: 2 }}>{fires}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 100,
          color, background: bg,
          ...(isGiovanni ? { animation: 'none', fontStyle: 'italic' } : {}),
        }}>
          {isGiovanni ? '🔥 ' : ''}{label}
        </span>
        <span style={{ fontSize: 11, color: '#9aa0a6' }}>{level} / 100</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/CravingMeter.tsx
git commit -m "feat: extract CravingMeter as standalone component"
```

---

## Task 6: Create `src/ui/PopularTimes.tsx`

**Files:**
- Create: `src/ui/PopularTimes.tsx`

- [ ] **Step 1: Create `src/ui/PopularTimes.tsx`**

```tsx
/**
 * Popular times bar chart — heuristic busyness for a typical restaurant.
 * No props; reads current time internally.
 */

// ---------------------------------------------------------------------------
// Busyness data (module-private)
// ---------------------------------------------------------------------------

interface RushStatus {
  level: 'low' | 'medium' | 'high';
  label: string;
  color: string;
  bg: string;
}

function busynessAt(hour: number, isWeekend: boolean): number {
  const weekday: Record<number, number> = {
    9: 1, 10: 2, 11: 4, 12: 9, 13: 10, 14: 7, 15: 3,
    16: 2, 17: 4, 18: 8, 19: 10, 20: 9, 21: 6, 22: 3,
  };
  const weekend: Record<number, number> = {
    9: 2, 10: 4, 11: 6, 12: 8, 13: 9, 14: 8, 15: 6,
    16: 4, 17: 5, 18: 7, 19: 10, 20: 10, 21: 7, 22: 4,
  };
  return (isWeekend ? weekend : weekday)[hour] ?? 0;
}

function getRushStatus(): RushStatus {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;
  const t = h + m / 60;

  const lunchStart = isWeekend ? 12 : 11.5;
  const lunchEnd = isWeekend ? 14.5 : 14;
  if (t >= lunchStart && t < lunchEnd)
    return { level: 'high', label: 'Lunch rush', color: '#c5221f', bg: '#fce8e6' };
  if (t >= 18 && t < 21)
    return { level: 'high', label: 'Dinner rush', color: '#c5221f', bg: '#fce8e6' };
  if ((t >= 11 && t < lunchStart) || (t >= 17 && t < 18))
    return { level: 'medium', label: 'Getting busier', color: '#b45309', bg: '#fef3c7' };

  return { level: 'low', label: 'Usually not busy', color: '#188038', bg: '#e6f4ea' };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PopularTimes() {
  const now = new Date();
  const currentHour = now.getHours();
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;
  const rush = getRushStatus();
  const hours = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

  return (
    <div style={{ marginTop: 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#3c4043' }}>Popular times</span>
        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 100, color: rush.color, background: rush.bg }}>
          {rush.level === 'high' ? '🔴' : rush.level === 'medium' ? '🟡' : '🟢'} {rush.label}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 36 }}>
        {hours.map((h) => {
          const busy = busynessAt(h, isWeekend);
          const isCurrent = h === currentHour;
          const barHeight = Math.max(4, Math.round((busy / 10) * 32));
          return (
            <div
              key={h}
              title={`${h}:00`}
              style={{
                flex: 1,
                height: barHeight,
                borderRadius: '3px 3px 0 0',
                background: isCurrent
                  ? rush.level === 'high' ? '#c5221f'
                    : rush.level === 'medium' ? '#f59e0b'
                    : '#188038'
                  : '#dadce0',
                transition: 'height 0.2s',
                cursor: 'default',
              }}
            />
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 3, marginTop: 3 }}>
        {hours.map((h) => (
          <div
            key={h}
            style={{
              flex: 1,
              fontSize: 8,
              textAlign: 'center',
              color: h === currentHour ? '#1a73e8' : '#9aa0a6',
              fontWeight: h === currentHour ? 700 : 400,
            }}
          >
            {h === 12 ? '12p' : h > 12 ? `${h - 12}p` : `${h}a`}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/PopularTimes.tsx
git commit -m "feat: extract PopularTimes as standalone component"
```

---

## Task 7: Update `src/mcp-app.tsx`

**Files:**
- Modify: `src/mcp-app.tsx`

Remove the duplicated weather code and inline `WeatherCard`; import from `src/ui/`.

- [ ] **Step 1: Replace the file content**

Replace the entire file with:

```tsx
/**
 * Weather MCP App UI — rendered inside the host when get_weather is called.
 * Uses @modelcontextprotocol/ext-apps React SDK.
 */
import type { App } from '@modelcontextprotocol/ext-apps';
import { useApp } from '@modelcontextprotocol/ext-apps/react';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { WeatherCard } from './ui/WeatherCard';
import type { WeatherData } from './ui/weather-utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseWeather(result: CallToolResult): WeatherData | null {
  if (result.structuredContent && 'temperature' in result.structuredContent) {
    return result.structuredContent as unknown as WeatherData;
  }
  const item = result.content?.find((c) => c.type === 'text');
  if (!item || item.type !== 'text') return null;
  try {
    return JSON.parse(item.text) as WeatherData;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Root app component
// ---------------------------------------------------------------------------

function WeatherApp() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [inputCity, setInputCity] = useState('');

  const { app, error } = useApp({
    appInfo: { name: 'Weather App', version: '1.0.0' },
    capabilities: {},
    onAppCreated: (app) => {
      app.ontoolinput = async (input) => {
        const city = (input.arguments as Record<string, unknown>)?.city;
        if (typeof city === 'string') setInputCity(city);
      };
      app.ontoolresult = async (result) => {
        const data = parseWeather(result);
        if (data) setWeather(data);
      };
      app.ontoolcancelled = (params) => {
        console.info('Tool cancelled:', params.reason);
      };
      app.onerror = console.error;
    },
  });

  useEffect(() => {
    if (!app) return;
    const ctx = app.getHostContext();
    if (ctx?.toolResult) {
      const data = parseWeather(ctx.toolResult as CallToolResult);
      if (data) setWeather(data);
    }
  }, [app]);

  if (error)
    return (
      <div className="status" style={{ color: '#f87171' }}>
        Error: {error.message}
      </div>
    );

  if (!app || !weather)
    return (
      <div
        className="status"
        style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', height: '100vh' }}
      >
        {!app ? 'Connecting…' : 'Loading weather…'}
      </div>
    );

  return <WeatherCard variant="full" weather={weather} inputCity={inputCity} app={app} />;
}

// ---------------------------------------------------------------------------
// Mount
// ---------------------------------------------------------------------------

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WeatherApp />
  </StrictMode>,
);
```

- [ ] **Step 2: Build the UI to verify**

```bash
pnpm build:ui
```

Expected: Both `mcp-app.html` and `mcp-app-meal.html` bundles build without errors.

- [ ] **Step 3: Commit**

```bash
git add src/mcp-app.tsx
git commit -m "refactor: mcp-app.tsx — remove duplicated weather code, import from ui/"
```

---

## Task 8: Update `src/mcp-app-meal.tsx`

**Files:**
- Modify: `src/mcp-app-meal.tsx`

Remove duplicated weather code and inline components; import from `src/ui/`.

- [ ] **Step 1: Replace the file content**

Replace the entire file with:

```tsx
/**
 * Restaurant Recommendation MCP App UI
 * Google Maps-inspired carousel using @modelcontextprotocol/ext-apps React SDK.
 */
import type { App } from '@modelcontextprotocol/ext-apps';
import { useApp } from '@modelcontextprotocol/ext-apps/react';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { StrictMode, useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { WeatherCard } from './ui/WeatherCard';
import { CravingMeter } from './ui/CravingMeter';
import { PopularTimes } from './ui/PopularTimes';
import type { WeatherSnapshot } from './ui/weather-utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Recommendation {
  name: string;
  cuisine: string;
  address: string;
  rating: number;
  distanceKm: number;
  openNow: boolean;
  openingHours?: string;
  weatherConditions?: string;
  travelAdvisory?: string;
  placeId?: string;
  photoUrl?: string;
}

interface MealData {
  recommendations: Recommendation[];
  weather?: WeatherSnapshot;
  cravingLevel?: number;
}

interface InputArgs {
  cuisine?: string;
  location?: string;
  hour?: string;
}

// ---------------------------------------------------------------------------
// Cuisine theme
// ---------------------------------------------------------------------------

interface CuisineTheme {
  emoji: string;
  gradient: string;
}

function getCuisineTheme(cuisine: string): CuisineTheme {
  const c = cuisine.toLowerCase();
  if (c.includes('italian') || c.includes('pizza') || c.includes('pasta'))
    return { emoji: '🍝', gradient: 'linear-gradient(135deg, #c62828 0%, #e57373 100%)' };
  if (c.includes('japanese') || c.includes('sushi') || c.includes('ramen'))
    return { emoji: '🍣', gradient: 'linear-gradient(135deg, #283593 0%, #7986cb 100%)' };
  if (c.includes('mexican') || c.includes('taco') || c.includes('burrito'))
    return { emoji: '🌮', gradient: 'linear-gradient(135deg, #e65100 0%, #ffb74d 100%)' };
  if (c.includes('thai'))
    return { emoji: '🍜', gradient: 'linear-gradient(135deg, #1b5e20 0%, #66bb6a 100%)' };
  if (c.includes('chinese') || c.includes('dim sum'))
    return { emoji: '🥟', gradient: 'linear-gradient(135deg, #b71c1c 0%, #ef9a9a 100%)' };
  if (c.includes('indian') || c.includes('curry'))
    return { emoji: '🍛', gradient: 'linear-gradient(135deg, #bf360c 0%, #ff8a65 100%)' };
  if (c.includes('french'))
    return { emoji: '🥐', gradient: 'linear-gradient(135deg, #0d47a1 0%, #64b5f6 100%)' };
  if (c.includes('burger') || c.includes('american'))
    return { emoji: '🍔', gradient: 'linear-gradient(135deg, #4e342e 0%, #a1887f 100%)' };
  if (c.includes('greek'))
    return { emoji: '🫒', gradient: 'linear-gradient(135deg, #004d40 0%, #4db6ac 100%)' };
  if (c.includes('korean'))
    return { emoji: '🥩', gradient: 'linear-gradient(135deg, #880e4f 0%, #f48fb1 100%)' };
  if (c.includes('vietnamese') || c.includes('pho'))
    return { emoji: '🍲', gradient: 'linear-gradient(135deg, #33691e 0%, #aed581 100%)' };
  if (c.includes('spanish') || c.includes('tapas'))
    return { emoji: '🥘', gradient: 'linear-gradient(135deg, #f57f17 0%, #fff176 100%)' };
  return { emoji: '🍽️', gradient: 'linear-gradient(135deg, #01579b 0%, #4fc3f7 100%)' };
}

// ---------------------------------------------------------------------------
// Browser geolocation hook
// ---------------------------------------------------------------------------

type LocationSource = 'gps' | 'approximate' | 'pending';

interface BrowserLocation {
  coords: { lat: number; lng: number } | null;
  source: LocationSource;
}

function useBrowserLocation(): BrowserLocation {
  const [state, setState] = useState<BrowserLocation>({ coords: null, source: 'pending' });

  useEffect(() => {
    if (!navigator.geolocation) {
      setState({ coords: null, source: 'approximate' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setState({ coords: { lat: pos.coords.latitude, lng: pos.coords.longitude }, source: 'gps' }),
      () => setState({ coords: null, source: 'approximate' }),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  return state;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderStars(rating: number): string {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
}

function parseMealData(result: CallToolResult): MealData | null {
  const sc = result.structuredContent;
  if (sc && 'recommendations' in sc && Array.isArray(sc.recommendations)) {
    return sc as unknown as MealData;
  }
  return null;
}

function mapsDirectionsUrl(rec: Recommendation): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(rec.address)}`;
}

function mapsSearchUrl(rec: Recommendation): string {
  if (rec.placeId) return `https://www.google.com/maps/place/?q=place_id:${rec.placeId}`;
  return `https://www.google.com/maps/search/${encodeURIComponent(rec.name + ' ' + rec.address)}`;
}

// ---------------------------------------------------------------------------
// Restaurant card
// ---------------------------------------------------------------------------

interface CardProps {
  rec: Recommendation;
  app: App;
  index: number;
  total: number;
  cravingLevel: number;
}

function RestaurantCard({ rec, app, index, total, cravingLevel }: CardProps) {
  const { emoji, gradient } = getCuisineTheme(rec.cuisine);

  const openLink = useCallback(
    (url: string) => { app.openLink({ url }).catch(console.error); },
    [app]
  );

  const openNowText = rec.openNow ? 'Open now' : 'Closed';
  const firstHourLine = rec.openingHours?.split('\n')[0];

  return (
    <div className="card">
      <div
        className="banner"
        style={
          rec.photoUrl
            ? {
                backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.55) 100%), url(${rec.photoUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : { background: gradient }
        }
      >
        {!rec.photoUrl && <span className="banner-emoji">{emoji}</span>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="cuisine-tag">{rec.cuisine}</span>
          <span className="cuisine-tag" style={{ opacity: 0.85, fontSize: 11 }}>
            {index + 1}/{total}
          </span>
        </div>
      </div>

      <div className="body">
        <div className="name-row">
          <div className="name">{rec.name}</div>
          <div className="rating-pill">
            <span className="star" style={{ color: '#fbbc04' }}>★</span>
            <span className="rating-number">{rec.rating.toFixed(1)}</span>
          </div>
        </div>

        <div style={{ color: '#fbbc04', fontSize: 13, letterSpacing: 1 }}>
          {renderStars(rec.rating)}
        </div>

        <div className="meta-row">
          <span className={`open-badge ${rec.openNow ? 'open' : 'closed'}`}>{openNowText}</span>
          {firstHourLine && (
            <>
              <span className="dot">·</span>
              <span className="meta-text">{firstHourLine}</span>
            </>
          )}
          <span className="dot">·</span>
          <span className="meta-text">{rec.distanceKm.toFixed(1)} km away</span>
        </div>

        <div className="address-row">
          <span className="address-icon">📍</span>
          <span className="address">{rec.address}</span>
        </div>

        <div className="divider" />
        <CravingMeter level={cravingLevel} />

        <div className="divider" />
        <PopularTimes />

        {rec.travelAdvisory && (
          <>
            <div className="divider" />
            <div className="advisory-row">
              <span className="advisory-icon">
                {rec.weatherConditions?.toLowerCase().includes('rain')
                  ? '🌧️'
                  : rec.weatherConditions?.toLowerCase().includes('snow')
                    ? '❄️'
                    : rec.weatherConditions?.toLowerCase().includes('thunder')
                      ? '⛈️'
                      : '🌤️'}
              </span>
              <span className="advisory-text">{rec.travelAdvisory}</span>
            </div>
          </>
        )}

        <div className="divider" />
        <div className="actions">
          <button className="btn btn-primary" onClick={() => openLink(mapsDirectionsUrl(rec))}>
            ↗ Directions
          </button>
          <button className="btn btn-secondary" onClick={() => openLink(mapsSearchUrl(rec))}>
            🗺 Maps
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Carousel
// ---------------------------------------------------------------------------

interface CarouselProps {
  recommendations: Recommendation[];
  app: App;
  cravingLevel: number;
}

function Carousel({ recommendations, app, cravingLevel }: CarouselProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const total = recommendations.length;

  const prev = useCallback(() => setActiveIdx((i) => (i - 1 + total) % total), [total]);
  const next = useCallback(() => setActiveIdx((i) => (i + 1) % total), [total]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [prev, next]);

  if (total === 0) return null;

  return (
    <div style={{ width: '100%', maxWidth: 420, position: 'relative' }}>
      {total > 1 && (
        <>
          <button onClick={prev} className="carousel-arrow carousel-arrow-left" aria-label="Previous">‹</button>
          <button onClick={next} className="carousel-arrow carousel-arrow-right" aria-label="Next">›</button>
        </>
      )}
      <div style={{ overflow: 'hidden', borderRadius: 16 }}>
        <div
          style={{
            display: 'flex',
            transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: `translateX(-${activeIdx * 100}%)`,
          }}
        >
          {recommendations.map((rec, i) => (
            <div key={rec.placeId ?? i} style={{ minWidth: '100%', flexShrink: 0 }}>
              <RestaurantCard rec={rec} app={app} index={i} total={total} cravingLevel={cravingLevel} />
            </div>
          ))}
        </div>
      </div>
      {total > 1 && (
        <div className="carousel-dots">
          {recommendations.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveIdx(i)}
              className={`carousel-dot ${i === activeIdx ? 'active' : ''}`}
              aria-label={`Go to result ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root app component
// ---------------------------------------------------------------------------

function MealApp() {
  const [data, setData] = useState<MealData | null>(null);
  const [inputArgs, setInputArgs] = useState<InputArgs>({});
  const [refreshing, setRefreshing] = useState(false);
  const browserLocation = useBrowserLocation();

  const { app, error } = useApp({
    appInfo: { name: 'Meal Recommendation App', version: '2.0.0' },
    capabilities: {},
    onAppCreated: (app) => {
      app.ontoolinput = async (input) => { setInputArgs((input.arguments as InputArgs) ?? {}); };
      app.ontoolresult = async (result) => {
        const parsed = parseMealData(result);
        if (parsed) setData(parsed);
      };
      app.ontoolcancelled = (params) => { console.info('Tool cancelled:', params.reason); };
      app.onerror = console.error;
    },
  });

  const handleRefresh = useCallback(async () => {
    if (!app || !inputArgs.cuisine) return;
    setRefreshing(true);
    try {
      const args = { ...inputArgs };
      if (browserLocation.coords && !args.location) {
        args.location = `${browserLocation.coords.lat},${browserLocation.coords.lng}`;
      }
      const result = await app.callServerTool({ name: 'recommend_meal', arguments: args });
      const parsed = parseMealData(result);
      if (parsed) setData(parsed);
    } catch (e) {
      console.error('Refresh failed:', e);
    } finally {
      setRefreshing(false);
    }
  }, [app, inputArgs, browserLocation.coords]);

  useEffect(() => {
    if (!app) return;
    const ctx = app.getHostContext();
    if (ctx?.toolResult) {
      const parsed = parseMealData(ctx.toolResult as CallToolResult);
      if (parsed) setData(parsed);
    }
  }, [app]);

  if (error)
    return <div className="status" style={{ color: '#c5221f' }}>Error: {error.message}</div>;

  if (!app || !data)
    return <div className="status">{!app ? 'Connecting…' : 'Finding restaurants…'}</div>;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f1f3f4',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 16,
      }}
    >
      {data.weather && <WeatherCard variant="compact" weather={data.weather} />}
      <Carousel recommendations={data.recommendations} app={app} cravingLevel={data.cravingLevel ?? 50} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
        <span className={`location-badge ${browserLocation.source}`}>
          <span className="location-dot" />
          {browserLocation.source === 'gps'
            ? 'Precise location'
            : browserLocation.source === 'pending'
              ? 'Locating…'
              : 'Approximate location'}
        </span>
        {inputArgs.cuisine && (
          <button className="btn btn-secondary" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? 'Searching…' : '🔄 Search again'}
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mount
// ---------------------------------------------------------------------------

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MealApp />
  </StrictMode>
);
```

- [ ] **Step 2: Full build and lint**

```bash
pnpm build
```

Expected: TypeScript server build + both Vite UI bundles all pass cleanly.

```bash
pnpm lint
```

Expected: No ESLint errors.

- [ ] **Step 3: Commit**

```bash
git add src/mcp-app-meal.tsx
git commit -m "refactor: mcp-app-meal.tsx — import WeatherCard, CravingMeter, PopularTimes from ui/"
```

---

## Final verification

- [ ] **Run full build one more time from clean**

```bash
pnpm build
```

Expected: exits 0 with no TypeScript errors and no Vite bundle errors.

- [ ] **Check line counts to confirm reduction**

```bash
wc -l src/tools.ts src/mcp-app.tsx src/mcp-app-meal.tsx
```

Expected roughly: `tools.ts` ≈ 200 lines (down from 521), `mcp-app.tsx` ≈ 80 lines (down from 241), `mcp-app-meal.tsx` ≈ 280 lines (down from 826).
