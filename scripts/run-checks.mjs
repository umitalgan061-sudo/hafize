import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ROOT_URL = new URL('../', import.meta.url);
const ROOT = fileURLToPath(ROOT_URL);

// Bu dizin/uzantı listesi tek kaynaktır: yeni bir lib, public veya scripts
// dosyası eklendiğinde gate'e ayrıca kaydedilmesi gerekmez, otomatik bulunur.
const SYNTAX_SOURCES = [
  { dir: 'lib', extensions: ['.mjs'] },
  { dir: 'public', extensions: ['.js'] },
  { dir: 'scripts', extensions: ['.mjs'] }
];
const ROOT_SYNTAX_FILES = ['server.mjs'];
const TEST_PREFIX = 'test-';
const EXTRA_TEST_SCRIPTS = ['scripts/validate-agent-registry.mjs'];

async function listDirectory(dir, extensions) {
  let entries;
  try {
    entries = await readdir(new URL(`${dir}/`, ROOT_URL), { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isFile() && extensions.some((extension) => entry.name.endsWith(extension)))
    .map((entry) => `${dir}/${entry.name}`)
    .sort();
}

export async function collectSyntaxTargets() {
  const targets = [...ROOT_SYNTAX_FILES];
  for (const { dir, extensions } of SYNTAX_SOURCES) {
    targets.push(...(await listDirectory(dir, extensions)));
  }
  return targets;
}

export async function collectTestScripts() {
  const discovered = (await listDirectory('scripts', ['.mjs'])).filter((file) =>
    file.startsWith(`scripts/${TEST_PREFIX}`)
  );
  return [...EXTRA_TEST_SCRIPTS, ...discovered];
}

function runNode(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk;
    });
    child.stderr.on('data', (chunk) => {
      output += chunk;
    });
    child.on('error', (error) => resolve({ code: 1, output: `${output}${error.message}` }));
    child.on('close', (code) => resolve({ code: code ?? 1, output }));
  });
}

function lastLine(output) {
  const lines = output.split('\n').map((line) => line.trim()).filter(Boolean);
  return lines.length ? lines[lines.length - 1].slice(0, 160) : '';
}

async function main() {
  const failures = [];
  const syntaxTargets = await collectSyntaxTargets();
  const testScripts = await collectTestScripts();

  process.stdout.write(`Hafize check gate: ${syntaxTargets.length} syntax targets, ${testScripts.length} test scripts\n\n`);

  for (const target of syntaxTargets) {
    const { code, output } = await runNode(['--check', target]);
    if (code !== 0) failures.push({ label: `syntax ${target}`, output });
  }
  process.stdout.write(`syntax: ${syntaxTargets.length - failures.length}/${syntaxTargets.length} ok\n\n`);

  // Fail-fast yerine tüm testler çalıştırılır; tek bir eski assertion'ın geri
  // kalan onlarca kontrolü gizlemesi bu gate'te mümkün değildir.
  for (const script of testScripts) {
    const { code, output } = await runNode([script]);
    if (code === 0) {
      process.stdout.write(`  ok   ${script} — ${lastLine(output)}\n`);
    } else {
      process.stdout.write(`  FAIL ${script}\n`);
      failures.push({ label: script, output });
    }
  }

  if (failures.length) {
    process.stdout.write(`\n${failures.length} check(s) failed:\n`);
    for (const failure of failures) {
      process.stdout.write(`\n===== ${failure.label} =====\n${failure.output.trim()}\n`);
    }
    process.exitCode = 1;
    return;
  }

  process.stdout.write(`\nAll checks passed: ${syntaxTargets.length} syntax + ${testScripts.length} test scripts\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
