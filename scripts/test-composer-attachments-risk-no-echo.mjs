import assert from 'node:assert/strict';
import fs from 'node:fs';
const scan=fs.readFileSync('public/composer-attachments-secret-scan.js','utf8');
const runtime=fs.readFileSync('public/composer-attachments.js','utf8');
assert.match(scan,/summary\(result\)/);
assert.match(scan,/finding\.label|item\.label/);
assert.doesNotMatch(runtime,/item\.content.*status|status.*item\.content/);
console.log('attachment risk no-echo: ok');