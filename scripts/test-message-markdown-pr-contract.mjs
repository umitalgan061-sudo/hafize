import assert from 'node:assert/strict';
import fs from 'node:fs';

const policy = fs.readFileSync(new URL('../public/sw-policy.js', import.meta.url), 'utf8');
const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
assert.equal(pkg.scripts['check:markdown'], 'node scripts/run-checks.mjs --filter=message-markdown,message-actions,message-outline');
assert.ok(policy.includes('/message-markdown.js'));
assert.ok(policy.includes('/message-actions.js'));
assert.ok(policy.includes('/message-outline.js'));
assert.ok(policy.includes('/message-markdown-preferences.js'));
console.log('markdown PR contract ok');
