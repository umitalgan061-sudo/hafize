import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/screen-analysis-client.js');

const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
const capture = Object.freeze({ blob: new Blob([JPEG_BYTES], { type: 'image/jpeg' }) });

class ImmediateReader {
  readAsDataURL(blob) {
    assert.equal(blob, capture.blob);
    this.result = 'data:image/jpeg;base64,/9j/2Q==';
    queueMicrotask(() => this.onload?.());
  }
}

{
  let called = false;
  await assert.rejects(api.analyzeCapture({
    capture,
    model: 'meta/llama-3.2-90b-vision-instruct',
    prompt: 'Bu ekranı açıkla',
    explicitUserIntent: false,
    FileReaderCtor: ImmediateReader,
    fetchImpl: async () => { called = true; }
  }), /SCREEN_ANALYSIS_CONFIRMATION_REQUIRED/);
  assert.equal(called, false, 'no network request without explicit user intent');
}

{
  let called = false;
  await assert.rejects(api.analyzeCapture({
    capture,
    model: 'local:qwen2.5-vl',
    prompt: 'Ekranı açıkla',
    explicitUserIntent: true,
    FileReaderCtor: ImmediateReader,
    fetchImpl: async () => { called = true; }
  }), /SCREEN_ANALYSIS_NVIDIA_MODEL_REQUIRED/);
  assert.equal(called, false, 'local provider cannot receive screen capture through NVIDIA screen-analysis route');
}

{
  let called = false;
  await assert.rejects(api.analyzeCapture({
    capture,
    model: 'meta/llama-3.2-90b-vision-instruct',
    prompt: '   ',
    explicitUserIntent: true,
    FileReaderCtor: ImmediateReader,
    fetchImpl: async () => { called = true; }
  }), /SCREEN_ANALYSIS_INPUT_REQUIRED/);
  assert.equal(called, false);
}

{
  let called = false;
  await assert.rejects(api.analyzeCapture({
    model: 'meta/llama-3.2-90b-vision-instruct',
    prompt: 'Ekranı açıkla',
    explicitUserIntent: true,
    FileReaderCtor: ImmediateReader,
    fetchImpl: async () => { called = true; }
  }), /SCREEN_CAPTURE_REQUIRED/);
  assert.equal(called, false);
}

{
  const outer = new AbortController();
  outer.abort('closed-before-encode');
  let called = false;
  await assert.rejects(api.analyzeCapture({
    capture,
    model: 'meta/llama-3.2-90b-vision-instruct',
    prompt: 'Ekranı açıkla',
    explicitUserIntent: true,
    signal: outer.signal,
    FileReaderCtor: ImmediateReader,
    fetchImpl: async () => { called = true; }
  }), (error) => error?.code === 'SCREEN_ANALYSIS_CANCELLED');
  assert.equal(called, false);
}

{
  const outer = new AbortController();
  let called = false;
  class AbortAfterEncodeReader {
    readAsDataURL() {
      this.result = 'data:image/jpeg;base64,/9j/2Q==';
      queueMicrotask(() => {
        this.onload?.();
        outer.abort('draft-cleared-after-encode');
      });
    }
  }
  await assert.rejects(api.analyzeCapture({
    capture,
    model: 'meta/llama-3.2-90b-vision-instruct',
    prompt: 'Ekranı açıkla',
    explicitUserIntent: true,
    signal: outer.signal,
    FileReaderCtor: AbortAfterEncodeReader,
    fetchImpl: async () => { called = true; }
  }), (error) => error?.code === 'SCREEN_ANALYSIS_CANCELLED');
  assert.equal(called, false, 'cancellation after encoding still prevents image transmission');
}

{
  let body = null;
  let optionsSeen = null;
  const response = await api.analyzeCapture({
    capture,
    model: ' meta/llama-3.2-90b-vision-instruct ',
    prompt: '  Bu ekrandaki ana problemi açıkla.  ',
    explicitUserIntent: true,
    FileReaderCtor: ImmediateReader,
    fetchImpl: async (path, options) => {
      assert.equal(path, api.ENDPOINT);
      optionsSeen = options;
      body = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({ content: '  Sonuç hazır.  ', model: 'meta/llama-3.2-90b-vision-instruct' })
      };
    }
  });

  assert.equal(optionsSeen.credentials, 'same-origin');
  assert.equal(optionsSeen.cache, 'no-store');
  assert.equal(body.explicitUserIntent, true);
  assert.equal(body.model, 'meta/llama-3.2-90b-vision-instruct');
  assert.equal(body.prompt, 'Bu ekrandaki ana problemi açıkla.');
  assert.equal(body.image, 'data:image/jpeg;base64,/9j/2Q==');
  assert.deepEqual(response, {
    content: 'Sonuç hazır.',
    model: 'meta/llama-3.2-90b-vision-instruct'
  });
}

{
  await assert.rejects(api.analyzeCapture({
    capture,
    model: 'meta/llama-3.2-90b-vision-instruct',
    prompt: 'Ekranı açıkla',
    explicitUserIntent: true,
    FileReaderCtor: ImmediateReader,
    fetchImpl: async () => ({ ok: false, status: 403, json: async () => ({ error: 'SCREEN_ANALYSIS_ORIGIN_DENIED' }) })
  }), /SCREEN_ANALYSIS_ORIGIN_DENIED/);
}

{
  await assert.rejects(api.analyzeCapture({
    capture,
    model: 'meta/llama-3.2-90b-vision-instruct',
    prompt: 'Ekranı açıkla',
    explicitUserIntent: true,
    FileReaderCtor: ImmediateReader,
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ content: '   ' }) })
  }), /INVALID_SCREEN_ANALYSIS_RESPONSE/);
}

console.log('screen analysis consent boundary tests passed');
