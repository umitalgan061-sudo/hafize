import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ui = require('../public/screen-analysis-ui.js');
const client = require('../public/screen-analysis-client.js');

assert.equal(ui.MAX_PROMPT_CHARS, 1200);
assert.equal(ui.PROMPT_PREVIEW_CHARS, 240);
assert.equal(ui.normalizePrompt('  ekrana bak  '), 'ekrana bak');
assert.equal(ui.normalizePrompt('satır 1\r\nsatır 2'), 'satır 1\nsatır 2');
assert.equal(ui.normalizePrompt(''), null);
assert.equal(ui.normalizePrompt('x'.repeat(1201)), null);
assert.equal(ui.normalizePrompt('a\0b'), null);
assert.equal(ui.normalizeNvidiaModel(' nvidia/model '), 'nvidia/model');
assert.equal(ui.normalizeNvidiaModel('local:qwen2.5'), null);
assert.equal(ui.normalizeNvidiaModel('nvidia/model\nother'), null);
assert.equal(ui.previewText('  çok   boşluk   var  '), 'çok boşluk var');
assert.equal(ui.previewText('abcdef', 4), 'abc…');

const blob = new Blob(['jpeg'], { type: 'image/jpeg' });
const capture = { blob, width: 1280, height: 720 };
const snapshot = ui.createReviewSnapshot({ capture, model: 'nvidia/vision', prompt: 'Ekranı açıkla' });
assert.ok(snapshot);
assert.equal(snapshot.capture, capture);
assert.equal(snapshot.model, 'nvidia/vision');
assert.equal(snapshot.prompt, 'Ekranı açıkla');
assert.equal(snapshot.width, 1280);
assert.equal(snapshot.height, 720);
assert.equal(ui.createReviewSnapshot({ capture, model: 'local:model', prompt: 'Ekranı açıkla' }), null);
assert.equal(ui.createReviewSnapshot({ capture: { blob, width: 0, height: 720 }, model: 'nvidia/vision', prompt: 'Ekranı açıkla' }), null);
assert.equal(ui.sameSnapshot(snapshot, { capture, model: 'nvidia/vision', prompt: 'Ekranı açıkla' }), true);
assert.equal(ui.sameSnapshot(snapshot, { capture, model: 'nvidia/vision', prompt: 'Değişti' }), false);
assert.equal(ui.sameSnapshot(snapshot, { capture: { ...capture }, model: 'nvidia/vision', prompt: 'Ekranı açıkla' }), false, 'capture identity must be exact');

assert.equal(client.MAX_PROMPT_CHARS, 4000);
assert.equal(client.normalizeNvidiaModel('nvidia/model'), 'nvidia/model');
assert.equal(client.normalizeNvidiaModel('local:llama'), null);
assert.equal(client.normalizePrompt('  soru  '), 'soru');
assert.equal(client.normalizePrompt('x'.repeat(4001)), null);

await assert.rejects(
  () => client.analyzeCapture({ capture, model: 'local:qwen', prompt: 'bak', explicitUserIntent: true, fetchImpl: async () => { throw new Error('SHOULD_NOT_FETCH'); } }),
  /SCREEN_ANALYSIS_NVIDIA_MODEL_REQUIRED/
);
await assert.rejects(
  () => client.analyzeCapture({ capture, model: 'nvidia/vision', prompt: 'bak', explicitUserIntent: false }),
  /SCREEN_ANALYSIS_CONFIRMATION_REQUIRED/
);
await assert.rejects(
  () => client.analyzeCapture({ capture, model: 'nvidia/vision', prompt: '', explicitUserIntent: true }),
  /SCREEN_ANALYSIS_INPUT_REQUIRED/
);

class FakeReader {
  readAsDataURL() {
    this.result = 'data:image/jpeg;base64,/9j/2Q==';
    this.onload();
  }
}
let request = null;
const response = await client.analyzeCapture({
  capture,
  model: ' nvidia/vision ',
  prompt: '  Bu görüntüyü açıkla. ',
  explicitUserIntent: true,
  FileReaderCtor: FakeReader,
  fetchImpl: async (url, init) => {
    request = { url, init };
    return {
      ok: true,
      async json() { return { content: 'Sonuç', model: 'nvidia/vision' }; }
    };
  }
});
assert.deepEqual(response, { content: 'Sonuç', model: 'nvidia/vision' });
assert.equal(request.url, '/api/screen-analysis');
assert.equal(request.init.method, 'POST');
assert.equal(request.init.cache, 'no-store');
const body = JSON.parse(request.init.body);
assert.deepEqual(Object.keys(body).sort(), ['explicitUserIntent', 'image', 'model', 'prompt'].sort());
assert.equal(body.explicitUserIntent, true);
assert.equal(body.model, 'nvidia/vision');
assert.equal(body.prompt, 'Bu görüntüyü açıkla.');
assert.equal(body.image, 'data:image/jpeg;base64,/9j/2Q==');

console.log('screen analysis consent helper tests passed');