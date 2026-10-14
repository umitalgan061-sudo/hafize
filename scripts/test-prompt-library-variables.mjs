import assert from 'node:assert/strict';
// public/typed/prompt-library.ts keeps its UMD browser contract: loaded as an
// ES module it publishes the API on `globalThis` instead of `module.exports`,
// so the suite imports it for that side effect and reads the global.
import '../public/typed/prompt-library.ts';

const promptLibrary = globalThis.HafizePromptLibrary;
const { extractVariables, replaceVariables, LIMITS } = promptLibrary;

assert.deepEqual(extractVariables('{{konu}} {{dil}} {{konu}}'), ['konu', 'dil']);
assert.deepEqual(extractVariables('{{ spaced_name }} {{dash-name}} {{bad.name}}'), ['spaced_name', 'dash-name']);
assert.equal(replaceVariables('Merhaba {{konu}}', { konu: 'Ankara' }), 'Merhaba Ankara');
assert.equal(replaceVariables('{{one}}/{{missing}}', { one: 'x' }), 'x/');
assert.equal(replaceVariables('{{one}}', { one: 'a'.repeat(2000) }).length, LIMITS.maxVariableValue);
assert.equal(replaceVariables('plain', null), 'plain');
assert.equal(replaceVariables('{{one}}', { one: '<script>alert(1)</script>' }), '<script>alert(1)</script>');
const long = Array.from({ length: 30 }, (_, i) => `{{v${i}}}`).join(' ');
assert.equal(extractVariables(long).length, LIMITS.maxVariables);
console.log('test-prompt-library-variables: ok');
