
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source=readFileSync('public/settings-privacy.js','utf8');
for (const required of ['let destroyed = false','if (destroyed) return','listeners.splice(0)','panel.remove()','CHANGE_EVENT']) assert.ok(source.includes(required),required);
console.log('privacy lifecycle contract ok');
