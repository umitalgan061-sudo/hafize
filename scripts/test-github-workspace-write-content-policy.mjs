import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(process.cwd());
const writer=fs.readFileSync(path.join(root,'lib/github-workspace-write.ts'),'utf8');
const policy=fs.readFileSync(path.join(root,'lib/plaintext-credential-policy.ts'),'utf8');

assert.match(writer,/containsPlaintextCredential/);
assert.match(writer,/GITHUB_SENSITIVE_PATH_BLOCKED/);
assert.match(writer,/GITHUB_WORKFLOW_PATH_BLOCKED/);
assert.match(writer,/GITHUB_CONTENT_CREDENTIAL_BLOCKED/);
assert.match(writer,/\.github\/workflows/);
assert.match(policy,/KNOWN/);
assert.match(policy,/PRIVATE_KEY/);
assert.match(policy,/AUTHORIZATION/);
console.log('github-workspace-write-content-policy: ok');
