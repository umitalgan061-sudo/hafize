import assert from 'node:assert/strict';
import { extractVariables, replaceVariables } from '../public/prompt-library.js';

assert.deepEqual(extractVariables('{{one}} {{two}} {{one}}'), ['one', 'two']);
assert.deepEqual(extractVariables('{{ spaced_name }} {{dash-name}} {{bad.name}}'), ['spaced_name', 'dash-name']);
assert.equal(replaceVariables('A {{one}} B {{missing}}', { one: 'X' }), 'A X B ');
assert.equal(replaceVariables('{{one}}', { one: 'a'.repeat(2000) }).length <= 1000, true);
assert.equal(replaceVariables('plain text', null), 'plain text');
assert.equal(replaceVariables('{{one}}/{{two}}', { one: '<script>', two: '&' }), '<script>/&');
console.log('test-prompt-library-variables: ok');
