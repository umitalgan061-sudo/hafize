// Streaming behaviour: partial answers stay readable, and per-delta paints are
// coalesced into one frame instead of rebuilding the DOM on every token.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createContainer, createDocument, findAll, findByClass } from './markdown-dom-harness.mjs';

const require = createRequire(import.meta.url);
const markdown = require('../public/markdown-renderer.js');

// `chat-markdown.js` looks the renderer up on the global, the way the browser
// wires the two script tags together.
globalThis.HafizeMarkdown = markdown;

const frames = [];
globalThis.requestAnimationFrame = (callback) => {
  frames.push(callback);
  return frames.length;
};
globalThis.cancelAnimationFrame = (handle) => {
  const index = Number(handle) - 1;
  if (frames[index]) frames[index] = null;
};
const runFrames = () => {
  const queued = frames.splice(0, frames.length);
  for (const callback of queued) callback?.();
  return queued.filter(Boolean).length;
};

const chat = require('../public/chat-markdown.js');

/* Every prefix of an answer renders without throwing -------------------- */

const ANSWER = [
  '# Rapor',
  '',
  'Kısa bir **giriş** cümlesi ve `kod` parçası.',
  '',
  '## Adımlar',
  '',
  '1. İlk adım',
  '2. İkinci adım',
  '   - alt madde',
  '',
  '> Not: dikkat.',
  '',
  '```js',
  'const toplam = 1 + 2;',
  'console.log(toplam);',
  '```',
  '',
  '| Anahtar | Değer |',
  '| --- | ---: |',
  '| a | 1 |',
  '',
  'Son cümle: https://nvidia.com',
  ''
].join('\n');

for (let length = 0; length <= ANSWER.length; length += 1) {
  const prefix = ANSWER.slice(0, length);
  const container = createContainer(createDocument());
  markdown.renderMarkdownInto(container, prefix, { placeholder: '…' });
  // Whatever the cut point, the words the model has already sent are on screen.
  const words = prefix.replace(/[#*_`>|~[\]()!-]/g, ' ').split(/\s+/).filter((word) => word.length > 3);
  const rendered = container.textContent;
  for (const word of words) {
    assert.ok(rendered.includes(word), `partial render at ${length} keeps "${word}"`);
  }
}

/* An open fence is marked while it is still arriving --------------------- */

const openFence = createContainer(createDocument());
markdown.renderMarkdownInto(openFence, '```js\nconst x = ');
assert.equal(findByClass(openFence, 'md-code').getAttribute('data-streaming'), 'true');
markdown.renderMarkdownInto(openFence, '```js\nconst x = 1;\n```');
assert.equal(findByClass(openFence, 'md-code').getAttribute('data-streaming'), null, 'the mark clears once the fence closes');

/* A half-written table is text until its delimiter row lands ------------- */

const table = createContainer(createDocument());
markdown.renderMarkdownInto(table, '| a | b |');
assert.equal(findAll(table, 'table').length, 0);
markdown.renderMarkdownInto(table, '| a | b |\n| --- | --- |');
assert.equal(findAll(table, 'table').length, 1, 'the table appears as soon as it is well formed');
assert.equal(findAll(table, 'td').length, 0, 'with no body rows yet');

/* Deltas coalesce into one frame ---------------------------------------- */

const streamed = createContainer(createDocument());
let text = '';
for (const delta of ['# Baş', 'lık\n\n', 'gövde ', 'metni']) {
  text += delta;
  chat.paint(streamed, text, { streaming: true });
}
assert.equal(frames.filter(Boolean).length, 1, 'four deltas schedule one frame');
assert.equal(streamed.textContent, '', 'nothing is painted before the frame runs');
runFrames();
assert.equal(streamed.textContent, 'Başlıkgövde metni', 'the newest text wins');
assert.equal(findAll(streamed, 'h1').length, 1);

/* A streaming answer is marked busy for assistive technology ------------- */

const announced = createContainer(createDocument());
chat.paint(announced, 'ilk parça', { streaming: true });
assert.equal(announced.getAttribute('aria-busy'), 'true', 'the live log does not re-read a growing answer');
runFrames();
assert.equal(announced.getAttribute('aria-busy'), 'true', 'it stays busy while deltas keep arriving');
chat.paint(announced, 'ilk parça tamamlandı', {});
assert.equal(announced.getAttribute('aria-busy'), null, 'the finished answer is announced once');

/* The final paint cannot be overwritten by a stale frame ----------------- */

const finished = createContainer(createDocument());
chat.paint(finished, 'yarım', { streaming: true });
chat.paint(finished, 'tam yanıt', {});
assert.equal(finished.textContent, 'tam yanıt', 'a non-streaming paint applies immediately');
runFrames();
assert.equal(finished.textContent, 'tam yanıt', 'the cancelled frame does not resurrect the older text');

/* Plain mode never renders markdown ------------------------------------- */

const userMessage = createContainer(createDocument());
chat.paint(userMessage, '# bu bir başlık değil\n**kalın değil**', { plain: true });
assert.equal(findAll(userMessage, 'h1').length, 0, 'a user message is literal text');
assert.equal(userMessage.textContent, '# bu bir başlık değil\n**kalın değil**');

const emptyPlain = createContainer(createDocument());
chat.paint(emptyPlain, '', { plain: true, placeholder: '…' });
assert.equal(emptyPlain.textContent, '…');

/* Without the renderer the chat still shows every answer ----------------- */

const saved = globalThis.HafizeMarkdown;
globalThis.HafizeMarkdown = undefined;
const degraded = createContainer(createDocument());
chat.paint(degraded, '# başlık', {});
assert.equal(degraded.textContent, '# başlık', 'the fallback writes the raw answer rather than nothing');
chat.paint(degraded, '', { placeholder: '…' });
assert.equal(degraded.textContent, '…');
globalThis.HafizeMarkdown = saved;

/* Source and plain-text helpers ----------------------------------------- */

const source = createContainer(createDocument());
chat.paint(source, '# Başlık\n\nGövde.', {});
assert.equal(chat.sourceFor(source), '# Başlık\n\nGövde.');
assert.equal(chat.plainTextFor(source), 'Başlık\n\nGövde.');
assert.equal(chat.sourceFor(null), '');
assert.equal(chat.plainTextFor(null), '');

assert.equal(chat.paint(null, 'x', {}), null);

console.log('chat markdown streaming OK: partial answers stay readable and deltas coalesce into one frame');
