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

// Early-boot scripts must run as blocking classic scripts before the deferred typed modules:
// theme-init.js sets the theme before first paint (no light flash for dark-mode users), and
// composer-focus-guard.js must be listening before any module can intercept pointer input.
// Each one is listed here with its reason, must stay small, must be loaded by index.html as a
// classic <script src>, and must not use module syntax. Anything else in public/ is a bridge.
const EARLY_BOOT_SCRIPTS: Record<string, string> = {
  'public/theme-init.js': 'applies the saved theme before first paint',
  'public/composer-focus-guard.js': 'gives the message field its focus back'
};
const EARLY_BOOT_MAX_LINES = 40;
// Third-party code copied in as-is (the Piper voice engine); it is not ours to rewrite.
const VENDOR_PREFIX = join(ROOT, 'public', 'vendor') + '/';

const indexHtml = await readFile(join(ROOT, 'public', 'index.html'), 'utf8');
for (const path of Object.keys(EARLY_BOOT_SCRIPTS)) {
  const source = await readFile(join(ROOT, path), 'utf8').catch(() => fail('early-boot-missing=' + path));
  if (source.split('\n').length > EARLY_BOOT_MAX_LINES) fail('early-boot-too-large=' + path);
  if (/^\s*(import|export)\s/m.test(source)) fail('early-boot-module-syntax=' + path);
  const src = '/' + path.slice('public/'.length);
  const tag = indexHtml.match(new RegExp('<script\\b[^>]*\\bsrc="' + src.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '"[^>]*>'));
  if (!tag) fail('early-boot-not-loaded=' + path);
  if (/\btype=["']module["']|\b(defer|async)\b/.test(tag[0])) fail('early-boot-not-classic=' + path);
}

const publicJs = all.filter((p) => p.startsWith(join(ROOT, 'public') + '/') && p.endsWith('.js'));
let earlyBoot = 0;
let vendored = 0;
for (const file of publicJs) {
  if (file.endsWith('/chat-markdown.js')) continue;
  if (file.startsWith(VENDOR_PREFIX)) { vendored += 1; continue; }
  if (relative(ROOT, file) in EARLY_BOOT_SCRIPTS) { earlyBoot += 1; continue; }
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
  publicJavaScriptBridges: publicJs.length - earlyBoot - vendored,
  publicEarlyBootScripts: earlyBoot,
  publicVendoredScripts: vendored
}));
