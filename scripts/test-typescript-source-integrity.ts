import { readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

// Generated and installed trees are not sources: walking them made this gate
// depend on whether `npm run build` had already run.
const SKIP_DIRECTORIES = new Set(['node_modules', '.git', 'typed-build', 'coverage', 'data']);

async function walk(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory() && SKIP_DIRECTORIES.has(entry.name)) continue;
    const target = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(target));
    else if (entry.isFile()) files.push(target);
  }
  return files;
}

function fail(message: string): never {
  throw new Error('TYPESCRIPT_SOURCE_INTEGRITY_FAILED:' + message);
}

const all = await walk(ROOT);
const libMjs = all.filter((p) => p.startsWith(join(ROOT, 'lib') + '/') && p.endsWith('.mjs'));
const libTs = new Set(all.filter((p) => p.startsWith(join(ROOT, 'lib') + '/') && p.endsWith('.ts')).map((p) => p.slice(0, -3)));
const orphan = libMjs.filter((p) => !libTs.has(p.slice(0, -4)));
if (orphan.length) fail('lib-orphan-mjs=' + orphan.map((p) => relative(ROOT, p)).join(','));

for (const file of libMjs) {
  const source = await readFile(file, 'utf8');
  const expected = "export * from './" + file.split('/').pop().replace('.mjs', '.ts') + "';";;
  const compact = source.split('\n').map((line) => line.trim()).filter(Boolean);
  if (compact.length > 3 || !source.includes(expected)) fail('lib-legacy-module-not-wrapper=' + relative(ROOT, file));
}

const publicJs = all.filter((p) => p.startsWith(join(ROOT, 'public') + '/') && p.endsWith('.js'));
for (const file of publicJs) {
  if (file.endsWith('/chat-markdown.js')) continue;
  const source = await readFile(file, 'utf8');
  if (!source.includes('/typed-build/') && !source.includes('typed/')) fail('public-js-not-bridge=' + relative(ROOT, file));
}

const server = await readFile(join(ROOT, 'server.ts'), 'utf8');
if (/from ['"][^'"]+\\.mjs['"]/.test(server)) fail('server-mjs-import');
if (!server.includes('createUpstreamCircuitBreaker')) fail('server-circuit-breaker');
if (!server.includes('createRateLimiter')) fail('server-rate-limiter');

console.log(JSON.stringify({
  status: 'ok',
  libLegacyWrappers: libMjs.length,
  libCanonicalTypeScript: libTs.size,
  publicJavaScriptBridges: publicJs.length
}));
