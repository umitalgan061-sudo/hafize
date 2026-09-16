import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-fill.js', 'utf8');
const presets = fs.readFileSync('public/prompt-library-fill-presets.js', 'utf8');

const lifecycleContracts = [
  'let booted = false',
  'if (booted || !documentRef()',
  'DOMContentLoaded',
  'MutationObserver',
  'observer?.observe',
  'listeners.push',
  'beforeunload',
  'closeDialog',
  'dialog.addEventListener(\'cancel\'',
  'dialog.showModal?.()',
  'dialog.remove()'
];
for (const contract of lifecycleContracts) assert.ok(source.includes(contract), `missing ${contract}`);
assert.ok(source.indexOf('booted = true') < source.indexOf('observer?.observe'));
assert.ok(source.indexOf('closeDialog') < source.indexOf('panel.addEventListener'));
assert.ok(source.includes('listeners.splice(0)'));
assert.ok(presets.includes('dialog.addEventListener(\'close\''));
assert.ok(presets.includes('observer.disconnect()'));
assert.ok(presets.includes('MutationObserver'));
assert.ok(presets.includes('state.activeDialog = null'));
assert.doesNotMatch(source, /setInterval\s*\(/);
assert.doesNotMatch(presets, /setInterval\s*\(/);
console.log('smart fill lifecycle contracts: ok');
