/**
 * Meal Planner MCP — Server
 *
 * @see https://modelcontextprotocol.io/
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTools } from './tools.js';

/**
 * Server instructions for AI assistants.
 *
 * These instructions help AI models understand how to use this server effectively.
 */
const SERVER_INSTRUCTIONS = `
# Meal Planner MCP Server

Helps users decide where to eat by combining restaurant search, live weather, and hunger level.

## Available Tools

- **get_weather** → Fetch current weather for any city (or auto-detect from IP). Use this to give the user a weather overview before recommending a restaurant.
- **recommend_meal** → Find a restaurant matching a cuisine near a given location. Combines Google Maps restaurant search with live weather data and the user's craving level to rank results.

## Recommended Workflow

1. Ask the user what cuisine they feel like and how hungry they are (1–100).
2. Call \`recommend_meal\` with cuisine, location (city or address), and cravingLevel.
   - Omit location to trigger elicitation and ask the user directly.
   - Pass an optional \`hour\` (HH:MM) to filter by opening hours at a specific time.
3. The tool returns up to 5 ranked restaurants with photos, ratings, distance, and a weather-aware travel advisory.

## Notes

- \`GOOGLE_MAPS_API_KEY\` is required for \`recommend_meal\` (Geocoding + Places API Legacy).
- \`OPEN_WEATHER_API_KEY\` is required for weather data in both tools.
- Both tools return a rich React UI card when called from a compatible host (Cursor, Claude Desktop).
`.trim();

export function createServer(): McpServer {
  const server = new McpServer(
    {
      name: 'meal-planner-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
        resources: { subscribe: false },
        experimental: {},
      },
      instructions: SERVER_INSTRUCTIONS,
    }
  );

  registerTools(server);

  return server;
}
