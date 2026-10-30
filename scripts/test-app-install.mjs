import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deviceKind, sharedText, qrSvg } from '../public/typed/app-install.ts';
import { captureSupport, frameDifference, frameSize, shouldSendFrame } from '../public/typed/live-screen.ts';

assert.equal(deviceKind({ standalone: true, userAgent: 'iPhone' }), 'installed');
assert.equal(deviceKind({ standalone: false, userAgent: 'Mozilla (iPhone; CPU iPhone OS)' }), 'ios');
assert.equal(deviceKind({ standalone: false, userAgent: 'Mozilla (Macintosh)', maxTouchPoints: 5 }), 'ios', 'iPadOS poses as a Mac');
assert.equal(deviceKind({ standalone: false, userAgent: 'Mozilla (Macintosh)', maxTouchPoints: 0 }), 'desktop');
assert.equal(deviceKind({ standalone: false, userAgent: 'Mozilla (Linux; Android 15)' }), 'android');

assert.equal(sharedText(''), null);
assert.equal(sharedText('?action=new'), null);
assert.equal(sharedText('?title=Baslik&text=Govde&url=https%3A%2F%2Fa.b'), 'Baslik\nGovde\nhttps://a.b');
assert.match(qrSvg('https://192.168.1.2:4443/'), /^<svg/);

const frame = (value, changed = 0) => { const pixels = new Uint8ClampedArray(100 * 4).fill(value); for (let index = 0; index < changed; index += 1) pixels[index * 4] = 255; return pixels; };
assert.equal(frameDifference(null, frame(0)), 100, 'the first frame always counts as new');
assert.equal(frameDifference(frame(0), frame(0)), 0);
assert.equal(frameDifference(frame(0), frame(5)), 0, 'noise below the delta is ignored');
assert.equal(frameDifference(frame(0), frame(0, 3)), 3, 'a small text change is measured, not averaged away');

const base = { lastSentAt: 0, now: 60_000, busy: false };
assert.equal(shouldSendFrame({ ...base, difference: 1 }), true);
assert.equal(shouldSendFrame({ ...base, difference: 0 }), false, 'a still screen costs nothing');
assert.equal(shouldSendFrame({ ...base, difference: 1, source: 'camera' }), false, 'camera noise is not a change');
assert.equal(shouldSendFrame({ ...base, difference: 50, now: 5_000 }), false, 'rate limited');
assert.equal(shouldSendFrame({ ...base, difference: 50, busy: true }), false);
assert.deepEqual(frameSize(3840, 2160), { width: 1600, height: 900 });
assert.deepEqual(frameSize(800, 600), { width: 800, height: 600 });

assert.deepEqual(captureSupport({}), { secure: false, screen: false, camera: false });
assert.deepEqual(captureSupport({ isSecureContext: true, navigator: { mediaDevices: { getUserMedia() {} } } }), { secure: true, screen: false, camera: true }, 'phone: camera only');

const root = new URL('..', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('public/manifest.webmanifest', root), 'utf8'));
for (const size of ['192x192', '512x512']) assert.ok(manifest.icons.some((icon) => icon.sizes === size && icon.type === 'image/png'), `installable icon ${size}`);
assert.ok(manifest.icons.some((icon) => icon.purpose === 'maskable'));
assert.equal(manifest.display, 'standalone');
const index = readFileSync(new URL('public/index.html', root), 'utf8');
const sw = readFileSync(new URL('public/sw-policy.ts', root), 'utf8');
for (const asset of ['/typed-build/live-screen.js', '/typed-build/app-install.js', '/live-screen.css']) {
  assert.equal(index.includes(asset), true, `index.html loads ${asset}`);
  assert.equal(sw.includes(`"${asset}"`), true, `service worker caches ${asset}`);
}
for (const asset of ['/icons/icon-192.png', '/icons/icon-512.png']) assert.equal(sw.includes(`"${asset}"`), true, `service worker caches ${asset}`);
const guard = readFileSync(new URL('lib/production-guard.ts', root), 'utf8');
for (const route of ['/api/localhost', '/api/screen', '/api/install-info']) assert.equal(guard.includes(`'${route}'`), true, `${route} requires a principal`);
console.log('app install tests passed');
