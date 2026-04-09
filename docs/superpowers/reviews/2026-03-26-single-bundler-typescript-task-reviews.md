# Task reviews: single-bundler TypeScript work (Tasks 5–9)

**Date:** 2026-03-26  
**Branch:** `feature/improvements` (at time of review)  
**Method:** Subagent-driven style — **spec compliance** first, then **code quality** per task.

**References:**

- [Implementation plan](../plans/2026-03-26-single-bundler-typescript-implementation.md)
- [Design spec](../specs/2026-03-26-single-bundler-typescript-design.md)

**Acceptance gate:** `pnpm run check` (format + lint + build) — verified passing at review time.

---

## Task 5 — `server.json` + README (optional)

**Commit:** `5a33e12`

### Spec compliance

| Requirement | Status |
|-------------|--------|
| Touch `server.json` and README where inconsistent | Met |
| Remote hint / local run uses documented command (`pnpm run start:http` after build) | Met (`remotes[0].description`) |
| README MCP path accuracy | Met (Cursor → `.cursor/mcp.json`) |
| Plan Step 1: point **`repository`**, **`packages[0].identifier`**, **`command`** to **this fork’s** name | **Partial** — `repository.url` remains upstream `SamMorrowDrums/mcp-typescript-starter`; `identifier` / `command` remain npm-catalog style (`npx -y mcp-typescript-starter`), which is coherent for published installs but not fork-specific URL/name. |

**Verdict:** Spec compliant **with one documented gap** — only if the plan literally required a fork URL and fork-specific package identity; otherwise intentional (catalog + upstream pointer).

### Code quality

| Area | Notes |
|------|--------|
| Clarity | Title/description/README edits are consistent and readable. |
| Risk | None for runtime; `server.json` is metadata. |

**Verdict:** **Approved** (optional follow-up: set `repository.url` to your fork if that was the real requirement).

---

## Task 6 — Split `src/tools.ts`

**Commit:** `e755198` (design spec §6 priority 1: tools split, move-only)

### Spec compliance

| Requirement | Status |
|-------------|--------|
| Modules under `src/tools/`, orchestration + `registerTools` | Met (`index.ts`, `register-weather.ts`, `register-meal.ts`) |
| No behavior change / move + re-export | Met (logic preserved; `server.ts` still imports from `./tools`) |
| Lint + build | Met via `pnpm run check` |

**Verdict:** **Spec compliant.**

### Code quality

| Strength | Issue |
|----------|--------|
| `tools-bundle-path.ts` preserves `import.meta.url` depth vs old `tools.ts` — correct mitigation for `DIST_DIR`. | Naming differs from plan examples (`weather.ts` / `meal.ts` vs `register-*`) — acceptable, no functional impact. |

**Verdict:** **Approved.**

---

## Task 7 — Split `src/mcp-app-meal.tsx`

**Commit:** `2a3b0ac` (design spec §6: meal UI under folder)

### Spec compliance

| Requirement | Status |
|-------------|--------|
| `src/mcp-app-meal/` with components/hooks/types | Met |
| Entry thin; Vite still loads `mcp-app-meal.html` → `/src/mcp-app-meal.tsx` | Met |
| Plan: `pnpm run build:ui && pnpm run lint` | Superseded in practice by full `pnpm run check` (stronger). |

**Verdict:** **Spec compliant.**

### Code quality

| Strength | Issue |
|----------|--------|
| Clear separation: types, themes, rush, hooks, utils, presentational components. | None blocking. |

**Verdict:** **Approved.**

---

## Task 8 — Split `src/services/google-places.ts`

**Commit:** `8e55047` (design spec §6 priority 3)

### Spec compliance

| Requirement | Status |
|-------------|--------|
| Folder + barrel; mechanical split | Met |
| No API behavior change | Assumed met (structure mirrors original; same public exports from `index.ts`) |
| `pnpm run lint && pnpm run build` | Met via `pnpm run check` |

**Verdict:** **Spec compliant.**

### Code quality

| Strength | Issue |
|----------|--------|
| Sensible slices: types, distance, geolocation, search, details. | `haversineKm` exported from `distance.ts` though only used internally — minor API surface (could be non-exported). |

**Verdict:** **Approved** (nit only).

---

## Task 9 (optional) — Split `src/http.ts`

**Commit:** `069c546` (design spec §6 optional `http.ts`)

### Spec compliance

| Requirement | Status |
|-------------|--------|
| Extract route helpers / weather demo | Met (`mcp-streamable-http.ts`, `weather-demo.ts`) |
| `http.ts` remains entry | Met |
| `pnpm run build && pnpm run lint` | Met via `pnpm run check` |
| Plan example commit message `refactor(http): extract route helpers` | Cosmetic — actual message is more specific; content matches. |

**Verdict:** **Spec compliant.**

### Code quality

| Strength | Issue |
|----------|--------|
| Session map + `/mcp` handler isolated; weather demo isolated; `http.ts` reads as wiring. | Coexistence of `src/http.ts` and `src/http/` is valid with explicit imports (`./http/...`); document for contributors if new code might import `./http` ambiguously. |

**Verdict:** **Approved** (documentation nit).

---

## Follow-up — AGENTS key paths

**Commit:** `d68ef78`

**Spec compliance:** Not a numbered plan task; aligns design spec §7 (accurate key file paths). **Approved.**

**Code quality:** Small, targeted doc fix. **Approved.**

---

## Design alignment (cross-cutting)

Design spec §6 file-split priorities (**tools → meal → google-places → http**) match the implementation order. First-pass “move code only” is respected. `pnpm run check` remains the acceptance gate per the plan testing note.

---

## Summary

| Task | Spec | Quality | Follow-up |
|------|------|---------|-----------|
| 5 | Pass* | Approved | *Optionally update `repository` (and related fields) for your fork if Step 1 required it. |
| 6 | Pass | Approved | — |
| 7 | Pass | Approved | — |
| 8 | Pass | Approved | Optional: narrow `distance` exports. |
| 9 | Pass | Approved | Optional: note `http.ts` vs `http/` for contributors. |
