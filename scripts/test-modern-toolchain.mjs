import { readFile } from 'node:fs/promises';

const files = {
  package: 'package.json',
  tsconfig: 'tsconfig.json',
  vite: 'vite.config.ts',
  vitest: 'vitest.config.ts',
  api: 'public/typed/hafize-api.ts',
  types: 'public/typed/hafize-types.ts',
  runtime: 'public/typed/app-runtime.ts',
  guard: 'lib/production-guard.ts',
  index: 'public/index.html',
  sw: 'public/sw-policy.js'
};

const text = {};
for (const [name, path] of Object.entries(files)) text[name] = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(`modern-toolchain: ${message}`);
}

const pkg = JSON.parse(text.package);
const tsconfig = JSON.parse(text.tsconfig);

assert(pkg.engines?.node === '>=24.21.0', 'Node 24.21+ engine missing');
assert(pkg.devDependencies?.typescript?.startsWith('^7.0.2'), 'TypeScript 7.0.2+ is not pinned');
assert(pkg.devDependencies?.vite?.startsWith('^8.3.0'), 'Vite 8.3.0+ is not pinned');
assert(pkg.devDependencies?.vitest?.startsWith('^5.'), 'Vitest 5 is not pinned');
assert(pkg.scripts?.start === 'node --import ./lib/production-guard.ts server.mjs', 'production start must preload typed guard');
assert(pkg.scripts?.['dev:server'] === 'node --import ./lib/production-guard.ts server.mjs', 'development server must preload typed guard');
assert(pkg.scripts?.build === 'tsc --noEmit && vite build', 'build script must typecheck before bundling');
assert(pkg.scripts?.prestart === 'npm run build', 'production start must build typed assets');
assert(pkg.scripts?.typecheck === 'tsc --noEmit', 'typecheck script missing');
assert(pkg.scripts?.['check:modern']?.includes('test-modern-toolchain.mjs'), 'modern verification command missing source contract');
assert(tsconfig.compilerOptions?.strict === true, 'strict TypeScript is required');
assert(tsconfig.compilerOptions?.moduleResolution === 'bundler', 'bundler module resolution is required');
assert(tsconfig.compilerOptions?.erasableSyntaxOnly === true, 'runtime-safe TypeScript syntax policy is required');
assert(tsconfig.include?.includes('public/**/*.ts'), 'browser TypeScript sources are not in typecheck include');
assert(tsconfig.include?.includes('lib/**/*.ts'), 'Node TypeScript security sources are not in typecheck include');
assert(text.vite.includes("'app-runtime': resolve(ROOT, 'public/typed/app-runtime.ts')"), 'runtime entry missing from Vite');
assert(text.vite.includes("'prompt-library-smart-fill': resolve(ROOT, 'public/prompt-library-smart-fill.ts')"), 'Smart Fill entry missing');
assert(text.vite.includes("'prompt-library-command-palette': resolve(ROOT, 'public/prompt-library-command-palette.ts')"), 'Command Palette entry missing');
assert(text.vite.includes("'scheduled-tasks-countdown': resolve(ROOT, 'public/scheduled-tasks-countdown.ts')"), 'Countdown entry missing');
assert(text.vite.includes("'prompt-library-smart-fill-hints': resolve(ROOT, 'public/prompt-library-smart-fill-hints.ts')"), 'Smart Fill hints entry missing');
assert(text.vite.includes("'/api':"), 'development API proxy missing');
assert(text.vite.includes('transformIndexHtml'), 'Vite development typed-entry transform missing');
assert(text.api.includes('retryable'), 'typed API error resilience missing');
assert(text.api.includes('TimeoutError'), 'typed API timeout boundary missing');
assert(text.runtime.includes("'hafize:runtime-ready'"), 'runtime lifecycle event missing');
assert(text.guard.includes("--import ./lib/production-guard.ts") === false, 'runtime source must not embed its own launcher');
assert(text.guard.includes('timingSafeEqual'), 'typed guard must preserve constant-time CSRF comparison');
assert(text.guard.includes('HAFIZE_AUTH_TOKEN_REQUIRED_FOR_PUBLIC_RUNTIME'), 'typed guard must preserve public-auth fail-closed behavior');
assert(text.guard.includes('X-Hafize-Request-Id'), 'typed guard must preserve request correlation');
assert(text.index.includes('/typed-build/app-runtime.js'), 'compiled runtime is not loaded by HTML');
assert(text.index.includes('/typed-build/prompt-library-smart-fill.js'), 'compiled Smart Fill is not loaded by HTML');
assert(text.index.includes('/typed-build/prompt-library-command-palette.js'), 'compiled Command Palette is not loaded by HTML');
assert(text.index.includes('/typed-build/scheduled-tasks-countdown.js'), 'compiled Countdown is not loaded by HTML');
assert(text.index.includes('/typed-build/prompt-library-smart-fill-hints.js'), 'compiled Smart Fill hints are not loaded by HTML');
assert(!text.index.includes('prompt-library-smart-fill.js" defer'), 'legacy Smart Fill script remains in HTML');
assert(!text.index.includes('prompt-library-command-palette.js" defer'), 'legacy Command Palette script remains in HTML');
assert(!text.index.includes('scheduled-tasks-countdown.js" defer'), 'legacy Countdown script remains in HTML');
assert(!text.index.includes('prompt-library-smart-fill-hints.js" defer'), 'legacy Smart Fill hints remain in HTML');
assert(text.sw.includes('hafize-shell-v35'), 'service worker cache version must be v35');
assert(text.sw.includes('/typed-build/app-runtime.js'), 'runtime build missing from PWA shell');
assert(text.sw.includes('/typed-build/prompt-library-smart-fill.js'), 'Smart Fill build missing from PWA shell');
assert(text.sw.includes('/typed-build/prompt-library-command-palette.js'), 'Command Palette build missing from PWA shell');
assert(text.sw.includes('/typed-build/scheduled-tasks-countdown.js'), 'Countdown build missing from PWA shell');
assert(text.sw.includes('/typed-build/prompt-library-smart-fill-hints.js'), 'Smart Fill hints build missing from PWA shell');
assert(!text.api.includes('Authorization'), 'browser API client must not own auth credentials');
console.log('modern-toolchain: source contracts ok');
