import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { evaluatePwaReadiness, PWA_READINESS_CONTRACT } from '../lib/pwa-readiness.mjs';
import { PUBLIC_DIR, shellAssetFile, swPolicy } from './shell-cache-contract.mjs';

// The readiness contract used to be exercised only against a hand-written
// fixture, so the shipped manifest could drift away from it unnoticed. This
// suite runs the real manifest and the real shell list through the same checks,
// then confirms every declared icon exists on disk at the size it claims.

const manifest = JSON.parse(readFileSync(path.join(PUBLIC_DIR, 'manifest.webmanifest'), 'utf8'));

const readiness = evaluatePwaReadiness({
  manifest,
  shellPaths: swPolicy.SHELL_ASSETS,
  serviceWorker: { networkOnlyApi: true, offlineFallback: true }
});
assert.deepEqual(readiness.manifest.issues, [], 'the shipped manifest meets the readiness contract');
assert.deepEqual(readiness.shell.missing, [], 'the shell caches every required path');
assert.deepEqual(readiness.shell.forbiddenCachedPaths, [], 'nothing forbidden is precached');
assert.equal(readiness.pass, true);

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Width and height from a PNG's IHDR chunk, which is always the first chunk. */
function pngSize(file) {
  const bytes = readFileSync(file);
  assert.ok(bytes.subarray(0, 8).equals(PNG_MAGIC), `${file} is a PNG`);
  assert.equal(bytes.toString('latin1', 12, 16), 'IHDR', `${file} starts with IHDR`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 3, 'the manifest declares an icon set');
for (const icon of manifest.icons) {
  assert.ok(icon.src.startsWith('/'), `${icon.src} is a same-origin path`);
  assert.equal(icon.type, 'image/png', `${icon.src} is declared as PNG`);

  // Icons have to survive offline too, or an installed app loses its own mark.
  assert.ok(swPolicy.SHELL_ASSETS.includes(icon.src), `${icon.src} is cached by the service worker`);

  const file = shellAssetFile(icon.src);
  assert.ok(file, `${icon.src} resolves to a file`);
  const declared = /^(\d+)x(\d+)$/.exec(icon.sizes);
  assert.ok(declared, `${icon.src} declares a single WxH size`);
  const actual = pngSize(file);
  assert.equal(actual.width, Number(declared[1]), `${icon.src} is ${icon.sizes} wide on disk`);
  assert.equal(actual.height, Number(declared[2]), `${icon.src} is ${icon.sizes} tall on disk`);
}

const anyIcons = manifest.icons.filter((icon) => String(icon.purpose ?? 'any').split(/\s+/).includes('any'));
const maskable = manifest.icons.filter((icon) => String(icon.purpose ?? '').split(/\s+/).includes('maskable'));
assert.ok(
  anyIcons.some((icon) => pngSize(shellAssetFile(icon.src)).width >= PWA_READINESS_CONTRACT.minInstallIconEdge),
  `an installable icon of at least ${PWA_READINESS_CONTRACT.minInstallIconEdge}px ships`
);
assert.ok(
  anyIcons.some((icon) => pngSize(shellAssetFile(icon.src)).width >= PWA_READINESS_CONTRACT.largeIconEdge),
  `a ${PWA_READINESS_CONTRACT.largeIconEdge}px icon ships for splash screens`
);
assert.ok(maskable.length >= 1, 'a maskable icon ships for launchers that crop');

// The install button only ever appears through the browser's own prompt event.
const html = readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8');
assert.match(html, /<link rel="manifest" href="\/manifest\.webmanifest" \/>/);
assert.match(html, /rel="apple-touch-icon" href="\/icon-192\.png"/, 'iOS gets a PNG home-screen icon');
assert.match(html, /id="installBtn"/);

console.log('pwa manifest assets OK: installable icon set, cached offline, sizes match the files on disk');
