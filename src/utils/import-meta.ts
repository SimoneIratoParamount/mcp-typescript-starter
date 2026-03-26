import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export type ImportMetaPaths = {
  /** Absolute filesystem path of the module file (ESM `__filename`). */
  __filename: string;
  /** Absolute directory of the module file (ESM `__dirname`). */
  __dirname: string;
};

/**
 * Resolves ESM `__filename` and `__dirname` from `import.meta.url`.
 */
export function importMetaPaths(importMetaUrl: string): ImportMetaPaths {
  const __filename = fileURLToPath(importMetaUrl);
  const __dirname = dirname(__filename);
  return { __filename, __dirname };
}
