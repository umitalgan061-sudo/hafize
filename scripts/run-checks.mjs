// Hafize kalite kapısı.
//
// package.json içindeki elle bakımı yapılan uzun `&&` zinciri yerine, syntax
// kontrolü ve test dosyaları diskten keşfedilir. Böylece yeni bir lib/test
// dosyası zinciri güncellemeyi unutan bir tur yüzünden sessizce kapının
// dışında kalamaz.

import { readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SYNTAX_DIRS = ['lib', 'scripts', 'public'];
const SYNTAX_EXTENSIONS = new Set(['.mjs', '.js']);
const SELF = 'run-checks.mjs';

// Canlı bir Redis sunucusu gerektiren testler yalnız açıkça istendiğinde çalışır.
const OPT_IN_TESTS = new Map([['test-redis-schedule-lease-live.mjs', 'HAFIZE_REDIS_LIVE_TEST']]);

function run(args, label) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('error', (error) => resolve({ label, ok: false, output: String(error?.message ?? error) }));
    child.on('close', (code) => resolve({ label, ok: code === 0, output }));
  });
}

async function listFiles(dir) {
  let entries;
  try {
    entries = await readdir(path.join(repoRoot, dir), { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isFile() && SYNTAX_EXTENSIONS.has(path.extname(entry.name)))
    .map((entry) => `${dir}/${entry.name}`)
    .sort();
}

async function collectSyntaxTargets() {
  const targets = ['server.mjs'];
  for (const dir of SYNTAX_DIRS) targets.push(...await listFiles(dir));
  return targets;
}

async function collectTestTargets() {
  const files = await listFiles('scripts');
  const selected = [];
  const skipped = [];
  for (const file of files) {
    const name = path.basename(file);
    if (name === SELF) continue;
    if (!name.startsWith('test-')) continue;
    const gate = OPT_IN_TESTS.get(name);
    if (gate && !process.env[gate]) {
      skipped.push(`${file} (${gate} ayarlı değil)`);
      continue;
    }
    selected.push(file);
  }
  return { selected, skipped };
}

function report(failures, { syntaxCount, testCount, skipped }) {
  console.log(`\nsyntax: ${syntaxCount} dosya · test: ${testCount} dosya · atlanan: ${skipped.length}`);
  for (const entry of skipped) console.log(`  atlandı: ${entry}`);
  if (!failures.length) {
    console.log('kalite kapısı: GEÇTİ');
    return 0;
  }
  console.log(`kalite kapısı: ${failures.length} başarısız`);
  for (const failure of failures) {
    console.log(`\n--- ${failure.label} ---`);
    console.log(failure.output.trimEnd());
  }
  return 1;
}

const syntaxTargets = await collectSyntaxTargets();
const { selected: testTargets, skipped } = await collectTestTargets();
const failures = [];

// Syntax kontrolleri yan etkisizdir; paralel çalıştırılır.
const syntaxResults = await Promise.all(
  syntaxTargets.map((file) => run(['--check', file], `node --check ${file}`))
);
for (const result of syntaxResults) if (!result.ok) failures.push(result);

if (failures.length) {
  process.exit(report(failures, { syntaxCount: syntaxTargets.length, testCount: 0, skipped }));
}

const registry = await run(['scripts/validate-agent-registry.mjs'], 'scripts/validate-agent-registry.mjs');
if (!registry.ok) failures.push(registry);

// Testler dosya/ortam durumu paylaşabildiği için sırayla çalıştırılır.
for (const file of testTargets) {
  const result = await run([file], file);
  if (result.ok) {
    console.log(`ok   ${file}`);
  } else {
    console.log(`FAIL ${file}`);
    failures.push(result);
  }
}

process.exit(report(failures, { syntaxCount: syntaxTargets.length, testCount: testTargets.length, skipped }));
