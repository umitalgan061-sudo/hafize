// Pure decisions for the gated Hafize Render release (.github/workflows/hafize-render-release.yml).
// No network, no secrets in return values: unit-tested in render-release-plan.test.mjs.

export const RENDER_SERVICE = 'srv-dc1valbl550s73flt7rg';
export const RENDER_ORIGIN = 'https://hafize-free.onrender.com';
export const QUALITY_WORKFLOW = 'Hafize quality';
const SHA = /^[0-9a-f]{40}$/;

/** Same rule as lib/github-agent-release.ts: only this service's hook, only the key parameter. */
export function validateDeployHook(value) {
  let hook;
  try { hook = new URL(String(value || '')); } catch { return { ok: false, code: 'RENDER_DEPLOY_HOOK_NOT_CONFIGURED' }; }
  const keys = [...hook.searchParams.keys()];
  const valid = hook.origin === 'https://api.render.com' && hook.pathname === '/deploy/' + RENDER_SERVICE
    && !hook.username && !hook.password && !hook.hash && hook.searchParams.getAll('key').length === 1
    && Boolean(hook.searchParams.get('key')) && keys.every((key) => key === 'key');
  return valid ? { ok: true } : { ok: false, code: 'RENDER_DEPLOY_HOOK_INVALID' };
}

/** The hook URL that deploys exactly `sha` (Render's documented `ref` parameter). */
export function hookForCommit(value, sha) {
  if (!validateDeployHook(value).ok) throw new Error('RENDER_DEPLOY_HOOK_INVALID');
  if (!SHA.test(sha)) throw new Error('RELEASE_SHA_INVALID');
  const hook = new URL(value);
  hook.searchParams.set('ref', sha);
  return hook.href;
}

const NOT_RUNTIME = [
  /^docs\//, /\.md$/i, /^\.github\//, /(^|\/)[^/]+\.test\.(?:ts|mts|mjs|js)$/,
  /^scripts\/(?:test-|validate-)[^/]+\.mjs$/, /^tests?\//, /^\.vscode\//, /^LICENSE$/
];

/** Whether a changed path can change what the Render service runs or serves. */
export function isRuntimePath(path) {
  const clean = String(path || '').replaceAll('\\', '/').replace(/^\.\//, '');
  return Boolean(clean) && !NOT_RUNTIME.some((pattern) => pattern.test(clean));
}

/** The latest completed push run of the quality workflow for `sha`. */
export function qualityVerdict(runs, sha) {
  const mine = (runs || []).filter((run) => run && run.name === QUALITY_WORKFLOW && run.head_sha === sha && run.event === 'push');
  if (!mine.length) return 'missing';
  const latest = mine.sort((a, b) => (b.run_attempt || 1) - (a.run_attempt || 1) || Date.parse(b.created_at || 0) - Date.parse(a.created_at || 0))[0];
  if (latest.status !== 'completed') return 'pending';
  return latest.conclusion === 'success' ? 'success' : 'failure';
}

/**
 * Deploy only the newest main commit, only when its quality run passed, only when something the
 * service runs changed since the live commit (or force), never when it is already live.
 */
export function planRelease({ head, live, quality, changedPaths, liveKnown = true, force = false }) {
  if (!SHA.test(head || '')) return { action: 'error', reason: 'HEAD_UNKNOWN' };
  if (live === head) return { action: 'skip', reason: 'ALREADY_LIVE' };
  if (quality !== 'success') return { action: 'skip', reason: 'QUALITY_' + String(quality || 'missing').toUpperCase() };
  if (force) return { action: 'deploy', reason: 'FORCED' };
  if (!live || !liveKnown) return { action: 'deploy', reason: 'LIVE_UNKNOWN' };
  const runtime = (changedPaths || []).filter(isRuntimePath);
  if (!runtime.length) return { action: 'skip', reason: 'NO_RUNTIME_CHANGE' };
  return { action: 'deploy', reason: 'RUNTIME_CHANGED', runtimeFiles: runtime.length };
}
