import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(process.cwd());
const writer=fs.readFileSync(path.join(root,'lib/github-workspace-write.ts'),'utf8');
const server=fs.readFileSync(path.join(root,'server.ts'),'utf8');

assert.match(writer,/issueApproval\(kind: GitHubWriteAction, raw: unknown, approved = false\)/);
assert.match(writer,/if \(!approved\)/);
assert.match(writer,/approvals\.delete\(ticket\)/);
assert.match(writer,/fingerprint\(kind, normalized\)/);
assert.match(server,/body\.approved === true/);
assert.match(server,/issueApproval\(action as any, body\.payload, body\.approved === true\)/);
console.log('github-workspace-write-approval: ok');
