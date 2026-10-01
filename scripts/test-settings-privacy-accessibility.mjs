
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source=readFileSync('public/settings-privacy.js','utf8');
for (const required of ['role\', \'status\'','aria-live\', \'polite\'','aria-labelledby\', \'privacyDataCenterTitle\'','aria-controls\', \'privacyDataCenterBody\'','contenteditable="true"','event.preventDefault()']) assert.ok(source.includes(required),required);
console.log('privacy accessibility contract ok');
