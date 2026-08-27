// Hafize test kapısı: statik syntax kontrolü + tüm test/validator script'lerinin çalıştırılması.
//
// Kapı, dosya listesini elle tutulan bir komut zinciri yerine dosya sisteminden
// keşfeder; böylece yeni eklenen bir test otomatik olarak kapıya dahil olur ve
// "yazıldı ama hiç çalıştırılmadı" durumu oluşmaz. Zincirden farklı olarak ilk
// hatada durulmaz; tüm başarısızlıklar tek turda raporlanır.
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEST_TIMEOUT_MS = 120_000;

// Kapı dışında bırakılan script'ler yalnız açık gerekçeyle burada listelenir.
const SKIPPED = new Map();

function listFiles(directory, extension) {
  return readdirSync(path.join(ROOT, directory))
    .filter((name) => name.endsWith(extension))
    .sort()
    .map((name) => `${directory}/${name}`);
}

function syntaxTargets() {
  return [
    'server.mjs',
    ...listFiles('lib', '.mjs'),
    ...listFiles('public', '.js'),
    ...listFiles('scripts', '.mjs')
  ];
}

function runnableScripts() {
  const scripts = listFiles('scripts', '.mjs').filter((file) => {
    const name = path.basename(file);
    if (name === 'run-tests.mjs') return false;
    return name.startsWith('test-') || name.startsWith('validate-');
  });
  return scripts.filter((file) => !SKIPPED.has(path.basename(file)));
}

function run(args, label) {
  const started = process.hrtime.bigint();
  const result = spawnSync(process.execPath, args, {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: TEST_TIMEOUT_MS
  });
  const ms = Number((process.hrtime.bigint() - started) / 1_000_000n);
  const ok = result.status === 0;
  if (!ok) {
    const detail = result.error
      ? String(result.error.message)
      : `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
    return { ok, label, ms, detail: detail || `exit=${result.status}` };
  }
  return { ok, label, ms };
}

function main(argv) {
  const failures = [];
  // Argüman verilirse yalnız adı bu parçalardan birini içeren dosyalar çalışır;
  // argümansız çağrı tüm kapıyı yürütür.
  const filters = argv.filter((value) => value && !value.startsWith('-'));
  const matches = (file) => !filters.length || filters.some((value) => file.includes(value));

  const targets = syntaxTargets().filter(matches);
  for (const file of targets) {
    const result = run(['--check', path.join(ROOT, file)], file);
    if (!result.ok) failures.push(result);
  }
  console.log(`syntax OK: ${targets.length} dosya`);

  const scripts = runnableScripts().filter(matches);
  for (const file of scripts) {
    const result = run([path.join(ROOT, file)], file);
    if (result.ok) {
      console.log(`PASS ${file} (${result.ms} ms)`);
    } else {
      console.log(`FAIL ${file} (${result.ms} ms)`);
      failures.push(result);
    }
  }

  for (const [name, reason] of SKIPPED) console.log(`SKIP scripts/${name}: ${reason}`);

  if (failures.length) {
    console.error(`\n${failures.length} kontrol başarısız:`);
    for (const failure of failures) {
      console.error(`\n--- ${failure.label} ---\n${failure.detail}`);
    }
    return 1;
  }

  console.log(`\nHafize kapısı OK: ${targets.length} syntax kontrolü, ${scripts.length} test/validator script'i geçti.`);
  return 0;
}

export { ROOT, SKIPPED, syntaxTargets, runnableScripts };

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  process.exit(main(process.argv.slice(2)));
}
