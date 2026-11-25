/**
 * Prepare a live Hosting release without guessing/replacing the existing
 * Firebase rewrite configuration. Only the owner-provided Hosting JSON is used.
 *
 * Never log credentials or the raw configuration. A missing configuration is a
 * deployment blocker, not a reason to invent rewrites for /api.
 */
import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { attachCloudRunRewrite, backendRouteActivated } from './hafize-cloud-run-route.mjs';

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

export function stampReleaseHtml(html,sha) {
  if(!/^[0-9a-f]{40}$/.test(sha))throw Error('GITHUB_COMMIT_SHA_MISSING_OR_INVALID');
  if(!html.includes('</head>')||!html.includes('/typed-build/app-install.js'))throw Error('FIREBASE_HOSTING_INDEX_INVALID');
  const versioned=html.replace(/(\b(?:src|href)=\")(\/[a-zA-Z0-9_./-]+\.(?:js|css)(?:\?[^\"]*)?)(\")/g,(_all,prefix,asset,suffix)=>{const url=new URL(asset,'https://release.invalid');if(url.pathname.endsWith('.js')&&!['/typed-build/app-install.js','/typed-build/release-update.js'].includes(url.pathname))return _all;url.searchParams.set('release',sha);return prefix+url.pathname+url.search.replaceAll('&','&amp;')+suffix;});
  return versioned.replace('</head>','<meta name="hafize-release" content="'+sha+'" />\n</head>');
}

export function withReleaseCacheHeaders(config){
  // Scope only public shell assets; no API or authentication rules are changed.
  const headers=Array.isArray(config.hosting.headers)?config.hosting.headers:[];
  const sources=['/','/index.html','/release.json','/typed-build/**','/sw.js'];
  return {...config,hosting:{...config.hosting,headers:[...headers,...sources.map(source=>({source,headers:[{key:'Cache-Control',value:'no-cache, max-age=0, must-revalidate'}]}))]}};
}

export const CANONICAL_HAFIZE_ORIGIN = 'https://hafize-free.onrender.com';
export function withCanonicalHafizeNavigation(config) {
  if(config.hosting?.site !== 'hafize-ua') throw Error('FIREBASE_HOSTING_CONFIG_SITE_MISMATCH');
  const existing = config.hosting.redirects ?? [];
  if(!Array.isArray(existing)) throw Error('FIREBASE_HOSTING_CONFIG_INVALID_REDIRECTS');
  // Only the browser entry routes change; keep existing API, assets, auth
  // and release metadata intact. Use 302 for reversible migration.
  return {...config,hosting:{...config.hosting,redirects:[
    ...['/','/index.html'].map(source=>({source,destination:CANONICAL_HAFIZE_ORIGIN+'/',type:302})),
    ...existing.filter(rule=>!['/','/index.html'].includes(rule?.source))
  ]}};
}

export function prepareRelease(config, projectId, siteId, commitSha, opts = {}) {
  const baseConfig = prepareHostingConfig(config, projectId, siteId);
  // A successfully verified Cloud Run deploy records its activation marker.
  // Before then all ordinary frontend releases preserve original API routes.
  const enabled = opts.activateCloudRun === true ||
    (opts.activateCloudRun !== false && backendRouteActivated(opts.readActivation));
  const prepared = enabled ? attachCloudRunRewrite(baseConfig) : baseConfig;
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
    const prepared=prepareRelease(
      process.env.HAFIZE_FIREBASE_HOSTING_CONFIG,
      process.env.HAFIZE_FIREBASE_PROJECT_ID,
      process.env.HAFIZE_FIREBASE_SITE_ID,
      process.env.GITHUB_SHA,
      { activateCloudRun: process.env.HAFIZE_CLOUD_RUN_ROUTE_ENABLED === 'true' ? true : undefined }
    );
    writeFileSync('firebase.json',JSON.stringify(withReleaseCacheHeaders(withCanonicalHafizeNavigation(prepared)),null,2)+'\n',{mode:0o600});
    const html=readFileSync('public/index.html','utf8');
    writeFileSync('public/index.html',stampReleaseHtml(html,process.env.GITHUB_SHA));
    process.stdout.write('Firebase Hosting preflight passed; build and existing site config verified.\n');
  } catch (error) {
    process.stderr.write('::error::' + String(error?.message || 'DEPLOY_PREFLIGHT_FAILED') + '\n');
    process.exitCode = 1;
  }
}
