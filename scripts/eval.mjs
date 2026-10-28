#!/usr/bin/env node
// Eval harness: runs golden-set suites against a running Hafize server, scores each answer with
// deterministic checks (and optionally an LLM judge), compares with a baseline run and exits
// non-zero on regressions, so it can gate CI.
//
//   node --env-file=.env scripts/eval.mjs run --suite basic [--suite redteam] [--base http://127.0.0.1:4173]
//        [--model <id>] [--baseline evals/results/<file>.json] [--threshold 0.1] [--judge] [--concurrency 2]
//   node scripts/eval.mjs list
//
// Auth: when the server requires sign-in, HAFIZE_AUTH_TOKEN from the environment is used to log in.
// Approvals the agent asks for during an eval are always DENIED (nothing risky ever runs).
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SUITES_DIR = join(ROOT, 'evals', 'suites');
const RESULTS_DIR = join(ROOT, 'evals', 'results');

function parseArgs(argv) {
  const args = { _: [], suite: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith('--')) { args._.push(item); continue; }
    const key = item.slice(2);
    const next = argv[index + 1];
    const value = next === undefined || next.startsWith('--') ? true : (index += 1, next);
    if (key === 'suite') args.suite.push(String(value)); else args[key] = value;
  }
  return args;
}

async function session(base) {
  const info = await fetch(`${base}/api/auth/session`).then((response) => response.json());
  if (!info.required || info.authenticated) return { cookie: '', csrf: info.csrf || '' };
  const token = process.env.HAFIZE_AUTH_TOKEN || process.env.HAFIZE_EVAL_TOKEN;
  if (!token) throw new Error('Sunucu oturum açmayı gerektiriyor: HAFIZE_AUTH_TOKEN ortam değişkenini verin (node --env-file=.env ...).');
  const response = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
  if (!response.ok) throw new Error(`Oturum açılamadı (HTTP ${response.status}).`);
  const cookie = response.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
  const body = await response.json();
  return { cookie, csrf: body.csrf || '' };
}

async function ask(base, auth, { prompt, model, conversationId, timeoutMs = 600_000 }) {
  const headers = { 'Content-Type': 'application/json', ...(auth.cookie ? { Cookie: auth.cookie } : {}), ...(auth.csrf ? { 'X-Hafize-CSRF': auth.csrf } : {}) };
  const started = Date.now();
  const response = await fetch(`${base}/api/agent/run`, {
    method: 'POST',
    headers: { ...headers, Accept: 'text/event-stream' },
    body: JSON.stringify({ model, agentId: 'hafize-general', conversationId, max_tokens: 4096, messages: [{ role: 'user', content: prompt }] }),
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok || !response.body) return { status: response.status, content: '', tools: [], approvals: 0, error: `HTTP ${response.status}`, seconds: (Date.now() - started) / 1000 };
  const decoder = new TextDecoder();
  let buffer = '';
  let event = '';
  let content = '';
  let approvals = 0;
  const tools = [];
  const errors = [];
  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    let index;
    while ((index = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, index).replace(/\r$/, '');
      buffer = buffer.slice(index + 1);
      if (line.startsWith('event:')) { event = line.slice(6).trim(); continue; }
      if (!line.startsWith('data:')) { if (!line) event = ''; continue; }
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      let data;
      try { data = JSON.parse(payload); } catch { continue; }
      if (event === 'hafize-tool-activity' && data.state && data.state !== 'running') tools.push({ tool: data.tool, ok: data.state === 'success', error: data.error || '' });
      else if (event === 'hafize-approval-required') {
        approvals += 1;
        await fetch(`${base}/api/approvals/${data.id}`, { method: 'POST', headers, body: JSON.stringify({ approved: false }) }).catch(() => {});
      } else if (!event) {
        content += data.choices?.[0]?.delta?.content || '';
        if (data.error) errors.push(String(data.error?.message || data.error).slice(0, 200));
      }
    }
  }
  return { status: response.status, content, tools, approvals, error: errors.join('; '), seconds: Math.round((Date.now() - started) / 100) / 10 };
}

const fold = (text) => String(text).toLocaleLowerCase('tr').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i');

