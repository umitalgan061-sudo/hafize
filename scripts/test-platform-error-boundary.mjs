import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const source = fs.readFileSync(path.join(process.cwd(), 'public/typed/platform-error-boundary.ts'), 'utf8');
for (const token of ['redactMessage','toRedactedError','installErrorBoundary','MAX_MESSAGE','SECRET_PATTERNS','[REDACTED]','hafize:diagnostic-error']) assert.ok(source.includes(token), `error boundary contract missing: ${token}`);
for (const forbidden of ['document.cookie','localStorage.getItem(\'token\')','HAFIZE_AUTH_TOKEN','Authorization']) assert.ok(!source.includes(forbidden), `raw credential access found: ${forbidden}`);
assert.ok(source.includes('window'));
assert.ok(source.includes('promise'));
console.log('platform error boundary: ok');
