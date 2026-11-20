import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const config = JSON.parse(readFileSync(resolve(root, 'firebase.recovery.json'), 'utf8'));
assert.equal(config?.hosting?.site, 'hafize-ua');
assert.equal(config?.hosting?.public, 'public');
assert.ok(statSync(resolve(root, config.hosting.public, 'index.html')).isFile());
assert.deepEqual(config.hosting.rewrites || [], [], 'Missing JS/CSS/API must not rewrite to index.html');
assert.deepEqual(config.hosting.redirects || [], [], 'Must not redirect API/assets');
for (const pattern of ['**/.*','**/*.ts','**/*.map']) {
  assert.ok(config.hosting.ignore.includes(pattern), 'Unignored sensitive source: ' + pattern);
}
for (const extension of ['html','js','css']) {
  assert.ok(config.hosting.headers.some((entry) => entry.source === '**/*.' + extension &&
    entry.headers.some((h) => h.key.toLowerCase() === 'cache-control' && h.value.includes('revalidate'))));
}
assert.equal(Object.prototype.hasOwnProperty.call(config, 'functions'), false);
console.log('Firebase recovery config validated; no production deploy');
