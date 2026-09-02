// The renderer only reaches the user if index.html loads it, app.js calls it,
// and the service worker caches it. Each link is easy to break silently: the
// fallback is plain text, so a disconnected renderer looks like "markdown
// support was never added" rather than an error.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (relative) => readFile(new URL(`../${relative}`, import.meta.url), 'utf8');
const [html, app, css, policy] = await Promise.all([
  read('public/index.html'),
  read('public/app.js'),
  read('public/styles.css'),
  read('public/sw-policy.js')
]);

// markdown.js must load before app.js so window.HafizeMarkdown exists on first render.
assert.match(html, /<script src="\/markdown\.js" defer><\/script>/);
assert.ok(
  html.indexOf('/markdown.js') < html.indexOf('/app.js'),
  'markdown.js must be declared before app.js'
);

// Both the first render and every streaming update go through one helper.
assert.match(app, /function renderMessageContent\(node, role, content\)/);
assert.match(app, /renderMessageContent\(content, message\.role, message\.content\)/);
assert.match(app, /renderMessageContent\(node, message\.role, content\)/);

// User text is never re-interpreted as markdown.
assert.match(app, /role === 'assistant' && markdown\?\.renderMarkdown/);

// A missing module must degrade to text rather than throw.
assert.match(app, /node\.textContent = content \|\| '…';/);

// The copy handler is delegated, because streaming replaces the nodes.
assert.match(app, /ui\.messages\.addEventListener\('click'/);
assert.match(app, /\.closest\?\.\('\.code-copy'\)/);

// The stale placeholder that shadowed the working recogniser must stay gone.
assert.equal(
  app.includes('Sesli giriş sonraki küçük geliştirme turunda etkinleştirilecek.'),
  false,
  'the mic placeholder shadows voice-input.js and must not return'
);

// Offline shell must carry the renderer, and adding it must invalidate the old cache.
assert.match(policy, /'\/markdown\.js'/);
assert.match(policy, /CACHE_PREFIX\}v15/);

// Assistant blocks need real block spacing; pre-wrap would double every gap.
assert.match(css, /\.message\.assistant \.content \{ white-space: normal; \}/);
assert.match(css, /\.code-block \{/);
assert.match(css, /\.code-copy \{/);

console.log('markdown wiring tests passed');
