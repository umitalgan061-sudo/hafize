import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Keşif tabanlı doğrulama kapısı.
//
// package.json içindeki elle bakımı yapılan uzun `&&` zinciri sürüklendiği için
// diskteki test dosyalarının bir bölümü hiç çalıştırılmıyordu. Bu çalıştırıcı
// hedefleri dosya sisteminden keşfeder, ilk hatada durmaz ve tüm başarısızlıkları
// tek raporda toplar.

const ROOT = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const TIMEOUT_MS = 180_000;

const patternArg = process.argv.slice(2).find((arg) => arg.startsWith('--pattern='));
const patterns = patternArg
  ? patternArg.slice('--pattern='.length).split(',').map((part) => part.trim()).filter(Boolean)
  : [];

function selected(relativePath) {
  return patterns.length === 0 || patterns.some((pattern) => relativePath.includes(pattern));
}

async function listFiles(dir, accept) {
  let entries;
  try {
    entries = await readdir(path.join(ROOT, dir), { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isFile() && accept(entry.name))
    .map((entry) => `${dir}/${entry.name}`)
    .sort();
}

function run(args, label) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      child.kill('SIGKILL');
      resolve({ label, ok: false, output: `${output}\nTIMEOUT after ${TIMEOUT_MS}ms` });
    }, TIMEOUT_MS);

    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ label, ok: false, output: `${output}\n${error.message}` });
    });
    child.on('close', (code) => {
      if (settled) return;
      clearTimeout(timer);
      resolve({ label, ok: code === 0, output });
    });
  });
}

const syntaxTargets = [
  'server.mjs',
  ...(await listFiles('lib', (name) => name.endsWith('.mjs'))),
  ...(await listFiles('public', (name) => name.endsWith('.js'))),
  ...(await listFiles('scripts', (name) => name.endsWith('.mjs')))
].filter(selected);

const runnableTargets = (await listFiles(
  'scripts',
  (name) => (name.startsWith('test-') || name.startsWith('validate-')) && name.endsWith('.mjs')
)).filter(selected);

if (syntaxTargets.length === 0 && runnableTargets.length === 0) {
  console.error('No check targets discovered.');
  process.exit(1);
}

const failures = [];

console.log(`Syntax check: ${syntaxTargets.length} file(s)`);
for (const target of syntaxTargets) {
  const result = await run(['--check', target], target);
  if (!result.ok) {
    failures.push(result);
    console.log(`  FAIL  ${target}`);
  }
}

console.log(`Run: ${runnableTargets.length} script(s)`);
for (const target of runnableTargets) {
  const result = await run([target], target);
  if (result.ok) {
    console.log(`  ok    ${target}`);
  } else {
    failures.push(result);
    console.log(`  FAIL  ${target}`);
  }
}

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed:\n`);
  for (const failure of failures) {
    console.error(`----- ${failure.label} -----`);
    console.error(failure.output.trim());
    console.error('');
  }
  process.exit(1);
}

console.log(`\nAll checks passed: ${syntaxTargets.length} syntax target(s), ${runnableTargets.length} script(s).`);
