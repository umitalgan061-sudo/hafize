// Tip denetimi kapısı.
//
// Hafize'de derleme adımı yoktur: Node 22.18+ `.ts` dosyalarını yerel tip
// sıyırma ile doğrudan çalıştırır, TypeScript burada yalnızca denetleyicidir ve
// hiçbir çıktı üretmez. Tarayıcı, service worker ve sunucu kodu farklı
// global'lere sahip olduğu için üç ayrı proje denetlenir; tek bir yapılandırma
// üçünü de doğru denetleyemez.
//
// Kapı, `npm run check` içinden ve tek başına `npm run typecheck` ile çalışır.

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TSC = path.join(ROOT, 'node_modules', 'typescript', 'lib', 'tsc.js');
const TIMEOUT_MS = 180_000;
const MAX_OUTPUT_LINES = 60;

/** Denetlenen projeler; her biri kendi global kümesini tanımlar. */
export const PROJECTS = Object.freeze([
  { name: 'node', config: 'tsconfig.node.json', describe: 'sunucu runtime ve kontrol paketleri' },
  { name: 'browser', config: 'tsconfig.browser.json', describe: 'tarayıcı arayüzü' },
  { name: 'worker', config: 'tsconfig.worker.json', describe: 'service worker' }
]);

function runProject(config) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(process.execPath, [TSC, '-p', path.join(ROOT, config)], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let output = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, TIMEOUT_MS);
    const append = (chunk) => { output += chunk.toString('utf8'); };
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ ok: false, output: `${output}\n${error.message}`, durationMs: Date.now() - started });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        ok: !timedOut && code === 0,
        output: timedOut ? `${output}\nTIMEOUT: ${TIMEOUT_MS} ms` : output,
        durationMs: Date.now() - started
      });
    });
  });
}

/** Her projeyi denetler ve `{ ok, failures }` döndürür. */
export async function typecheck({ log = console.log } = {}) {
  if (!existsSync(TSC)) {
    log('typecheck: TypeScript kurulu değil. Önce `npm install` çalıştır.');
    return { ok: false, failures: [{ name: 'typecheck', output: 'TYPESCRIPT_NOT_INSTALLED' }] };
  }

  log(`typecheck: ${PROJECTS.length} proje denetleniyor`);
  const failures = [];
  for (const project of PROJECTS) {
    const result = await runProject(project.config);
    const seconds = (result.durationMs / 1000).toFixed(1);
    log(`${result.ok ? 'ok  ' : 'FAIL'} typecheck:${project.name} — ${project.describe} (${seconds}s)`);
    if (!result.ok) failures.push({ name: `typecheck:${project.name}`, output: result.output });
  }
  return { ok: failures.length === 0, failures };
}

function tail(text) {
  const lines = String(text || '').trimEnd().split('\n');
  return lines.slice(-MAX_OUTPUT_LINES).join('\n');
}

// Doğrudan çalıştırıldığında kendi başına bir kapı gibi davranır.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { ok, failures } = await typecheck();
  if (!ok) {
    console.error(`\n${failures.length} tip denetimi başarısız:\n`);
    for (const failure of failures) {
      console.error(`--- ${failure.name} ---`);
      console.error(tail(failure.output));
      console.error('');
    }
    process.exit(1);
  }
  console.log('\nTip denetimi tamam: tüm projeler temiz');
}
