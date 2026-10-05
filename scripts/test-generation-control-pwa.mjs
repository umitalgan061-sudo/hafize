import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const sw = await readFile(new URL('../public/sw-policy.ts', import.meta.url), 'utf8');
const vite = await readFile(new URL('../vite.config.ts', import.meta.url), 'utf8');
const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');

assert.match(sw, /\/generation-control\.css/);
assert.match(vite, /generation-control\.ts/);
assert.match(vite, /app-shell\.ts/);
assert.match(html, /\/typed-build\/app-shell\.js/);
assert.doesNotMatch(html, /\/generation-control\.js/);
console.log('generation-control pwa/build wiring: OK');
