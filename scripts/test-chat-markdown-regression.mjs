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

const requiredRendererContracts = [
  /LIMITS/,
  /createElement/,
  /createTextNode/,
  /textContent/,
  /appendChild|append\(/,
  /https?:/,
  /mailto:/,
  /javascript/i,
  /data:/,
  /escape/i,
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
for (const source of [files.renderer, files.chat]) {
  for (const contract of forbiddenExecution) assert.doesNotMatch(source, contract, `unsafe contract ${contract} present`);
}

const chatContracts = [
  /requestAnimationFrame/,
  /cancelAnimationFrame/,
  /aria-busy/,
  /navigator\.clipboard/,
  /MutationObserver/,
  /assistant/i,
  /content/,
  /copy|kopy/i,
  /stream/i
];
for (const contract of chatContracts) assert.match(files.chat, contract, `chat contract ${contract} missing`);

const integrationContracts = [
  [/updateMessage\(assistantId, content\)/, 'assistant stream update remains canonical'],
  [/textContent\s*=\s*content/, 'plain text fallback remains available'],
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
assert.match(files.css, /prefers-reduced-motion/);
assert.match(files.css, /forced-colors/);
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
  [matrix, ['Bloklar', 'DOM', 'Güvenlik', 'Streaming'], 'test matrix'],
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
