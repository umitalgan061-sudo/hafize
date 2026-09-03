// Hafize doğrulama kapısı.
//
// package.json içindeki tek satırlık dev komut yerine, kontrol edilecek dosyaları
// ve test scriptlerini diskten keşfeder. Böylece yeni bir lib dosyası veya yeni bir
// scripts/test-*.mjs eklendiğinde kapıya elle eklenmeyi unutmak mümkün olmaz.
import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Kapıda çalıştırılmayan testler ve gerekçeleri. Yalnızca dış bir servis
// gerektiren testler buraya girebilir; her giriş test-run-checks.mjs tarafından
// "dosya gerçekten var mı" diye doğrulanır.
export const EXCLUDED_TESTS = new Map([
  ['test-redis-schedule-lease-live.mjs', 'canlı Redis sunucusu gerektirir (REDIS_URL)']
]);

// Testlerden önce çalışan, test olmayan doğrulayıcılar.
export const EXTRA_VALIDATORS = ['validate-agent-registry.mjs'];

async function listFiles(directory, predicate) {
  const entries = await readdir(path.join(ROOT, directory), { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && predicate(entry.name))
    .map((entry) => `${directory}/${entry.name}`)
    .sort();
}

export async function collectSyntaxTargets() {
  const [libFiles, publicFiles, scriptFiles] = await Promise.all([
    listFiles('lib', (name) => name.endsWith('.mjs')),
    listFiles('public', (name) => name.endsWith('.js')),
    listFiles('scripts', (name) => name.endsWith('.mjs'))
  ]);
  return ['server.mjs', ...libFiles, ...publicFiles, ...scriptFiles];
}

export async function collectTestScripts() {
  const files = await listFiles('scripts', (name) => name.startsWith('test-') && name.endsWith('.mjs'));
  return files.filter((file) => !EXCLUDED_TESTS.has(path.basename(file)));
}

function run(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('error', (error) => resolve({ ok: false, output: `${output}${error.message}` }));
    child.on('close', (code) => resolve({ ok: code === 0, output }));
  });
}

async function runPool(items, limit, worker) {
  const failures = [];
  let index = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const item = items[index++];
      const failure = await worker(item);
      if (failure) failures.push(failure);
    }
  });
  await Promise.all(runners);
  return failures;
}

function report(failures) {
  if (!failures.length) return true;
  console.error(`\n${failures.length} kontrol başarısız:`);
  for (const failure of failures) {
    console.error(`\n--- ${failure.name} ---`);
    console.error(failure.output.trim().split('\n').slice(-25).join('\n'));
  }
  return false;
}

export async function main(argv = []) {
  const syntaxOnly = argv.includes('--syntax-only');
  const listOnly = argv.includes('--list');
  const syntaxTargets = await collectSyntaxTargets();
  const testScripts = await collectTestScripts();

  if (listOnly) {
    console.log(`syntax (${syntaxTargets.length}):\n  ${syntaxTargets.join('\n  ')}`);
    console.log(`test (${testScripts.length}):\n  ${testScripts.join('\n  ')}`);
    for (const [name, reason] of EXCLUDED_TESTS) console.log(`atlanan: ${name} — ${reason}`);
    return 0;
  }

  const syntaxFailures = await runPool(syntaxTargets, 8, async (target) => {
    const result = await run(['--check', target]);
    return result.ok ? null : { name: `syntax ${target}`, output: result.output };
  });
  if (!report(syntaxFailures)) return 1;
  console.log(`syntax OK (${syntaxTargets.length} dosya)`);
  if (syntaxOnly) return 0;

  // Testler sırayla çalışır: bazıları geçici dosya ve sahte saat kullanır.
  const failures = [];
  for (const script of [...EXTRA_VALIDATORS.map((name) => `scripts/${name}`), ...testScripts]) {
    const result = await run([script]);
    if (result.ok) continue;
    failures.push({ name: script, output: result.output });
  }
  if (!report(failures)) {
    console.error(`\n${testScripts.length + EXTRA_VALIDATORS.length} scriptten ${failures.length} tanesi başarısız.`);
    return 1;
  }
  console.log(`test OK (${testScripts.length + EXTRA_VALIDATORS.length} script)`);
  for (const [name, reason] of EXCLUDED_TESTS) console.log(`atlandı: ${name} — ${reason}`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = await main(process.argv.slice(2));
}
