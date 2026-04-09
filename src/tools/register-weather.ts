/**
 * `get_weather` tool registration.
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
import { DIST_DIR } from '../tools-bundle-path';
import { getWeather } from '../services/openweather';

/**
 * Weather tool backed by OpenWeatherMap with a React MCP App UI.
 *
 * Uses registerAppTool to attach _meta.ui.resourceUri so compatible hosts
 * render the React card automatically.
 */
export function registerWeatherTool(server: McpServer): void {
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
