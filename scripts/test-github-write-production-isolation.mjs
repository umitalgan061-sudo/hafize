import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [server, tools] = await Promise.all([
  readFile(new URL('../server.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../lib/tool-runtime.mjs', import.meta.url), 'utf8')
]);

assert.doesNotMatch(server, /github-write-(?:approval|client|execution|http-api|server-runtime)/);
assert.doesNotMatch(server, /HAFIZE_GITHUB_WRITE_(?:APPROVAL_SECRET|AUTH_TOKEN|AUTH_SUBJECT|OWNER_KEY|REPOS)/);
assert.doesNotMatch(tools, /github_(?:write|create_branch|update_file|create_pr|merge_pr)/);
assert.match(tools, /github_read_file/);

console.log('github write production isolation tests passed');
