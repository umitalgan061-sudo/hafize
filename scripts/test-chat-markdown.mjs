import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { assertShellCacheAtLeast } from './sw-cache-version.mjs';

const require = createRequire(import.meta.url);
const markdown = require('../public/chat-markdown.js');
const policy = require('../public/sw-policy.js');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { parseMarkdown, parseInline, renderMarkdown, safeLinkHref } = markdown;

// --- block parsing -----------------------------------------------------------
const doc = parseMarkdown('# Başlık\n\nBir **kalın** cümle.\n\n- ilk\n- ikinci\n\n> alıntı\n\n---\n\n1. bir\n2. iki');
assert.deepEqual(doc.map((block) => block.type), ['heading', 'paragraph', 'list', 'quote', 'rule', 'list']);
assert.equal(doc[0].level, 1); assert.equal(doc[2].ordered, false); assert.equal(doc[2].items.length, 2);
assert.equal(doc[5].ordered, true); assert.deepEqual(doc[5].items.map((item) => item[0].text), ['bir', 'iki']);
assert.ok(Object.isFrozen(doc));
// A heading deeper than the surface supports is clamped, not dropped.
assert.equal(parseMarkdown('###### derin')[0].level, 3);
// Wrapped lines belong to one paragraph; a blank line starts the next.
const wrapped = parseMarkdown('birinci satır\ndevam satırı\n\nayrı paragraf');
assert.equal(wrapped.length, 2); assert.equal(wrapped[0].spans[0].text, 'birinci satır devam satırı');

// --- fenced code -------------------------------------------------------------
const fenced = parseMarkdown('Şu kod:\n```js\nconst a = 1;\n\nreturn a;\n```\nbitti');
assert.deepEqual(fenced.map((block) => block.type), ['paragraph', 'code', 'paragraph']);
assert.equal(fenced[1].language, 'js'); assert.equal(fenced[1].text, 'const a = 1;\n\nreturn a;'); assert.equal(fenced[1].closed, true);
// Mid-stream the closing fence has not arrived yet: the partial body still has to
// render as code, otherwise every streamed answer flashes raw backticks.
const streaming = parseMarkdown('```python\nprint("yarım")');
assert.equal(streaming.length, 1); assert.equal(streaming[0].type, 'code');
assert.equal(streaming[0].closed, false); assert.equal(streaming[0].text, 'print("yarım")');
// Markdown inside a fence stays literal, and a language label is an identifier —
// never arbitrary model text used as a class name.
const literal = parseMarkdown('```\n# not a heading\n- not a list\n```');
assert.equal(literal.length, 1); assert.equal(literal[0].text, '# not a heading\n- not a list'); assert.equal(literal[0].language, '');
assert.equal(parseMarkdown('```<script>\nx\n```')[0].language, ''); assert.equal(parseMarkdown('```JS\nx\n```')[0].language, 'js');

// --- inline spans ------------------------------------------------------------
assert.deepEqual(parseInline('düz **kalın** ve *eğik* ve `kod`').map((span) => span.type), ['text', 'strong', 'text', 'emphasis', 'text', 'code']);
assert.equal(parseInline('`**kod içinde**`')[0].type, 'code'); assert.equal(parseInline('`**kod içinde**`')[0].text, '**kod içinde**');
assert.deepEqual(parseInline('yalın metin').map((span) => span.text), ['yalın metin']);
// A long run of unmatched markers is quadratic to scan and re-scanned on every
// streamed chunk, so an over-long line falls back to plain text and stays fast.
const hostile = `x${'`'.repeat(markdown.CHAT_MARKDOWN_LIMITS.maxInlineLength + 1000)}`;
const started = Date.now();
assert.deepEqual(parseInline(hostile).map((span) => span.type), ['text']);
assert.ok(Date.now() - started < 250, 'uzun işaret dizisi taraması sınırlı kalmalı');
assert.equal(parseMarkdown(`a *${'b *'.repeat(20_000)}`).length >= 1, true);

// --- link safety -------------------------------------------------------------
assert.equal(safeLinkHref('https://example.com/a'), 'https://example.com/a');
assert.equal(safeLinkHref('mailto:a@b.com'), 'mailto:a@b.com');
for (const unsafe of ['javascript:alert(1)', 'data:text/html,<script>', 'vbscript:x', '/relative', '', null]) {
  assert.equal(safeLinkHref(unsafe), '', `${String(unsafe)} bir bağlantı olmamalı`);
}
const linked = parseInline('[site](https://example.com/x) ve [kötü](javascript:alert(1))');
assert.equal(linked[0].type, 'link'); assert.equal(linked[0].href, 'https://example.com/x');
assert.equal(linked.some((span) => span.type === 'link' && span.href.startsWith('javascript')), false);

