import assert from 'node:assert/strict';
import { loadPublicModule } from './public-module.mjs';
const { extractVariables, replaceVariables, LIMITS } = loadPublicModule('prompt-library.js');

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
