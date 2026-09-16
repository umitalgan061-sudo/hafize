import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const typed = path.join(root, 'public', 'typed');
const read = (name) => fs.readFileSync(path.join(typed, name), 'utf8');
const index = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const vite = fs.readFileSync(path.join(root, 'vite.config.ts'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'public', 'sw-policy.js'), 'utf8');

const entries = [
  'auth', 'browser-platform', 'chat-composer-features', 'chat-drafts',
  'chat-history-search', 'chat-history-management', 'chat-history-export',
  'composer-history', 'conversation-workspace', 'hands-free', 'runtime-health',
  'scheduled-tasks', 'screen-share', 'settings-workspace', 'ui-shell',
  'voice-input', 'voice-output', 'workspace-navigation'
];

for (const name of entries) {
  assert.ok(fs.existsSync(path.join(typed, `${name}.ts`)), `missing typed entry: ${name}`);
  const source = read(`${name}.ts`);
  assert.ok(source.includes("'use strict'") || source.includes('import '), `${name} is not a typed module`);
  assert.ok(!source.includes('innerHTML'), `${name} must not use innerHTML`);
  assert.ok(!source.includes('outerHTML'), `${name} must not use outerHTML`);
}

assert.match(vite, /const TYPED_ENTRIES/);
for (const name of entries) assert.match(vite, new RegExp(`['"]${name}['"]`), `vite missing ${name}`);

for (const name of entries) assert.match(index, new RegExp(`/typed-build/${name}\\.js`), `index missing ${name}`);
for (const legacy of ['/auth.js', '/chat-composer-features.js', '/chat-drafts.js', '/voice-input.js', '/voice-output.js', '/hands-free.js', '/screen-share.js', '/workspace-navigation.js', '/conversation-workspace.js', '/chat-history-search.js', '/chat-history-management.js', '/chat-history-export.js', '/composer-history.js', '/scheduled-tasks.js', '/settings-workspace.js', '/ui-shell.js']) {
  assert.equal(index.includes(`src="${legacy}"`), false, `legacy runtime still loaded: ${legacy}`);
}

for (const name of entries) assert.match(sw, new RegExp(`/typed-build/${name}\\.js`), `service worker missing ${name}`);
assert.match(sw, /pathname\.startsWith\('\/api\/'\)/);
assert.match(sw, /network-only/);

const auth = read('auth.ts');
assert.match(auth, /X-Hafize-CSRF/);
assert.match(auth, /same-origin/);
assert.match(auth, /AUTH_SESSION_FAILED/);
assert.doesNotMatch(auth, /Authorization\s*:/i);
assert.doesNotMatch(auth, /localStorage\.setItem\([^,]+,\s*.*token/i);

const composer = read('chat-composer-features.ts');
assert.match(composer, /fileBytes/);
assert.match(composer, /attachments/);
assert.match(composer, /file\.text\(\)/);
assert.match(composer, /preventDefault/);
assert.match(composer, /no.*separate.*upload|sunucuya ayrı bir yükleme/i);

const drafts = read('chat-drafts.ts');
assert.match(drafts, /chat-drafts\.v1/);
assert.match(drafts, /DRAFT_LIMITS/);
assert.match(drafts, /visibilitychange/);
assert.match(drafts, /pagehide/);
assert.match(drafts, /beforeunload/);

const voice = read('voice-output.ts');
assert.match(voice, /speechSynthesis/);
assert.match(voice, /tr-TR/);
assert.match(voice, /visibilitychange/);
assert.match(voice, /Kod bloğu atlandı/);

const voiceInput = read('voice-input.ts');
assert.match(voiceInput, /SpeechRecognition/);
assert.match(voiceInput, /not-allowed/);
assert.match(voiceInput, /interimResults/);
assert.match(voiceInput, /input.*bubbles/);

const handsFree = read('hands-free.ts');
assert.match(handsFree, /containsWakePhrase/);
assert.match(handsFree, /30 \* 60 \* 1000/);
assert.match(handsFree, /HANDS_FREE_EVENTS/);
assert.match(handsFree, /networkStreak/);

const screen = read('screen-share.ts');
assert.match(screen, /explicitUserIntent/);
assert.match(screen, /getDisplayMedia/);
assert.match(screen, /image\/jpeg/);
assert.match(screen, /stopStream/);
assert.doesNotMatch(screen, /audio:\s*true/);

const tasks = read('scheduled-tasks.ts');
assert.match(tasks, /api\/schedules/);
assert.match(tasks, /credentials:\s*'same-origin'/);
assert.match(tasks, /DELETE/);
assert.match(tasks, /SCHEDULE_LIMITS/);
assert.match(tasks, /AbortController/);

const history = read('conversation-workspace.ts');
assert.match(history, /ConversationFilter/);
assert.match(history, /ConversationSort/);
assert.match(history, /normalizeConversationList/);
assert.match(history, /exportSelection/);
assert.match(history, /MAX_IMPORT_MESSAGES|importMessages/);

const historySearch = read('chat-history-search.ts');
assert.match(historySearch, /searchableText/);
assert.match(historySearch, /Ctrl|metaKey/);
assert.match(historySearch, /Escape/);
assert.match(historySearch, /aria-label/);

const historyManagement = read('chat-history-management.ts');
assert.match(historyManagement, /pinned/);
assert.match(historyManagement, /normalizeTitle/);
assert.match(historyManagement, /confirm/);
assert.match(historyManagement, /data-conversation-id/);

const historyExport = read('chat-history-export.ts');
assert.match(historyExport, /buildMarkdown/);
assert.match(historyExport, /buildJson/);
assert.match(historyExport, /noopener/);
assert.match(historyExport, /revokeObjectURL/);

const composerHistory = read('composer-history.ts');
assert.match(composerHistory, /ArrowUp/);
assert.match(composerHistory, /ArrowDown/);
assert.match(composerHistory, /compositionstart/);
assert.match(composerHistory, /compositionend/);
assert.match(composerHistory, /maxItems/);

const settings = read('settings-workspace.ts');
assert.match(settings, /Açık/);
assert.match(settings, /Koyu/);
assert.match(settings, /Azaltılmış hareket/);
assert.match(settings, /geri alınamaz/);

const uiShell = read('ui-shell.ts');
assert.match(uiShell, /createMonthCells/);
assert.match(uiShell, /moveCalendarDate/);
assert.match(uiShell, /aria-expanded/);
assert.match(uiShell, /Speech|mic/);

const navigation = read('workspace-navigation.ts');
assert.match(navigation, /normalizeWorkspace/);
assert.match(navigation, /aria-current/);
assert.match(navigation, /MutationObserver/);
assert.match(navigation, /destroy/);

const runtime = read('runtime-health.ts');
assert.match(runtime, /HAFIZE_RUNTIME_VERSION/);
assert.match(runtime, /unhandledrejection/);
assert.match(runtime, /offline/);
assert.match(runtime, /performance/);
assert.match(runtime, /saveDiagnostics/);
assert.doesNotMatch(runtime, /fetch\(/);

const platform = read('browser-platform.ts');
assert.match(platform, /class Disposer/);
assert.match(platform, /sameOriginPath/);
assert.match(platform, /safeJsonParse/);
assert.match(platform, /timeoutSignal/);
assert.match(platform, /dispatch/);

console.log(`Typed runtime wave contract checks passed for ${entries.length} modules.`);
