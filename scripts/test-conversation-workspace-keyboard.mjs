import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const source = fs.readFileSync(path.join(root, 'public', 'conversation-workspace-keyboard.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public', 'conversation-workspace-keyboard.css'), 'utf8');
const index = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'public', 'sw-policy.js'), 'utf8');

const must = (fragment, label = fragment) => assert.ok(source.includes(fragment), label);
const mustCss = (fragment) => assert.ok(css.includes(fragment), `css includes ${fragment}`);

must("const MODIFIER = 'mod'");
must("selectAll: { key: 'a', shift: true }");
must("clearSelection: { key: 'x', shift: true }");
must("focusSearch: { key: 'u', shift: true }");
must("escape: { key: 'Escape', shift: false }");
must('function isTextEditingTarget');
must('function isModifierPressed');
must('function matches');
must('function announce');
must('function clickControl');
must('function focusSearch');
must('function clearSearchOnEscape');
must('function matchesEscape');
must('function onKeydown');
must('function createHint');
must('function refreshControls');
must('new MutationObserver');
must("document.addEventListener('keydown', onKeydown)");
must("ui.search.addEventListener('focus'");
must('window.HafizeConversationWorkspaceKeyboard');
must('Object.freeze({');
must('isContentEditable');
must("['INPUT', 'TEXTAREA', 'SELECT']");
must('event.isComposing');
must('event.altKey');
must('event.preventDefault()');
must('ui.search.value = \'\'');
must("ui.search.dispatchEvent(new Event('input'", 'search event stays inside existing workspace contract');
must('ui.search.select()');
must('aria-label', 'shortcut UI is accessible');
must('role', 'hint has semantic role');
must('workspace-shortcuts');
must('workspace-shortcut-item');
must('workspace-shortcuts-title');
must('Görünen sohbetler seçildi.');
must('Sohbet seçimi temizlendi.');
must('Sohbet çalışma alanı araması odakta.');
must('Aramayı temizle');

for (const forbidden of [
  'fetch(',
  'XMLHttpRequest',
  'document.cookie',
  'Authorization',
  'Bearer ',
  'apiKey',
  'client_secret',
  'innerHTML =',
  'outerHTML =',
  'insertAdjacentHTML',
  'eval(',
  'new Function('
]) assert.ok(!source.includes(forbidden), `keyboard layer excludes ${forbidden}`);

for (const fragment of [
  '.conversation-workspace-shortcuts',
  '.workspace-shortcuts-title',
  '.workspace-shortcuts-list',
  '.workspace-shortcut-item',
  '.workspace-shortcut-item kbd',
  '@media (max-width: 460px)',
  '@media (prefers-reduced-motion: reduce)',
  '@media (forced-colors: active)'
]) mustCss(fragment);

assert.ok(index.includes('/conversation-workspace-keyboard.js'));
assert.ok(index.includes('/conversation-workspace-keyboard.css'));
assert.ok(sw.includes('/conversation-workspace-keyboard.js'));
assert.ok(sw.includes('/conversation-workspace-keyboard.css'));

const jsLines = source.split('\n').length;
const cssLines = css.split('\n').length;
assert.ok(jsLines >= 120, 'keyboard module is not a placeholder');
assert.ok(cssLines >= 45, 'keyboard styles include responsive/accessibility rules');

const shortcuts = [
  ['Ctrl / ⌘ + Shift + A', 'Görünenleri seç'],
  ['Ctrl / ⌘ + Shift + X', 'Seçimi temizle'],
  ['Ctrl / ⌘ + Shift + U', 'Aramaya geç'],
  ['Esc', 'Aramayı temizle']
];
for (const [key, label] of shortcuts) {
  assert.ok(source.includes(key), `hint contains ${key}`);
  assert.ok(source.includes(label), `hint contains ${label}`);
}

console.log(`conversation-workspace-keyboard: ${shortcuts.length} shortcuts, ${jsLines} JS lines, ${cssLines} CSS lines`);
