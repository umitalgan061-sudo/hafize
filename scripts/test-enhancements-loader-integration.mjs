import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const loader = require('../public/enhancements-loader.js');
const uiShell = fs.readFileSync(new URL('../public/ui-shell.js', import.meta.url), 'utf8');
const swPolicy = require('../public/sw-policy.js');

assert.match(uiShell, /script\.src = '\/enhancements-loader\.js'/);
assert.match(uiShell, /data-hafize-enhancements-entry/);
assert.match(uiShell, /querySelector\?\.\('script\[data-hafize-enhancements-entry="1"\]'/);
assert.equal(swPolicy.CURRENT_CACHE, 'hafize-shell-v50');
assert.ok(swPolicy.SHELL_ASSETS.includes('/enhancements-loader.js'));

const expected = [
  '/message-copy.js',
  '/message-edit.js',
  '/keyboard-shortcuts.js',
  '/conversation-search.js',
  '/scroll-to-latest.js',
  '/composer-limit-feedback.js',
  '/mobile-sidebar-dismiss.js',
  '/draft-clear-undo.js',
  '/draft-navigation-guard.js',
  '/conversation-keyboard-nav.js',
  '/conversation-delete-confirm.js',
  '/shortcut-help.js',
  '/network-status.js',
  '/conversation-copy.js',
  '/in-chat-find.js',
  '/safe-markdown-render.js',
  '/code-block-copy.js',
  '/conversation-export.js',
  '/response-fold.js',
  '/code-block-focus.js',
  '/composer-history.js',
  '/code-block-download.js',
  '/text-file-import.js',
  '/composer-paste-guard.js',
  '/message-timeline.js',
  '/message-keyboard-nav.js',
  '/command-palette.js'
];
assert.deepEqual(loader.ENHANCEMENTS, expected);
for (const path of expected) assert.ok(swPolicy.SHELL_ASSETS.includes(path), `${path} must remain offline shell-cached`);

for (const forbidden of [
  'https://',
  'http://',
  '/api/',
  'voice-output.js',
  'hands-free.js',
  'screen-share.js',
  'memory-ui.js',
  'cloud-session-ui.js'
]) {
  if (forbidden.endsWith('.js')) assert.equal(loader.ENHANCEMENTS.includes(`/${forbidden}`), false);
}

console.log(`enhancement loader integration passed: ${expected.length} existing UI modules wired into the live shell`);
