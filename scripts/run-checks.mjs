import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Keşif tabanlı kapı: yeni bir modül veya test dosyası eklendiğinde kapıya
// elle kayıt gerekmez, dosya sistemi tek kaynaktır.
export const SYNTAX_ROOT_FILES = ['server.mjs'];
export const SYNTAX_DIRECTORIES = ['lib', 'public', 'scripts'];
export const SYNTAX_EXTENSIONS = ['.mjs', '.js'];
export const VALIDATOR_PREFIX = 'validate-';
export const TEST_PREFIX = 'test-';

// Kapı dışında bırakılan tek dosya yoktur; bir dosyanın hariç tutulması
// gerekirse buraya açık gerekçesiyle eklenir ve guard testi bunu doğrular.
export const EXCLUDED_TESTS = Object.freeze({});

const TEST_TIMEOUT_MS = 120_000;

function listFiles(directory) {
  let entries;
  try {
    entries = readdirSync(path.join(ROOT, directory));
  } catch {
    return [];
  }
  return entries
    .filter((name) => SYNTAX_EXTENSIONS.includes(path.extname(name)))
    .filter((name) => statSync(path.join(ROOT, directory, name)).isFile())
    .sort()
    .map((name) => `${directory}/${name}`);
}

export function collectSyntaxTargets() {
  const targets = [...SYNTAX_ROOT_FILES];
  for (const directory of SYNTAX_DIRECTORIES) targets.push(...listFiles(directory));
  return targets;
}

export function collectScriptTargets(prefix) {
  return listFiles('scripts').filter((file) => {
    const name = path.basename(file);
    return name.startsWith(prefix) && name.endsWith('.mjs');
  });
}

export function collectValidatorTargets() {
  return collectScriptTargets(VALIDATOR_PREFIX);
}

export function collectTestTargets() {
  return collectScriptTargets(TEST_PREFIX).filter((file) => !(path.basename(file) in EXCLUDED_TESTS));
}

export function collectPlan() {
  return {
    syntax: collectSyntaxTargets(),
    validators: collectValidatorTargets(),
    tests: collectTestTargets()
  };
}

function runNode(args, label) {
  const started = Date.now();
  const result = spawnSync(process.execPath, args, {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: TEST_TIMEOUT_MS
  });
  const durationMs = Date.now() - started;
  const timedOut = result.error?.code === 'ETIMEDOUT';
  const ok = !timedOut && !result.error && result.status === 0;
  return {
    label,
    ok,
    durationMs,
    timedOut,
    output: [result.stdout, result.stderr, result.error?.message].filter(Boolean).join('\n').trim()
  };
}

function report(failures) {
  if (!failures.length) return;
  console.error('\nBaşarısız kontroller:');
  for (const failure of failures) {
    console.error(`\n✖ ${failure.label}${failure.timedOut ? ' (zaman aşımı)' : ''}`);
    if (failure.output) console.error(failure.output);
  }
}

export function runCheckGate({ filter = '' } = {}) {
  const plan = collectPlan();
  const matches = (value) => !filter || value.includes(filter);
  const failures = [];

  const syntaxTargets = plan.syntax.filter(matches);
  for (const target of syntaxTargets) {
    const result = runNode(['--check', target], `syntax ${target}`);
    if (!result.ok) failures.push(result);
  }
  console.log(`syntax: ${syntaxTargets.length} dosya kontrol edildi`);

  const runnable = [...plan.validators, ...plan.tests].filter(matches);
  for (const target of runnable) {
    const result = runNode([target], target);
    if (result.ok) {
      console.log(`✓ ${target} (${result.durationMs} ms)`);
    } else {
      console.log(`✖ ${target} (${result.durationMs} ms)`);
      failures.push(result);
    }
  }

  report(failures);
  console.log(
    `\nÖzet: ${syntaxTargets.length} syntax, ${plan.validators.filter(matches).length} doğrulayıcı, ` +
      `${plan.tests.filter(matches).length} test — ${failures.length} başarısız`
  );
  return { failures, plan };
}

function parseArgs(argv) {
  const options = { filter: '', list: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--list') options.list = true;
    else if (arg === '--filter') options.filter = argv[index + 1] ?? '';
    else if (arg.startsWith('--filter=')) options.filter = arg.slice('--filter='.length);
    else throw new Error(`UNKNOWN_CHECK_ARGUMENT:${arg}`);
  }
  return options;
}

const invokedDirectly =
  typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  const options = parseArgs(process.argv.slice(2));
  if (options.list) {
    const plan = collectPlan();
    console.log(JSON.stringify(plan, null, 2));
  } else {
    const { failures } = runCheckGate(options);
    if (failures.length) process.exitCode = 1;
  }
}
