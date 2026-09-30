import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(process.cwd());
const server=fs.readFileSync(path.join(root,'server.ts'),'utf8');
const guard=fs.readFileSync(path.join(root,'lib/production-guard.ts'),'utf8');

const approval='/api/github/workspace/write/approval';
const write='/api/github/workspace/write';

assert.match(server,new RegExp(approval.replaceAll('/','\\/')));
assert.match(server,new RegExp(write.replaceAll('/','\\/')));
assert.match(server,/req\.method === 'POST'/);
assert.match(server,/handleGitHubWorkspaceWrite\(req, url, res\)/);
assert.match(guard,new RegExp(approval.replaceAll('/','\\/')));
assert.match(guard,new RegExp(write.replaceAll('/','\\/')));
assert.match(guard,/safeMethod/);
console.log('github-workspace-write-routing: ok');
