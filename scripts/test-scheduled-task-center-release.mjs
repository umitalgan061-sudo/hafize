import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertLegacyModulesBundled } from './legacy-bundle-contract.mjs';
import { assertShellCacheAtLeast } from './shell-cache-contract.mjs';

const paths = [
  'public/index.html',
  'public/sw-policy.ts',
  'README.md',
  'public/typed/legacy/scheduled-task-preview.ts',
  'public/typed/legacy/scheduled-task-duplicate.ts',
  'public/typed/legacy/scheduled-task-templates.ts',
  'public/typed/legacy/scheduled-task-templates-backup.ts',
  'public/typed/legacy/scheduled-task-draft.ts',
  'public/typed/legacy/scheduled-task-planning.ts',
  'public/typed/legacy/scheduled-task-status-summary.ts',
  'public/typed/legacy/scheduled-task-preview-activity.ts',
  'public/typed/legacy/scheduled-task-insights.ts',
  'public/typed/legacy/scheduled-task-actions.ts',
  'public/typed/legacy/scheduled-task-detail.ts',
  'public/typed/legacy/scheduled-task-export.ts'
];
const files = await Promise.all(paths.map((path) => readFile(new URL('../' + path, import.meta.url), 'utf8')));
const [index, sw, readme, ...modules] = files;

assertShellCacheAtLeast(45, 'scheduled task center');
assert.ok(readme.includes('Görevler'));
assert.ok(modules.some((source) => source.includes('requestSubmit')));
assert.ok(modules.some((source) => source.includes('localStorage')));
for (const source of modules) {
  assert.doesNotMatch(source, /NVIDIA_API_KEY/);
  assert.doesNotMatch(source, /Authorization:\s*Bearer/);
}
assertLegacyModulesBundled(['scheduled-task-preview']);
console.log('scheduled-task-center-release: ok');
