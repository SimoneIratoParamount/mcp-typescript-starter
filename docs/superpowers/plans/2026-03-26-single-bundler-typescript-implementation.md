# Single bundler + TypeScript layout + docs + file splits — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the approved design in [`docs/superpowers/specs/2026-03-26-single-bundler-typescript-design.md`](../specs/2026-03-26-single-bundler-typescript-design.md): Vite-only server build (no `tsc` emit), shared `tsconfig.base.json`, accurate AGENTS.md, optional `check` script, CI aligned with pnpm, then incremental file splits without behavior changes.

**Architecture:** Keep **two Vite configs** (`vite.config.ts` for UI, `vite.server.config.ts` for Node SSR entries). TypeScript uses a **shared base** extended by server vs app configs with **`noEmit: true`**. **No** `.d.ts` from build. Verification is **`pnpm run lint`** and **`pnpm run build`** after each task (no unit test harness yet — add smoke tests later if desired).

**Tech stack:** Node 24+, pnpm, TypeScript 5.x, Vite 7, ESLint + typescript-eslint, Prettier.

**Spec reference:** @docs/superpowers/specs/2026-03-26-single-bundler-typescript-design.md

---

## File map (create / modify)

| Path | Role |
|------|------|
| `tsconfig.base.json` | **Create** — shared compiler options for server + app |
| `tsconfig.server.json` | **Modify** — `extends` base, `noEmit: true`, drop declaration emit flags |
| `tsconfig.app.json` | **Modify** — `extends` base, keep React/DOM/JSX overrides |
| `tsconfig.json` | **Modify** — possibly adjust/remove `references` if `tsc -b` breaks without `composite` |
| `package.json` | **Modify** — `build:server` without `tsc`; add `check` script |
| `pnpm-workspace.yaml` | **Modify** — remove stale `esbuild` from `onlyBuiltDependencies` |
| `.github/workflows/ci.yml` | **Modify** — pnpm + `pnpm install --frozen-lockfile` |
| `AGENTS.md` | **Modify** — structure, pnpm, Vite-only build, feature table, remove/fix `check` |
| `README.md` | **Modify** — only if MCP paths or scripts disagree after edits |
| `server.json` | **Optional** — align package name, scripts (`start:http`), repo URL |
| `src/tools.ts` | **Split later** — extract modules under `src/tools/` or similar |
| `src/mcp-app-meal.tsx` | **Split later** — components under `src/mcp-app-meal/` |
| `src/services/google-places.ts` | **Split later** — helpers vs API vs types |
| `src/http.ts` | **Split later** — optional route helpers |

---

### Task 0: CI — pnpm alignment (prerequisite)

**Files:**

- Modify: `.github/workflows/ci.yml`

**Why:** Current workflow uses `npm ci` with `cache: npm` but the repo has **`pnpm-lock.yaml`** only and **`package.json` engines** discourage npm. CI must match the lockfile.

- [ ] **Step 1: Edit CI to use pnpm**

Use `pnpm/action-setup` (or corepack) + `cache: pnpm` + `pnpm install --frozen-lockfile`. Run the same scripts via `pnpm run …` (or `pnpm exec` where needed).

Example shape (exact versions pin to match repo):

```yaml
- uses: pnpm/action-setup@v4
  with:
    version: 10
- uses: actions/setup-node@v6
  with:
    node-version: '24'
    cache: 'pnpm'
- run: pnpm install --frozen-lockfile
- run: pnpm run format:check
- run: pnpm run lint
- run: pnpm run build
- run: pnpm run --if-present test
```

- [ ] **Step 2: Verify locally**

```bash
pnpm install --frozen-lockfile
pnpm run format:check && pnpm run lint && pnpm run build
```

Expected: all exit 0.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: use pnpm with frozen lockfile"
```

---

### Task 1: `tsconfig.base.json` + extend server/app

**Files:**

- Create: `tsconfig.base.json`
- Modify: `tsconfig.server.json`
- Modify: `tsconfig.app.json`

- [ ] **Step 1: Add `tsconfig.base.json`**

Shared options (adjust only if something breaks):

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  }
}
```

