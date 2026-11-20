#!/usr/bin/env node
/**
 * Hafize local backend GitHub App setup (opt-in).
 *
 * Default: validates files/config and prints a safe plan, NO filesystem writes.
 * --apply: updates only this checkout's ignored .env. Never uploads secrets.
 */
import { readFileSync, writeFileSync, existsSync, lstatSync, realpathSync, statSync } from 'node:fs';
import { resolve, join, sep, isAbsolute } from 'node:path';
import { planLocalGitHubAppEnv } from '../lib/github-app-local-config.mjs';

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function isWithin(candidate, root) {
  const file = process.platform === 'win32' ? candidate.toLowerCase() : candidate;
  const dir = process.platform === 'win32' ? root.toLowerCase() : root;
  return file === dir || file.startsWith(dir + sep);
}

function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--apply') || args.length > 1) fail('INVALID_ARGUMENT');
  const apply = args.includes('--apply');
  const root = resolve(process.cwd());
  const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  if (packageJson?.name !== 'hafize-ai') fail('NOT_HAFIZE_REPOSITORY');

  const ignoreText = readFileSync(join(root, '.gitignore'), 'utf8');
  if (!/^\s*\.env\s*$/m.test(ignoreText)) fail('ENV_NOT_GITIGNORED');

  const fromEnv = String(process.env.HAFIZE_GITHUB_APP_PRIVATE_KEY_PATH || '').trim();
  const localAppData = String(process.env.LOCALAPPDATA || '').trim();
  const fallback = localAppData
    ? join(localAppData, 'Hafize', 'secrets', 'hafize-github-app.pem')
    : '';
  const privateKeyPath = fromEnv || fallback;

  if (!isAbsolute(privateKeyPath) || !existsSync(privateKeyPath) ||
      !statSync(privateKeyPath).isFile()) fail('GITHUB_APP_PRIVATE_KEY_MISSING');

  // Cannot accidentally configure a key that lives in the repo or public/
  const keyRealPath = realpathSync(privateKeyPath);
  if (isWithin(keyRealPath, realpathSync(root))) fail('GITHUB_APP_PRIVATE_KEY_IN_REPOSITORY');

  const file = join(root, '.env');
  if (existsSync(file) && (!lstatSync(file).isFile() || lstatSync(file).isSymbolicLink())) {
    fail('GITHUB_APP_UNSAFE_ENV_FILE');
  }
  const previous = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const plan = planLocalGitHubAppEnv(previous, privateKeyPath);
  console.log('Hafize local GitHub App setup:', apply ? 'APPLY' : 'DRY RUN');
  console.log('Repository:', plan.repository);
  console.log('Private key: found outside repository (contents not shown)');
  console.log('Environment file:', plan.mode === 'create' ? 'will create ignored .env' : 'will preserve unrelated settings');

  if (!apply) {
    console.log('No changes made. Run again with --apply to enable local GitHub App integration.');
    return;
  }

  // This is strictly local opt-in; no GitHub calls, PRs or deployments.
  writeFileSync(file, plan.content, { encoding: 'utf8', mode: 0o600, flag: 'w' });
  console.log('Local backend configuration saved. No credentials printed or uploaded.');
  console.log('Verify: node --use-system-ca --use-env-proxy --env-file=.env scripts/check-github-app.mjs');
  console.log('Restart the local Hafize server to load the new environment.');
}

try {
  main();
} catch (err) {
  // Do not print paths or error objects (they can expose local settings).
  const code = typeof err?.code === 'string' && /^[A-Z0-9_]{3,70}$/.test(err.code)
    ? err.code : 'GITHUB_APP_LOCAL_SETUP_FAILED';
  console.error('GitHub App local setup failed:', code);
  process.exitCode = 1;
}
