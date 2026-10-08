import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(process.cwd());
const writer=fs.readFileSync(path.join(root,'lib/github-workspace-write.ts'),'utf8');
const server=fs.readFileSync(path.join(root,'server.ts'),'utf8');
const env=fs.readFileSync(path.join(root,'.env.example'),'utf8');

for(const action of ['branch','file','pull']) assert.match(writer, new RegExp(`['"]${action}['"]`));
assert.match(writer,/\/git\/refs/);
assert.match(writer,/\/contents\//);
assert.match(writer,/\/pulls/);
assert.match(writer,/Buffer\.from\(fileContent,\s*'utf8'\)\.toString\('base64'\)/);
assert.match(writer,/existingSha/);
assert.match(server,/GITHUB_WRITE_CONFIGURED/);
assert.match(server,/githubWriteConfigured/);
assert.match(env,/HAFIZE_GITHUB_WRITE_REPOS=/);
console.log('github-workspace-write-api: ok');
