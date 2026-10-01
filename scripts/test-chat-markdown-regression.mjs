import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const files = {
  renderer: fs.readFileSync('public/markdown-renderer.ts', 'utf8'),
  chat: fs.readFileSync('public/chat-markdown.js', 'utf8'),
  css: fs.readFileSync('public/chat-markdown.css', 'utf8'),
  app: fs.readFileSync('public/typed/app-shell.ts', 'utf8'),
  composer: fs.readFileSync('public/chat-composer-features.js', 'utf8'),
  workspace: fs.readFileSync('public/typed/message-workspace.ts', 'utf8'),
  voice: fs.readFileSync('public/typed/voice-output.ts', 'utf8'),
  loader: fs.readFileSync('public/prompt-library-revisions-enhancements.js', 'utf8')
};

const requiredRendererContracts = [
  /LIMITS/,
  /createElement/,
  /createTextNode/,
  /textContent/,
  /appendChild|append\(/,
  /https?:/,
  /mailto:/,
  /SAFE_SCHEMES/,
  /ESCAPABLE_PATTERN/,
  /table/i,
  /blockquote/i,
  /code/i,
  /list/i,
  /heading|h1|h2|h3/i
];
for (const contract of requiredRendererContracts) assert.match(files.renderer, contract, `renderer contract ${contract} missing`);

const forbiddenExecution = [
  /innerHTML\s*=/,
  /insertAdjacentHTML\s*\(/,
  /eval\s*\(/,
  /new Function\s*\(/,
  /document\.write\s*\(/,
  /srcdoc/i,
  /<script/i
];
/** Source with comments removed, so a pattern matches code and not prose. */
function codeOnly(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^[ \t]*\/\/.*$/gm, ' ');
}
for (const source of [files.renderer, files.chat]) {
  const code = codeOnly(source);
  for (const contract of forbiddenExecution) assert.doesNotMatch(code, contract, `unsafe contract ${contract} present`);
}

// The allowlist is only as good as what it actually rejects, so exercise it.
const renderer = createRequire(import.meta.url)('../public/markdown-renderer.ts');
assert.deepEqual([...renderer.SAFE_SCHEMES], ['http:', 'https:', 'mailto:']);
for (const safe of ['https://example.com/a', 'http://example.com', 'mailto:a@example.com']) {
  assert.equal(renderer.safeUrl(safe), safe, `safe destination survives: ${safe}`);
}
for (const hostile of [
  'javascript:alert(1)',
  'JavaScript:alert(1)',
  'java\tscript:alert(1)',
  'java\nscript:alert(1)',
  ' javascript:alert(1)',
  'data:text/html,<script>alert(1)</script>',
  'vbscript:msgbox(1)',
  'file:///etc/passwd',
  'blob:https://example.com/x',
  '/admin/delete',
  '//evil.example/x',
  './relative',
  ''
]) {
  assert.equal(renderer.safeUrl(hostile), '', `hostile destination is dropped: ${JSON.stringify(hostile)}`);
}

const chatContracts = [
  /requestAnimationFrame/,
  /cancelAnimationFrame/,
  /aria-busy/,
  /navigator\.clipboard/,
  /content/,
  /copy|kopy/i,
  /stream/i
];
for (const contract of chatContracts) assert.match(files.chat, contract, `chat contract ${contract} missing`);

// Only assistant answers are rendered as markdown; a user message stays plain
// text. The layer takes that as a `plain` option so it owns no role logic.
assert.match(files.chat, /options\.plain/, 'the layer honours a plain-text mode');
assert.match(
  files.app,
  /plain: role !== 'assistant'/,
  'the app renders markdown for assistant answers only'
);

const integrationContracts = [
  [/updateMessage\(assistantId, content\)/, 'assistant stream update remains canonical'],
  [/node\.textContent = value \|\| MESSAGE_PLACEHOLDER/, 'plain text fallback remains available when the renderer is absent'],
  [/addMessage\(['"]assistant['"]/, 'assistant messages still use app message path'],
  [/hafize/, 'existing application namespace remains referenced']
];
for (const [contract, label] of integrationContracts) assert.match(files.app, contract, label);

const downstreamContracts = [
  [files.composer, /clipboard|navigator\.clipboard|textContent/, 'composer copy path'],
  [files.workspace, /textContent|dataset|message/, 'message workspace path'],
  [files.voice, /normalizeSpeechText|speech|text/, 'voice normalization path']
];
for (const [source, contract, label] of downstreamContracts) assert.match(source, contract, label);

assert.match(files.css, /\.message\.assistant/);
assert.match(files.css, /@media/);
assert.match(files.css, /forced-colors/, 'high-contrast mode keeps answer structure visible');
assert.doesNotMatch(
  files.css,
  /(?:^|[\s;{])(?:transition|animation)\s*:/m,
  'no motion to reduce: a reduced-motion query would be a dead rule'
);
assert.doesNotMatch(files.css, /\.message\.user\s*\{/);

const bootstrapContracts = [
  ["const STYLE = '/chat-markdown.css'", 'static stylesheet'],
  ["const RENDERER = '/markdown-renderer.js'", 'static renderer'],
  ["const CHAT = '/chat-markdown.js'", 'static chat module'],
  /createElement\(['"]link['"]\)/,
  /createElement\(['"]script['"]\)/,
  /script\.defer\s*=\s*true/,
  /loadScript\(RENDERER, \(\) => loadScript\(CHAT\)\)/,
  /loaded\.has\(src\)/
];
for (const contract of bootstrapContracts) {
  const pattern = Array.isArray(contract) ? contract[0] : contract;
  assert.match(files.loader, pattern instanceof RegExp ? pattern : new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

const docs = fs.readFileSync('docs/CHAT_MARKDOWN.md', 'utf8');
const security = fs.readFileSync('docs/CHAT_MARKDOWN_SECURITY.md', 'utf8');
const matrix = fs.readFileSync('docs/CHAT_MARKDOWN_TEST_MATRIX.md', 'utf8');
const review = fs.readFileSync('docs/CHAT_MARKDOWN_REVIEW.md', 'utf8');
const operations = fs.readFileSync('docs/CHAT_MARKDOWN_USAGE.md', 'utf8');
for (const [source, terms, label] of [
  [docs, ['Markdown', 'Streaming', 'Geri alma'], 'product doc'],
  [security, ['DOM', 'javascript:', 'Gizlilik', 'Streaming'], 'security doc'],
  [matrix, ['Blok ayrıştırma', 'DOM', 'Güvenlik', 'Akış davranışı'], 'test matrix'],
  [review, ['Product', 'Security', 'Integration', 'Rollback'], 'release review'],
  [operations, ['Kullanıcı davranışı', 'Operasyon', 'Geri alma'], 'operations doc']
]) {
  for (const term of terms) assert.match(source, new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), `${label}: ${term}`);
}

assert.doesNotMatch(files.loader, /fetch\s*\(/);
assert.doesNotMatch(files.loader, /innerHTML\s*=/);
assert.doesNotMatch(files.chat, /new\s+Image\s*\(/);
assert.doesNotMatch(files.chat, /\.src\s*=\s*['"]https?:/);
assert.doesNotMatch(files.renderer, /setTimeout\s*\(.*fetch/i);

console.log('chat markdown comprehensive regression: ok');
