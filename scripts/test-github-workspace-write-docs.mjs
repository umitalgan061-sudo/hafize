import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(process.cwd());
for(const name of [
  'GITHUB_WRITE.md',
  'GITHUB_WRITE_API.md',
  'GITHUB_WRITE_SECURITY.md',
  'GITHUB_WRITE_DATA_MODEL.md',
  'GITHUB_WRITE_USER_GUIDE.md',
  'GITHUB_WRITE_QA.md',
  'GITHUB_WRITE_OPERATIONS.md',
  'GITHUB_WRITE_ROLLBACK.md',
  'GITHUB_WRITE_THREAT_MODEL.md',
  'GITHUB_WRITE_FAILURE_MODES.md',
  'GITHUB_WRITE_CONFIGURATION.md',
  'GITHUB_WRITE_SCENARIOS.md',
  'GITHUB_WRITE_AUDIT.md',
  'GITHUB_WRITE_COMPATIBILITY.md',
  'GITHUB_WRITE_RELEASE.md',
  'GITHUB_WRITE_APPROVAL_MODEL.md',
  'GITHUB_WRITE_TEST_MATRIX.md',
  'GITHUB_WRITE_SECURITY_REVIEW.md',
  'GITHUB_WRITE_RUNBOOK.md'
]) {
  const file=path.join(root,'docs',name);
  assert.ok(fs.existsSync(file), name+' missing');
  assert.ok(fs.readFileSync(file,'utf8').trim().length>100, name+' is unexpectedly short');
}
console.log('github-workspace-write-docs: ok');
