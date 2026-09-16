import assert from 'node:assert/strict';
import fs from 'node:fs';

const fill = fs.readFileSync('public/prompt-library-fill.js', 'utf8');
const presets = fs.readFileSync('public/prompt-library-fill-presets.js', 'utf8');
const usage = fs.readFileSync('public/prompt-library-usage.js', 'utf8');
const css = fs.readFileSync('public/prompt-library-fill.css', 'utf8');
const qa = fs.readFileSync('docs/PROMPT_LIBRARY_SMART_FILL_QA.md', 'utf8');

const checks = [
  [/promptLibraryFillDialog/, 'dialog id'],
  [/dataset\.promptId/, 'prompt id binding'],
  [/messageInput/, 'composer target'],
  [/new Event\('input'/, 'composer input event'],
  [/useCount/, 'usage increment'],
  [/MAX_VALUE = 1000/, 'value limit'],
  [/MAX_SAVED = 30/, 'remember limit'],
  [/StorageEvent/, 'storage refresh'],
  [/textContent/, 'safe text rendering'],
  [/MutationObserver/, 'dynamic list support'],
  [/showModal/, 'native dialog'],
  [/aria-labelledby/, 'dialog label'],
  [/aria-label/, 'input label']
];
for (const [pattern, name] of checks) assert.match(fill, pattern, name);
assert.doesNotMatch(fill, /innerHTML\s*=/);
assert.doesNotMatch(fill, /outerHTML/);
assert.doesNotMatch(fill, /eval\s*\(/);
assert.doesNotMatch(fill, /new Function/);
assert.doesNotMatch(fill, /fetch\s*\(/);
assert.doesNotMatch(fill, /XMLHttpRequest/);
assert.match(presets, /MAX_PRESETS = 8/);
assert.match(presets, /MAX_NAME = 48/);
assert.match(presets, /MAX_VALUE = 1000/);
assert.match(presets, /MAX_VARS = 12/);
assert.match(presets, /savePreset/);
assert.match(presets, /deletePreset/);
assert.match(presets, /toLocaleLowerCase\('tr-TR'\)/);
assert.doesNotMatch(presets, /innerHTML\s*=/);
assert.match(usage, /prompt-library-fill\.css/);
assert.match(usage, /prompt-library-fill\.js/);
assert.match(usage, /prompt-library-fill-presets\.js/);
assert.match(css, /forced-colors/);
assert.match(css, /prefers-reduced-motion/);
assert.match(css, /focus-visible/);
assert.match(qa, /Release gate/);
assert.match(qa, /160/);

const sourceLines = fill.split('\n').length;
const presetLines = presets.split('\n').length;
assert.ok(sourceLines >= 150, 'smart fill implementation should remain substantive');
assert.ok(presetLines >= 100, 'preset implementation should remain substantive');

console.log('smart fill regression suite: ok');
console.log(`implementation lines: ${sourceLines}; preset lines: ${presetLines}`);
