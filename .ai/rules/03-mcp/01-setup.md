# MCP Server Setup

## Three Ways to Start

### 1. stdio/tsx — development (no build needed)

```json
{
  "type": "stdio",
  "command": "npx",
  "args": ["tsx", "src/stdio.ts"]
}
```

Use this during development. Requires `tsx` available via npx.

### 2. stdio/node — compiled

```json
{
  "type": "stdio",
  "command": "node",
  "args": ["dist/stdio.js"]
}
```

Run `pnpm build` first. Faster startup, no transpilation overhead.

### 3. HTTP transport — remote/web clients

```json
{
  "type": "http",
  "url": "http://localhost:3000/mcp"
}
```

Run `pnpm start:http` (or `pnpm dev:http`) first. Use for browser-based or remote MCP clients.

## Interactive Testing

```bash
npx @modelcontextprotocol/inspector -- npx tsx src/stdio.ts
```

## Client Config Locations

- **Cursor:** `.cursor/mcp.json`
- **Claude Desktop:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **VS Code:** `.vscode/mcp.json`
