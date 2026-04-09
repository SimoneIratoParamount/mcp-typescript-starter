/**
 * Meal Planner MCP — Tools
 *
 * Tool definitions for the meal planner MCP server.
 *
 * @see https://modelcontextprotocol.io/docs/concepts/tools
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerWeatherTool } from './register-weather';
import { registerMealRecommendationTool } from './register-meal';

/**
 * Register all tools with the server.
 */
export function registerTools(server: McpServer): void {
  registerWeatherTool(server);
  registerMealRecommendationTool(server);
}
