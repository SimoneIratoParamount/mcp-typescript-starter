#!/usr/bin/env node
/**
 * MCP TypeScript Starter - stdio Transport
 *
 * This entrypoint runs the MCP server using stdio transport,
 * which is ideal for local development and CLI tool integration.
 *
 * Usage:
 *   node dist/stdio.js
 *   npx ts-node src/stdio.ts
 *
 * @see https://modelcontextprotocol.io/docs/develop/transports#stdio
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { importMetaPaths } from './utils/import-meta';

const { __dirname } = importMetaPaths(import.meta.url);
config({ path: resolve(__dirname, '..', '.env') });

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server';

async function main() {
  const server = createServer();

  // Create stdio transport
  const transport = new StdioServerTransport();

  // Connect the server to the transport
  await server.connect(transport);

  // Log to stderr so it doesn't interfere with stdio protocol
  console.error('MCP TypeScript Starter running on stdio');
  console.error('Press Ctrl+C to exit');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
