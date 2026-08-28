// Hafize doğrulama kapısı.
//
// Kapı, elle bakımı yapılan dev bir npm script dizesi yerine dosya keşfi kullanır:
// `lib/*.mjs`, `scripts/*.mjs`, `public/*.js` ve `server.mjs` söz dizimi açısından
// kontrol edilir, ardından `scripts/test-*.mjs` altındaki tüm testler çalıştırılır.
// Böylece yeni bir modül veya test dosyası kapıya kaydedilmeyi unutulduğunda
// sessizce kapsam dışı kalmaz.
import { readdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const TIMEOUT_MS = 120_000;
const MAX_BUFFER = 8 * 1024 * 1024;
const MAX_DETAIL_LINES = 25;

// `test-*.mjs` deseniyle eşleşmeyen, ancak kapının parçası olan doğrulayıcılar.
const EXTRA_VALIDATORS = ['scripts/validate-agent-registry.mjs'];

async function listFiles(dir, matches) {
  const entries = await readdir(path.join(root, dir), { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && matches(entry.name))
    .map((entry) => `${dir}/${entry.name}`)
    .sort();
}

function describeFailure(error) {
  const output = `${error?.stdout ?? ''}${error?.stderr ?? ''}`.trimEnd();
  const detail = output || error?.message || 'bilinmeyen hata';
  const lines = detail.split('\n');
  if (lines.length <= MAX_DETAIL_LINES) return detail;
  return [`… (${lines.length - MAX_DETAIL_LINES} satır kırpıldı)`, ...lines.slice(-MAX_DETAIL_LINES)].join('\n');
}

async function runNode(args) {
  await run(process.execPath, args, { cwd: root, timeout: TIMEOUT_MS, maxBuffer: MAX_BUFFER });
}

async function main() {
  const syntaxTargets = [
    'server.mjs',
    ...(await listFiles('lib', (name) => name.endsWith('.mjs'))),
    ...(await listFiles('scripts', (name) => name.endsWith('.mjs'))),
    ...(await listFiles('public', (name) => name.endsWith('.js')))
  ];
  const testTargets = [
    ...EXTRA_VALIDATORS,
    ...(await listFiles('scripts', (name) => name.startsWith('test-') && name.endsWith('.mjs')))
  ];

  const failures = [];

  for (const file of syntaxTargets) {
    try {
      await runNode(['--check', file]);
    } catch (error) {
      failures.push({ stage: 'söz dizimi', file, detail: describeFailure(error) });
    }
  }
  const syntaxFailures = failures.length;
  console.log(`Söz dizimi: ${syntaxTargets.length} dosya kontrol edildi, ${syntaxFailures} hata`);

  let passedTests = 0;
  for (const file of testTargets) {
    try {
      await runNode([file]);
      passedTests += 1;
    } catch (error) {
      failures.push({ stage: 'test', file, detail: describeFailure(error) });
    }
  }
  console.log(
    `Testler: ${testTargets.length} script çalıştırıldı, ${passedTests} başarılı, ${testTargets.length - passedTests} başarısız`
  );

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`\n✗ [${failure.stage}] ${failure.file}\n${failure.detail}`);
    }
    console.error(`\nDoğrulama kapısı BAŞARISIZ: ${failures.length} sorun.`);
    process.exitCode = 1;
    return;
  }

  console.log('Doğrulama kapısı BAŞARILI: tüm kaynak dosyaları ve test scriptleri geçti.');
}

await main();
