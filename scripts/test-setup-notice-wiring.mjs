// The setup notice spans three files: markup in index.html, a health-flag read
// in app.js, and the flag itself in server.mjs. Renaming any one of them would
// silently leave an operator with a blank model list and no explanation, which
// is exactly the failure this notice exists to prevent.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (relative) => readFile(new URL(`../${relative}`, import.meta.url), 'utf8');

const [html, app, css, server] = await Promise.all([
  read('public/index.html'),
  read('public/app.js'),
  read('public/styles.css'),
  read('server.mjs')
]);

// Markup: present, hidden by default, and announced to assistive technology.
assert.match(html, /id="setupNotice"/);
assert.match(html, /<div id="setupNotice"[^>]*\brole="status"/);
assert.match(html, /<div id="setupNotice"[^>]*\bhidden\b/);
assert.match(html, /NVIDIA_API_KEY/);
assert.match(html, /docs\/KURULUM\.md/);

// The notice must never invite pasting a key into the browser.
assert.equal(/<input[^>]*id="setupNotice/i.test(html), false);
assert.match(html, /anahtar tarayıcıya hiçbir zaman gönderilmez/i);

// Client wiring: reads the flag the server actually publishes, and runs at boot.
assert.match(app, /setupNotice: document\.querySelector\('#setupNotice'\)/);
assert.match(app, /refreshSetupNotice/);
assert.match(app, /\/api\/health/);
assert.match(app, /payload\?\.nvidiaConfigured === true/);
assert.match(app, /^\s*refreshSetupNotice\(\);$/m);

// Server contract: the flag exists and is derived from the key, never its value.
assert.match(server, /nvidiaConfigured: Boolean\(NVIDIA_API_KEY\)/);

// A failed health probe must not assert that a key is missing.
assert.match(app, /catch \{[\s\S]{0,200}?ui\.setupNotice\.hidden = true;/);

// Styling exists, so the notice cannot render as unstyled text.
assert.match(css, /\.setup-notice\s*\{/);

console.log('setup notice wiring tests passed');
