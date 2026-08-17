import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const policySource = await readFile(new URL('../public/sw-policy.js', import.meta.url), 'utf8');
const index = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');

assert.match(policySource, /hafize-shell-v82/);
assert.match(policySource, /'\/hands-free-consent\.js'/);
assert.match(policySource, /'\/hands-free-consent\.css'/);
assert.match(index, /<link rel="stylesheet" href="\/hands-free-consent\.css" \/>/);
assert.match(index, /<script src="\/hands-free-consent\.js" defer><\/script>/);

const consentScript = index.indexOf('<script src="/hands-free-consent.js" defer></script>');
const handsFreeScript = index.indexOf('<script src="/hands-free.js" defer></script>');
assert.ok(consentScript >= 0 && consentScript < handsFreeScript);

assert.doesNotMatch(policySource, /\/api\/.*SHELL_ASSETS/);
console.log('hands-free consent PWA wiring tests passed');
