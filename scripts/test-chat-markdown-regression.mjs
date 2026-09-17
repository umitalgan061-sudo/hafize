import assert from 'node:assert/strict';
import fs from 'node:fs';

const files = {
  renderer: fs.readFileSync('public/markdown-renderer.js', 'utf8'),
  chat: fs.readFileSync('public/chat-markdown.js', 'utf8'),
  css: fs.readFileSync('public/chat-markdown.css', 'utf8'),
  app: fs.readFileSync('public/app.js', 'utf8'),
  composer: fs.readFileSync('public/chat-composer-features.js', 'utf8'),
  workspace: fs.readFileSync('public/message-workspace.js', 'utf8'),
  voice: fs.readFileSync('public/voice-output.js', 'utf8'),
  loader: fs.readFileSync('public/prompt-library-revisions-enhancements.js', 'utf8')
};

// `javascript:` and every other scheme is rejected by the `SAFE_SCHEMES`
// allowlist rather than by name; the behaviour is covered by
// test-chat-markdown-security.mjs.
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
// The allowlist is exactly these three schemes, so `javascript:`, `data:`
// and every relative destination are rejected without being named.
assert.match(files.renderer, /SAFE_SCHEMES = Object\.freeze\(\['http:', 'https:', 'mailto:'\]\)/);

const forbiddenExecution = [
  /innerHTML\s*=/,
  /insertAdjacentHTML\s*\(/,
  /eval\s*\(/,
  /new Function\s*\(/,
  /document\.write\s*\(/,
  /srcdoc/i,
  /<script/i
];
// Comment lines are dropped first: documentation may name `<script>` as the
// thing the renderer refuses to build, and that is not an unsafe construct.
const withoutCommentLines = (source) => source
  .split(/\r?\n/)
  .filter((line) => !/^\s*(?:\/\/|\/\*|\*)/.test(line))
  .join('\n');

for (const source of [files.renderer, files.chat]) {
  const code = withoutCommentLines(source);
  for (const contract of forbiddenExecution) assert.doesNotMatch(code, contract, `unsafe contract ${contract} present`);
}

const chatContracts = [
  /requestAnimationFrame/,
  /cancelAnimationFrame/,
  /aria-busy/,
  /navigator\.clipboard/,
  /addEventListener\('click', handleCopyClick\)/,
  // The layer itself is role-agnostic: app.js passes `plain` for anything
  // that is not an assistant answer.
  /options\.plain/,
  /content/,
  /copy|kopy/i,
  /stream/i
];
for (const contract of chatContracts) assert.match(files.chat, contract, `chat contract ${contract} missing`);

const integrationContracts = [
  [/updateMessage\(assistantId, content\)/, 'assistant stream update remains canonical'],
  [/node\.textContent = value \|\| MESSAGE_PLACEHOLDER/, 'plain text fallback remains available'],
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
// The sheet carries no motion today, so a reduced-motion block would be dead
// CSS. The contract is conditional: motion may only be added together with
// the escape hatch for it.
if (/(?:^|[\s;{])(?:transition|animation)\s*:/m.test(files.css)) {
  assert.match(files.css, /prefers-reduced-motion/, 'motion needs a reduced-motion fallback');
}
assert.match(files.css, /forced-colors/);
assert.doesNotMatch(files.css, /\.message\.user\s*\{/);

// The markdown assets are declared by the HTML shell, in an order that has
// the renderer ready before the chat layer and both ready before app.js.
const index = fs.readFileSync('public/index.html', 'utf8');
for (const [asset, label] of [
  ['/chat-markdown.css', 'stylesheet'],
  ['/markdown-renderer.js', 'renderer'],
  ['/chat-markdown.js', 'chat module']
]) assert.ok(index.includes(`"${asset}"`), `shell declares the markdown ${label}`);
assert.ok(index.indexOf('/markdown-renderer.js') < index.indexOf('/chat-markdown.js" defer'));
assert.ok(index.indexOf('/chat-markdown.js" defer') < index.indexOf('/app.js'));

// The Prompt Library module used to inject them at runtime, which kept them out
// of the offline shell cache. It must not grow that second path back.
assert.doesNotMatch(files.loader, /chat-markdown/);
assert.doesNotMatch(files.loader, /markdown-renderer/);

const docs = fs.readFileSync('docs/CHAT_MARKDOWN.md', 'utf8');
const security = fs.readFileSync('docs/CHAT_MARKDOWN_SECURITY.md', 'utf8');
const matrix = fs.readFileSync('docs/CHAT_MARKDOWN_TEST_MATRIX.md', 'utf8');
const review = fs.readFileSync('docs/CHAT_MARKDOWN_REVIEW.md', 'utf8');
const operations = fs.readFileSync('docs/CHAT_MARKDOWN_USAGE.md', 'utf8');
for (const [source, terms, label] of [
  [docs, ['Markdown', 'Streaming', 'Geri alma'], 'product doc'],
  [security, ['DOM', 'javascript:', 'Gizlilik', 'Streaming'], 'security doc'],
  [matrix, ['Blok', 'DOM', 'Güvenlik', 'Streaming'], 'test matrix'],
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
