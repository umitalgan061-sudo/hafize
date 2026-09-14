import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../public/chat-markdown.js', import.meta.url), 'utf8');
assert.match(source, /function copyCode\(/);
assert.match(source, /navigator\?\.clipboard/);
assert.match(source, /writeText/);
assert.match(source, /closest\?\.\('\.md-code'\)/);
assert.match(source, /\.querySelector\?\.\('pre'\)/);
assert.match(source, /Kopyalandı/);
assert.match(source, /Kod bloğunu kopyala/);
assert.match(source, /catch\(\(\) => undefined\)/);
assert.doesNotMatch(source, /ClipboardItem/);
assert.doesNotMatch(source, /fetch\s*\(/);

const copyFlow = source.slice(source.indexOf('function copyCode'), source.indexOf('function install'));
assert.match(copyFlow, /Promise\.reject\(new Error\('EMPTY_CODE'\)\)/);
assert.match(copyFlow, /CLIPBOARD_UNAVAILABLE/);
assert.match(copyFlow, /button\.textContent = DEFAULT_LABELS\.copied/);

console.log('test-chat-markdown-copy: ok');
