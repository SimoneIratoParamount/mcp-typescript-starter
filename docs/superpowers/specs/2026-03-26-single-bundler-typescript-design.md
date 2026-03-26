# Design: Single bundler (Vite), no `tsc` in build, TS/Vite config layout, file splits, AGENTS.md

**Status:** Approved (2026-03-26)  
**Constraints:** Remove `tsc` from build; no `.d.ts` output for now (option A).

## 1. Goals

- **Single bundler:** Vite for both UI and Node server bundles (already true for transpile/bundle; remove parallel `tsc` emit).
- **No `tsc` in build:** Server build must not invoke `tsc` for emit or declarations.
- **No `.d.ts`:** Accept no generated declaration artifacts from the server build until needed (e.g. publishing a library).
- **Better-organized configs:** Shared TypeScript defaults; clear separation of UI vs server Vite configs.
- **Split large files:** Reduce size of `tools.ts`, `mcp-app-meal.tsx`, `google-places.ts`, optionally `http.ts`, without behavior change in the first pass.
- **AGENTS.md:** Align with repository reality (structure, commands, tool locations, build pipeline).

## 2. Non-goals (for this iteration)

- Merging UI and server into **one** `vite.config.ts` file (optional future work).
- Adding `vite-plugin-dts` or restoring `.d.ts` unless requirements change.
- Large refactors beyond mechanical splits and config moves.

## 3. Build pipeline

### Current (before)

- `build:server`: `tsc -p tsconfig.server.json` (emitDeclarationOnly) → `vite build --config vite.server.config.ts`

### Target

- `build:server`: **`vite build --config vite.server.config.ts` only**
- **`build`:** unchanged order: `build:ui` then `build:server` (UI still uses `vite.config.ts` + `INPUT`).

### Typechecking

- **Editor / ESLint:** Primary feedback via `typescript-eslint` and IDE.
- **Optional CI:** `tsc -b --noEmit` or `tsc -p tsconfig.server.json --noEmit` **not** part of `build`; document as optional. If the project adopts a strict “no `tsc` binary anywhere” policy, CI can rely on ESLint only (weaker type guarantees).

## 4. TypeScript configuration

Introduce **`tsconfig.base.json`** with shared options, for example:

- `strict`, `target`, `module` / `moduleResolution` (`bundler`), `esModuleInterop`, `skipLibCheck`, `forceConsistentCasingInFileNames`, `resolveJsonModule`, `isolatedModules`

**`tsconfig.server.json`**

- `extends` base
- `include` server-relevant sources under `src/` (exclude React app entrypoints as today)
- **`noEmit: true`** for typecheck-only
- **Remove:** `emitDeclarationOnly`, `declaration`, `declarationMap`, and **`composite`** unless a consumer (e.g. project references) still requires it — re-validate `tsc -b` and IDE after removal

**`tsconfig.app.json`**

- `extends` base
- React/DOM libs, `jsx`, `noEmit: true`, current `include` for `mcp-app*.tsx` and HTML entry references

**`tsconfig.json`**

- Keep solution-style **project references** to server + app if still valuable; adjust if `composite` is dropped (validate VS Code / ESLint project resolution).

## 5. Vite configuration

- **Keep** two configs: **`vite.config.ts`** (client UI) and **`vite.server.config.ts`** (Node SSR bundle for `stdio` / `http` entries).
- **Optional later:** Move both under `config/vite/` and update `package.json` script paths for clarity.

**Server:** `build.ssr: true`, `ssr.target: 'node'`, `emptyOutDir: false` (preserve UI output in `dist/`), external npm deps by default.

## 6. File splits (incremental, behavior-preserving)

| Priority | File | Direction |
|----------|------|-----------|
| 1 | `tools.ts` | Modules per domain (e.g. weather, meal, shared registration helpers); single `registerTools` orchestration |
| 2 | `mcp-app-meal.tsx` | Components + hooks under e.g. `src/mcp-app-meal/` |
| 3 | `services/google-places.ts` | API surface vs pure helpers vs types |
| 4 | `http.ts` | Route handlers / demo HTML helpers if warranted |

First pass: **move code only** (no logic changes); run existing lint/build after each slice.

## 7. AGENTS.md updates

Verified issues to fix:

| Area | Correction |
|------|------------|
| **Project tree** | Remove non-existent `resources.ts`, `prompts.ts`; list actual files (`server.ts`, `tools.ts`, `http.ts`, `stdio.ts`, `services/*`, `mcp-app*.tsx`, `utils/import-meta.ts`). |
| **Key files / MCP table** | Tools live primarily in **`tools.ts`** (and splits); **`server.ts`** wires `createServer` / registration; fix misattributed features. |
| **Package manager** | Align with **`package.json` engines** (pnpm preferred; avoid documenting `npm ci` as primary if repo discourages npm). |
| **Build** | Document **Vite-only** server build; no `tsc` in `build:server`; no committed server `.d.ts`. |
| **`npm run check`** | Either remove from docs or add a real **`check`** script (e.g. lint + format check + build). |

## 8. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Dropping `composite` breaks references | Re-run `tsc -b` / IDE after tsconfig edits |
| ESLint without `parserOptions.project` misses type-aware rules | Optionally enable typed linting with explicit `tsconfig` paths later |
| Chunk layout for server (`dist/chunks/*`) | Document deploy/run from repo root so relative chunk paths resolve |

## 9. Implementation order (suggested)

1. Tsconfig base + server/app extends; remove emit-only flags; remove `tsc` from `build:server`.
2. Full `pnpm run build` + `pnpm run lint` verification.
3. AGENTS.md + optional `check` script decision.
4. File splits in priority order (tools → meal UI → google-places → http).

## 10. Approval

Design approved by project owner on 2026-03-26. Next step: implementation plan (`writing-plans` workflow) after spec review in-repo.
