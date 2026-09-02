import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverCheckPlan, runCheckPlan } from '../lib/check-runner.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const filters = [];
for (const argument of process.argv.slice(2)) {
  if (argument.startsWith('--filter=')) filters.push(...argument.slice('--filter='.length).split(','));
  else if (argument !== '--') filters.push(argument);
}

const plan = await discoverCheckPlan({ rootDir, filters });
if (!plan.syntaxChecks.length && !plan.tests.length) {
  console.error('Doğrulama kapısı hiçbir dosya bulamadı; filtreyi kontrol edin.');
  process.exit(1);
}

const started = Date.now();
const summary = await runCheckPlan(plan, { rootDir, log: (line) => console.log(line) });

console.log(
  `\n${summary.syntaxChecked} sözdizimi kontrolü, ${summary.testsRun} test — ` +
    `${summary.failures.length} başarısız (${Math.round((Date.now() - started) / 1000)} sn)`
);

if (!summary.ok) {
  for (const failure of summary.failures) {
    console.error(`\n----- ${failure.kind}: ${failure.file} -----\n${failure.output}`);
  }
  process.exit(1);
}
