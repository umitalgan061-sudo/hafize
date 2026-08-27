import { readdir, readFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// Gate her testi çalıştırır ama bir modülün testi hiç yazılmamışsa bunu göremez.
// Bu doğrulayıcı sözleşmesi: `lib/` altındaki her modüle en az bir test scriptinden
// referans verilmelidir. Bugün kapsam eksiksizdir; doğrulayıcı geriye düşmeyi engeller.
const ROOT = new URL('../', import.meta.url);
const COVERED_DIRECTORY = 'lib';
const TEST_FILE_PATTERN = /^test-.+\.mjs$/;

async function fileNames(directory) {
  const entries = await readdir(new URL(`${directory}/`, ROOT), { withFileTypes: true });
  return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
}

export function selectUncovered(modules, testSources) {
  return modules
    .filter((module) => !testSources.some((source) => source.includes(`${COVERED_DIRECTORY}/${module}`)))
    .sort();
}

export async function findUncoveredModules() {
  const modules = (await fileNames(COVERED_DIRECTORY)).filter((name) => name.endsWith('.mjs'));
  const testNames = (await fileNames('scripts')).filter((name) => TEST_FILE_PATTERN.test(name));
  const sources = await Promise.all(
    testNames.map((name) => readFile(new URL(`scripts/${name}`, ROOT), 'utf8'))
  );
  return selectUncovered(modules, sources);
}

const invokedDirectly = process.argv[1] && relative(fileURLToPath(import.meta.url), process.argv[1]) === '';
if (invokedDirectly) {
  const uncovered = await findUncoveredModules();
  if (uncovered.length) {
    console.error(`Check coverage BAŞARISIZ: ${uncovered.length} modül hiçbir testten referans almıyor:`);
    for (const module of uncovered) console.error(`  - ${COVERED_DIRECTORY}/${module}`);
    console.error('Modül için bir scripts/test-*.mjs doğrulaması ekleyin.');
    process.exitCode = 1;
  } else {
    console.log(`Check coverage OK: ${COVERED_DIRECTORY}/ altındaki tüm modüller en az bir testten referans alıyor`);
  }
}
