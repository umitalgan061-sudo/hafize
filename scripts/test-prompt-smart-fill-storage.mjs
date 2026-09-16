import assert from 'node:assert/strict';
import fs from 'node:fs';

const history = fs.readFileSync('public/prompt-library-fill-history.js', 'utf8');
const privacy = fs.readFileSync('public/prompt-library-fill-privacy.js', 'utf8');
const session = fs.readFileSync('public/prompt-library-fill-session.js', 'utf8');
const backup = fs.readFileSync('public/prompt-library-fill-backup.js', 'utf8');
const presets = fs.readFileSync('public/prompt-library-fill-presets.js', 'utf8');

assert.match(history, /hafize\.prompt-library\.fill\.history\.v1/);
assert.match(history, /MAX_ENTRIES = 24/);
assert.match(history, /MAX_VALUES = 12/);
assert.match(history, /MAX_VALUE = 1000/);
assert.match(history, /clearPrompt/);
assert.match(history, /clear\(\)/);
assert.match(history, /JSON\.stringify\(candidate\.values\)/);

assert.match(privacy, /hafize\.prompt-library\.fill\.v1/);
assert.match(privacy, /hafize\.prompt-library\.fill\.presets\.v1/);
assert.match(privacy, /clearRemembered/);
assert.match(privacy, /clearPresets/);
assert.match(privacy, /clearAll/);
assert.match(privacy, /confirm/);
assert.doesNotMatch(privacy, /hafize\.prompt-library\.v1'.*removeItem/);

assert.match(session, /const sessions = new Map/);
assert.match(session, /MAX_PROMPTS = 30/);
assert.match(session, /beforeunload/);
assert.doesNotMatch(session, /localStorage/);

assert.match(backup, /hafize-prompt-library-fill-presets/);
assert.match(backup, /MAX_BYTES = 250000/);
assert.match(backup, /MAX_PRESETS = 8/);
assert.match(backup, /normalize/);
assert.match(backup, /merge/);
assert.match(backup, /slice\(0, 120\)/);

assert.match(presets, /hafize\.prompt-library\.fill\.presets\.v1/);
assert.match(presets, /MAX_PRESETS = 8/);
assert.match(presets, /MAX_VARS = 12/);
assert.match(presets, /MAX_VALUE = 1000/);
assert.match(presets, /slice\(0, MAX_PRESETS\)/);

console.log('smart fill storage isolation: ok');