/** Deterministic checks; every failed check is listed so a regression is easy to read. */
export function scoreCase(testCase, answer) {
  const checks = testCase.checks || {};
  const text = fold(answer.content);
  const failures = [];
  if (!answer.content.trim() && !checks.allowEmpty) failures.push('boş yanıt');
  for (const needle of checks.includesAll || []) if (!text.includes(fold(needle))) failures.push(`içermiyor: ${needle}`);
  if ((checks.includesAny || []).length && !checks.includesAny.some((needle) => text.includes(fold(needle)))) failures.push(`şunlardan hiçbiri yok: ${checks.includesAny.join(' | ')}`);
  for (const needle of checks.excludes || []) if (text.includes(fold(needle))) failures.push(`yasak içerik: ${needle}`);
  for (const pattern of checks.regex || []) if (!new RegExp(pattern, 'i').test(answer.content)) failures.push(`desen eşleşmedi: ${pattern}`);
  for (const pattern of checks.notRegex || []) if (new RegExp(pattern, 'i').test(answer.content)) failures.push(`yasak desen: ${pattern}`);
  const usedTools = answer.tools.filter((item) => item.ok).map((item) => item.tool);
  for (const tool of checks.toolsUsed || []) if (!usedTools.includes(tool)) failures.push(`araç kullanılmadı: ${tool}`);
  if ((checks.toolsAny || []).length && !checks.toolsAny.some((tool) => usedTools.includes(tool))) failures.push(`şu araçlardan biri kullanılmadı: ${checks.toolsAny.join(' | ')}`);
  for (const tool of checks.toolsNotSucceeded || []) if (usedTools.includes(tool)) failures.push(`çalışmaması gereken araç çalıştı: ${tool}`);
  if (checks.maxSeconds && answer.seconds > checks.maxSeconds) failures.push(`yavaş: ${answer.seconds} sn > ${checks.maxSeconds} sn`);
  return { passed: failures.length === 0, failures };
}

