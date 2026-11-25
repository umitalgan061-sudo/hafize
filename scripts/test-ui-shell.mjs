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

const designSystem=readFileSync(new URL('../public/design-system.css',import.meta.url),'utf8');
const indexHtml=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
assert.ok(indexHtml.indexOf('/design-system.css')>indexHtml.indexOf('/advanced-workspace.css'));
assert.match(designSystem,/html\[data-theme="light"\]\s*\{/);
assert.match(designSystem,/html\[data-theme="dark"\]\s*\{/);
assert.match(designSystem,/@container hz-panel \(max-width: 530px\)/);
assert.doesNotMatch(designSystem,/#layoutToggle/);
assert.match(designSystem,/@media not all and \(forced-colors: active\)/);
assert.match(designSystem,/@media\(prefers-reduced-motion:reduce\)/);
for(const page of ['studio','task-plan','file-analysis']){
  const html=readFileSync(new URL('../public/'+page+'.html',import.meta.url),'utf8');
  assert.ok(html.indexOf('/theme-init.js')>=0&&html.indexOf('/theme-init.js')<html.indexOf('/studio.css'));
}
const settingsSource=readFileSync(new URL('../public/typed/legacy/settings-workspace.ts',import.meta.url),'utf8');
assert.match(settingsSource,/heading\.textContent = 'Ayarlar'/);
const luminance=hex=>{const rgb=hex.match(/[a-f0-9]{2}/gi).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];};
const contrast=(a,b)=>{const values=[luminance(a),luminance(b)].sort((x,y)=>y-x);return (values[0]+.05)/(values[1]+.05);};
for(const [fg,bg] of [['302b27','fffdfa'],['69635c','fffdfa'],['f2efea','2b2c2e'],['b8b1a8','2b2c2e'],['ffffff','a94a2c'],['ffffff','b4232b'],['ffffff','187348']])assert.ok(contrast(fg,bg)>=4.5,fg+' / '+bg);
console.log('Frontend design system contract OK: themes, contrast, standalone tools and retained mode controls');

assert.match(designSystem,/--bg:#202122; --panel:#292927; --card:#2e2d2b/);
assert.match(designSystem,/--bg:#f7f5f0; --panel:#efebe5; --card:#fffdfa/);
for(const effect of ['hz-orange-beam-x','hz-orange-beam-y','hz-orange-header','hz-refined-composer-pulse']){
  assert.ok(designSystem.includes('@keyframes '+effect),effect);
}
assert.match(designSystem,/html\[data-theme\] \.edge-beam\s*\{[^}]*display:block;opacity:\.82/s);
assert.match(designSystem,/html\[data-reduced-motion="true"\][^{}]*::after\{animation:none!important/);
assert.match(designSystem,/pointer-events:none/);
assert.doesNotMatch(designSystem,/#layoutToggle/);
assert.doesNotMatch(designSystem,/hz-orange-composer-breathe|--hz-card-warm/);
assert.match(designSystem, /\.main \.primary-column form#composer\.composer\{background:var\(--card\);border-color:var\(--line\)\}/);
for(const [fg,bg] of [['302b27','fffdfa'],['69635c','fffdfa'],['f2efea','2e2d2b'],['b8b1a8','2e2d2b'],['ffffff','a94a2c'],['a04325','fffdfa']])assert.ok(contrast(fg,bg)>=4.5,fg+' / '+bg);
const studioStyles=readFileSync(new URL('../public/studio.css',import.meta.url),'utf8');
assert.match(studioStyles,/@keyframes studio-orange-trace/);
console.log('Hafize elegant theme contract OK: neutral surfaces, fine animated accents and reduced motion');

assert.match(indexHtml,/href="\/design-system\.css\?v=thinking-border-20261125-1"/);
const renderServerSource=readFileSync(new URL('../server.ts',import.meta.url),'utf8');
assert.match(renderServerSource,/url\.pathname === '\/release\.json'/);
assert.match(renderServerSource,/const marker = '<meta name="hafize-release" content="' \+ revision/);
assert.match(renderServerSource,/const revision = relative === 'index.html'/);
const releaseUpdateSource=readFileSync(new URL('../public/typed/release-update.ts',import.meta.url),'utf8');
assert.match(releaseUpdateSource,/if\(valid\(latest\)&&loaded!==latest\)/);
console.log('Render release refresh contract OK: stamped HTML, versioned CSS and release endpoint');

assert.match(designSystem,/animation:hz-refined-composer-pulse 5\.6s ease-in-out infinite/);
assert.match(designSystem,/#composer\[data-voice-listening="true"\]>\.hz-composer-pulse\{opacity:0;animation:none\}/);
assert.match(designSystem,/html\[data-reduced-motion="true"\] #composer>\.hz-composer-pulse\{animation:none!important\}/);
assert.doesNotMatch(designSystem,/form#composer\.composer::after|form#composer\.composer::before/);
assert.match(designSystem,/html\[data-theme\] \.edge-beam\{opacity:\.78\}/);
console.log('Refined motion contract OK: four edges, top trace, gentle independent composer pulse and mobile support');

assert.match(indexHtml, /<span class="hz-composer-pulse" aria-hidden="true"><\/span>/);
assert.match(designSystem, /#composer>\.hz-composer-pulse\s*\{[^}]*pointer-events:none/s);

assert.match(indexHtml, /<div class="hz-frame" aria-hidden="true"><i><\/i><i><\/i><\/div>/);
assert.match(designSystem, /@property --hz-perimeter-angle/);
assert.match(designSystem, /mask-composite:exclude/);
assert.match(designSystem, /body:has\(>\.hz-frame\)>\.edge-beam\{display:none\}/);
assert.match(designSystem, /html\[data-theme\]\.hafize-working body>\.hz-frame>i,[\s\S]*?padding:3px;animation-duration:3\.8s/);
assert.match(designSystem, /html\[data-theme\] #composer>\.hz-composer-pulse\{\s*position:absolute;inset:-2px;padding:1\.5px;opacity:\.8;box-shadow:none;\s*animation-duration:8s/);
const frameSource=readFileSync(new URL('../public/typed/theme-polish.ts',import.meta.url),'utf8');
assert.match(frameSource,/if \(!document\.querySelector\('\.hz-frame'\)\)/);
const thinkingSource=readFileSync(new URL('../public/typed/chat-scroll.ts',import.meta.url),'utf8');
assert.match(thinkingSource,/classList\.add\('hafize-working'\)/);
assert.match(thinkingSource,/classList\.remove\('hafize-working'\)/);
console.log('Continuous perimeter contract OK: idle/working states, composer ring, fallback and single frame');

assert.match(designSystem,/html\[data-theme\]\.hafize-working body>\.hz-frame\{\s*display:block;position:fixed;inset:0;[^}]*border-radius:0;[^}]*pointer-events:none;opacity:1;\s*box-shadow:inset 0 0 0 2px #d9774f/s);
console.log('Thinking outer viewport outline contract OK');
