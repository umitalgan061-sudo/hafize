import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const index = read('public/index.html');
const vite = read('vite.config.ts');
const sw = read('public/sw-policy.js');
const packageJson = JSON.parse(read('package.json'));
const tsconfig = JSON.parse(read('tsconfig.json'));

assert.equal(typeof packageJson.scripts?.build, 'string');
assert.equal(typeof packageJson.scripts?.typecheck, 'string');
assert.equal(typeof packageJson.scripts?.['test:modern'], 'string');
assert.ok(String(packageJson.devDependencies?.typescript || packageJson.dependencies?.typescript || '').length > 0);
assert.ok(String(packageJson.devDependencies?.vite || '').length > 0);
assert.ok(String(packageJson.devDependencies?.vitest || '').length > 0);
assert.equal(tsconfig.compilerOptions.strict, true);
assert.equal(tsconfig.compilerOptions.moduleResolution, 'bundler');
assert.equal(tsconfig.compilerOptions.noUncheckedIndexedAccess, true);
assert.equal(tsconfig.compilerOptions.exactOptionalPropertyTypes, true);

const typedEntries = [
  'auth', 'chat-composer-features', 'chat-drafts', 'chat-history-search', 'chat-history-management', 'chat-history-export',
  'composer-history', 'conversation-workspace', 'hands-free', 'runtime-health', 'scheduled-tasks', 'screen-share',
  'settings-workspace', 'ui-shell', 'voice-input', 'voice-output', 'workspace-navigation'
];

