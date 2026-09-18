import assert from 'node:assert/strict';
import fs from 'node:fs';

const fill = fs.readFileSync('public/prompt-library-fill.js', 'utf8');
const history = fs.readFileSync('public/prompt-library-fill-history.js', 'utf8');
const backup = fs.readFileSync('public/prompt-library-fill-backup.js', 'utf8');
const session = fs.readFileSync('public/prompt-library-fill-session.js', 'utf8');
const privacy = fs.readFileSync('public/prompt-library-fill-privacy.js', 'utf8');

assert.match(fill, /hafize\.prompt-library\.v1/);
assert.match(fill, /hafize\.prompt-library\.fill\.v1/);
assert.match(history, /hafize\.prompt-library\.fill\.history\.v1/);
assert.match(backup, /hafize\.prompt-library\.fill\.presets\.v1/);
assert.doesNotMatch(session, /localStorage/);
assert.match(privacy, /clearRemembered/);
assert.match(privacy, /clearPresets/);
assert.match(privacy, /clearAll/);
assert.ok(new Set([
  'hafize.prompt-library.v1',
  'hafize.prompt-library.fill.v1',
  'hafize.prompt-library.fill.presets.v1',
  'hafize.prompt-library.fill.history.v1'
]).size === 4);
console.log('smart fill namespace regression: ok');
