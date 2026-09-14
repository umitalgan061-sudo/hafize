import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../public/chat-markdown.js', import.meta.url), 'utf8');

assert.match(source, /\.message\.assistant \.content/);
assert.match(source, /querySelectorAll\('\.message\.assistant \.content'\)/);
assert.doesNotMatch(source, /\.message\.user \.content/);
assert.doesNotMatch(source, /\.message:not\(\.assistant\)/);
assert.match(source, /markdownSource/);
assert.match(source, /markdownRendered|replaceChildren/);

const installSection = source.slice(source.indexOf('function install'));
assert.match(installSection, /messages/);
assert.match(installSection, /assistant/);
assert.match(installSection, /content/);

console.log('test-chat-markdown-ownership: ok');
