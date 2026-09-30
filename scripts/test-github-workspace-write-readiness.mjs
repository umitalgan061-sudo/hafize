import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(process.cwd());
const server=fs.readFileSync(path.join(root,'server.ts'),'utf8');
const ui=fs.readFileSync(path.join(root,'public/github-workspace-write.ts'),'utf8');
const docs=fs.readFileSync(path.join(root,'docs/GITHUB_WRITE_CONFIGURATION.md'),'utf8');

assert.match(server,/githubWriteConfigured: GITHUB_WRITE_CONFIGURED/);
assert.match(server,/GITHUB_WRITE_CONFIGURED = Boolean/);
assert.match(ui,/checkWriteReadiness/);
assert.match(ui,/payload\.githubWriteConfigured/);
assert.match(ui,/yazma hazır/);
assert.match(ui,/yazma kapalı/);
assert.match(docs,/githubWriteConfigured/);
console.log('github-workspace-write-readiness: ok');
