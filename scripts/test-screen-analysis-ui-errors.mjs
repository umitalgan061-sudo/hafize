import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ui = require('../public/screen-analysis-ui.js');

assert.equal(
  ui.analysisFailureMessage({ name: 'AbortError', code: 'SCREEN_ANALYSIS_TIMEOUT', message: 'SCREEN_ANALYSIS_TIMEOUT' }),
  'Ekran analizi zaman aşımına uğradı; görüntü isteği kapatıldı. Yeniden denemek için tekrar gözden geçir.'
);
assert.equal(
  ui.analysisFailureMessage({ name: 'AbortError', code: 'SCREEN_ANALYSIS_CANCELLED', message: 'SCREEN_ANALYSIS_CANCELLED' }),
  'Ekran analizi iptal edildi.'
);
assert.equal(
  ui.analysisFailureMessage({ name: 'AbortError', message: 'aborted' }),
  'Ekran analizi iptal edildi.'
);
assert.equal(
  ui.analysisFailureMessage(new Error('SCREEN_ANALYSIS_NVIDIA_MODEL_REQUIRED')),
  'Ekran analizi için NVIDIA modeli gerekiyor.'
);
assert.equal(
  ui.analysisFailureMessage(new Error('SCREEN_ANALYSIS_FAILED')),
  'Ekran analizi tamamlanamadı.'
);
assert.equal(
  ui.analysisFailureMessage(null),
  'Ekran analizi tamamlanamadı.'
);

assert.equal(ui.normalizePrompt('  ekranı açıkla  '), 'ekranı açıkla');
assert.equal(ui.normalizePrompt('   '), null);
assert.equal(ui.normalizePrompt('a'.repeat(ui.MAX_PROMPT_CHARS + 1)), null);
assert.equal(ui.normalizePrompt('a\0b'), null);
assert.equal(ui.normalizeNvidiaModel(' meta/vision '), 'meta/vision');
assert.equal(ui.normalizeNvidiaModel('local:qwen-vl'), null);
assert.equal(ui.normalizeNvidiaModel(''), null);
assert.equal(ui.previewText('  bir   iki   üç  ', 20), 'bir iki üç');
assert.equal(ui.previewText('abcdefghij', 6), 'abcde…');

const capture = Object.freeze({
  blob: new Blob(['jpeg'], { type: 'image/jpeg' }),
  width: 1280,
  height: 720,
  mimeType: 'image/jpeg'
});
const snapshot = ui.createReviewSnapshot({
  capture,
  model: 'meta/vision',
  prompt: 'Ekranı açıkla'
});
assert.ok(snapshot);
assert.equal(Object.isFrozen(snapshot), true);
assert.equal(snapshot.capture, capture);
assert.equal(snapshot.model, 'meta/vision');
assert.equal(snapshot.prompt, 'Ekranı açıkla');
assert.equal(snapshot.width, 1280);
assert.equal(snapshot.height, 720);
assert.equal(ui.sameSnapshot(snapshot, { capture, model: 'meta/vision', prompt: 'Ekranı açıkla' }), true);
assert.equal(ui.sameSnapshot(snapshot, { capture, model: 'meta/other', prompt: 'Ekranı açıkla' }), false);
assert.equal(ui.sameSnapshot(snapshot, { capture, model: 'meta/vision', prompt: 'Farklı talimat' }), false);
assert.equal(ui.sameSnapshot(snapshot, { capture: { ...capture }, model: 'meta/vision', prompt: 'Ekranı açıkla' }), false);

assert.equal(ui.createReviewSnapshot({ capture: null, model: 'meta/vision', prompt: 'x' }), null);
assert.equal(ui.createReviewSnapshot({ capture: { blob: capture.blob, width: 0, height: 720 }, model: 'meta/vision', prompt: 'x' }), null);
assert.equal(ui.createReviewSnapshot({ capture, model: 'local:qwen-vl', prompt: 'x' }), null);
assert.equal(ui.createReviewSnapshot({ capture, model: 'meta/vision', prompt: '' }), null);

console.log('screen analysis UI error and review contract tests passed');
