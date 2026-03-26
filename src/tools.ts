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
import { join } from 'node:path';
import { importMetaPaths } from './utils/import-meta.js';
import {
  resolveLocation,
  searchRestaurants,
  getPlaceOpeningHours,
  getPlacePhotoUrl,
  isOpenAtHour,
  ipToLatLng,
  geolocateViaGoogle,
} from './services/google-places.js';
import { getWeather, fetchWeatherByCoords, classifyWeather } from './services/openweather.js';

const { __filename, __dirname } = importMetaPaths(import.meta.url);
// When running via tsx (dev), __dirname is src/ — compiled output lives in dist/
const DIST_DIR = __filename.endsWith('.ts') ? join(__dirname, '..', 'dist') : __dirname;

interface ExtraMetadata {
  requestInfo?: { headers?: Record<string, string | string[] | undefined> };
}

/**
 * Register all tools with the server.
 */
export function registerTools(server: McpServer): void {
  registerWeatherTool(server);
  registerMealRecommendationTool(server);
}

// =============================================================================
// Weather tool
// =============================================================================

/**
 * Weather tool backed by OpenWeatherMap with a React MCP App UI.
 *
 * Uses registerAppTool to attach _meta.ui.resourceUri so compatible hosts
 * render the React card automatically.
 */
function registerWeatherTool(server: McpServer): void {
  const resourceUri = 'ui://get-weather/mcp-app.html';

  registerAppTool(
    server,
    'get_weather',
    {
      title: 'Get Weather',
      description: 'Get the current weather for a city or location name.',
      inputSchema: {
        city: z.string().describe('City or location name (e.g. "Berlin", "Tokyo, JP")'),
      },
      _meta: { ui: { resourceUri } },
    },
    async ({ city }) => {
      const apiKey = process.env.OPEN_WEATHER_API_KEY;

      if (!apiKey?.trim()) {
        return {
          content: [
            {
              type: 'text',
              text: 'OpenWeatherMap API is not configured. Set OPEN_WEATHER_API_KEY in your .env file.',
            },
          ],
          isError: true,
        };
      }

      try {
        const weather = await getWeather(city, apiKey);
        const summary =
          `${weather.location}: ${weather.temperature}°C, ${weather.conditions}. ` +
          `Humidity ${weather.humidity}%, wind ${weather.windSpeed} m/s.`;
        return {
          content: [{ type: 'text', text: summary }],
          structuredContent: weather as unknown as Record<string, unknown>,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text', text: `Failed to get weather: ${message}` }],
          isError: true,
        };
      }
    }
  );

  registerAppResource(
    server,
    resourceUri,
    resourceUri,
    { mimeType: RESOURCE_MIME_TYPE },
    async () => {
      const html = await readFile(join(DIST_DIR, 'mcp-app.html'), 'utf-8');
      return {
        contents: [
          {
            uri: resourceUri,
            mimeType: RESOURCE_MIME_TYPE,
            text: html,
            _meta: { ui: { csp: { resourceDomains: ['https://images.unsplash.com'] } } },
          },
        ],
      };
    }
  );
}

// =============================================================================
// Meal recommendation – restaurant by cuisine (Google Maps + weather-aware)
// =============================================================================

