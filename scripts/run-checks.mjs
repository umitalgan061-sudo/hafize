import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_URL = new URL('../', import.meta.url);
const ROOT_PATH = fileURLToPath(ROOT_URL);

// Kaynak dizinleri elle sayılmaz; her dizindeki tüm çalıştırılabilir kaynaklar
// otomatik keşfedilir. Böylece yeni bir modül veya test dosyası gate dışında kalamaz.
const SOURCE_DIRECTORIES = Object.freeze(['lib', 'public', 'scripts']);
const ROOT_SOURCE_FILES = Object.freeze(['server.mjs']);
const SOURCE_EXTENSIONS = Object.freeze(['.mjs', '.js']);
// `test-*` doğrulama testleri, `validate-*` ise sözleşme/registry doğrulayıcılarıdır;
// ikisi de gate'in çalıştırdığı zorunlu kontrollerdir.
const TEST_FILE_PATTERN = /^(?:test|validate)-.+\.mjs$/;

function isSourceFile(name) {
  return SOURCE_EXTENSIONS.some((extension) => name.endsWith(extension));
}

async function listFiles(directory, root = ROOT_URL) {
  let entries;
  try {
    entries = await readdir(new URL(`${directory}/`, root), { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => `${directory}/${entry.name}`);
}

export async function discoverSyntaxTargets(root = ROOT_URL) {
  const found = [...ROOT_SOURCE_FILES];
  for (const directory of SOURCE_DIRECTORIES) {
    found.push(...(await listFiles(directory, root)).filter((file) => isSourceFile(file)));
  }
  return found.sort();
}

export async function discoverTestScripts(root = ROOT_URL) {
  const files = await listFiles('scripts', root);
  return files.filter((file) => TEST_FILE_PATTERN.test(file.slice('scripts/'.length))).sort();
}

export function selectTargets(targets, filters = []) {
  if (!filters.length) return [...targets];
  return targets.filter((target) => filters.some((filter) => target.includes(filter)));
}

function runNode(args, { cwd = ROOT_PATH, spawnImpl = spawn } = {}) {
  return new Promise((resolve) => {
    const child = spawnImpl(process.execPath, args, { cwd, stdio: 'inherit' });
    child.on('error', () => resolve(1));
    child.on('close', (code) => resolve(typeof code === 'number' ? code : 1));
  });
}

export async function runChecks({
  filters = [],
  root = ROOT_URL,
  runner = runNode,
  log = console.log,
  logError = console.error
} = {}) {
  const syntaxTargets = selectTargets(await discoverSyntaxTargets(root), filters);
  const testScripts = selectTargets(await discoverTestScripts(root), filters);

  if (!syntaxTargets.length && !testScripts.length) {
    logError('run-checks: seçilen filtreyle eşleşen dosya yok.');
    return { ok: false, syntaxTargets, testScripts, failures: ['no-match'] };
  }

  const failures = [];
  log(`run-checks: ${syntaxTargets.length} dosya syntax kontrolü`);
  for (const target of syntaxTargets) {
    if ((await runner(['--check', target])) !== 0) failures.push(`syntax:${target}`);
  }

  log(`run-checks: ${testScripts.length} test çalıştırılıyor`);
  for (const script of testScripts) {
    if ((await runner([script])) !== 0) failures.push(`test:${script}`);
  }

  if (failures.length) {
    logError(`run-checks BAŞARISIZ (${failures.length}):`);
    for (const failure of failures) logError(`  - ${failure}`);
    return { ok: false, syntaxTargets, testScripts, failures };
  }

  log(`run-checks OK: ${syntaxTargets.length} dosya kontrol edildi, ${testScripts.length} test geçti`);
  return { ok: true, syntaxTargets, testScripts, failures };
}

const invokedDirectly = process.argv[1] && relative(fileURLToPath(import.meta.url), process.argv[1]) === '';
if (invokedDirectly) {
  const filters = process.argv.slice(2).filter((value) => typeof value === 'string' && value.trim());
  const result = await runChecks({ filters });
  if (!result.ok) process.exitCode = 1;
}
