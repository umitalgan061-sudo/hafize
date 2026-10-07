import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { assertModuleDelivered } from './shell-cache-contract.mjs';
const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('public/index.html');
const settings = read('public/typed/legacy/settings-workspace.ts');
const css = read('public/settings-workspace.css');
const sw = read('public/sw-policy.ts');

assert.match(html, /settings-workspace\.css/);
assertModuleDelivered('settings-workspace');
// The panel is injected by the module, so the id contract lives in the script.
assert.match(settings, /WORKSPACE_ID = 'settingsWorkspace'/);
assert.match(settings, /section\.id = WORKSPACE_ID/);
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
assertModuleDelivered('settings-workspace');
assert.match(sw, /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v\d+`/);

console.log('settings workspace source-contract checks passed');
