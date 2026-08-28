// Hafize doğrulama kapısı.
//
// Daha önce bu kapı `package.json` içinde elle bakımı yapılan tek satırlık dev
// bir `&&` zinciriydi. Zincir iki yönden bozuldu:
//   1. Yeni bir test dosyası eklendiğinde zincire eklenmeyi unutmak sessizce
//      kapsam kaybı yaratıyordu (85 test dosyasının 33'ü hiç çalışmıyordu,
//      aralarında tüm OAuth / PKCE / token şifreleme testleri vardı);
//   2. `&&` zinciri ilk hatada durduğu için tek turda yalnız bir hata
//      görülebiliyordu.
//
// Bu çalıştırıcı hedefleri diskten keşfeder, bu yüzden kapsam kod tabanıyla
// birlikte kendiliğinden büyür; ayrıca hataya rağmen devam eder ve turun
// sonunda tüm başarısızlıkları birlikte raporlar.

import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Sözdizimi kontrolü yapılacak kaynak dizinleri ve uzantıları.
const SYNTAX_DIRECTORIES = [
  { directory: 'lib', extensions: ['.mjs'] },
  { directory: 'scripts', extensions: ['.mjs'] },
  { directory: 'public', extensions: ['.js'] }
];
const SYNTAX_ROOT_FILES = ['server.mjs'];
const TEST_PREFIX = 'test-';
const VALIDATION_PREFIX = 'validate-';
const TEST_EXTENSION = '.mjs';

// Keşif dışı bırakılan her dosya burada gerekçesiyle birlikte durur. Liste
// bilinçli olarak boş tutulur; bir testin sessizce atlanması yerine gerekçesi
// görünür olsun diye bu yapı vardır.
export const EXCLUDED_TESTS = Object.freeze({});

async function listFiles(directory, extensions) {
  let entries;
  try {
    entries = await readdir(path.join(ROOT, directory), { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
  return entries
    .filter((entry) => entry.isFile() && extensions.includes(path.extname(entry.name)))
    .map((entry) => `${directory}/${entry.name}`)
    .sort();
}

export async function discoverSyntaxTargets() {
  const targets = [...SYNTAX_ROOT_FILES];
  for (const { directory, extensions } of SYNTAX_DIRECTORIES) {
    targets.push(...(await listFiles(directory, extensions)));
  }
  return targets;
}

export async function discoverTestTargets() {
  const files = await listFiles('scripts', [TEST_EXTENSION]);
  return files.filter((file) => {
    const name = path.basename(file);
    if (!name.startsWith(TEST_PREFIX) && !name.startsWith(VALIDATION_PREFIX)) return false;
    return !Object.hasOwn(EXCLUDED_TESTS, name);
  });
}

function run(args, { timeoutMs }) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      child.kill('SIGKILL');
      resolve({ ok: false, output: `${output}\nZAMAN AŞIMI: ${timeoutMs} ms` });
    }, timeoutMs);
    const capture = (chunk) => {
      // Çıktı sınırsız büyümesin; hata teşhisi için son bölüm yeterlidir.
      output = `${output}${chunk}`.slice(-20_000);
    };
    child.stdout.on('data', capture);
    child.stderr.on('data', capture);
    child.on('error', (error) => {
      clearTimeout(timer);
      if (!settled) resolve({ ok: false, output: `${output}\n${error.message}` });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (!settled) resolve({ ok: code === 0, output });
    });
  });
}

async function runAll(label, targets, toArgs, timeoutMs) {
  const failures = [];
  process.stdout.write(`\n== ${label} (${targets.length}) ==\n`);
  for (const target of targets) {
    const { ok, output } = await run(toArgs(target), { timeoutMs });
    if (ok) {
      process.stdout.write(`  ok    ${target}\n`);
    } else {
      process.stdout.write(`  HATA  ${target}\n`);
      failures.push({ target, output });
    }
  }
  return failures;
}

export async function main() {
  const syntaxTargets = await discoverSyntaxTargets();
  const testTargets = await discoverTestTargets();

  const failures = [
    ...(await runAll('Sözdizimi', syntaxTargets, (target) => ['--check', target], 30_000)),
    ...(await runAll('Testler', testTargets, (target) => [target], 120_000))
  ];

  process.stdout.write(
    `\n== Özet ==\n  sözdizimi hedefi: ${syntaxTargets.length}\n  test hedefi: ${testTargets.length}\n  başarısız: ${failures.length}\n`
  );

  if (failures.length === 0) {
    process.stdout.write('\nDoğrulama kapısı yeşil.\n');
    return 0;
  }

  for (const { target, output } of failures) {
    process.stdout.write(`\n--- ${target} ---\n${output.trim()}\n`);
  }
  process.stdout.write(`\nDoğrulama kapısı KIRMIZI: ${failures.map((f) => f.target).join(', ')}\n`);
  return 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
