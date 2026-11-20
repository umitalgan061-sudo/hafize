#!/usr/bin/env node
// Read-only setup check: verifies GitHub App auth and repository access.
// Does not print credentials, modify repositories, or create commits.
import { createGitHubAppAuth } from '../lib/github-app-auth.ts';

function required(name) {
  const value = (process.env[name] || '').trim();
  if (!value) throw new Error('Missing required setting: ' + name);
  return value;
}

async function main() {
  const appId = required('HAFIZE_GITHUB_APP_ID');
  const installationId = required('HAFIZE_GITHUB_APP_INSTALLATION_ID');
  const privateKeyPath = required('HAFIZE_GITHUB_APP_PRIVATE_KEY_PATH');
  const appSlug = process.env.HAFIZE_GITHUB_APP_SLUG || 'hafize-umitalgan';
  const repository = process.env.HAFIZE_GITHUB_VERIFY_REPO || 'umitalgan061-sudo/hafize';

  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error('Invalid verification repository name');
  }

  const auth = createGitHubAppAuth({
    appId,
    installationId,
    privateKeyPath,
    appSlug
  });

  const identity = await auth.botCommitIdentity();
  const response = await auth.authenticatedFetch(
    'https://api.github.com/repos/' + repository.split('/').map(encodeURIComponent).join('/'),
    { method: 'GET' }
  );

  if (!response.ok) {
    throw new Error('Repository access check failed (HTTP ' + response.status + ')');
  }

  const data = await response.json();
  if (data?.full_name?.toLowerCase() !== repository.toLowerCase()) {
    throw new Error('Unexpected repository returned by GitHub');
  }

  console.log('GitHub App authentication: OK');
  console.log('GitHub App bot:', identity.name);
  console.log('Repository access:', data.full_name);
  console.log('Installation token: verified (not shown)');
  console.log('No writes or changes were made.');
}

main().catch((error) => {
  // Avoid printing potentially sensitive upstream error bodies or request headers.
  const message = error && typeof error === 'object' && 'code' in error
    ? String(error.code)
    : error instanceof Error ? error.message : 'Verification failed';
  console.error('GitHub App check failed:', message);
  process.exitCode = 1;
});
