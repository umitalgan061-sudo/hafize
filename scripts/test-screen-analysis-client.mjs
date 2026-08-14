import assert from 'node:assert/strict';
import client from '../public/screen-analysis-client.js';

class FakeReader {
  readAsDataURL(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString('base64')}`;
      this.onload?.();
    }, () => this.onerror?.());
  }
}

const jpeg = new Blob([Buffer.from([0xff, 0xd8, 0x10, 0xff, 0xd9])], { type: 'image/jpeg' });
const capture = { blob: jpeg, width: 120, height: 80, mimeType: 'image/jpeg' };
const dataUrl = await client.blobToDataUrl(jpeg, FakeReader);
assert.match(dataUrl, /^data:image\/jpeg;base64,/);
assert.equal(client.ENDPOINT, '/api/screen-analysis');

await assert.rejects(
  client.analyzeCapture({ capture, model: 'vision', prompt: 'bak', explicitUserIntent: false, FileReaderCtor: FakeReader }),
  /SCREEN_ANALYSIS_CONFIRMATION_REQUIRED/
);

const calls = [];
const result = await client.analyzeCapture({
  capture,
  model: ' nvidia/vision-test ',
  prompt: ' Bu ekrandaki problemi bul. ',
  explicitUserIntent: true,
  FileReaderCtor: FakeReader,
  async fetchImpl(url, init) {
    calls.push({ url, init });
    return { ok: true, async json() { return { content: 'Bir hata paneli var.', model: 'nvidia/vision-test' }; } };
  }
});
assert.deepEqual(result, { content: 'Bir hata paneli var.', model: 'nvidia/vision-test' });
assert.equal(calls.length, 1);
assert.equal(calls[0].url, '/api/screen-analysis');
assert.equal(calls[0].init.method, 'POST');
assert.equal(calls[0].init.cache, 'no-store');
const sent = JSON.parse(calls[0].init.body);
assert.equal(sent.explicitUserIntent, true);
assert.equal(sent.model, 'nvidia/vision-test');
assert.equal(sent.prompt, 'Bu ekrandaki problemi bul.');
assert.match(sent.image, /^data:image\/jpeg;base64,/);
assert.equal(Object.hasOwn(sent, 'ownerId'), false);
assert.equal(Object.hasOwn(sent, 'token'), false);

let fetchCalls = 0;
await assert.rejects(client.analyzeCapture({ capture: null, model: 'x', prompt: 'y', explicitUserIntent: true, fetchImpl() { fetchCalls += 1; } }), /SCREEN_CAPTURE_REQUIRED/);
assert.equal(fetchCalls, 0);

const png = new Blob([Buffer.from('png')], { type: 'image/png' });
await assert.rejects(client.blobToDataUrl(png, FakeReader), /INVALID_SCREEN_CAPTURE/);
const tooLarge = new Blob([new Uint8Array(client.MAX_IMAGE_BYTES + 1)], { type: 'image/jpeg' });
await assert.rejects(client.blobToDataUrl(tooLarge, FakeReader), /INVALID_SCREEN_CAPTURE/);

await assert.rejects(client.analyzeCapture({
  capture,
  model: 'vision',
  prompt: 'bak',
  explicitUserIntent: true,
  FileReaderCtor: FakeReader,
  async fetchImpl() { return { ok: false, async json() { return { error: 'INVALID_SCREEN_ANALYSIS_REQUEST', detail: '/tmp/private' }; } }; }
}), /INVALID_SCREEN_ANALYSIS_REQUEST/);

console.log('screen analysis client tests passed');
