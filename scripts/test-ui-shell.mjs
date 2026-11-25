import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const shell = require('../public/typed/ui-shell.ts');

assert.equal(shell.resolveTheme('dark', false), 'dark');
assert.equal(shell.resolveTheme('light', true), 'light');
assert.equal(shell.resolveTheme(null, true), 'dark');
assert.equal(shell.resolveTheme('system', false), 'light');
assert.deepEqual(shell.WEEKDAYS, ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']);

const may2025 = shell.createMonthCells(2025, 4, 15);
assert.equal(may2025.length, 42);
assert.deepEqual(may2025.slice(0, 4).map(({ day, outside }) => [day, outside]), [
  [28, true], [29, true], [30, true], [1, false]
]);
assert.equal(may2025.filter((cell) => cell.selected).length, 1);
assert.equal(may2025.find((cell) => cell.selected)?.day, 15);
assert.equal(may2025[0].year, 2025);
assert.equal(may2025[0].month, 3);
assert.equal(may2025[41].day, 8);
assert.equal(may2025[41].month, 5);

const feb2024 = shell.createMonthCells(2024, 1, 29);
assert.equal(feb2024.some((cell) => cell.day === 29 && !cell.outside && cell.selected), true);

console.log('UI shell OK: theme resolution and Monday-first 42-cell Turkish calendar contract verified');

assert.equal(shell.calendarDateKey(new Date(2026,10,25)),'2026-11-25');
const input=[{scheduleId:'b',task:'Öğleden sonra',runAt:new Date(2026,10,25,14).toISOString(),status:'scheduled'},{scheduleId:'a',task:'Sabah',runAt:new Date(2026,10,25,9).toISOString(),status:'completed'},{scheduleId:'c',task:'Yarın',runAt:new Date(2026,10,26,10).toISOString(),status:'running'},{scheduleId:'cancel',task:'İptal',runAt:new Date(2026,10,25,8).toISOString(),status:'cancelled'},{scheduleId:'invalid',task:'Hatalı',runAt:'invalid',status:'scheduled'}];
const agenda=shell.parseDesktopAgendaTasks(input);
assert.deepEqual(shell.agendaTasksForDate(agenda,new Date(2026,10,25)).map(x=>x.id),['a','b']);
assert.deepEqual(shell.agendaTasksForDate(agenda,new Date(2026,10,26)).map(x=>x.id),['c']);
assert.equal(shell.DESKTOP_AGENDA_MEDIA,'(min-width: 1041px) and (hover: hover) and (pointer: fine)');

const advanced = require('../public/typed/advanced-workspace.ts');
assert.equal(advanced.normalizeAdvancedSearch('  GÖREVLER / Bağlantı  '),'gorevler / baglanti');
assert.equal(advanced.classifyAdvancedCard('', 'utility-card calendar-card', 'Takvim'),'daily');
assert.equal(advanced.classifyAdvancedCard('calendarConnectionCard','','Takvim bağlantısı'),'connections');
assert.equal(advanced.classifyAdvancedCard('githubWorkspaceCard','','GitHub'),'connections');
assert.equal(advanced.classifyAdvancedCard('scheduleRuntimeCard','','Görev motoru'),'tasks');
assert.equal(advanced.classifyAdvancedCard('promptLibraryCard','','İstem kütüphanesi'),'chat');
assert.equal(advanced.classifyAdvancedCard('systemReadinessCard','','Sistem durumu'),'system');
assert.equal(advanced.classifyAdvancedCard('newUnknownFeature','','Yeni özellik'),'other');
assert.equal(advanced.advancedCardMatches('all','baglanti','connections','Bağlantılar'),true);
assert.equal(advanced.advancedCardMatches('tasks','','connections','GitHub'),false);
assert.equal(advanced.advancedCardMatches('chat','istem','chat','İstem Kütüphanesi'),true);
assert.equal(advanced.advancedCardMatches('all','olmayan','daily','Takvim'),false);
assert.equal(advanced.advancedCardMatches('all','','other','Yeni araç'),true);
console.log('Advanced workspace OK: Turkish search, card categorization and category/query filtering');

/* The rail is a narrow container even on a wide desktop. Keep layout contracts
   synchronized and the red switch available before advanced mode is selected. */
const { readFileSync } = await import('node:fs');
const advancedStyles = readFileSync(new URL('../public/advanced-workspace.css', import.meta.url), 'utf8');
const advancedSource = readFileSync(new URL('../public/typed/advanced-workspace.ts', import.meta.url), 'utf8');
assert.match(advancedStyles, /@media\(min-width:1180px\)/);
assert.match(advancedSource, /matchMedia\('\(min-width: 1180px\)'\)/);
assert.match(advancedStyles, /container:aw-card \/ inline-size/);
assert.match(advancedStyles, /@container aw-card \(max-width: 520px\)/);
assert.match(advancedStyles, /@container aw-card \(max-width: 320px\)/);
assert.match(advancedStyles, /grid-auto-rows:max-content/);
assert.match(advancedStyles, /html\[data-theme\] #sidebar #layoutToggle\s*\{[^}]*background:#b4232b;color:#fff/s);
assert.doesNotMatch(advancedStyles, /\.aw-rail-header\{position:sticky/);
console.log('Advanced panel fit contract OK: synchronized breakpoints, container queries, red layout switch');

assert.match(advancedStyles, /--aw-width:clamp\(300px,23vw,340px\)/);
assert.match(advancedStyles, /width:min\(340px,calc\(100vw - 24px\)\)/);
assert.match(advancedStyles, /html\[data-hafize-layout="classic"\] #sidebar \.history-block\s*\{[^}]*height:auto;min-height:0;max-height:none;flex:0 0 auto/s);
assert.match(advancedStyles, /#sidebar #conversationList\s*\{[^}]*max-height:min\(38dvh,340px\);flex:0 0 auto/s);
assert.match(advancedStyles, /#sidebar #layoutToggle\[aria-pressed="true"\]\s*\{[^}]*background:#187348;[^}]*color:#fff/s);
console.log('Advanced layout contract OK: intrinsic sidebar sections, compact right rail, green return switch');
