import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(new URL('../', import.meta.url).pathname);
const read = (path) => readFile(resolve(root, path), 'utf8');
const exists = async (path) => { try { await access(resolve(root, path)); return true; } catch { return false; } };
const modules = [
  'prompt-library-smart-insert','prompt-library-smart-insert-center','prompt-library-smart-insert-history',
  'prompt-library-smart-insert-history-bridge','prompt-library-smart-insert-presets','prompt-library-smart-insert-suggestions',
  'prompt-library-smart-insert-validation','prompt-library-smart-insert-activity','prompt-library-smart-insert-shortcuts'
];
const app = await read('public/typed/legacy-app.ts');
for (const name of modules) {
  const path = 'public/typed/legacy/' + name + '.ts';
  assert(await exists(path), 'missing: ' + path);
  assert.equal(await exists('public/' + name + '.js'), false, 'legacy JS exists: ' + name);
  const source = await read(path);
  assert.match(source, /import type \{ HafizeLegacyRoot \}/);
  assert.match(source, /export function install/);
  assert.doesNotMatch(source, /eval\s*\(/);
  assert.doesNotMatch(source, /new Function\s*\(/);
  assert.doesNotMatch(source, /fetch\s*\(/);
  assert.doesNotMatch(source, /XMLHttpRequest/);
  assert.doesNotMatch(source, /WebSocket/);
  assert(app.includes('./legacy/' + name + '.ts'), 'legacy app wiring: ' + name);
}
assert(await exists('public/typed/legacy/prompt-library-smart-insert-contract.ts'));
const contract = await read('public/typed/legacy/prompt-library-smart-insert-contract.ts');
for (const token of ['SmartInsertPrompt','SmartInsertProfile','SmartInsertHistoryEntry','SmartInsertValidationResult','HafizeLegacyRoot']) assert(contract.includes(token), 'contract token: ' + token);
assert(app.includes('HAFIZE_LEGACY_BROWSER_MODULE_COUNT = 52'));
console.log('Smart Insert TypeScript contract: OK');
