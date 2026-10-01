
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source=readFileSync('public/settings-privacy.js','utf8');
const readme=readFileSync('README.md','utf8');
for (const required of ['HafizePrivacyCenter','privacyReport','clearDataSurfaces','clearAllKnown','filter','copyReport']) assert.ok(source.includes(required),required);
for (const required of ['## Yerel Veri ve Gizlilik Merkezi','Gizlilik raporu','Ctrl / ⌘ + Shift + R','test-settings-privacy-inventory.mjs','test-settings-privacy-regression.mjs']) assert.ok(readme.includes(required),required);
console.log('privacy regression contract ok');
