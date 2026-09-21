import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const sources = [
  'public/github-workspace.ts',
  'public/github-workspace-extra.ts',
  'public/github-workspace-actions.ts',
  'public/github-workspace-details.ts'
].map((file) => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');

assert.doesNotMatch(sources, /fetch\([^)]*method:\s*['"](POST|PUT|PATCH|DELETE)['"]/s);
assert.doesNotMatch(sources, /XMLHttpRequest/);
assert.doesNotMatch(sources, /WebSocket/);
assert.doesNotMatch(sources, /GITHUB_TOKEN/);
console.log('github-workspace-client-write-boundary: ok');
