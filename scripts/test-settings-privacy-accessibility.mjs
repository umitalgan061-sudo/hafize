import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source=readFileSync('public/typed/settings-privacy.ts','utf8');
for (const required of ['role\', \'status\'','aria-live\', \'polite\'','aria-labelledby\', \'privacyDataCenterTitle\'','aria-controls\', \'privacyDataCenterBody\'']) assert.ok(source.includes(required),required);
// The panel used to grab Ctrl/Cmd+Shift+R, which is the browser's hard-reload shortcut.
assert.ok(!/toLowerCase\(\) !== ['"]r['"]|SHORTCUT = ['"]r['"]/.test(source), 'must not intercept Ctrl/Cmd+Shift+R');
console.log('privacy accessibility contract ok');
