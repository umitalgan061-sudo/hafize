import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const s=readFileSync('public/typed/settings-privacy.ts','utf8');
const required=['prompt-library.smart-views.v1','prompt-library.smart-fill.v1.','prompt-library.collections.v1','prompt-library.revisions.v1','composer-history.settings.v1','workspace-backup.meta.v1'];
for(const key of required) assert.ok(s.includes(key),key);
console.log('privacy allowlist regression ok');
