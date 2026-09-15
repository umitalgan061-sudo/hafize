import assert from 'node:assert/strict';
import fs from 'node:fs';

const policy = fs.readFileSync(new URL('../public/sw-policy.js', import.meta.url), 'utf8');
const loader = fs.readFileSync(new URL('../public/composer-history-help.js', import.meta.url), 'utf8');
const preference = fs.readFileSync(new URL('../public/message-markdown-preferences.js', import.meta.url), 'utf8');
assert.ok(policy.includes('/message-markdown-preferences.js'));
assert.ok(loader.includes('/message-markdown-preferences.js'));
assert.ok(preference.includes("hafize.markdown-rendering.v1"));
assert.ok(preference.includes("'on'"));
assert.ok(preference.includes("'off'"));
assert.ok(policy.includes('v36'));
console.log('markdown preference PWA contract ok');
