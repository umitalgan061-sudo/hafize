import assert from 'node:assert/strict';
import { checkPwaIcons, checkPwaManifest, checkPwaShell, evaluatePwaReadiness, PWA_READINESS_CONTRACT } from '../lib/pwa-readiness.mjs';

const icons = [
  { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
];
const manifest = {
  name: 'Hafize',
  short_name: 'Hafize',
  start_url: '/',
  display: 'standalone',
  icons
};
const shell = ['/', '/index.html', '/offline.html', '/styles.css', '/app.js', '/manifest.webmanifest'];

const manifestResult = checkPwaManifest(manifest);
assert.equal(manifestResult.pass, true);
assert.equal(manifestResult.iconCount, 3);
assert.equal(checkPwaManifest({ ...manifest, start_url: 'https://evil.example/' }).pass, false);
assert.throws(() => checkPwaManifest({ ...manifest, name: '' }), /INVALID_PWA_MANIFEST_NAME/);

// Icons: an install prompt needs a square 192px `any` icon, a 512px icon and a
// maskable one. Each of those is checked on its own so a regression names itself.
assert.equal(checkPwaIcons(icons).pass, true);
assert.equal(checkPwaIcons(icons).installable, 512);
assert.equal(checkPwaIcons(icons).maskable, 512);
assert.deepEqual(checkPwaIcons([]).issues, ['icons:missing']);
assert.deepEqual(checkPwaIcons(undefined).issues, ['icons:missing']);

// The single 191x191 icon Hafize used to ship is one pixel under the bar.
const undersized = checkPwaIcons([{ src: '/hafize.jpeg', sizes: '191x191', type: 'image/jpeg' }]);
assert.equal(undersized.pass, false);
assert.ok(undersized.issues.includes('icons:no-square-192px-any'));
assert.ok(undersized.issues.includes('icons:no-512px'));
assert.ok(undersized.issues.includes('icons:no-maskable'));

// A non-square box does not count, and a maskable-only set still lacks an `any` icon.
assert.equal(checkPwaIcons([{ src: '/wide.png', sizes: '512x256' }]).installable, 0);
assert.equal(checkPwaIcons([{ src: '/a.png', sizes: '512x512', purpose: 'maskable' }]).pass, false);
assert.equal(checkPwaIcons([{ src: '/a.png', sizes: '192x192 512x512', purpose: 'any maskable' }]).pass, true);
assert.ok(checkPwaIcons([{ sizes: '512x512' }]).issues.includes('icons:unparsable-entry'));

const shellResult = checkPwaShell(shell);
assert.equal(shellResult.pass, true);
assert.equal(checkPwaShell([...shell, '/api/chat']).pass, false);
assert.deepEqual(checkPwaShell([...shell, '/api/chat']).forbiddenCachedPaths, ['/api/chat']);
// The worker script must not be precached, or the cache pins an old worker.
assert.equal(checkPwaShell([...shell, '/sw.js']).pass, false);
assert.deepEqual(checkPwaShell([...shell, '/sw.js']).forbiddenCachedPaths, ['/sw.js']);
assert.equal(checkPwaShell(['/index.html']).missing.length, PWA_READINESS_CONTRACT.requiredShellPaths.length - 1);
assert.throws(() => checkPwaShell(null), /INVALID_PWA_SHELL/);

assert.equal(PWA_READINESS_CONTRACT.minInstallIconEdge, 192);
assert.equal(PWA_READINESS_CONTRACT.largeIconEdge, 512);
assert.deepEqual([...PWA_READINESS_CONTRACT.forbiddenShellPaths], ['/sw.js']);

const ready = evaluatePwaReadiness({
  manifest,
  shellPaths: shell,
  serviceWorker: { networkOnlyApi: true, offlineFallback: true }
});
assert.equal(ready.pass, true);
const notReady = evaluatePwaReadiness({ manifest, shellPaths: shell, serviceWorker: { networkOnlyApi: false, offlineFallback: true } });
assert.equal(notReady.pass, false);
assert.equal(evaluatePwaReadiness({
  manifest: { ...manifest, icons: [{ src: '/hafize.jpeg', sizes: '191x191' }] },
  shellPaths: shell,
  serviceWorker: { networkOnlyApi: true, offlineFallback: true }
}).pass, false);

console.log('pwa readiness tests passed');
