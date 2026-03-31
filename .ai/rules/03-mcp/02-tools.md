# MCP Tool Authoring Patterns

- Define tool input schemas with Zod in `src/tools.ts`
- Register tools inside `createServer()` in `src/server.ts` using `server.tool()`
- Return `{ content: [{ type: "text", text: "..." }] }` for plain text responses
- Return embedded resources for UI responses (HTML cards served from `dist/`)
- Use **elicitation** (`server.elicit()`) to request missing required info from the user at runtime — do not make location or other context assumptions
- Keep tool handler functions pure where possible; put API logic in `src/services/`
- Every tool input field must have a Zod `.describe()` — this becomes the MCP schema description
