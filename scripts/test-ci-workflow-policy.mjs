import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflow = await readFile(
  new URL('../.github/workflows/check.yml', import.meta.url),
  'utf8'
);

// CI must cover pull requests, main updates and explicit manual recovery runs.
assert.match(workflow, /^\s*pull_request:\s*$/m);
assert.match(workflow, /^\s*workflow_dispatch:\s*$/m);
assert.match(workflow, /push:\s*\n\s*branches:\s*\n\s*- main/m);

// Keep the workflow read-only and avoid the elevated pull_request_target context.
assert.match(workflow, /permissions:\s*\n\s*contents:\s*read/m);
assert.doesNotMatch(workflow, /pull_request_target\s*:/);
assert.doesNotMatch(workflow, /contents:\s*write|actions:\s*write|pull-requests:\s*write/);

// Reproducible lockfile install and the repository's single canonical verification entrypoint.
assert.match(workflow, /run:\s*npm ci --ignore-scripts --no-audit --no-fund/);
assert.match(workflow, /run:\s*npm run check/);
assert.doesNotMatch(workflow, /run:\s*npm install\b/);

// Feature branches are validated by pull_request, avoiding duplicate push + PR runs.
assert.doesNotMatch(workflow, /hafize\/\*\*/);

console.log('CI workflow policy tests passed');