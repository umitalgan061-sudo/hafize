import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const s=readFileSync('public/typed/settings-privacy.ts','utf8');
assert.ok(s.includes('listeners.splice(0)'));
assert.ok(s.includes('panel.remove()'));
assert.ok(s.includes('destroyed = true'));
console.log('privacy destroy gate ok');
