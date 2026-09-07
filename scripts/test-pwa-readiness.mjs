import assert from 'node:assert/strict';
import { checkPwaManifest, checkPwaShell, evaluatePwaReadiness, PWA_READINESS_CONTRACT } from '../lib/pwa-readiness.mjs';

const manifest = {
  name: 'Hafize',
  short_name: 'Hafize',
  start_url: '/',
  display: 'standalone',
  icons: [{ src: '/hafize.jpeg', sizes: '512x512', type: 'image/jpeg' }]
};
const shell = ['/', '/index.html', '/offline.html', '/styles.css', '/app.js', '/sw.js', '/manifest.webmanifest'];

const manifestResult = checkPwaManifest(manifest);
assert.equal(manifestResult.pass, true);
assert.equal(manifestResult.iconCount, 1);
assert.equal(checkPwaManifest({ ...manifest, start_url: 'https://evil.example/' }).pass, false);
assert.throws(() => checkPwaManifest({ ...manifest, name: '' }), /INVALID_PWA_MANIFEST_NAME/);

const shellResult = checkPwaShell(shell);
assert.equal(shellResult.pass, true);
assert.equal(checkPwaShell([...shell, '/api/chat']).pass, false);
assert.equal(checkPwaShell(['/index.html']).missing.length, PWA_READINESS_CONTRACT.requiredShellPaths.length - 1);
assert.throws(() => checkPwaShell(null), /INVALID_PWA_SHELL/);

const ready = evaluatePwaReadiness({
  manifest,
  shellPaths: shell,
  serviceWorker: { networkOnlyApi: true, offlineFallback: true }
});
assert.equal(ready.pass, true);
const notReady = evaluatePwaReadiness({ manifest, shellPaths: shell, serviceWorker: { networkOnlyApi: false, offlineFallback: true } });
assert.equal(notReady.pass, false);

console.log('pwa readiness tests passed');
