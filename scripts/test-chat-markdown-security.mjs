// Security contract for rendering untrusted model output.
//
// An answer is attacker-influenceable text: a user can paste anything into the
// chat, a tool result can carry anything back, and the model repeats both. The
// renderer therefore never builds markup from a string and never lets a
// non-http(s)/mailto destination reach an `href`.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContainer, createDocument, findAll, findAllByClass, walk } from './markdown-dom-harness.mjs';

const require = createRequire(import.meta.url);
const markdown = require('../public/markdown-renderer.ts');
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/* No string ever becomes markup ---------------------------------------- */

for (const file of ['public/markdown-renderer.ts', 'public/chat-markdown.js']) {
  const source = readFileSync(path.join(ROOT, file), 'utf8');
  for (const sink of ['innerHTML', 'outerHTML', 'insertAdjacentHTML', 'document.write', 'createContextualFragment']) {
    assert.equal(source.includes(sink), false, `${file} must not use ${sink}`);
  }
  assert.equal(/\beval\s*\(/.test(source), false, `${file} must not use eval`);
  assert.equal(/new Function\s*\(/.test(source), false, `${file} must not build functions from strings`);
}

/* Dangerous destinations ----------------------------------------------- */

const REJECTED_URLS = [
  'javascript:alert(1)',
  'JaVaScRiPt:alert(1)',
  '  javascript:alert(1)',
  'java\tscript:alert(1)',
  'java\nscript:alert(1)',
  'jAvAsCrIpT:void(0)',
  'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
  'data:image/svg+xml,<svg onload=alert(1)>',
  'vbscript:msgbox(1)',
  'file:///etc/passwd',
  'blob:https://example.com/abc',
  'about:blank',
  'chrome://settings',
  '//example.com/protocol-relative',
  '/api/schedules',
  '../../gizli',
  '#bolum',
  'mailto:a@b.c\u0000',
  ''
];
for (const url of REJECTED_URLS) {
  assert.equal(markdown.safeUrl(url), '', `refused destination: ${JSON.stringify(url)}`);
}

const ACCEPTED_URLS = [
  'https://example.com',
  'http://example.com/yol?a=1#b',
  'HTTPS://EXAMPLE.COM',
  'mailto:hafize@example.com'
];
for (const url of ACCEPTED_URLS) {
  assert.equal(markdown.safeUrl(url), url, `accepted destination: ${url}`);
}

assert.equal(markdown.safeUrl(`https://example.com/${'a'.repeat(markdown.LIMITS.MAX_URL_LENGTH)}`), '', 'an over-long URL is refused');
assert.equal(markdown.safeUrl(null), '');
assert.equal(markdown.safeUrl({ toString: () => 'javascript:alert(1)' }), '');

/* Hostile answers render as inert text --------------------------------- */

const HOSTILE = [
  '<script>alert(1)</script>',
  '<img src=x onerror="alert(1)">',
  '<iframe src="javascript:alert(1)"></iframe>',
  '<svg/onload=alert(1)>',
  '<a href="javascript:alert(1)">tıkla</a>',
  '<style>body{display:none}</style>',
  '<!-- yorum --><b>kalın</b>',
  '[tıkla](javascript:alert(1))',
  '[tıkla](  javascript:alert(1)  )',
  '![resim](javascript:alert(1))',
  '<javascript:alert(1)>',
  '</div><script>alert(1)</script>',
  '`</code><script>alert(1)</script>`',
  '```html\n<script>alert(1)</script>\n```',
  '| <script>alert(1)</script> | b |\n| --- | --- |\n| 1 | 2 |',
  '# <script>alert(1)</script>',
  '> <script>alert(1)</script>',
  '- <script>alert(1)</script>'
];

for (const answer of HOSTILE) {
  const documentRef = createDocument();
  const container = createContainer(documentRef);
  markdown.renderMarkdownInto(container, answer);

  const tags = new Set();
  walk(container, (node) => {
    if (node.nodeType === 1 && node.tagName !== '#fragment') tags.add(node.tagName.toLowerCase());
  });
  for (const forbidden of ['script', 'iframe', 'style', 'object', 'embed', 'img', 'svg', 'form', 'input', 'link', 'meta']) {
    assert.equal(tags.has(forbidden), false, `${forbidden} must never appear for: ${answer}`);
  }
  for (const anchor of findAll(container, 'a')) {
    const href = anchor.getAttribute('href') ?? '';
    assert.match(href, /^(?:https?|mailto):/i, `every rendered href is http(s) or mailto, saw: ${href}`);
  }
  // Nothing is silently dropped: the literal markup is still readable text.
  if (answer.includes('<script>alert(1)</script>')) {
    assert.ok(container.textContent.includes('alert(1)'), `hostile markup stays visible as text: ${answer}`);
  }
}

/* Event-handler attributes are never emitted ---------------------------- */

const documentRef = createDocument();
const container = createContainer(documentRef);
markdown.renderMarkdownInto(container, [
  '# <b onclick="alert(1)">x</b>',
  '',
  '[bağlantı](https://example.com "onmouseover=alert(1)")',
  '',
  '| a onerror=alert(1) | b |',
  '| --- | --- |',
  '| <img onerror=alert(1)> | 2 |'
].join('\n'));

walk(container, (node) => {
  if (node.nodeType !== 1 || !node.attributes) return;
  for (const name of node.attributes.keys()) {
    assert.equal(/^on/i.test(name), false, `attribute ${name} must never be set`);
    assert.ok(
      ['class', 'href', 'target', 'rel', 'title', 'scope', 'data-align', 'data-language', 'data-md-copy',
        'data-state', 'data-streaming', 'data-md', 'aria-hidden', 'aria-label', 'role', 'tabindex', 'type', 'start'].includes(name),
      `unexpected attribute: ${name}`
    );
  }
});

/* Outgoing links are isolated ------------------------------------------ */

const linkDocument = createDocument();
const linkContainer = createContainer(linkDocument);
markdown.renderMarkdownInto(linkContainer, 'bkz. [site](https://example.com) ve https://nvidia.com');
const anchors = findAll(linkContainer, 'a');
assert.equal(anchors.length, 2);
for (const anchor of anchors) {
  assert.equal(anchor.getAttribute('target'), '_blank');
  assert.equal(anchor.getAttribute('rel'), 'noopener noreferrer nofollow ugc', 'no opener, no referrer, no ranking transfer');
}

/* Images never become a network request -------------------------------- */

const imageDocument = createDocument();
const imageContainer = createContainer(imageDocument);
markdown.renderMarkdownInto(imageContainer, '![izleyici](https://tracker.example.com/pixel.gif)');
assert.equal(findAll(imageContainer, 'img').length, 0, 'an image reference never fetches');
assert.equal(findAllByClass(imageContainer, 'md-link-image').length, 1, 'it is shown as a link instead');

/* Copy controls carry no answer text ----------------------------------- */

const codeDocument = createDocument();
const codeContainer = createContainer(codeDocument);
markdown.renderMarkdownInto(codeContainer, '```js\nconst gizli = 1;\n```');
assert.equal(
  codeContainer.textContent,
  'const gizli = 1;',
  'the rendered answer reads back as the answer, with no button labels mixed in'
);

console.log('chat markdown security OK: no markup sink, no unsafe scheme, no remote fetch, isolated links');
