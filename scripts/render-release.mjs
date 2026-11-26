// Gated Hafize Render release, run by .github/workflows/hafize-render-release.yml.
// The deploy hook comes only from the HAFIZE_RENDER_DEPLOY_HOOK secret and is never printed.
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { hookForCommit, planRelease, qualityVerdict, RENDER_ORIGIN, validateDeployHook } from './render-release-plan.mjs';

const repo = process.env.GITHUB_REPOSITORY || 'umitalgan061-sudo/hafize';
const token = process.env.GH_TOKEN || '';
const hook = process.env.HAFIZE_RENDER_DEPLOY_HOOK || '';
const force = String(process.env.FORCE || '').toLowerCase() === 'true';
const summary = (line) => { if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, line + '\n'); console.log(line); };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function github(path) {
  const response = await fetch('https://api.github.com/repos/' + repo + path, {
    headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token, 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'hafize-render-release' },
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error('GITHUB_' + response.status);
  return response.json();
}

async function liveCommit(attempts = 4) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const url = new URL(RENDER_ORIGIN + '/release.json');
      url.searchParams.set('t', String(Date.now()));
      const response = await fetch(url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(90000) });
      if (response.ok) {
        const body = await response.json();
        if (typeof body?.commit === 'string' && /^[0-9a-f]{40}$/i.test(body.commit)) return body.commit.toLowerCase();
      }
    } catch { /* free instance waking up */ }
    if (attempt < attempts - 1) await sleep(15000);
  }
  return null;
}

function changedSince(live, head) {
  try {
    execFileSync('git', ['cat-file', '-e', live + '^{commit}'], { stdio: 'ignore' });
    return { known: true, paths: execFileSync('git', ['diff', '--name-only', live, head], { encoding: 'utf8' }).split('\n').filter(Boolean) };
  } catch {
    return { known: false, paths: [] };
  }
}

async function main() {
  if (!hook) {
    summary('::notice::HAFIZE_RENDER_DEPLOY_HOOK tanımlı değil; Render yüklemesi yapılmadı (bkz. docs/HAFIZE_RENDER_RELEASE.md).');
    return;
  }
  const check = validateDeployHook(hook);
  if (!check.ok) { console.error('::error::' + check.code + ': gizli bağlantı yalnız bu Render servisinin deploy hook adresi olmalı.'); process.exitCode = 1; return; }
  // The newest main commit and its quality verdict; a run still in progress
  // (or not started yet) is awaited for up to 25 minutes, following main if it moves.
  let head = '';
  let quality = 'missing';
  const qualityDeadline = Date.now() + 25 * 60 * 1000;
  for (;;) {
    head = String((await github('/commits/main')).sha || '').toLowerCase();
    const runs = (await github('/actions/runs?head_sha=' + head + '&event=push&per_page=50')).workflow_runs || [];
    quality = qualityVerdict(runs, head);
    if (quality === 'success' || quality === 'failure' || Date.now() > qualityDeadline) break;
    await sleep(60000);
  }
  const live = await liveCommit();
  const changed = live ? changedSince(live, head) : { known: false, paths: [] };
  const plan = planRelease({ head, live, quality, changedPaths: changed.paths, liveKnown: changed.known, force });
  summary(`Hafize Render: canlı ${live ? live.slice(0, 7) : 'bilinmiyor'}, main ${head.slice(0, 7)}, kalite ${quality}, karar ${plan.action} (${plan.reason}).`);
  if (plan.action === 'error') { process.exitCode = 1; return; }
  if (plan.action !== 'deploy') return;

  const response = await fetch(hookForCommit(hook, head), { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000) });
  if (response.status !== 200) {
    const why = response.status === 401 || response.status === 404 ? 'bağlantı anahtarı geçersiz ya da commit Render tarafından bulunamadı' : 'beklenmeyen yanıt';
    console.error(`::error::Render yüklemesi başlatılamadı: HTTP ${response.status} (${why}).`);
    process.exitCode = 1;
    return;
  }
  summary(`Render yüklemesi başlatıldı: ${head.slice(0, 7)}.`);
  const deadline = Date.now() + 30 * 60 * 1000;
  while (Date.now() < deadline) {
    await sleep(30000);
    if ((await liveCommit(1)) === head) {
      const live = await fetch(RENDER_ORIGIN + '/api/health/live', { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(60000) }).catch(() => null);
      if (live?.ok) { summary(`Doğrulandı: Hafize Render ${head} yayında ve /api/health/live yanıt veriyor.`); return; }
    }
  }
  console.error(`::error::Render 30 dk içinde ${head.slice(0, 7)} sürümünü yayınlamadı; Render panelindeki Deploys sayfasına bakın.`);
  process.exitCode = 1;
}

main().catch((error) => { console.error('::error::Render yayın akışı durdu: ' + (error?.message || 'bilinmeyen hata').replace(/https?:\/\/\S+/g, '<adres>')); process.exitCode = 1; });
