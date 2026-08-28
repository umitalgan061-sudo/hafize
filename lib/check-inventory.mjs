import { readdir } from 'node:fs/promises';
import path from 'node:path';

// Statik/smoke kapısının hangi kaynakları taradığı tek yerde tanımlanır.
export const SYNTAX_TARGETS = Object.freeze([
  Object.freeze({ dir: '.', extensions: Object.freeze(['.mjs']) }),
  Object.freeze({ dir: 'lib', extensions: Object.freeze(['.mjs']) }),
  Object.freeze({ dir: 'scripts', extensions: Object.freeze(['.mjs']) }),
  Object.freeze({ dir: 'public', extensions: Object.freeze(['.js']) })
]);

export const TEST_PREFIX = 'test-';

function fail(reason) {
  const error = new Error(`INVALID_CHECK_INVENTORY:${reason}`);
  error.code = 'INVALID_CHECK_INVENTORY';
  throw error;
}

function requireRoot(root) {
  if (typeof root !== 'string' || !root.trim()) fail('root');
  return root;
}

async function listFiles(root, { dir, extensions }) {
  const entries = await readdir(path.join(root, dir), { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && extensions.includes(path.extname(entry.name)))
    .map((entry) => (dir === '.' ? entry.name : `${dir}/${entry.name}`))
    .sort();
}

/** Syntax kontrolüne girecek tüm kaynak dosyaları, repo köküne göreli olarak döner. */
export async function collectSyntaxFiles(root) {
  requireRoot(root);
  const files = [];
  for (const target of SYNTAX_TARGETS) {
    for (const file of await listFiles(root, target)) files.push(file);
  }
  return files;
}

/** `scripts/test-*.mjs` paketlerini keşfeder; elle tutulan bir liste yoktur. */
export async function collectTestFiles(root) {
  requireRoot(root);
  const entries = await listFiles(root, { dir: 'scripts', extensions: ['.mjs'] });
  return entries.filter((file) => path.basename(file).startsWith(TEST_PREFIX));
}

/** Yalnız `--only <parça>` desteklenir; bilinmeyen argüman sessizce yutulmaz. */
export function parseCheckArgs(argv = []) {
  if (!Array.isArray(argv)) fail('argv');
  const filters = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (typeof arg !== 'string') fail('argv.entry');
    if (arg === '--only') {
      const value = argv[index + 1];
      if (typeof value !== 'string' || !value.trim() || value.startsWith('--')) fail('only');
      filters.push(value.trim());
      index += 1;
      continue;
    }
    if (arg.startsWith('--only=')) {
      const value = arg.slice('--only='.length).trim();
      if (!value) fail('only');
      filters.push(value);
      continue;
    }
    fail(`argument:${arg}`);
  }
  return Object.freeze({ filters: Object.freeze(filters) });
}

/** Filtre yoksa tüm paketler çalışır; filtre varsa yalnız eşleşenler seçilir. */
export function selectTests(files, filters = []) {
  if (!Array.isArray(files)) fail('files');
  if (!Array.isArray(filters)) fail('filters');
  if (filters.length === 0) return [...files];
  return files.filter((file) => filters.some((needle) => file.includes(needle)));
}
