import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile('public/prompt-library-safety.js','utf8');
const fn=source.indexOf('function normalizeRecoveryPayload');
const build=source.indexOf('function buildImportPlan');
assert.ok(fn>=0 && build>fn);
assert.match(source.slice(fn,build),/Array\.isArray\(payload\.prompts\)/);
console.log('prompt-library-recovery-wrapper-compat: ok');
