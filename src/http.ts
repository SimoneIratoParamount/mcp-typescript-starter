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
import { importMetaPaths } from './utils/import-meta';

const { __dirname } = importMetaPaths(import.meta.url);
config({ path: resolve(__dirname, '..', '.env') });

import express from 'express';
import { registerMcpStreamableHttpRoute } from './http/mcp-streamable-http';
import { registerWeatherDemoRoute } from './http/weather-demo';

const PORT = parseInt(process.env.PORT || '3000', 10);

async function main() {
  const app = express();

  app.use(express.json());

  app.use(
    '/mcp-ui',
    express.static(new URL('../node_modules/@mcp-ui/client/dist', import.meta.url).pathname)
  );
  app.use(express.static(new URL('../public', import.meta.url).pathname));

  registerWeatherDemoRoute(app);
  const getSessionCount = registerMcpStreamableHttpRoute(app);

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      server: 'mcp-typescript-starter',
      version: '1.0.0',
      sessions: getSessionCount(),
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
