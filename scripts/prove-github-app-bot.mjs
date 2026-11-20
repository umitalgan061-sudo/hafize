#!/usr/bin/env node
// One-time, explicitly opted-in proof that Hafize can contribute as its own GitHub App.
// No writes without --confirm-create-draft-pr. No merge, force-push or deletion.
import { randomBytes } from 'node:crypto';
import { createGitHubAppAuth } from '../lib/github-app-auth.ts';

const CONFIRM = '--confirm-create-draft-pr';
const REPOSITORY = 'umitalgan061-sudo/hafize';
const FILE = 'docs/GITHUB_APP_BOT_PROOF.md';
const API = 'https://api.github.com';

function fail(code, status = 1) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  throw error;
}

function requiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) fail('MISSING_' + name);
  return value;
}

async function request(auth, method, endpoint, body) {
  const response = await auth.authenticatedFetch(API + endpoint, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'Hafize-GitHub-Bot-Proof'
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  if (!response.ok) fail('GITHUB_' + method + '_FAILED_HTTP_' + response.status);
  try {
    return await response.json();
  } catch {
    fail('GITHUB_INVALID_JSON_RESPONSE');
  }
}

function checkSha(sha) {
  if (typeof sha !== 'string' || !/^[a-f0-9]{40}$/i.test(sha)) {
    fail('GITHUB_INVALID_COMMIT_SHA');
  }
  return sha;
}

function checkIdentity(identity) {
  if (!identity || typeof identity.name !== 'string' ||
    !/^[a-z0-9-]+\[bot\]$/.test(identity.name) ||
    typeof identity.email !== 'string' ||
    !/^[1-9][0-9]*\+[a-z0-9-]+\[bot\]@users\.noreply\.github\.com$/.test(identity.email) ||
    !identity.email.endsWith('+' + identity.name + '@users.noreply.github.com')) {
    fail('GITHUB_BOT_IDENTITY_INVALID');
  }
  return identity;
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.some((x) => x !== CONFIRM) || argv.filter((x) => x === CONFIRM).length > 1) {
    fail('UNKNOWN_ARGUMENT');
  }
  const writesApproved = argv.includes(CONFIRM);

  const auth = createGitHubAppAuth({
    appId: requiredEnv('HAFIZE_GITHUB_APP_ID'),
    installationId: requiredEnv('HAFIZE_GITHUB_APP_INSTALLATION_ID'),
    privateKeyPath: requiredEnv('HAFIZE_GITHUB_APP_PRIVATE_KEY_PATH'),
    appSlug: String(process.env.HAFIZE_GITHUB_APP_SLUG || 'hafize-umitalgan')
  });

  const identity = checkIdentity(await auth.botCommitIdentity());
  const repoPath = '/repos/' + REPOSITORY;
  const repo = await request(auth, 'GET', repoPath);
  const base = repo?.default_branch;
  if (repo?.full_name !== REPOSITORY || typeof base !== 'string' ||
      !/^[A-Za-z0-9._/-]+$/.test(base) || base.includes('..')) {
    fail('GITHUB_REPOSITORY_RESPONSE_INVALID');
  }
  const baseCommit = await request(auth, 'GET', repoPath + '/commits/' + encodeURIComponent(base));
  const baseSha = checkSha(baseCommit?.sha);
  const branch = 'hafize/auto-github-bot-proof-' + randomBytes(6).toString('hex');

  console.log('GitHub App bot:', identity.name);
  console.log('Repository:', REPOSITORY);
  console.log('Base branch:', base);
  console.log('Target test branch:', branch);
  console.log('Write consent:', writesApproved ? 'EXPLICITLY APPROVED' : 'NOT GIVEN');
  if (!writesApproved) {
    console.log('DRY RUN ONLY. To create a bot commit and a draft PR, re-run with ' + CONFIRM);
    return;
  }

  // The only writes: create a NEW branch, add a single documentation file,
  // then open a DRAFT PR. Neither main nor any existing branch is updated.
  const created = await request(auth, 'POST', repoPath + '/git/refs', {
    ref: 'refs/heads/' + branch,
    sha: baseSha
  });
  if (created?.ref !== 'refs/heads/' + branch) fail('GITHUB_NEW_BRANCH_UNEXPECTED_RESPONSE');
  console.log('New branch: created');

  const content = [
    '# Hafize GitHub App bot contribution verification',
    '',
    'This pull request proves that the Hafize GitHub App can create a branch,',
    'author a commit, and open a draft pull request using an installation token.',
    '',
    '- GitHub App bot: ' + identity.name,
    '- Repository: ' + REPOSITORY,
    '- Default branch was not changed by this proof.',
    '- No private key or access token is stored in this file.',
    '',
    'This is a reviewable verification artifact, **not** a production deployment.',
    'Close this PR without merging if the verification file is not needed.',
    ''
  ].join('\n');

  const saved = await request(auth, 'PUT', repoPath + '/contents/' + FILE, {
    message: 'test(github): verify Hafize App bot-authored commit',
    content: Buffer.from(content, 'utf8').toString('base64'),
    branch,
    author: identity,
    committer: identity
  });
  const commitSha = checkSha(saved?.commit?.sha);
  console.log('Bot commit:', commitSha);

  // Verify GitHub has stored the requested author/committer attribution,
  // rather than merely assuming a successful HTTP response proves authorship.
  const commitInfo = await request(auth, 'GET', repoPath + '/commits/' + commitSha);
  const author = commitInfo?.commit?.author;
  const committer = commitInfo?.commit?.committer;
  if (author?.email !== identity.email || committer?.email !== identity.email) {
    fail('GITHUB_BOT_COMMIT_ATTRIBUTION_MISMATCH');
  }

  const createdPr = await request(auth, 'POST', repoPath + '/pulls', {
    title: 'test(github): Hafize GitHub App bot identity proof',
    body: [
      'Bot-authored integration smoke test.',
      '',
      '- Created using Hafize GitHub App installation credentials.',
      '- Commit author and committer email checked against the verified GitHub App bot.',
      '- Draft PR; no automatic merge, deployment, or default-branch changes.',
      '- The proof document can be discarded after review.'
    ].join('\n'),
    head: branch,
    base,
    draft: true
  });
  if (!Number.isInteger(createdPr?.number) || createdPr.number < 1 ||
      createdPr?.draft !== true ||
      typeof createdPr?.html_url !== 'string' ||
      !createdPr.html_url.startsWith('https://github.com/' + REPOSITORY + '/pull/')) {
    fail('GITHUB_DRAFT_PR_UNEXPECTED_RESPONSE');
  }

  console.log('Draft PR:', createdPr.html_url);
  console.log('Pull request created by:', createdPr?.user?.login || '(unavailable)');
  console.log('All write actions completed. Review the PR; do not merge solely to prove attribution.');
}

main().catch((error) => {
  // Never print request payloads, tokens, the private key, or upstream response bodies.
  const code = typeof error?.code === 'string' && /^[A-Za-z0-9_]+$/.test(error.code)
    ? error.code
    : 'GITHUB_BOT_PROOF_FAILED';
  console.error('GitHub bot proof failed:', code);
  if (error?.cause?.code && /^[A-Z0-9_]{2,60}$/.test(error.cause.code)) {
    console.error('Network cause:', error.cause.code);
  }
  process.exitCode = 1;
});
