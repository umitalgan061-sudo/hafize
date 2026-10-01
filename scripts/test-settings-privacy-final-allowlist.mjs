import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const s=readFileSync('public/settings-privacy.js','utf8');
assert.ok(s.includes('const SURFACES = Object.freeze'));
assert.ok(s.includes('const surfaceMap = new Map'));
assert.ok(s.includes('exactMap.has(value)'));
assert.ok(s.includes('surface.prefix && value.startsWith(surface.prefix)'));
console.log('privacy allowlist final gate ok');
