import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const smart = read('public/prompt-library-smart-fill.js');
const palette = read('public/prompt-library-command-palette.js');
const sw = read('public/sw-policy.js');
const index = read('public/index.html');
const smartCss = read('public/prompt-library-smart-fill.css');
const paletteCss = read('public/prompt-library-command-palette.css');

assert.match(index, /prompt-library\.js/);
assert.match(index, /prompt-library-smart-fill\.js/);
assert.match(index, /prompt-library-command-palette\.js/);
assert.match(index, /prompt-library-smart-fill\.css/);
assert.match(index, /prompt-library-command-palette\.css/);
assert.match(sw, /prompt-library-smart-fill\.js/);
assert.match(sw, /prompt-library-command-palette\.js/);
assert.match(sw, /prompt-library-smart-fill\.css/);
assert.match(sw, /prompt-library-command-palette\.css/);

assert.match(smart, /HafizePromptLibrary/);
assert.match(smart, /extractVariables/);
assert.match(smart, /replaceVariables/);
assert.match(smart, /promptLibraryCard/);
assert.match(smart, /prompt-smart-fill/);
assert.match(smart, /aria-modal/);
assert.match(smart, /role', 'alert'/);
assert.match(smart, /MAX_VALUE = 1000/);
assert.match(smart, /MAX_VARIABLES = 12/);
assert.match(smart, /MAX_PRESETS = 6/);
assert.match(smart, /MAX_PREVIEW = 8000/);
assert.match(smart, /localStorage/);
assert.doesNotMatch(smart, /fetch\s*\(/);
assert.doesNotMatch(smart, /XMLHttpRequest/);
assert.doesNotMatch(smart, /WebSocket/);
assert.doesNotMatch(smart, /innerHTML\s*=/);
assert.doesNotMatch(smart, /outerHTML/);
assert.match(smart, /composer\.value/);
assert.match(smart, /composer\.dispatchEvent/);
assert.doesNotMatch(smart, /requestSubmit/);
assert.doesNotMatch(smart, /form\.submit/);

assert.match(palette, /PromptLibraryCommandPalette/);
assert.match(palette, /MAX_RESULTS = 12/);
assert.match(palette, /MAX_QUERY = 120/);
assert.match(palette, /\/prompt/);
assert.match(palette, /Ctrl|ctrl/);
assert.match(palette, /metaKey/);
assert.match(palette, /aria-selected/);
assert.match(palette, /listbox/);
assert.match(palette, /option/);
assert.match(palette, /Escape/);
assert.match(palette, /ArrowDown/);
assert.match(palette, /ArrowUp/);
assert.match(palette, /Enter/);
assert.match(palette, /HafizePromptLibrarySmartFill/);
assert.doesNotMatch(palette, /fetch\s*\(/);
assert.doesNotMatch(palette, /XMLHttpRequest/);

assert.match(sw, /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v28`/);
assert.match(sw, /prompt-library-smart-fill/);
assert.match(sw, /prompt-library-command-palette/);
assert.match(sw, /pathname\.startsWith\('\/api\/'\)/);
assert.match(sw, /network-only/);

assert.match(smartCss, /@media\(max-width:700px\)/);
assert.match(smartCss, /forced-colors:active/);
assert.match(smartCss, /focus-visible/);
assert.match(smartCss, /prefers-reduced-motion:reduce/);
assert.match(paletteCss, /@media\(max-width:700px\)/);
assert.match(paletteCss, /forced-colors:active/);
assert.match(paletteCss, /focus-visible/);

const docs = [
  'docs/PROMPT_SMART_FILL.md',
  'docs/PROMPT_SMART_FILL_DATA_MODEL.md',
  'docs/PROMPT_SMART_FILL_SECURITY.md',
  'docs/PROMPT_SMART_FILL_ACCESSIBILITY.md',
  'docs/PROMPT_SMART_FILL_FAILURES.md',
  'docs/PROMPT_SMART_FILL_OPERATIONS.md',
  'docs/PROMPT_SMART_FILL_PERFORMANCE.md',
  'docs/PROMPT_SMART_FILL_QA.md',
  'docs/PROMPT_SMART_FILL_RELEASE.md',
  'docs/PROMPT_SMART_FILL_ROLLBACK.md',
  'docs/PROMPT_SMART_FILL_SUPPORT.md',
  'docs/PROMPT_SMART_FILL_EXAMPLES.md',
  'docs/PROMPT_SMART_FILL_TEST_MATRIX.md',
  'docs/PROMPT_SMART_FILL_COMPATIBILITY.md',
  'docs/PROMPT_SMART_FILL_REVIEW.md',
  'docs/PROMPT_SMART_FILL_USER_GUIDE.md'
];
for (const file of docs) {
  const content = read(file);
  assert.ok(content.startsWith('# '), `${file}: heading missing`);
  assert.ok(content.length > 200, `${file}: documentation unexpectedly short`);
}

console.log('prompt smart-fill integration contracts: ok');
