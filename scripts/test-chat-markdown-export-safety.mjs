import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const markdown = readFileSync(new URL('../public/chat-markdown.js', import.meta.url), 'utf8');

assert.match(app, /message\.content/);
assert.doesNotMatch(app, /markdownRendered.*content/);
assert.doesNotMatch(app, /querySelector\('\.md-/);
assert.match(markdown, /function parseMarkdown/);
assert.match(markdown, /function renderMarkdown/);
assert.doesNotMatch(markdown, /localStorage/);
assert.doesNotMatch(markdown, /JSON\.stringify\(.*message/);

const renderSection = markdown.slice(markdown.indexOf('function renderMarkdown'), markdown.indexOf('function copyCode'));
assert.match(renderSection, /parseMarkdown\(value\)/);
assert.match(renderSection, /replaceChildren/);
assert.doesNotMatch(renderSection, /localStorage|sessionStorage|document\.cookie/);

console.log('test-chat-markdown-export-safety: ok');