// --- rendering ---------------------------------------------------------------
class FakeNode {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase(); this.children = []; this.attributes = new Map();
    this.className = ''; this.type = ''; this.own = '';
  }
  set textContent(value) { this.own = String(value); this.children = []; }
  get textContent() { return this.children.length ? this.children.map((child) => child.textContent).join('') : this.own; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = [...nodes]; this.own = ''; }
}
const fakeDocument = { createElement: (tag) => new FakeNode(tag) };
const flatten = (node) => [node, ...node.children.flatMap((child) => flatten(child))];

const host = new FakeNode('div');
renderMarkdown(host, '## Rapor\n\nBir `satır` ve [bağlantı](https://example.com/)\n\n```js\nconst x = 1;\n```', { document: fakeDocument });
const rendered = flatten(host);
assert.deepEqual(host.children.map((child) => child.tagName), ['H4', 'P', 'DIV']);
const link = rendered.find((node) => node.tagName === 'A');
assert.equal(link.getAttribute('href'), 'https://example.com/');
assert.equal(link.getAttribute('rel'), 'noopener noreferrer nofollow');
assert.equal(link.getAttribute('target'), '_blank');
assert.equal(rendered.find((node) => node.tagName === 'PRE').textContent, 'const x = 1;');
const copy = rendered.find((node) => node.className.includes('md-code-copy'));
assert.equal(copy.tagName, 'BUTTON'); assert.equal(copy.type, 'button'); assert.equal(copy.getAttribute('aria-label'), 'Kod bloğunu kopyala');
// Rendering replaces the previous tree instead of appending to it, so a streaming
// update never stacks duplicate blocks; an empty answer keeps the placeholder.
renderMarkdown(host, 'tek paragraf', { document: fakeDocument });
assert.equal(host.children.length, 1); assert.equal(host.children[0].tagName, 'P'); assert.equal(host.children[0].textContent, 'tek paragraf');
renderMarkdown(host, '', { document: fakeDocument });
assert.equal(host.children[0].textContent, '…');
// Markup in model output is text, never nodes.
renderMarkdown(host, 'zararsız <script>alert(1)</script> metni', { document: fakeDocument });
assert.equal(flatten(host).some((node) => node.tagName === 'SCRIPT'), false);
assert.match(host.textContent, /<script>alert\(1\)<\/script>/);
// A missing container or document is a no-op, not a crash.
assert.equal(renderMarkdown(null, 'x', { document: fakeDocument }), null);
assert.equal(renderMarkdown(host, 'x', {}), host);

// --- source and shell contract ----------------------------------------------
const source = await readFile(join(ROOT, 'public', 'chat-markdown.js'), 'utf8');
assert.equal(source.includes('innerHTML'), false, 'markdown yüzeyi innerHTML kullanamaz');
assert.equal(source.includes('insertAdjacentHTML'), false);
assert.ok(Object.isFrozen(markdown));
const appSource = await readFile(join(ROOT, 'public', 'app.js'), 'utf8');
assert.match(appSource, /HafizeChatMarkdown/);
assert.match(appSource, /role !== 'assistant'/, 'kullanıcı mesajı düz metin kalmalı');
// Copy/export surfaces read the answer as written, not the flattened tree text.
assert.match(appSource, /dataset\.raw = content/);
assert.match(await readFile(join(ROOT, 'public', 'chat-composer-features.js'), 'utf8'), /dataset\?\.raw/);
assertShellCacheAtLeast(policy, 20);
for (const asset of ['/chat-markdown.js', '/chat-markdown.css', '/auth.js']) {
  assert.ok(policy.SHELL_ASSETS.includes(asset), `${asset} offline kabuğunda olmalı`);
}
const indexHtml = await readFile(join(ROOT, 'public', 'index.html'), 'utf8');
assert.ok(indexHtml.indexOf('/chat-markdown.js') < indexHtml.indexOf('/app.js'), 'markdown modülü app.js öncesinde yüklenmeli');
assert.match(indexHtml, /href="\/chat-markdown\.css"/);

console.log('chat markdown tests passed');
