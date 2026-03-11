/**
 * MCP TypeScript Starter - Tools
 *
 * All tool definitions for the MCP server.
 * Tools are functions that the client can invoke to perform actions.
 *
 * ## Tool Annotations
 *
 * Every tool SHOULD have annotations to help AI assistants understand behavior:
 * - readOnlyHint: Tool only reads data, doesn't modify state
 * - destructiveHint: Tool can permanently delete or modify data
 * - idempotentHint: Repeated calls with same args have same effect
 * - openWorldHint: Tool accesses external systems (web, APIs, etc.)
 *
 * ## Schema Conventions
 *
 * NOTE: TypeScript implementation uses Zod for schema validation. Zod v4 only
 * supports `description` for properties, not `title`. This is a language/library
 * limitation compared to other MCP implementations (Python, Go, etc.) that can
 * provide both title and description in JSON schemas.
 *
 * All tool parameters will have:
 * - ✓ description (via .describe())
 * - ✗ title (not supported in Zod v4)
 *
 * ## Implementation Notes
 *
 * ### Schema Differences from Python Reference
 * - TypeScript SDK automatically adds `$schema` field to inputSchema (SDK behavior)
 * - Property `title` fields not supported (Zod v4 limitation)
 * - `outputSchema` is supported via registerTool() method
 * - Icons can be added via _meta field (not yet implemented)
 *
 * ### Task Support
 * - TypeScript SDK may add `execution.taskSupport: forbidden` to tools (SDK default)
 * - This indicates tools run synchronously and don't support task-based execution
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
  getPlaceOpeningHours,
  isOpenAtHour,
  ipToLatLng,
  geolocateViaGoogle,
} from './services/google-places.js';
import { getWeather, fetchWeatherByCoords, classifyWeather } from './services/openweather.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// When running via tsx (dev), __dirname is src/ — compiled output lives in dist/
const DIST_DIR = __filename.endsWith('.ts') ? join(__dirname, '..', 'dist') : __dirname;

let bonusToolLoaded = false;

interface ExtraMetadata {
  requestInfo?: { headers?: Record<string, string | string[] | undefined> };
}

/**
 * Register all tools with the server.
 */
export function registerTools(server: McpServer): void {
  registerHelloTool(server);
  registerWeatherTool(server);
  registerAskLlmTool(server);
  registerLongTaskTool(server);
  registerLoadBonusTool(server);
  registerConfirmActionTool(server);
  registerGetFeedbackTool(server);
  registerTickleMindTool(server);
  registerMealRecommendationTool(server);
}

/**
 * Basic greeting tool with annotations.
 */