for (const name of typedEntries) {
  const source = read(`public/typed/${name}.ts`);
  assert.ok(source.length > 500, `${name} should contain a meaningful typed implementation`);
  assert.ok(/export /.test(source), `${name} has no typed export surface`);
  assert.doesNotMatch(source, /document\.write\s*\(/, `${name} must not use document.write`);
  assert.doesNotMatch(source, /innerHTML\s*=/, `${name} must not use innerHTML assignment`);
  assert.doesNotMatch(source, /outerHTML\s*=/, `${name} must not use outerHTML assignment`);
}

const directLegacyPairs = typedEntries.map((name) => [name, `/typed-build/${name}.js`]);
for (const [name, entry] of directLegacyPairs) assert.match(index, new RegExp(entry.replaceAll('.', '\\.')), `index missing generated entry ${name}`);

const removedLegacy = [
  '/auth.js', '/chat-composer-features.js', '/chat-drafts.js', '/chat-history-search.js', '/chat-history-management.js',
  '/chat-history-export.js', '/composer-history.js', '/conversation-workspace.js', '/hands-free.js', '/scheduled-tasks.js',
  '/screen-share.js', '/settings-workspace.js', '/ui-shell.js', '/voice-input.js', '/voice-output.js', '/workspace-navigation.js'
];
for (const legacy of removedLegacy) assert.equal(index.includes(`src="${legacy}"`), false, `${legacy} is still loaded in index.html`);

for (const [name] of directLegacyPairs) assert.match(vite, new RegExp(`['"]${name}['"]`), `Vite missing ${name}`);
for (const [name, entry] of directLegacyPairs) assert.match(sw, new RegExp(entry.replaceAll('.', '\\.'), 'g'), `Service worker missing ${name}`);

assert.match(sw, /CURRENT_CACHE.*v38/);
assert.match(sw, /network-only/);
assert.match(sw, /pathname\.startsWith\('\/api\/'\)/);
assert.match(vite, /target:\s*'es2022'/);
assert.match(vite, /sourcemap:\s*true/);
assert.match(vite, /fs:\s*\{ strict:\s*true \}/);
assert.match(vite, /proxy:/);

const runtime = read('public/typed/runtime-health.ts');
assert.match(runtime, /RUNTIME_LIMITS/);
assert.match(runtime, /RUNTIME_STORAGE_KEY/);
assert.match(runtime, /runtimeSnapshot/);
assert.match(runtime, /registerModule/);
assert.match(runtime, /window\.addEventListener/);
assert.match(runtime, /unhandledrejection/);
assert.match(runtime, /offline/);
assert.doesNotMatch(runtime, /navigator\.sendBeacon/);
assert.doesNotMatch(runtime, /XMLHttpRequest/);

const platform = read('public/typed/browser-platform.ts');
assert.match(platform, /AbortController/);
assert.match(platform, /sameOriginPath/);
assert.match(platform, /safeStorage/);
assert.match(platform, /writeStorage/);
assert.match(platform, /class Disposer/);

const auth = read('public/typed/auth.ts');
assert.match(auth, /fetch\s*=\s*async/);
assert.match(auth, /X-Hafize-CSRF/);
assert.match(auth, /credentials:\s*'same-origin'/);
assert.match(auth, /AUTH_SESSION_FAILED/);
assert.doesNotMatch(auth, /localStorage.*token/i);
assert.doesNotMatch(auth, /sessionStorage.*token/i);

const media = read('public/typed/screen-share.ts');
assert.match(media, /explicitUserIntent/);
assert.match(media, /audio:\s*false/);
assert.match(media, /stopStream/);
assert.match(media, /getDisplayMedia/);
assert.match(media, /image\/jpeg/);

const tasks = read('public/typed/scheduled-tasks.ts');
assert.match(tasks, /AbortController/);
assert.match(tasks, /encodeURIComponent/);
assert.match(tasks, /method:\s*'DELETE'/);
assert.match(tasks, /maxAttempts/);
assert.match(tasks, /SCHEDULE_LIMITS/);

const history = read('public/typed/conversation-workspace.ts');
assert.match(history, /importMessages/);
assert.match(history, /conversations:\s*30/);
assert.match(history, /selected/);
assert.match(history, /normalizeConversationList/);
assert.match(history, /filterConversations/);

const composer = read('public/typed/chat-composer-features.ts');
assert.match(composer, /fileBytes/);
assert.match(composer, /attachments/);
assert.match(composer, /File\.text|file\.text/);
assert.match(composer, /DragEvent/);
assert.match(composer, /ClipboardEvent/);

const voiceInput = read('public/typed/voice-input.ts');
assert.match(voiceInput, /SpeechRecognition/);
assert.match(voiceInput, /not-allowed/);
assert.match(voiceInput, /documentRef\.hidden/);

const voiceOutput = read('public/typed/voice-output.ts');
assert.match(voiceOutput, /speechSynthesis/);
assert.match(voiceOutput, /speechOutput|VOICE_OUTPUT/);
assert.match(voiceOutput, /visibilitychange/);

const handsFree = read('public/typed/hands-free.ts');
assert.match(handsFree, /containsWakePhrase/);
assert.match(handsFree, /30 \* 60 \* 1000/);
assert.match(handsFree, /networkRetryDelay/);
assert.match(handsFree, /hafize:hands-free-revoke/);

const composerHistory = read('public/typed/composer-history.ts');
assert.match(composerHistory, /ArrowUp/);
assert.match(composerHistory, /ArrowDown/);
assert.match(composerHistory, /compositionstart/);
assert.match(composerHistory, /COMPOSER_HISTORY_RETENTION/);

const settings = read('public/typed/settings-workspace.ts');
assert.match(settings, /SETTINGS_THEME_KEY/);
assert.match(settings, /SETTINGS_REDUCED_MOTION_KEY/);
assert.match(settings, /SETTINGS_CONVERSATIONS_KEY/);
assert.match(settings, /geri alınamaz/);

const ui = read('public/typed/ui-shell.ts');
assert.match(ui, /createMonthCells/);
assert.match(ui, /moveCalendarDate/);
assert.match(ui, /installSidebarDisclosure/);
assert.match(ui, /aria-expanded/);

const navigation = read('public/typed/workspace-navigation.ts');
assert.match(navigation, /WORKSPACES/);
assert.match(navigation, /MutationObserver/);
assert.match(navigation, /aria-current/);
assert.match(navigation, /destroy/);

for (const testName of [
  'browser-platform.test.ts', 'chat-history-search.test.ts', 'composer-history.test.ts',
  'conversation-workspace.test.ts', 'scheduled-tasks.test.ts', 'screen-share.test.ts',
  'voice-input.test.ts', 'voice-output.test.ts'
]) {
  const content = read(`public/typed/${testName}`);
  assert.match(content, /describe\(/);
  assert.match(content, /expect\(/);
  assert.match(content, /vitest/);
}

console.log(`TypeScript runtime integration checks passed: ${typedEntries.length} typed entries, ${removedLegacy.length} legacy entry points removed.`);
