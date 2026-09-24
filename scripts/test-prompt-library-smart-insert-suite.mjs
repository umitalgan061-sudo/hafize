import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const source = await readFile(new URL('public/prompt-library-smart-insert.js', root), 'utf8');
const css = await readFile(new URL('public/prompt-library-smart-insert.css', root), 'utf8');
const index = await readFile(new URL('public/index.html', root), 'utf8');
const sw = await readFile(new URL('public/sw-policy.js', root), 'utf8');

const mustContain = (text, pattern, label) => assert.match(text, pattern, label);
const mustNotContain = (text, pattern, label) => assert.doesNotMatch(text, pattern, label);

mustContain(source, /PROFILE_KEY\s*=\s*['"]hafize\.prompt-library\.variable-profiles\.v1['"]/, 'profile storage key is stable');
mustContain(source, /MAX_PROFILES\s*=\s*24/, 'profile count is bounded');
mustContain(source, /MAX_VARIABLES\s*=\s*12/, 'variable count is bounded');
mustContain(source, /MAX_VALUE\s*=\s*1000/, 'variable value is bounded');
mustContain(source, /MAX_IMPORT\s*=\s*300000/, 'profile import is bounded');
mustContain(source, /normalizeProfile\(/, 'profiles are normalized before persistence');
mustContain(source, /normalizeProfiles\(/, 'profile collections are normalized');
mustContain(source, /mergeProfiles\(/, 'profile import merges by profile name');
mustContain(source, /exportProfiles\(/, 'profile export contract exists');
mustContain(source, /importProfilesText\(/, 'profile import contract exists');
mustContain(source, /preview\.textContent\s*=|textContent\s*=.*replaceVariables/, 'preview uses textContent');
mustNotContain(source, /innerHTML\s*=/, 'smart insert does not inject HTML strings');
mustContain(source, /role['"]?,\s*['"]dialog['"]|setAttribute\(['"]role['"],\s*['"]dialog['"]\)/, 'dialog semantics are explicit');
mustContain(source, /aria-modal['"]?,\s*['"]true['"]|setAttribute\(['"]aria-modal['"],\s*['"]true['"]\)/, 'modal state is announced');
mustContain(source, /Escape/, 'Escape closes the dialog');
mustContain(source, /event\.ctrlKey\s*\|\|\s*event\.metaKey/, 'keyboard insert supports Ctrl/Command');
mustContain(source, /event\.key\s*!==\s*['"]Tab['"]/, 'focus loop handles Tab');
mustContain(source, /missing\.length/, 'required variables are validated');
mustContain(source, /input\.value\s*=\s*api\(\)\?\.replaceVariables/, 'resolved text is placed in composer');
mustNotContain(source, /input\.form\.submit|form\.requestSubmit|composer.*\.dispatchEvent\(new Event\(['"]submit/, 'smart insert never submits the conversation');
mustContain(source, /input\.dispatchEvent\(new Event\(['"]input['"]/, 'composer input state is synchronized');
mustContain(source, /active\s*=\s*null/, 'dialog lifecycle clears active state');
mustContain(source, /trigger\?\.focus\?\.\(\)/, 'focus returns to trigger');
mustContain(source, /beforeunload/, 'observer cleanup exists on unload');

mustContain(css, /prompt-library-variable-dialog/, 'dialog CSS exists');
mustContain(css, /@media\(max-width:700px\)/, 'mobile dialog layout exists');
mustContain(css, /forced-colors:active/, 'forced-colors support exists');
mustContain(css, /prefers-reduced-motion:reduce/, 'reduced motion support exists');

mustContain(index, /prompt-library-enhancements\.js/, 'enhancement loader is shipped');
assert.equal((index.match(/prompt-library-enhancements\.js/g) || []).length, 1, 'enhancement script remains single-instanced');
mustContain(sw, /prompt-library-smart-insert\.js/, 'smart insert JS is PWA cached');
mustContain(sw, /prompt-library-smart-insert\.css/, 'smart insert CSS is PWA cached');
mustContain(sw, /CURRENT_CACHE\s*=\s*`\$\{CACHE_PREFIX\}v\d+`/, 'shell cache is versioned');

console.log('prompt-library-smart-insert-suite: ok');
