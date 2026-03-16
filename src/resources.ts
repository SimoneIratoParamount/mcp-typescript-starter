/**
 * Meal Planner MCP — Resources
 *
 * Resources are registered directly by each tool via registerAppResource.
 * This file is kept for future static resources.
 *
 * @see https://modelcontextprotocol.io/docs/concepts/resources
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerResources(_server: McpServer): void {
  // Tool-specific resources (weather UI, meal UI) are registered
  // inline inside registerWeatherTool and registerMealRecommendationTool.
}
