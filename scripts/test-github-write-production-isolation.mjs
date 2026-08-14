import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [server, tools] = await Promise.all([
  readFile(new URL('../server.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../lib/tool-runtime.mjs', import.meta.url), 'utf8')
]);

assert.doesNotMatch(server, /github-write-(?:approval|client|execution)/);
assert.doesNotMatch(server, /HAFIZE_GITHUB_WRITE_APPROVAL_SECRET/);
assert.doesNotMatch(tools, /github_(?:write|create_branch|create_pr|merge_pr)/);
assert.match(tools, /github_read_file/);

console.log('github write production isolation tests passed');
