import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(process.cwd());
const writer=fs.readFileSync(path.join(root,'lib/github-workspace-write.ts'),'utf8');
const ui=fs.readFileSync(path.join(root,'public/github-workspace-write.ts'),'utf8');
const server=fs.readFileSync(path.join(root,'server.ts'),'utf8');

assert.match(writer,/Object\.freeze/);
assert.match(writer,/encodeURIComponent/);
assert.match(writer,/Cache-Control/);
assert.match(writer,/X-GitHub-Api-Version/);
assert.match(writer,/User-Agent/);
assert.match(ui,/Cache: 'no-store'/i);
assert.match(ui,/credentials: 'same-origin'/);
assert.match(ui,/Onayla ve yürüt/);
assert.match(ui,/Yazma önizlemesi/);
assert.match(ui,/Son başarılı işlemler/);
assert.match(server,/sendJson\(res, 502, \{ error: 'GITHUB_WRITE_FAILED' \}\)/);
assert.match(server,/sendJson\(res, error\.status, \{ error: error\.code \}\)/);
console.log('github-workspace-write-quality: ok');
