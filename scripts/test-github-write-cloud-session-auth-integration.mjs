import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const authPath = fileURLToPath(new URL('../lib/privileged-principal-auth.mjs', import.meta.url));
const runtimePath = fileURLToPath(new URL('../lib/github-write-server-runtime.mjs', import.meta.url));
const httpPath = fileURLToPath(new URL('../lib/github-write-http-api.mjs', import.meta.url));
const approvalPath = fileURLToPath(new URL('../lib/github-write-approval.mjs', import.meta.url));
const contractPath = fileURLToPath(new URL('../lib/github-write-contract.mjs', import.meta.url));
const docPath = fileURLToPath(new URL('../docs/GITHUB_WRITE_CLOUD_SESSION_AUTH.md', import.meta.url));

const [authSource, runtimeSource, httpSource, approvalSource, contractSource, doc] = await Promise.all([
  readFile(authPath, 'utf8'),
  readFile(runtimePath, 'utf8'),
  readFile(httpPath, 'utf8'),
  readFile(approvalPath, 'utf8'),
  readFile(contractPath, 'utf8'),
  readFile(docPath, 'utf8')
]);

for (const path of [authPath, runtimePath, httpPath, approvalPath, contractPath]) {
  const syntax = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout || `${path} syntax check failed`);
}

assert.match(runtimeSource, /createPrivilegedPrincipalAuthenticator/);
assert.match(runtimeSource, /tokenEnv:\s*'HAFIZE_GITHUB_WRITE_AUTH_TOKEN'/);
assert.match(runtimeSource, /subjectEnv:\s*'HAFIZE_GITHUB_WRITE_AUTH_SUBJECT'/);
assert.match(runtimeSource, /allowCloudSession:\s*true/);
assert.match(runtimeSource, /cloudSessionAuthenticator/);
assert.doesNotMatch(runtimeSource, /createBearerPrincipalAuthenticator/);

assert.match(authSource, /createBearerPrincipalAuthenticator/);
assert.match(authSource, /createRevocableCloudSessionAuth/);
assert.doesNotMatch(authSource, /import \{ createCloudSessionAuth \} from/);
assert.match(authSource, /if \(bearer\)/);
assert.match(authSource, /if \(cloud\)/);
assert.match(authSource, /requestOrigin\(headers\) !== cloud\.origin/);
assert.match(authSource, /AUTH_REQUIRED/);
assert.match(authSource, /HAFIZE_CLOUD_SESSION_ORIGIN/);
assert.match(authSource, /HAFIZE_CLOUD_SESSION_TTL_MS/);

assert.match(httpSource, /\/api\/github\/write\/prepare/);
assert.match(httpSource, /\/api\/github\/write\/execute/);
assert.match(httpSource, /exactBody\(body, \['command'\]\)/);
assert.match(httpSource, /exactBody\(body, \['command', 'approvalToken'\]\)/);
assert.match(httpSource, /approvalBoundary\.prepare/);
assert.match(httpSource, /executionBoundary\.execute/);

assert.match(approvalSource, /commandDigest/);
assert.match(approvalSource, /GITHUB_WRITE_APPROVAL_EXPIRED/);
assert.match(approvalSource, /GITHUB_WRITE_APPROVAL_MISMATCH/);
assert.match(approvalSource, /GITHUB_WRITE_APPROVAL_REPLAYED/);
assert.match(approvalSource, /ownerResolver/);
assert.match(contractSource, /HAFIZE_BRANCH_PREFIX = 'hafize\/'/);
assert.match(contractSource, /GITHUB_WORKFLOW_WRITE_BLOCKED/);
assert.match(contractSource, /SENSITIVE_GITHUB_WRITE_PATH_BLOCKED/);
assert.match(contractSource, /GITHUB_WRITE_PR_MUST_BE_DRAFT/);

for (const forbidden of [
  /process\.env\.GITHUB_TOKEN[^\n]*return/,
  /approvalSecret[^\n]*sendJson/,
  /ownerKey[^\n]*sendJson/,
  /passwordHash[^\n]*sendJson/,
  /signingKey[^\n]*sendJson/,
  /document\.cookie/,
  /localStorage/,
  /sessionStorage/,
  /shell\s*=\s*true/,
  /\bexec\s*\(/,
  /\bspawn\s*\(/
]) {
  assert.equal(forbidden.test(authSource), false, `auth source must not expose forbidden surface: ${forbidden}`);
}

assert.match(doc, /bearer.*birincil/i);
assert.match(doc, /cloud-session.*fallback/i);
assert.match(doc, /approval.*değişmez/i);
assert.match(doc, /replay/i);
assert.match(doc, /secret/i);
assert.match(doc, /AUTH_REQUIRED/);

console.log('GitHub write cloud-session auth integration tests passed');
