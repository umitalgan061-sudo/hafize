import assert from 'node:assert/strict';
import {
  normalizeScreenCaptureMetadata,
  SCREEN_CAPTURE_LIMITS
} from '../lib/screen-capture-metadata.mjs';

const valid = normalizeScreenCaptureMetadata({
  explicitUserIntent: true,
  mimeType: 'image/jpeg',
  byteLength: 128000,
  width: 1280,
  height: 720
});
assert.equal(valid.ok, true);
assert.deepEqual(valid.metadata, {
  mimeType: 'image/jpeg',
  byteLength: 128000,
  width: 1280,
  height: 720
});
assert.equal('explicitUserIntent' in valid.metadata, false);

for (const [input, error] of [
  [{ mimeType: 'image/jpeg', byteLength: 1, width: 1, height: 1 }, 'SCREEN_CAPTURE_REQUIRES_EXPLICIT_USER_INTENT'],
  [{ explicitUserIntent: true, mimeType: 'image/png', byteLength: 1, width: 1, height: 1 }, 'SCREEN_CAPTURE_UNSUPPORTED_MIME'],
  [{ explicitUserIntent: true, mimeType: 'image/jpeg', byteLength: SCREEN_CAPTURE_LIMITS.bytes + 1, width: 1, height: 1 }, 'SCREEN_CAPTURE_INVALID_SIZE'],
  [{ explicitUserIntent: true, mimeType: 'image/jpeg', byteLength: 1, width: 1281, height: 1 }, 'SCREEN_CAPTURE_INVALID_DIMENSIONS'],
  [{ explicitUserIntent: true, mimeType: 'image/jpeg', byteLength: 1, width: 1, height: 721 }, 'SCREEN_CAPTURE_INVALID_DIMENSIONS'],
  [{ explicitUserIntent: true, mimeType: 'image/jpeg', byteLength: 1, width: 1, height: 1, sourceUrl: 'x' }, 'INVALID_SCREEN_CAPTURE:field']
]) {
  assert.deepEqual(normalizeScreenCaptureMetadata(input), { ok: false, error });
}

assert.deepEqual(normalizeScreenCaptureMetadata(null), { ok: false, error: 'INVALID_SCREEN_CAPTURE:input' });
console.log('screen capture metadata tests passed');
