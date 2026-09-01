import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

// Syntax denetimi yapılacak kaynak dizinleri. Yeni dosyalar otomatik kapsanır.
const SYNTAX_DIRECTORIES = [
  { directory: 'lib', extensions: ['.mjs'] },
  { directory: 'public', extensions: ['.js'] },
  { directory: 'scripts', extensions: ['.mjs'] }
];
const SYNTAX_ROOT_FILES = ['server.mjs'];

// Doğrulayıcı (test olmayan) adımlar.
const VALIDATORS = ['scripts/validate-agent-registry.mjs'];

// Varsayılan gate dışında bırakılan testler yalnızca burada, gerekçesiyle listelenir.
// Buraya eklenmemiş her `scripts/test-*.mjs` dosyası otomatik olarak gate'e girer.
export const EXCLUDED_TESTS = Object.freeze({
  'test-redis-schedule-lease-live.mjs': 'Canlı Redis sunucusu gerektirir; `npm run check:live` ile opt-in çalıştırılır.'
});

export async function discoverSyntaxTargets(root = ROOT) {
  const targets = [...SYNTAX_ROOT_FILES];
  for (const { directory, extensions } of SYNTAX_DIRECTORIES) {
    const entries = await readdir(join(root, directory), { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!extensions.some((extension) => entry.name.endsWith(extension))) continue;
      targets.push(`${directory}/${entry.name}`);
    }
  }
  return targets.sort();
}

export async function discoverTestFiles(root = ROOT) {
  const entries = await readdir(join(root, 'scripts'), { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.startsWith('test-') && entry.name.endsWith('.mjs'))
    .map((entry) => entry.name)
    .sort();
}

export async function planChecks({ root = ROOT, includeLive = false, filter = '' } = {}) {
  const testFiles = await discoverTestFiles(root);
  // Filtre virgülle ayrılmış birden fazla terim kabul eder; terimlerden biri eşleşirse adım seçilir.
  const terms = String(filter).split(',').map((term) => term.trim()).filter(Boolean);
  const matches = (name) => terms.length === 0 || terms.some((term) => name.includes(term));
  const scheduled = [];
  const skipped = [];
  for (const name of testFiles) {
    const reason = EXCLUDED_TESTS[name];
    if (reason && !includeLive) {
      if (matches(name)) skipped.push({ name, reason });
      continue;
    }
    if (matches(name)) scheduled.push(`scripts/${name}`);
  }
  return {
    syntax: (await discoverSyntaxTargets(root)).filter(matches),
    validators: VALIDATORS.filter(matches),
    tests: scheduled,
    skipped
  };
}

function run(args, { root }) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('error', (error) => resolve({ ok: false, output: `${output}${error.message}` }));
    child.on('close', (code) => resolve({ ok: code === 0, output }));
  });
}

async function runAll(steps, { root, concurrency }) {
  const failures = [];
  let index = 0;
  const workers = Array.from({ length: Math.min(concurrency, steps.length || 1) }, async () => {
    while (index < steps.length) {
      const step = steps[index++];
      const started = Date.now();
      const result = await run(step.args, { root });
      const duration = Date.now() - started;
      if (result.ok) {
        process.stdout.write(`  ok   ${step.label} (${duration}ms)\n`);
      } else {
        process.stdout.write(`  FAIL ${step.label} (${duration}ms)\n`);
        failures.push({ label: step.label, output: result.output.trimEnd() });
      }
    }
  });
  await Promise.all(workers);
  return failures;
}

function parseArguments(argv) {
  const options = { includeLive: false, filter: '', concurrency: 4, list: false };
  for (let i = 0; i < argv.length; i += 1) {
    const argument = argv[i];
    if (argument === '--include-live') options.includeLive = true;
    else if (argument === '--list') options.list = true;
    else if (argument === '--filter') options.filter = argv[++i] ?? '';
    else if (argument === '--concurrency') options.concurrency = Number.parseInt(argv[++i] ?? '', 10);
    else throw new Error(`UNKNOWN_ARGUMENT:${argument}`);
  }
  if (!Number.isInteger(options.concurrency) || options.concurrency < 1 || options.concurrency > 16) {
    throw new Error('INVALID_CONCURRENCY');
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const plan = await planChecks({ root: ROOT, includeLive: options.includeLive, filter: options.filter });

  if (options.list) {
    process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
    return;
  }

  const started = Date.now();
  process.stdout.write(`Syntax (${plan.syntax.length} dosya)\n`);
  const syntaxFailures = await runAll(
    plan.syntax.map((file) => ({ label: file, args: ['--check', file] })),
    { root: ROOT, concurrency: options.concurrency }
  );

  process.stdout.write(`\nDoğrulayıcılar (${plan.validators.length})\n`);
  const validatorFailures = await runAll(
    plan.validators.map((file) => ({ label: file, args: [file] })),
    { root: ROOT, concurrency: options.concurrency }
  );

  process.stdout.write(`\nTestler (${plan.tests.length})\n`);
  const testFailures = await runAll(
    plan.tests.map((file) => ({ label: file, args: [file] })),
    { root: ROOT, concurrency: options.concurrency }
  );

  const failures = [...syntaxFailures, ...validatorFailures, ...testFailures];
  for (const { name, reason } of plan.skipped) {
    process.stdout.write(`\n  skip ${name} — ${reason}\n`);
  }

  const total = plan.syntax.length + plan.validators.length + plan.tests.length;
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  if (failures.length) {
    process.stdout.write(`\n${failures.length}/${total} adım başarısız (${seconds}s):\n`);
    for (const failure of failures) {
      process.stdout.write(`\n=== ${failure.label} ===\n${failure.output}\n`);
    }
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`\nTüm kontroller geçti: ${total} adım (${seconds}s).\n`);
}

if (process.argv[1] && relative(process.argv[1], fileURLToPath(import.meta.url)) === '') {
  await main();
}
