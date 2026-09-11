import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { readShellCacheVersion } from './check-support.mjs';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('public/index.html');
const settings = read('public/settings-workspace.js');
const css = read('public/settings-workspace.css');
const sw = read('public/sw-policy.js');

assert.match(html, /settings-workspace\.css/);
assert.match(html, /settings-workspace\.js/);
// The workspace section is created at runtime, so the id lives in the module.
assert.match(settings, /WORKSPACE_ID = 'settingsWorkspace'/);
assert.match(settings, /hafize\.theme\.v1/);
assert.match(settings, /hafize\.reduced-motion\.v1/);
assert.match(settings, /hafize\.conversations\.v1/);
assert.match(settings, /hafize:workspace-changed/);
assert.match(settings, /removeItem\?\.\(STORAGE_KEY\)/);
assert.match(settings, /location\?\.reload/);
assert.match(settings, /themeSelect\.addEventListener/);
assert.match(settings, /motionSwitch\.input\.addEventListener/);
assert.match(settings, /Uygulamayı yükle/);
assert.match(css, /data-reduced-motion/);
assert.match(css, /@media \(max-width: 680px\)/);
assert.match(sw, /\/settings-workspace\.css/);
assert.match(sw, /\/settings-workspace\.js/);
assert.match(sw, new RegExp(`CURRENT_CACHE = \`\\$\\{CACHE_PREFIX\\}${readShellCacheVersion(sw)}\``));

console.log('settings workspace source-contract checks passed');
