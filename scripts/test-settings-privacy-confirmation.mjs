import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const s=readFileSync('public/typed/settings-privacy.ts','utf8');
assert.ok(s.includes("rootRef.confirm?.("));
assert.ok(s.includes("rootRef.prompt?.('Onay için TEMIZLE yaz:')"));
assert.ok(s.includes("!== 'TEMIZLE'"));
console.log('privacy confirmation contract ok');
