import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

// Canlı dış servis gerektiren testler varsayılan kapıda çalışmaz; açık opt-in ister.
const LIVE_ONLY_TESTS = new Map([['test-redis-schedule-lease-live.mjs', 'HAFIZE_LIVE_REDIS']]);

async function sourceFiles() {
  const groups = await Promise.all(
    [
      ['lib', (name) => name.endsWith('.mjs')],
      ['scripts', (name) => name.endsWith('.mjs')],
      ['public', (name) => name.endsWith('.js')]
    ].map(async ([dir, keep]) => {
      const names = (await readdir(path.join(ROOT, dir))).filter(keep).sort();
      return names.map((name) => `${dir}/${name}`);
    })
  );
  return ['server.mjs', ...groups.flat()];
}

async function testFiles() {
  const names = (await readdir(path.join(ROOT, 'scripts')))
    .filter((name) => name.startsWith('test-') && name.endsWith('.mjs'))
    .sort();
  return names.filter((name) => {
    const gate = LIVE_ONLY_TESTS.get(name);
    if (!gate) return true;
    if (process.env[gate] === '1') return true;
    console.log(`skip  scripts/${name} (${gate}=1 ile çalıştırılır)`);
    return false;
  });
}

function run(args, label) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('error', (error) => resolve({ label, ok: false, output: String(error?.message || error) }));
    child.on('close', (code) => resolve({ label, ok: code === 0, output }));
  });
}

const failures = [];

for (const file of await sourceFiles()) {
  const result = await run(['--check', file], `syntax ${file}`);
  if (!result.ok) {
    failures.push(result);
    console.log(`FAIL  ${result.label}`);
  }
}
console.log(`syntax kontrolü tamamlandı (${failures.length} hata)`);

for (const file of ['scripts/validate-agent-registry.mjs', ...(await testFiles()).map((name) => `scripts/${name}`)]) {
  const result = await run([file], file);
  if (result.ok) {
    const summary = result.output.trim().split('\n').filter(Boolean).pop() || 'OK';
    console.log(`ok    ${file} — ${summary}`);
  } else {
    failures.push(result);
    console.log(`FAIL  ${file}`);
  }
}

if (failures.length) {
  console.error(`\n${failures.length} kontrol başarısız:`);
  for (const failure of failures) {
    console.error(`\n--- ${failure.label} ---\n${failure.output.trim()}`);
  }
  process.exit(1);
}

console.log('\nTüm kontroller geçti.');