function registerHelloTool(server: McpServer): void {
  server.registerTool(
    'hello',
    {
      title: 'Say Hello',
      description: 'Say hello to a person',
      inputSchema: {
        name: z.string().describe('Name of the person to greet'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ name }) => ({
      content: [{ type: 'text', text: `Hello, ${name}! Welcome to MCP.` }],
    })
  );
}

/**
 * Weather tool backed by OpenWeatherMap with a React MCP App UI.
 *
 * Uses registerAppTool to attach _meta.ui.resourceUri so compatible hosts
 * (Claude Desktop, ui-inspector, etc.) render the React card automatically.
 * The tool returns weather as JSON text; the React app (mcp-app.tsx) parses it.
 */
function registerWeatherTool(server: McpServer): void {
  const resourceUri = 'ui://get-weather/mcp-app.html';

  // Register the tool with UI metadata linking it to the React app resource
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

  // Register the bundled React app HTML as an MCP resource
  registerAppResource(
    server,
    resourceUri,
    resourceUri,
    { mimeType: RESOURCE_MIME_TYPE },
    async () => {
      const html = await readFile(join(DIST_DIR, 'mcp-app.html'), 'utf-8');
      return {
        contents: [{ uri: resourceUri, mimeType: RESOURCE_MIME_TYPE, text: html }],
      };
    }
  );
}

/**
 * Tool that invokes LLM sampling.
 */
function registerAskLlmTool(server: McpServer): void {
  server.registerTool(
    'ask_llm',
    {
      title: 'Ask LLM',
      description: 'Ask the connected LLM a question using sampling',
      inputSchema: {
        prompt: z.string().describe('The question or prompt to send to the LLM'),
        maxTokens: z.number().optional().default(100).describe('Maximum tokens in response'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false, // LLM responses vary
        openWorldHint: false, // Uses connected client, not external
      },
    },
    async ({ prompt, maxTokens }) => {
      try {
        const result = await server.server.createMessage({
          messages: [{ role: 'user', content: { type: 'text', text: prompt } }],
          maxTokens: maxTokens ?? 100,
        });

        return {
          content: [
            {
              type: 'text',
              text: `LLM Response: ${result.content.type === 'text' ? result.content.text : '[non-text response]'}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Sampling not supported or failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

/**
 * Long-running task with progress updates.
 */
function registerLongTaskTool(server: McpServer): void {
  server.registerTool(
    'long_task',
    {
      title: 'Long Running Task',
      description: 'Simulate a long-running task with progress updates',
      inputSchema: {
        taskName: z.string().describe('Name for this task'),
        steps: z.number().optional().default(5).describe('Number of steps to simulate'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ taskName, steps }, extra) => {
      const numSteps = steps ?? 5;

      for (let i = 0; i < numSteps; i++) {
        await extra.sendNotification({
          method: 'notifications/progress',
          params: {
            progressToken: 'long_task',
            progress: i / numSteps,
            total: 1.0,
          },
        });
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      return {
        content: [
          {
            type: 'text',
            text: `Task "${taskName}" completed successfully after ${numSteps} steps!`,
          },
        ],
      };
    }
  );
}

/**
 * Tool that dynamically loads another tool at runtime.
 */
function registerLoadBonusTool(server: McpServer): void {
  server.registerTool(
    'load_bonus_tool',
    {
      title: 'Load Bonus Tool',
      description: 'Dynamically register a new bonus tool',
      inputSchema: {},
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true, // Loading twice is safe
        openWorldHint: false,
      },
    },
    async (_args, extra) => {
      if (bonusToolLoaded) {
        return {
          content: [
            { type: 'text', text: "Bonus tool is already loaded! Try calling 'bonus_calculator'." },
          ],
        };
      }

      // Register the bonus calculator with structured configuration and outputSchema
      server.registerTool(
        'bonus_calculator',
        {
          title: 'Bonus Calculator',
          description: 'A calculator that was dynamically loaded',
          inputSchema: {
            a: z.number().describe('First number'),
            b: z.number().describe('Second number'),
            operation: z
              .enum(['add', 'subtract', 'multiply', 'divide'])
              .describe('Mathematical operation'),
          },
          outputSchema: {
            result: z.number(),
            operation: z.string(),
          },
          annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
          },
        },
        async ({ a, b, operation }) => {
          const ops: Record<string, number> = {
            add: a + b,
            subtract: a - b,
            multiply: a * b,
            divide: b !== 0 ? a / b : NaN,
          };
          const result = ops[operation];
          return {
            content: [{ type: 'text', text: `${a} ${operation} ${b} = ${result}` }],
            structuredContent: { result, operation },
          };
        }
      );

      bonusToolLoaded = true;

      // Notify clients that the tools list has changed
      await extra.sendNotification({
        method: 'notifications/tools/list_changed',
        params: {},
      });

      return {
        content: [
          {
            type: 'text',
            text: "Bonus tool 'bonus_calculator' has been loaded! The tools list has been updated.",
          },
        ],
      };
    }
  );
}

// =============================================================================
// Elicitation Tools - Request user input during tool execution
//
// WHY ELICITATION MATTERS:
// Elicitation allows tools to request additional information from users
// mid-execution, enabling interactive workflows. This is essential for:
//   - Confirming destructive actions before they happen
//   - Gathering missing parameters that weren't provided upfront
//   - Implementing approval workflows for sensitive operations
//   - Collecting feedback or additional context during execution
//
// TWO ELICITATION MODES:
// - Form (schema): Display a structured form with typed fields in the client
// - URL: Open a web page (e.g., OAuth flow, feedback form, documentation)
//
// RESPONSE ACTIONS:
// - "accept": User provided the requested information
// - "decline": User explicitly refused to provide information
// - "cancel": User dismissed the request without responding
// =============================================================================

/**
 * Tool that demonstrates form elicitation - requests user confirmation.
 */
function registerConfirmActionTool(server: McpServer): void {
  server.registerTool(
    'confirm_action',
    {
      title: 'Confirm Action',
      description: 'Request user confirmation before proceeding',
      inputSchema: {
        action: z.string().describe('Description of the action to confirm'),
        destructive: z
          .boolean()
          .optional()
          .default(false)
          .describe('Whether the action is destructive'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false, // User response varies
        openWorldHint: false,
      },
    },
    async ({ action, destructive }) => {
      try {
        // Form elicitation: Display a structured form with typed fields
        // The client renders this as a dialog/form based on the JSON schema
        const warningText = destructive ? ' (WARNING: This action is destructive!)' : '';
        const result = await server.server.elicitInput({
          mode: 'form',
          message: `Please confirm: ${action}${warningText}`,
          requestedSchema: {
            type: 'object',
            properties: {
              confirm: {
                type: 'boolean',
                title: 'Confirm',
                description: 'Confirm the action',
              },
              reason: {
                type: 'string',
                title: 'Reason',
                description: 'Optional reason for your choice',
              },
            },
            required: ['confirm'],
          },
        });

        if (result.action === 'accept') {
          const content = result.content ?? {};
          if (content.confirm) {
            const reason = (content.reason as string) || 'No reason provided';
            return {
              content: [{ type: 'text', text: `Action confirmed: ${action}\nReason: ${reason}` }],
            };
          }
          return {
            content: [{ type: 'text', text: `Action declined by user: ${action}` }],
          };
        } else if (result.action === 'decline') {
          return {
            content: [{ type: 'text', text: `User declined to respond for: ${action}` }],
          };
        } else {
          return {
            content: [{ type: 'text', text: `User cancelled elicitation for: ${action}` }],
          };
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Elicitation not supported or failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

/**
 * Tool that demonstrates URL elicitation - opens feedback form in browser.
 */
function registerGetFeedbackTool(server: McpServer): void {
  server.registerTool(
    'get_feedback',
    {
      title: 'Get Feedback',
      description: 'Request feedback from the user',
      inputSchema: {
        question: z.string().describe('The question to ask the user'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false, // User response varies
        openWorldHint: true, // Opens external URL
      },
    },
    async ({ question }) => {
      const feedbackUrl =
        'https://github.com/SamMorrowDrums/mcp-starters/issues/new?template=workshop-feedback.yml&title=' +
        encodeURIComponent(question);

      try {
        // URL elicitation: Open a web page in the user's browser
        // Useful for OAuth flows, external forms, documentation links, etc.
        const result = await server.server.elicitInput({
          mode: 'url',
          message: `Please answer this question: ${question}`,
          elicitationId: `feedback-${Date.now()}`,
          url: feedbackUrl,
        });

        if (result.action === 'accept') {
          return {
            content: [
              {
                type: 'text',
                text: 'Thank you for providing your answer!',
              },
            ],
          };
        } else if (result.action === 'decline') {
          return {
            content: [
              {
                type: 'text',
                text: `No problem! You can answer the question anytime at: ${feedbackUrl}`,
              },
            ],
          };
        } else {
          return {
            content: [{ type: 'text', text: 'Feedback request cancelled.' }],
          };
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `URL elicitation not supported or failed: ${error instanceof Error ? error.message : 'Unknown error'}\n\nYou can still answer at: ${feedbackUrl}`,
            },
          ],
        };
      }
    }
  );
}

// =============================================================================
// Easter egg – "something interesting to tickle my mind"
// =============================================================================

/**
 * Easter egg tool: call when the user asks for "something interesting to tickle
 * my mind". Returns a transport message and optionally starts a short
 * interactive sequence in the X dimension.
 */
function registerTickleMindTool(server: McpServer): void {
  server.registerTool(
    'tickle_mind',
    {
      title: 'Tickle Mind (Easter Egg)',
      description: `If user expresses its will for something more interesting, start an Easter egg experience with a short interactive sequence.`,
      inputSchema: {
        dimension: z
          .string()
          .optional()
          .default('X')
          .describe('Name of the dimension to transport to (e.g. "X", "Curiosity", "7th")'),
        interactive: z
          .boolean()
          .optional()
          .default(true)
          .describe('Whether to start the follow-up interaction in the dimension'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ dimension, interactive }) => {
      const transportMessage = `Command acknowledged, transporting you to the ${dimension} dimension.`;

      if (!interactive) {
        return {
          content: [{ type: 'text', text: transportMessage }],
        };
      }

      try {
        const result = await server.server.elicitInput({
          mode: 'form',
          message: `You have arrived in the ${dimension} dimension. What do you see? (Optional: describe it to continue the journey.)`,
          requestedSchema: {
            type: 'object',
            properties: {
              observation: {
                type: 'string',
                title: 'What do you see?',
                description: 'Describe what you see in this dimension',
              },
              stayLonger: {
                type: 'boolean',
                title: 'Stay longer?',
                description: 'Would you like to explore more?',
              },
            },
            required: [],
          },
        });

        if (result.action === 'accept' && result.content) {
          const obs = (result.content as { observation?: string }).observation;
          const stay = (result.content as { stayLonger?: boolean }).stayLonger;
          const parts = [
            transportMessage,
            '',
            '---',
            obs ? `Your observation: "${obs}"` : 'You took in the view without leaving a note.',
            stay
              ? 'You chose to stay and explore further. The dimension hums with possibility.'
              : 'You returned when ready. Safe travels.',
          ];
          return {
            content: [{ type: 'text', text: parts.join('\n') }],
          };
        }

        if (result.action === 'decline') {
          return {
            content: [
              {
                type: 'text',
                text: `${transportMessage}\n\nYou declined to share your experience. The ${dimension} dimension remains a mystery.`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `${transportMessage}\n\nYou closed the portal. Until next time.`,
            },
          ],
        };
      } catch {
        return {
          content: [{ type: 'text', text: transportMessage }],
        };
      }
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
        'Weather-aware: fetches current conditions and adjusts the pick and travel advice accordingly. ' +
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
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
      _meta: { ui: { resourceUri } },
    },
    async ({ cuisine, location, hour }, extra) => {
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

      let coords: { lat: number; lng: number } | null = null;
      if (location?.trim()) {
        coords = await resolveLocation(location, apiKey);
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
              location ?? '' /* fallback to google fn to get location from coords */,
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
              text: `No restaurant found for cuisine "${cuisine}" near ${location}.`,
            },
          ],
          isError: true,
        };
      }

      // Weather context (optional — silently ignored if key missing or call fails)
      const weather = weatherResult.status === 'fulfilled' ? weatherResult.value : null;
      const weatherSeverity = weather ? classifyWeather(weather.conditions) : 'good';

      // Sort strategy: bad weather → minimise distance; good weather → distance then rating
      const sorted = [...restaurants].sort((a, b) =>
        weatherSeverity === 'bad'
          ? a.distanceKm - b.distanceKm
          : a.distanceKm - b.distanceKm || b.rating - a.rating
      );

      // Validate hour format if provided
      let hhmm: string | null = null;
      let dayOfWeek = new Date().getDay();
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
              text: `No ${cuisine} restaurant ${timeDesc} found near ${location ?? 'your location'}. Try a different time or cuisine.`,
            },
          ],
          isError: true,
        };
      }

      // Take the top 5 open places
      const top5 = openPlaces.slice(0, 5);

      const recommendations = top5.map((d) => {
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

      const timeDesc = hour ? ` open at ${hour}` : '';
      const lines = [
        `**Top ${recommendations.length} ${cuisine} picks${timeDesc} near ${location ?? 'you'}:**`,
        '',
        ...recommendations.map(
          (r, i) => `${i + 1}. **${r.name}** — ${r.rating}/5 · ${r.distanceKm} km · ${r.address}`
        ),
      ];
      if (weather) lines.push('', `Weather: ${weather.temperature}°C, ${weather.conditions}`);

      return {
        content: [{ type: 'text', text: lines.join('\n') }],
        structuredContent: { recommendations, weather: weatherSnapshot },
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
        contents: [{ uri: resourceUri, mimeType: RESOURCE_MIME_TYPE, text: html }],
      };
    }
  );
}
