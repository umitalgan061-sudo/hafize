import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const css = fs.readFileSync(path.join(root, 'public', 'conversation-workspace.css'), 'utf8');
const keyboardCss = fs.readFileSync(path.join(root, 'public', 'conversation-workspace-keyboard.css'), 'utf8');
const keyboard = fs.readFileSync(path.join(root, 'public', 'conversation-workspace-keyboard.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const workspace = fs.readFileSync(path.join(root, 'public', 'conversation-workspace.js'), 'utf8');

const responsiveContracts = [
  ['@media (max-width: 760px)', 'tablet/mobile layout breakpoint'],
  ['@media (max-width: 460px)', 'small phone layout breakpoint'],
  ['grid-template-columns: 1fr 1fr', 'two-column control layout'],
  ['grid-template-columns: 1fr', 'single-column phone layout'],
  ['grid-column: 1 / -1', 'search occupies the compact toolbar width'],
  ['width: 100%', 'controls fit available width'],
  ['min-width: 0', 'flex/grid children can shrink'],
  ['overflow: hidden', 'quota bar clips fill'],
  ['overflow-wrap: anywhere', 'attachment-adjacent metadata remains breakable']
];
for (const [fragment, label] of responsiveContracts) assert.ok(css.includes(fragment), label);

// Media query'ler stil dosyasında, ARIA nitelikleri ise setAttribute ile JS'te tanımlanır.
const cssAccessibilityContracts = [
  ['@media (forced-colors: active)', 'forced color mode exists'],
  ["html[data-reduced-motion='true']", 'application reduced-motion flag exists'],
  ['@media (prefers-reduced-motion: reduce)', 'system reduced-motion mode exists']
];
for (const [fragment, label] of cssAccessibilityContracts) assert.ok(css.includes(fragment), label);

const ariaContracts = [
  ['aria-valuemin', 'progressbar minimum is explicit'],
  ['aria-valuemax', 'progressbar maximum is explicit'],
  ['aria-valuenow', 'progressbar current value is explicit'],
  ["setAttribute('role', 'status')", 'live status exists'],
  ["'aria-label', 'Sohbet çalışma alanı yönetimi'", 'workspace has named region']
];
for (const [fragment, label] of ariaContracts) assert.ok(workspace.includes(fragment), label);

const shortcutVisualContracts = [
  ['.conversation-workspace-shortcuts', 'shortcut helper has a container'],
  ['.workspace-shortcuts-list', 'shortcut helper has a list'],
  ['.workspace-shortcut-item', 'shortcut helper has item styling'],
  ['.workspace-shortcut-item kbd', 'shortcut keys have keyboard styling'],
  ['@media (max-width: 460px)', 'shortcut list compacts on phones']
];
for (const [fragment, label] of shortcutVisualContracts) assert.ok(keyboardCss.includes(fragment), label);

const shortcutBehaviorContracts = [
  ["event.isComposing", 'IME composition is respected'],
  ["event.altKey", 'Alt combinations are excluded'],
  ["escape: { key: 'Escape'", 'Escape is explicitly handled'],
  ['matchesEscape(event)', 'Escape has a dedicated matcher'],
  ['isTextEditingTarget(event.target)', 'editing fields own normal text entry'],
  ['event.target !== ui.search', 'workspace search is the controlled input'],
  ['event.preventDefault()', 'shortcut browser defaults are prevented'],
  ['ui.search.focus()', 'focus shortcut focuses search'],
  ['ui.search.select()', 'focus shortcut selects existing query'],
  ['document.addEventListener(\'keydown\', onKeydown)', 'keyboard listener exists']
];
for (const [fragment, label] of shortcutBehaviorContracts) assert.ok(keyboard.includes(fragment), label);

const indexContracts = [
  ['/conversation-workspace.css', 'workspace css'],
  ['/conversation-workspace-keyboard.css', 'keyboard css'],
  ['/conversation-workspace.js', 'workspace runtime'],
  ['/conversation-workspace-keyboard.js', 'keyboard runtime']
];
for (const [fragment, label] of indexContracts) assert.ok(index.includes(fragment), label);

assert.equal(index.match(/conversation-workspace-keyboard\.css/g)?.length, 1);
assert.equal(index.match(/conversation-workspace-keyboard\.js/g)?.length, 1);
assert.equal(index.match(/conversation-workspace\.css/g)?.length, 1);
assert.equal(index.match(/conversation-workspace\.js/g)?.length, 1);

const noNetwork = ['fetch(', 'XMLHttpRequest', 'WebSocket', 'document.cookie', 'Authorization', 'Bearer '];
for (const fragment of noNetwork) {
  assert.ok(!keyboard.includes(fragment), `keyboard has no ${fragment}`);
  assert.ok(!workspace.includes(fragment), `workspace has no ${fragment}`);
}

assert.ok(css.includes('background: var(--card)'));
assert.ok(css.includes('color: var(--ink)'));
assert.ok(css.includes('border: 1px solid var(--line)'));
assert.ok(keyboardCss.includes('color: var(--muted)'));
assert.ok(keyboardCss.includes('background: var(--card)'));

assert.ok(workspace.includes('row.hidden = !visible'));
assert.ok(workspace.includes("row.style.order = visible ? String(orderedIds.get(id)) : '9999'"));
assert.ok(workspace.includes('row.classList.toggle(\'workspace-selected\''));
assert.ok(workspace.includes('check.checked = state.selected.includes(id)'));

console.log(`conversation-workspace-navigation: responsive, accessibility, shortcut, shell-order and no-network contracts passed (${responsiveContracts.length + cssAccessibilityContracts.length + ariaContracts.length + shortcutVisualContracts.length + shortcutBehaviorContracts.length} checks)`);
