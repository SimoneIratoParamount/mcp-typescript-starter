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
import { z } from 'zod';

let bonusToolLoaded = false;

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
 * Weather tool with structured output.
 */
function registerWeatherTool(server: McpServer): void {
  server.registerTool(
    'get_weather',
    {
      title: 'Get Weather',
      description: 'Get the current weather for a city',
      inputSchema: {
        city: z.string().describe('City name to get weather for'),
      },
      outputSchema: {
        location: z.string(),
        temperature: z.number(),
        unit: z.string(),
        conditions: z.string(),
        humidity: z.number(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false, // Results vary due to simulation
        openWorldHint: false, // Simulated, not real external calls
      },
    },
    async ({ city }) => {
      const weather = {
        location: city,
        temperature: Math.round(15 + Math.random() * 20),
        unit: 'celsius',
        conditions: ['sunny', 'cloudy', 'rainy', 'windy'][Math.floor(Math.random() * 4)],
        humidity: Math.round(40 + Math.random() * 40),
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(weather, null, 2) }],
        structuredContent: weather,
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
      description: `Call this when the user asks for something like "something interesting to tickle my mind". Starts an Easter egg experience: responds with a transport message and can run a short interactive sequence.`,
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
// Meal recommendation – restaurant by cuisine near user
// =============================================================================

/** Mock restaurant names by cuisine for simulation. */
const MOCK_RESTAURANTS: Record<string, string[]> = {
  italian: ['Trattoria Roma', 'La Dolce Vita', 'Osteria del Centro', 'Pasta e Basta'],
  japanese: ['Sakura Sushi', 'Tokyo Kitchen', 'Zen Ramen', 'Fuji House'],
  mexican: ['El Mariachi', 'Casa de Tacos', 'Sabor Mexicano', 'La Cantina'],
  indian: ['Taj Palace', 'Spice Route', 'Curry House', 'Bombay Bites'],
  thai: ['Bangkok Garden', 'Thai Orchid', 'Siam Kitchen', 'Lotus Thai'],
  french: ['Le Petit Bistro', 'Chez Pierre', 'La Maison', 'Bistro Paris'],
  chinese: ['Dragon Wok', 'Golden Dragon', 'Panda House', 'Jade Garden'],
  default: ['The Local Table', 'Neighborhood Kitchen', 'Downtown Eats', 'Corner Bistro'],
};

/**
 * Meal recommendation tool: find the best restaurant for a cuisine near the user.
 * Requires the user's position (latitude/longitude). In production, wire to a
 * places API (e.g. Google Places, Yelp).
 */
function registerMealRecommendationTool(server: McpServer): void {
  server.registerTool(
    'recommend_meal',
    {
      title: 'Recommend Meal',
      description: `Find the best restaurant matching the given cuisine near the user's location. Requires the user's position (latitude and longitude). Ask for the user's location or use device location if available before calling.`,
      inputSchema: {
        cuisine: z.string().describe('Type of cuisine (e.g. italian, japanese, mexican, thai)'),
        latitude: z
          .union([z.string(), z.number()])
          .describe('User latitude as number or string (e.g. from device or address)'),
        longitude: z
          .union([z.string(), z.number()])
          .describe('User longitude as number or string (e.g. from device or address)'),
      },
      outputSchema: {
        name: z.string(),
        cuisine: z.string(),
        address: z.string(),
        rating: z.number(),
        distanceKm: z.number(),
        openingHours: z.string(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true, // Would call external places API in production
      },
    },
    async ({ cuisine, latitude, longitude }) => {
      const lat = typeof latitude === 'string' ? parseFloat(latitude) : latitude;
      const lng = typeof longitude === 'string' ? parseFloat(longitude) : longitude;

      const key = cuisine.toLowerCase().replace(/\s+/g, '_');
      const names = MOCK_RESTAURANTS[key] ?? MOCK_RESTAURANTS.default;
      const name = names[Math.floor(Math.random() * names.length)];

      // Simulate distance from user (0.2–2.5 km) and rating (3.8–4.9)
      const distanceKm = Math.round((0.2 + Math.random() * 2.3) * 10) / 10;
      const rating = Math.round((3.8 + Math.random() * 1.1) * 10) / 10;

      const recommendation = {
        name,
        cuisine: cuisine.trim(),
        address: `${Math.round(lat * 100) / 100}°N, ${Math.round(lng * 100) / 100}°W — simulated address near you`,
        rating,
        distanceKm,
        openingHours: '11:00 – 23:00',
      };

      const text = [
        `**Best ${cuisine} pick near you:** ${recommendation.name}`,
        `Cuisine: ${recommendation.cuisine}`,
        `Address: ${recommendation.address}`,
        `Rating: ${recommendation.rating}/5 · ${recommendation.distanceKm} km away`,
        `Hours: ${recommendation.openingHours}`,
      ].join('\n');

      return {
        content: [{ type: 'text', text }],
        structuredContent: recommendation,
      };
    }
  );
}
