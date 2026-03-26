#!/usr/bin/env node
/**
 * MCP TypeScript Starter - Streamable HTTP Transport
 *
 * This entrypoint runs the MCP server using HTTP with SSE streams,
 * which is ideal for remote deployment and web-based clients.
 *
 * Usage:
 *   node dist/http.js
 *   PORT=8080 node dist/http.js
 *
 * @see https://modelcontextprotocol.io/docs/develop/transports#streamable-http
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { importMetaPaths } from './utils/import-meta.js';

const { __dirname } = importMetaPaths(import.meta.url);
config({ path: resolve(__dirname, '..', '.env') });

import express from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer } from './server.js';
import { getWeather } from './services/openweather.js';
import { buildWeatherHtml } from './services/weather-ui.js';

const PORT = parseInt(process.env.PORT || '3000', 10);

async function main() {
  const app = express();

  // Parse JSON bodies
  app.use(express.json());

  // Serve @mcp-ui/client Web Component and public demo files
  app.use('/mcp-ui', express.static(new URL('../node_modules/@mcp-ui/client/dist', import.meta.url).pathname));
  app.use(express.static(new URL('../public', import.meta.url).pathname));

  /**
   * Weather UI demo endpoint — returns a UIResource (text/html) ready for
   * <ui-resource-renderer> to render.
   */
  app.get('/api/weather', async (req, res) => {
    const city = typeof req.query.city === 'string' ? req.query.city.trim() : '';
    if (!city) {
      res.status(400).json({ error: 'city query parameter is required' });
      return;
    }
    const apiKey = process.env.OPEN_WEATHER_API_KEY;
    if (!apiKey?.trim()) {
      res.status(503).json({ error: 'OPEN_WEATHER_API_KEY not configured' });
      return;
    }
    try {
      const weather = await getWeather(city, apiKey);
      const html = buildWeatherHtml(weather);
      res.json({
        uri: `ui://weather/${encodeURIComponent(weather.location)}`,
        mimeType: 'text/html',
        text: html,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });

  // Store transports for session management
  const transports = new Map<string, StreamableHTTPServerTransport>();

  /**
   * MCP endpoint - handles all MCP protocol messages
   */
  app.all('/mcp', async (req, res) => {
    // Get or create session ID
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (req.method === 'GET') {
      // SSE stream for server-to-client messages
      if (!sessionId || !transports.has(sessionId)) {
        res.status(400).json({ error: 'Invalid or missing session ID' });
        return;
      }

      const transport = transports.get(sessionId)!;
      await transport.handleRequest(req, res, req.body);
      return;
    }

    if (req.method === 'POST') {
      // Handle new sessions or existing session messages
      let transport: StreamableHTTPServerTransport;

      if (sessionId && transports.has(sessionId)) {
        transport = transports.get(sessionId)!;
      } else {
        // Create new session
        const server = createServer();
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => crypto.randomUUID(),
        });

        transport.onclose = () => {
          const id = transport.sessionId;
          if (id) {
            transports.delete(id);
            console.log(`Session closed: ${id}`);
          }
        };

        await server.connect(transport);
      }

      req.headers['x-client-ip'] = (req.ip || (req.headers['x-forwarded-for'] as string) || '') as string;

      await transport.handleRequest(req, res, req.body);

      // Store the transport after handleRequest so sessionId is set
      if (transport.sessionId && !transports.has(transport.sessionId)) {
        transports.set(transport.sessionId, transport);
        console.log(`New session: ${transport.sessionId}`);
      }
      return;
    }

    if (req.method === 'DELETE') {
      // Close session
      if (sessionId && transports.has(sessionId)) {
        const transport = transports.get(sessionId)!;
        await transport.close();
        transports.delete(sessionId);
        res.status(200).json({ message: 'Session closed' });
      } else {
        res.status(404).json({ error: 'Session not found' });
      }
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  });

  /**
   * Health check endpoint
   */
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      server: 'mcp-typescript-starter',
      version: '1.0.0',
      sessions: transports.size,
    });
  });

  app.listen(PORT, () => {
    console.log(`MCP TypeScript Starter running on http://localhost:${PORT}`);
    console.log(`  MCP endpoint:   http://localhost:${PORT}/mcp`);
    console.log(`  Health check:   http://localhost:${PORT}/health`);
    console.log(`  Weather UI demo: http://localhost:${PORT}/`);
    console.log('');
    console.log('Press Ctrl+C to exit');
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
