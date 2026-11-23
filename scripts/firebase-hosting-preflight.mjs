/**
 * Prepare a live Hosting release without guessing/replacing the existing
 * Firebase rewrite configuration. Only the owner-provided Hosting JSON is used.
 *
 * Never log credentials or the raw configuration. A missing configuration is a
 * deployment blocker, not a reason to invent rewrites for /api.
 */
import { existsSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

function checkId(value, label) {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9-]{2,62}$/.test(value)) {
    throw new Error(label + '_MISSING_OR_INVALID');
  }
  return value;
}

export function prepareHostingConfig(rawConfig, projectId, siteId) {
  checkId(projectId, 'FIREBASE_PROJECT_ID');
  checkId(siteId, 'FIREBASE_SITE_ID');
  if (typeof rawConfig !== 'string' || !rawConfig.trim()) {
    throw new Error('FIREBASE_HOSTING_CONFIG_MISSING');
  }
  let config;
  try { config = JSON.parse(rawConfig); }
  catch { throw new Error('FIREBASE_HOSTING_CONFIG_INVALID_JSON'); }
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('FIREBASE_HOSTING_CONFIG_NOT_OBJECT');
  }
  if (!config.hosting || Array.isArray(config.hosting) || typeof config.hosting !== 'object') {
    throw new Error('FIREBASE_HOSTING_CONFIG_SINGLE_SITE_REQUIRED');
  }
  const hosting = config.hosting;
  // The owner's existing public path can be anything, including a nested
  // build directory. Never delete or copy to that untrusted path. This CI
  // workflow builds Hafize into public/, so override ONLY the local source
  // directory used by Firebase CLI; all deployed API rewrites, headers and
  // site configuration remain identical.
  if (typeof hosting.public !== 'string' || !hosting.public.trim()) {
    throw new Error('FIREBASE_HOSTING_CONFIG_PUBLIC_DIRECTORY_MISSING');
  }
  if (hosting.target) {
    throw new Error('FIREBASE_HOSTING_CONFIG_TARGET_REQUIRES_UNTRACKED_FIREBASERC');
  }
  if (hosting.site && hosting.site !== siteId) {
    throw new Error('FIREBASE_HOSTING_CONFIG_SITE_MISMATCH');
  }
  // Constrain deployment to the exact verified Hosting site; keep existing
  // /api, auth, headers, CSP, redirects and SPA rewrites *unchanged*.
  return { ...config, hosting: { ...hosting, public: 'public', site: siteId } };
}

export function prepareRelease(config, projectId, siteId, commitSha, opts = {}) {
  const prepared = prepareHostingConfig(config, projectId, siteId);
  if (typeof commitSha !== 'string' || !/^[0-9a-f]{40}$/.test(commitSha)) {
    throw new Error('GITHUB_COMMIT_SHA_MISSING_OR_INVALID');
  }
  const exists = opts.exists ?? existsSync;
  const write = opts.write ?? writeFileSync;
  if (!exists('public/index.html') || !exists('public/typed-build/voice-mode.js')) {
    throw new Error('FIREBASE_HOSTING_BUILD_MISSING');
  }
  // Embed a verifiable release marker into the built public assets.
  write('public/release.json', JSON.stringify({ commit: commitSha }) + '\n');
  write('firebase.json', JSON.stringify(prepared, null, 2) + '\n', { mode: 0o600 });
  return prepared;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    prepareRelease(
      process.env.HAFIZE_FIREBASE_HOSTING_CONFIG,
      process.env.HAFIZE_FIREBASE_PROJECT_ID,
      process.env.HAFIZE_FIREBASE_SITE_ID,
      process.env.GITHUB_SHA
    );
    process.stdout.write('Firebase Hosting preflight passed; build and existing site config verified.\n');
  } catch (error) {
    process.stderr.write('::error::' + String(error?.message || 'DEPLOY_PREFLIGHT_FAILED') + '\n');
    process.exitCode = 1;
  }
}
