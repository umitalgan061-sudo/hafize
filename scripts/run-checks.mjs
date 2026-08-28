import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectSyntaxFiles, collectTestFiles, parseCheckArgs, selectTests } from '../lib/check-inventory.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function runNode(args, { quiet = false } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: ROOT,
      stdio: quiet ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'inherit', 'inherit']
    });
    let captured = '';
    if (quiet) {
      child.stdout.on('data', (chunk) => { captured += chunk; });
      child.stderr.on('data', (chunk) => { captured += chunk; });
    }
    child.on('error', (error) => resolve({ ok: false, output: String(error?.message ?? error) }));
    child.on('close', (code) => resolve({ ok: code === 0, output: captured }));
  });
}

const { filters } = parseCheckArgs(process.argv.slice(2));
const syntaxFiles = await collectSyntaxFiles(ROOT);
const testFiles = selectTests(await collectTestFiles(ROOT), filters);

if (syntaxFiles.length === 0) throw new Error('NO_SYNTAX_TARGETS');
if (testFiles.length === 0) throw new Error('NO_TEST_TARGETS');

const failures = [];

// 1) Syntax kapısı: her kaynak dosya derlenebilmeli.
for (const file of syntaxFiles) {
  const result = await runNode(['--check', file], { quiet: true });
  if (!result.ok) failures.push({ file, stage: 'syntax', output: result.output });
}
console.log(
  failures.length === 0
    ? `syntax OK: ${syntaxFiles.length} dosya`
    : `syntax FAIL: ${failures.length}/${syntaxFiles.length} dosya`
);

// 2) Ajan kayıt defteri sözleşmesi filtresiz turlarda doğrulanır.
if (filters.length === 0) {
  const registry = await runNode(['scripts/validate-agent-registry.mjs']);
  if (!registry.ok) failures.push({ file: 'scripts/validate-agent-registry.mjs', stage: 'registry', output: '' });
}

// 3) Test paketleri keşifle bulunur; yeni bir test dosyası kapıya elle eklenmez.
let passed = 0;
for (const file of testFiles) {
  const result = await runNode([file]);
  if (result.ok) passed += 1;
  else failures.push({ file, stage: 'test', output: '' });
}

console.log(`\ntest OK: ${passed}/${testFiles.length} paket`);

if (failures.length > 0) {
  console.error('\nBaşarısız kontroller:');
  for (const failure of failures) {
    console.error(`- [${failure.stage}] ${failure.file}`);
    if (failure.output) console.error(failure.output.trim());
  }
  process.exitCode = 1;
} else {
  console.log('Tüm kontroller geçti.');
}
