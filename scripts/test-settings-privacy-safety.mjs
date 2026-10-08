
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source=readFileSync('public/typed/settings-privacy.ts','utf8');
for (const forbidden of ['fetch(','XMLHttpRequest','WebSocket']) assert.ok(!source.includes(forbidden),forbidden);
for (const required of ['localOnly: true','contentIncluded: false','safeStorage(storage)','const MAX_KEYS = 300','Math.min(MAX_KEYS,','token, OAuth secret ve sunucu görev verileri']) assert.ok(source.includes(required),required);
console.log('privacy safety contract ok');