- [ ] **Step 2: `tsconfig.server.json`** — set `"extends": "./tsconfig.base.json"`, add `"compilerOptions": { "lib": ["ES2022"], "noEmit": true }`, **remove** `outDir`, `rootDir`, `declaration`, `declarationMap`, `emitDeclarationOnly`, `composite`. Keep `include`/`exclude` as today.

- [ ] **Step 3: `tsconfig.app.json`** — set `"extends": "./tsconfig.base.json"`, merge: keep `lib` (ESNext + DOM), `jsx`, `verbatimModuleSyntax`, `allowImportingTsExtensions`, `noEmit: true`, **remove** duplicated strict/skipLibCheck if inherited, **remove** `composite` if present.

- [ ] **Step 4: Validate TypeScript**

```bash
pnpm exec tsc -p tsconfig.server.json --noEmit
pnpm exec tsc -p tsconfig.app.json --noEmit
```

Expected: exit 0.

If **`pnpm exec tsc -b`** from repo root fails because `composite` was removed from referenced projects, either restore **`composite: true`** only if required for references, or **remove `references`** from `tsconfig.json` (next step).

- [ ] **Step 5: Fix root `tsconfig.json` if needed**

If `references` require composite: remove the `references` block and keep `"files": []`, **or** document that developers run `tsc -p tsconfig.server.json` for server checks. Re-run `pnpm exec tsc -b` if you keep references.

- [ ] **Step 6: Commit**

```bash
git add tsconfig.base.json tsconfig.server.json tsconfig.app.json tsconfig.json
git commit -m "chore(ts): add tsconfig.base and noEmit server/app configs"
```

---

### Task 2: Remove `tsc` from server build

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Change script**

`build:server`: **`vite build --config vite.server.config.ts`** (no leading `tsc`).

- [ ] **Step 2: Verify**

```bash
pnpm run build
```

