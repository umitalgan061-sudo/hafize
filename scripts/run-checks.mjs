// Hafize doğrulama kapısı.
//
// Elle bakımı yapılan uzun `&&` zinciri yerine depodaki dosyaları keşfeder:
// yeni bir `lib/*.mjs`, `public/*.js` veya `scripts/test-*.mjs` eklendiğinde
// kapı otomatik olarak kapsar. Ayrıca ilk hatada durmaz; tüm başarısız
// süitleri toplu raporlar.
//
// Kullanım:
//   node scripts/run-checks.mjs             # sözdizimi + tüm test süitleri
//   node scripts/run-checks.mjs --syntax    # yalnızca sözdizimi kontrolü
//   node scripts/run-checks.mjs canva gmail # yalnızca eşleşen süitler
import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SUITE_TIMEOUT_MS = 120_000;

const argv = process.argv.slice(2);
const syntaxOnly = argv.includes('--syntax') || argv.includes('--syntax-only');
const filters = argv.filter((arg) => !arg.startsWith('--'));

async function listFiles(dir, predicate) {
  let entries;
  try {
    entries = await readdir(path.join(ROOT, dir), { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isFile() && predicate(entry.name))
    .map((entry) => `${dir}/${entry.name}`)
    .sort();
}

function run(args, { timeoutMs = SUITE_TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ ok: false, output: `${output}${error.message}` });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) resolve({ ok: false, output: `${output}\nTIMEOUT: ${timeoutMs} ms içinde bitmedi` });
      else resolve({ ok: code === 0, output });
    });
  });
}

const syntaxTargets = [
  'server.mjs',
  ...(await listFiles('lib', (name) => name.endsWith('.mjs'))),
  ...(await listFiles('scripts', (name) => name.endsWith('.mjs'))),
  ...(await listFiles('public', (name) => name.endsWith('.js')))
];

const suites = [
  'scripts/validate-agent-registry.mjs',
  ...(await listFiles('scripts', (name) => name.startsWith('test-') && name.endsWith('.mjs')))
].filter((file) => filters.length === 0 || filters.some((filter) => file.includes(filter)));

const failures = [];
const startedAt = Date.now();

process.stdout.write(`Sözdizimi kontrolü: ${syntaxTargets.length} dosya\n`);
for (const file of syntaxTargets) {
  const result = await run(['--check', file], { timeoutMs: 30_000 });
  if (!result.ok) {
    failures.push({ file, stage: 'syntax', output: result.output });
    process.stdout.write(`  ✗ ${file}\n`);
  }
}
if (!failures.length) process.stdout.write('  ✓ tüm dosyalar geçti\n');

if (!syntaxOnly) {
  process.stdout.write(`\nTest süitleri: ${suites.length}\n`);
  for (const file of suites) {
    const result = await run([file]);
    if (result.ok) {
      process.stdout.write(`  ✓ ${path.basename(file)}\n`);
    } else {
      failures.push({ file, stage: 'test', output: result.output });
      process.stdout.write(`  ✗ ${path.basename(file)}\n`);
    }
  }
}

const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
if (failures.length) {
  process.stdout.write(`\n${failures.length} başarısız kontrol (${seconds} sn):\n`);
  for (const failure of failures) {
    process.stdout.write(`\n=== ${failure.stage}: ${failure.file} ===\n${failure.output.trim()}\n`);
  }
  process.exit(1);
}

process.stdout.write(`\nTüm kontroller geçti: ${syntaxTargets.length} dosya, ${syntaxOnly ? 0 : suites.length} süit (${seconds} sn)\n`);
