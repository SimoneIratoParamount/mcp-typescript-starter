# TypeScript Conventions

- Use ESM module syntax (`import`/`export`) throughout — no CommonJS
- Enable TypeScript strict mode (already set in tsconfig)
- Use **Zod** for all tool input schemas — do not use plain TypeScript types for MCP tool inputs
- Format with **Prettier** before committing (`pnpm format`)
- Lint with **ESLint** (`pnpm lint`)
- Run `pnpm build` to verify no TypeScript errors before committing
- Do not use `any` — prefer `unknown` and narrow with type guards or Zod
- Use named exports; avoid default exports except for React components