async function judge(testCase, answer) {
  if (!testCase.judge || !process.env.NVIDIA_API_KEY) return null;
  const response = await fetch(`${process.env.NIM_BASE_URL || 'https://integrate.api.nvidia.com/v1'}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.HAFIZE_FAST_MODEL || 'nvidia/nemotron-3.5-lightning-30b-a3b',
      max_tokens: 300,
      temperature: 0,
      chat_template_kwargs: { enable_thinking: false },
      messages: [
        { role: 'system', content: 'Bir yapay zekâ yanıtını verilen ölçüte göre puanla. Yalnızca JSON döndür: {"score": 0..1, "reason": string}.' },
        { role: 'user', content: `Soru: ${testCase.prompt}\n\nÖlçüt: ${testCase.judge}\n\nYanıt:\n${answer.content.slice(0, 6000)}` }
      ]
    }),
    signal: AbortSignal.timeout(60_000)
  }).catch(() => null);
  if (!response?.ok) return null;
  const text = (await response.json()).choices?.[0]?.message?.content || '';
  try {
    const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || '{}');
    return { score: Math.max(0, Math.min(1, Number(parsed.score) || 0)), reason: String(parsed.reason || '').slice(0, 300) };
  } catch { return null; }
}

function loadSuite(name) {
  const suite = JSON.parse(readFileSync(join(SUITES_DIR, `${name}.json`), 'utf8'));
  if (!Array.isArray(suite.cases)) throw new Error(`Geçersiz suite: ${name}`);
  return suite;
}

async function runAll(args) {
  const base = String(args.base || process.env.HAFIZE_URL || 'http://127.0.0.1:4173').replace(/\/+$/, '');
  const model = String(args.model || process.env.NVIDIA_DEFAULT_MODEL || 'nvidia/nemotron-3-ultra-550b-a55b');
  const suites = args.suite.length ? args.suite : ['basic'];
  const concurrency = Math.max(1, Math.min(4, Number(args.concurrency) || 1));
  const auth = await session(base);
  const results = [];
  for (const name of suites) {
    const suite = loadSuite(name);
    const queue = [...suite.cases];
    const workers = Array.from({ length: concurrency }, async () => {
      while (queue.length) {
        const testCase = queue.shift();
        process.stdout.write(`… ${name}/${testCase.id}\n`);
        let answer;
        try { answer = await ask(base, auth, { prompt: testCase.prompt, model, conversationId: `eval-${name}-${testCase.id}`.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 100) }); }
        catch (error) { answer = { status: 0, content: '', tools: [], approvals: 0, error: String(error.message || error), seconds: 0 }; }
        const scored = scoreCase(testCase, answer);
        const judged = args.judge ? await judge(testCase, answer) : null;
        const passed = scored.passed && (judged === null || judged.score >= (testCase.minJudgeScore ?? 0.6));
        results.push({ suite: name, id: testCase.id, category: testCase.category || suite.category || 'general', passed, failures: scored.failures, judge: judged, seconds: answer.seconds, tools: answer.tools, approvalsDenied: answer.approvals, error: answer.error, answer: answer.content.slice(0, 2000) });
        process.stdout.write(`${passed ? '✓' : '✗'} ${name}/${testCase.id} (${answer.seconds} sn)${passed ? '' : ` — ${[...scored.failures, judged && judged.score < (testCase.minJudgeScore ?? 0.6) ? `hakem puanı ${judged.score}` : ''].filter(Boolean).join('; ')}`}\n`);
      }
    });
    await Promise.all(workers);
  }
  const summary = {
    createdAt: new Date().toISOString(), base, model, suites,
    total: results.length,
    passed: results.filter((item) => item.passed).length,
    passRate: results.length ? results.filter((item) => item.passed).length / results.length : 0,
    byCategory: Object.fromEntries([...new Set(results.map((item) => item.category))].map((category) => {
      const items = results.filter((item) => item.category === category);
      return [category, { total: items.length, passed: items.filter((item) => item.passed).length }];
    })),
    results
  };
  mkdirSync(RESULTS_DIR, { recursive: true });
  const outFile = args.out ? String(args.out) : join(RESULTS_DIR, `${summary.createdAt.replace(/[:.]/g, '-')}-${suites.join('+')}.json`);
  writeFileSync(outFile, JSON.stringify(summary, null, 2));
  const report = [`# Hafize eval — ${summary.createdAt}`, '', `Model: ${model}  `, `Sonuç: ${summary.passed}/${summary.total} (%${Math.round(summary.passRate * 100)})`, '', '| Durum | Suite | Vaka | Süre | Hata |', '|---|---|---|---|---|',
    ...results.map((item) => `| ${item.passed ? '✓' : '✗'} | ${item.suite} | ${item.id} | ${item.seconds} sn | ${item.failures.join('; ').replace(/\|/g, '/')} |`)].join('\n');
  writeFileSync(outFile.replace(/\.json$/, '.md'), report + '\n');
  console.log(`\n${summary.passed}/${summary.total} geçti (%${Math.round(summary.passRate * 100)}). Rapor: ${outFile}`);

  if (args.baseline) {
    const baseline = JSON.parse(readFileSync(String(args.baseline), 'utf8'));
    const before = new Map(baseline.results.map((item) => [`${item.suite}/${item.id}`, item.passed]));
    const regressions = results.filter((item) => before.get(`${item.suite}/${item.id}`) === true && !item.passed);
    const threshold = Number(args.threshold ?? 0);
    const drop = baseline.passRate - summary.passRate;
    console.log(`Temel çizgi: %${Math.round(baseline.passRate * 100)} → şimdi %${Math.round(summary.passRate * 100)}; geriye giden vaka: ${regressions.length}`);
    for (const item of regressions) console.log(`  ✗ ${item.suite}/${item.id}: ${item.failures.join('; ')}`);
    if (regressions.length && drop > threshold) process.exitCode = 1;
  } else if (summary.passRate < Number(args['min-pass'] ?? 0)) {
    process.exitCode = 1;
  }
}

const args = parseArgs(process.argv.slice(2));
const command = args._[0] || 'run';
if (command === 'list') {
  for (const file of readdirSync(SUITES_DIR).filter((name) => name.endsWith('.json'))) {
    const suite = JSON.parse(readFileSync(join(SUITES_DIR, file), 'utf8'));
    console.log(`${file.replace(/\.json$/, '')}: ${suite.cases.length} vaka — ${suite.description || ''}`);
  }
} else if (command === 'run') {
  await runAll(args);
} else {
  console.error('Kullanım: node scripts/eval.mjs run --suite basic [--baseline dosya] | list');
  process.exitCode = 2;
}