/** Build a travel advisory based on weather and distance. */
function buildTravelAdvisory(conditions: string, distanceKm: number): string {
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

/**
 * Meal recommendation tool: find a restaurant matching the given cuisine near
 * the given location. Weather-aware: in bad conditions it prioritises nearby
 * venues and adds a travel advisory.
 */
function registerMealRecommendationTool(server: McpServer): void {
  const resourceUri = 'ui://recommend-meal/mcp-app-meal.html';

  registerAppTool(
    server,
    'recommend_meal',
    {
      title: 'Recommend Meal',
      description:
        'Find a restaurant matching the given cuisine near the given location. ' +
        'Weather-aware: fetches current conditions and adjusts picks accordingly. ' +
        'Craving-aware: higher craving → prioritises top-rated spots over proximity. ' +
        'Optionally pass an hour (HH:MM) to filter by places open at that time.',
      inputSchema: {
        cuisine: z.string().describe('Type of cuisine (e.g. italian, japanese, mexican, thai)'),
        location: z
          .string()
          .optional()
          .describe(
            'City, address, or "lat,lng" to search near; omit to use client IP as a fallback'
          ),
        hour: z
          .string()
          .optional()
          .describe(
            'Time to check availability (HH:MM 24h, e.g. "14:30"). Omit to use open-now status.'
          ),
        cravingLevel: z
          .number()
          .min(1)
          .max(100)
          .optional()
          .describe(
            'How hungry the user is on a scale of 1–100 (1 = barely peckish, 100 = Giovanni-level starving). ' +
              'Infer from context: "peckish" → 15, "could eat" → 35, "hungry" → 60, "starving" → 85, ' +
              '"haven\'t eaten all day / dying" → 95–100. ' +
              'Ask the user only if the intent is completely ambiguous. Defaults to 50 if omitted.'
          ),
      },
      outputSchema: {
        recommendations: z.array(
          z.object({
            name: z.string(),
            cuisine: z.string(),
            address: z.string(),
            rating: z.number(),
            distanceKm: z.number(),
            openNow: z.boolean(),
            placeId: z.string().optional(),
            photoUrl: z.string().optional(),
            openingHours: z.string().optional(),
            weatherConditions: z.string().optional(),
            travelAdvisory: z.string().optional(),
          })
        ),
        weather: z
          .object({
            location: z.string(),
            temperature: z.number(),
            conditions: z.string(),
            humidity: z.number(),
            windSpeed: z.number(),
          })
          .optional(),
        cravingLevel: z.number(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
      _meta: { ui: { resourceUri } },
    },
    async ({ cuisine, location, hour, cravingLevel }, extra) => {
      const craving = cravingLevel ?? 50;
      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (!apiKey?.trim()) {
        return {
          content: [
            {
              type: 'text',
              text: 'Google Maps API is not configured. Set GOOGLE_MAPS_API_KEY in your .env.',
            },
          ],
          isError: true,
        };
      }

      let effectiveLocation = location;

      // When no location is provided, use elicitation to ask the user
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
                  description:
                    'City, address, or neighbourhood (e.g. "Buikslotermeerplein, Amsterdam")',
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
        const extraTyped = extra as ExtraMetadata;
        const headers = extraTyped.requestInfo?.headers;
        const ip =
          (headers?.['x-client-ip'] as string) || (headers?.['x-forwarded-for'] as string) || '';

        if (ip) {
          coords = ipToLatLng(ip);
        }

        if (!coords) {
          coords = await geolocateViaGoogle(apiKey);
        }
      }

      if (!coords) {
        return {
          content: [
            {
              type: 'text',
              text: `Could not determine your location. Please provide a city name, full address, or "lat,lng" (e.g. 52.52,13.405).`,
            },
          ],
          isError: true,
        };
      }

      // Fetch restaurants and weather in parallel
      const weatherKey = process.env.OPEN_WEATHER_API_KEY;
      const [restaurantResult, weatherResult] = await Promise.allSettled([
        searchRestaurants(cuisine, coords.lat, coords.lng, apiKey),
        weatherKey?.trim()
          ? fetchWeatherByCoords(
              coords.lat,
              coords.lng,
              effectiveLocation ?? '',
              weatherKey
            )
          : Promise.reject(new Error('no key')),
      ]);

      if (restaurantResult.status === 'rejected') {
        const message =
          restaurantResult.reason instanceof Error
            ? restaurantResult.reason.message
            : String(restaurantResult.reason);
        return {
          content: [{ type: 'text', text: `Failed to search restaurants: ${message}` }],
          isError: true,
        };
      }

      const restaurants = restaurantResult.value;
      if (restaurants.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No restaurant found for cuisine "${cuisine}" near ${effectiveLocation ?? 'your location'}.`,
            },
          ],
          isError: true,
        };
      }

      // Weather context (optional — silently ignored if key missing or call fails)
      const weather = weatherResult.status === 'fulfilled' ? weatherResult.value : null;
      const weatherSeverity = weather ? classifyWeather(weather.conditions) : 'good';

      // Sort strategy driven by craving level:
      //  1–25  → nearest (barely hungry, just want something quick)
      //  26–50 → nearest then best-rated (mild hunger or bad weather)
      //  51–75 → best-rated then nearest (properly hungry, quality matters)
      //  76–100 → pure rating (very hungry / Giovanni mode — brave any distance)
      // Bad weather caps the strategy at 26–50 unless craving ≥ 80.
      const sorted = [...restaurants].sort((a, b) => {
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

      // Validate hour format if provided
      let hhmm: string | null = null;
      const dayOfWeek = new Date().getDay();
      if (hour) {
        const match = hour.match(/^(\d{1,2}):(\d{2})$/);
        if (!match) {
          return {
            content: [
              {
                type: 'text',
                text: `Invalid hour format "${hour}". Use HH:MM in 24h format (e.g. "14:30").`,
              },
            ],
            isError: true,
          };
        }
        hhmm = match[1].padStart(2, '0') + match[2];
      }

      // Fetch opening hours for the top candidates so we can filter to open places.
      // Check more than 5 to increase our chances of finding 5 that are open.
      const candidates = sorted.slice(0, 15);
      const detailResults = await Promise.all(
        candidates.map(async (r) => {
          if (!r.placeId) return { restaurant: r, hours: null };
          const hours = await getPlaceOpeningHours(r.placeId, apiKey);
          return { restaurant: r, hours };
        })
      );

      // Filter to places confirmed open for the timeframe
      const openPlaces = detailResults.filter((d) => {
        if (!d.hours) return false;
        if (hhmm) return isOpenAtHour(d.hours.periods, dayOfWeek, hhmm);
        // No hour specified → use real-time open status from initial search
        return d.restaurant.openNow;
      });

      if (openPlaces.length === 0) {
        const timeDesc = hour ? `open at ${hour}` : 'currently open';
        return {
          content: [
            {
              type: 'text',
              text: `No ${cuisine} restaurant ${timeDesc} found near ${effectiveLocation ?? 'your location'}. Try a different time or cuisine.`,
            },
          ],
          isError: true,
        };
      }

      // Take the top 5 open places
      const top5 = openPlaces.slice(0, 5);

      // Resolve Google Places photo CDN URLs in parallel (fails silently per item)
      const photoUrls = await Promise.all(
        top5.map((d) =>
          d.restaurant.photoReference
            ? getPlacePhotoUrl(d.restaurant.photoReference, apiKey).catch(() => null)
            : Promise.resolve(null)
        )
      );

      const recommendations = top5.map((d, i) => {
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

      const weatherSnapshot = weather
        ? {
            location: weather.location,
            temperature: weather.temperature,
            conditions: weather.conditions,
            humidity: weather.humidity,
            windSpeed: weather.windSpeed,
          }
        : undefined;

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
        `**Top ${recommendations.length} ${cuisine} picks${timeDesc} near ${effectiveLocation ?? 'you'}:**`,
        `Craving level: ${cravingLabel}`,
        '',
        ...recommendations.map(
          (r, i) => `${i + 1}. **${r.name}** — ${r.rating}/5 · ${r.distanceKm} km · ${r.address}`
        ),
      ];
      if (weather) lines.push('', `Weather: ${weather.temperature}°C, ${weather.conditions}`);

      return {
        content: [{ type: 'text', text: lines.join('\n') }],
        structuredContent: { recommendations, weather: weatherSnapshot, cravingLevel: craving },
      };
    }
  );

  registerAppResource(
    server,
    resourceUri,
    resourceUri,
    { mimeType: RESOURCE_MIME_TYPE },
    async () => {
      const html = await readFile(join(DIST_DIR, 'mcp-app-meal.html'), 'utf-8');
      return {
        contents: [
          {
            uri: resourceUri,
            mimeType: RESOURCE_MIME_TYPE,
            text: html,
            _meta: {
              ui: {
                csp: {
                  resourceDomains: [
                    'https://lh3.googleusercontent.com',
                    'https://maps.googleapis.com',
                    'https://images.unsplash.com',
                  ],
                },
              },
            },
          },
        ],
      };
    }
  );
}
