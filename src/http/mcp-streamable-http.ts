/**
 * Streamable HTTP transport for MCP (`/mcp` — GET/POST/DELETE).
 */

import type { Express } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer } from '../server';

/**
 * Registers the `/mcp` route. Returns a function that reports the number of active sessions.
 */
export function registerMcpStreamableHttpRoute(app: Express): () => number {
  const transports = new Map<string, StreamableHTTPServerTransport>();

  app.all('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (req.method === 'GET') {
      if (!sessionId || !transports.has(sessionId)) {
        res.status(400).json({ error: 'Invalid or missing session ID' });
        return;
      }

      const transport = transports.get(sessionId)!;
      await transport.handleRequest(req, res, req.body);
      return;
    }

    if (req.method === 'POST') {
      let transport: StreamableHTTPServerTransport;

      if (sessionId && transports.has(sessionId)) {
        transport = transports.get(sessionId)!;
      } else {
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

      req.headers['x-client-ip'] = (req.ip ||
        (req.headers['x-forwarded-for'] as string) ||
        '') as string;

      await transport.handleRequest(req, res, req.body);

      if (transport.sessionId && !transports.has(transport.sessionId)) {
        transports.set(transport.sessionId, transport);
        console.log(`New session: ${transport.sessionId}`);
      }
      return;
    }

    if (req.method === 'DELETE') {
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

  return () => transports.size;
}