Expected: completes; `dist/` has `stdio.js`, `http.js`, `dist/chunks/*.js`, UI HTML; **no** new requirement for `.d.ts` from `tsc`.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "build: drop tsc from server build (vite only)"
```

---

### Task 3: `pnpm-workspace.yaml` cleanup

**Files:**

- Modify: `pnpm-workspace.yaml`

- [ ] **Step 1: Remove `esbuild`** from `onlyBuiltDependencies` unless `esbuild` is again a direct dependency (it should not be after Vite-only server build).

- [ ] **Step 2: Commit**

```bash
git add pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "chore: drop stale esbuild from pnpm onlyBuiltDependencies"
```

---

### Task 4: `check` script + AGENTS.md

**Files:**

- Modify: `package.json`
- Modify: `AGENTS.md`

- [ ] **Step 1: Add `check` script** (pick one chain; example):

```json
"check": "pnpm run format:check && pnpm run lint && pnpm run build"
```

- [ ] **Step 2: Rewrite AGENTS.md** per spec §7:

  - Quick Reference: **`pnpm install`** / **`pnpm run build`**, etc.
  - Remove non-existent **`resources.ts` / `prompts.ts`** from tree; add **`utils/import-meta.ts`**, **`services/*`**, **`vite.server.config.ts`**, MCP UI files.
  - **Key files:** tools in **`src/tools.ts`**, wiring in **`src/server.ts`**, transports **`stdio.ts` / `http.ts`**.
  - **MCP features table:** align rows with actual tools (meal, weather, ext-apps) and file paths.
  - **Build:** Vite-only server bundle; note **`dist/chunks/`** for server deploy from repo root.
  - Reference **`pnpm run check`** now that it exists.

- [ ] **Step 3: Run**

```bash
pnpm run check
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add package.json AGENTS.md
git commit -m "docs(agents): align with pnpm and vite-only server; add check script"
```

---

### Task 5 (optional): `server.json` + README touch-ups

**Files:**

- Modify: `server.json`
- Modify: `README.md` (only if inconsistent)

- [ ] **Step 1:** Point **`repository`**, **`packages[0].identifier`**, **`command`**, and remote hints to **this** fork’s name and **`pnpm run start:http`** (or documented command).

- [ ] **Step 2: Commit**

```bash
git add server.json README.md
git commit -m "docs: align server.json and README with local package scripts"
```

---

### Task 6: Split `src/tools.ts`

**Files:**

- Create: e.g. `src/tools/weather.ts`, `src/tools/meal.ts`, `src/tools/index.ts` (exact names your choice)
- Modify: `src/tools.ts` → thin re-export + `registerTools` only, or delete and update `src/server.ts` imports

**Rule:** No behavior change; **move** functions and re-export.

- [ ] **Step 1:** Identify logical sections in `tools.ts` (weather, meal, shared).

- [ ] **Step 2:** Move code to new modules; keep public API stable for `server.ts`.

- [ ] **Step 3:**

```bash
pnpm run lint && pnpm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/tools.ts src/tools/
git commit -m "refactor(tools): split tools into modules"
```

---

### Task 7: Split `src/mcp-app-meal.tsx`

**Files:**

- Create: `src/mcp-app-meal/` (components, hooks, types as needed)
- Modify: `src/mcp-app-meal.tsx` (entry only)

- [ ] **Step 1:** Extract presentational pieces + hooks; preserve exports used by Vite entry `mcp-app-meal.html`.

- [ ] **Step 2:** `pnpm run build:ui && pnpm run lint`

- [ ] **Step 3: Commit**

```bash
git add src/mcp-app-meal.tsx src/mcp-app-meal/
git commit -m "refactor(ui): split mcp-app-meal into components"
```

---

### Task 8: Split `src/services/google-places.ts`

**Files:**

- Create: e.g. `src/services/google-places/` (types, client, geo helpers)
- Modify: `src/services/google-places.ts` or replace with barrel

- [ ] **Step 1:** Mechanical split; **no API behavior change**.

- [ ] **Step 2:** `pnpm run lint && pnpm run build`

- [ ] **Step 3: Commit**

```bash
git add src/services/google-places.ts src/services/google-places/
git commit -m "refactor(services): split google-places module"
```

---

### Task 9 (optional): Split `src/http.ts`

**Files:**

- Create: e.g. `src/http/routes.ts` or `src/http/weather-demo.ts`
- Modify: `src/http.ts`

- [ ] **Step 1:** Only if file still hard to navigate after other work.

- [ ] **Step 2:** `pnpm run build && pnpm run lint`

- [ ] **Step 3: Commit**

```bash
git add src/http.ts src/http/
git commit -m "refactor(http): extract route helpers"
```

---

## Testing note (TDD substitute)

There is **no `npm test` implementation** yet. Until tests exist, treat **`pnpm run check`** as the acceptance gate per task. Optional follow-up: add **Vitest** or **node:test** with one smoke test that imports `dist/stdio.js` or runs a tiny function from `src/utils/import-meta.ts`.

---

## Plan review loop

After you finish this document:

1. Dispatch **plan-document-reviewer** with: path to this plan, path to [`docs/superpowers/specs/2026-03-26-single-bundler-typescript-design.md`](../specs/2026-03-26-single-bundler-typescript-design.md).
2. Fix issues; re-review max 3 iterations.

---

## Execution handoff

**Plan complete and saved to `docs/superpowers/plans/2026-03-26-single-bundler-typescript-implementation.md`. Two execution options:**

1. **Subagent-driven (recommended)** — Fresh subagent per task; review between tasks (@superpowers:subagent-driven-development).
2. **Inline execution** — Run tasks in this session with checkpoints (@superpowers:executing-plans).

**Which approach do you want?**
