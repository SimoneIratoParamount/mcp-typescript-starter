# MCP Tool Authoring Patterns

- Define tool input schemas with Zod and register tools using `registerAppTool()` in `src/tools.ts`
- `createServer()` in `src/server.ts` calls `registerTools(server)` to wire them in
- Return `{ content: [{ type: "text", text: "..." }] }` for plain text responses
- Return embedded resources for UI responses (HTML cards served from `dist/`)
- Use **elicitation** (`server.elicit()`) to request missing required info from the user at runtime — do not make location or other context assumptions
- Keep tool handler functions pure where possible; put API logic in `src/services/`
- Every tool input field must have a Zod `.describe()` — this becomes the MCP schema description
