/**
 * Resolves the `dist/` directory for loading built MCP UI HTML.
 * Kept at `src/` depth so `import.meta.url` matches the former `src/tools.ts` layout.
 */
import { join } from 'node:path';
import { importMetaPaths } from './utils/import-meta';

const { __filename, __dirname } = importMetaPaths(import.meta.url);
export const DIST_DIR = __filename.endsWith('.ts') ? join(__dirname, '..', 'dist') : __dirname;
