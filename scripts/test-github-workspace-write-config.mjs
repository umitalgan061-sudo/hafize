import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(process.cwd());
const server=fs.readFileSync(path.join(root,'server.ts'),'utf8');
const env=fs.readFileSync(path.join(root,'.env.example'),'utf8');
const docs=fs.readFileSync(path.join(root,'docs/GITHUB_WRITE_CONFIGURATION.md'),'utf8');

assert.match(server,/HAFIZE_GITHUB_WRITE_REPOS/);
assert.match(server,/GITHUB_WRITE_CONFIGURED/);
assert.match(server,/githubWriteConfigured/);
assert.match(env,/HAFIZE_GITHUB_WRITE_REPOS=/);
assert.match(docs,/Write allowlist/);
assert.match(docs,/read allowlist/);
assert.match(docs,/githubWriteConfigured/);
console.log('github-workspace-write-config: ok');
