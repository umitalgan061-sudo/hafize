import { readFile } from 'node:fs/promises';
import { access } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const names = [
  'app','auth','chat-composer-features','conversation-workspace',
  'conversation-workspace-keyboard','message-workspace-policy',
  'message-workspace','workspace-navigation'
];

async function exists(path) {
  try { await access(new URL(path, root)); return true; }
  catch { return false; }
}

function assert(condition, message) {
  if (!condition) throw new Error(`browser-typescript-migration: ${message}`);
}

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const vite = await readFile(new URL('../vite.config.ts', import.meta.url), 'utf8');
const sw = await readFile(new URL('../public/sw-policy.js', import.meta.url), 'utf8');

for (const name of names) {
  assert(await exists(`public/${name}.ts`), `missing-source:${name}`);
  assert(vite.includes(`'${name}': resolve(ROOT, 'public/${name}.ts')`), `missing-vite-entry:${name}`);
  assert(html.includes(`/typed-build/${name}.js`), `missing-html-entry:${name}`);
  assert(sw.includes(`/typed-build/${name}.js`), `missing-pwa-entry:${name}`);
  assert(!html.includes(`/${name}.js" defer`), `legacy-html-entry:${name}`);
}

const packageData = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
assert(packageData.scripts.start.includes('server.ts'), 'server-start-is-not-typed');
assert(packageData.scripts['dev:server'].includes('server.ts'), 'server-dev-is-not-typed');

const server = await readFile(new URL('../server.ts', import.meta.url), 'utf8');
assert(server.includes('./lib/agent-runtime.ts'), 'typed-server-agent-boundary');
assert(server.includes('./lib/tool-runtime.ts'), 'typed-server-tool-boundary');
assert(server.includes('./lib/request-failure.ts'), 'typed-server-error-boundary');
assert(!server.includes('.mjs'), 'typed-server-imports-legacy-runtime');

const shim = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
assert(shim.includes("import './server.ts';"), 'legacy-server-shim-missing');

console.log(`browser-typescript-migration: ${names.length} browser entries and typed server entry protected`);
