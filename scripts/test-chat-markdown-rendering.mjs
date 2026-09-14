import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { renderMarkdown } from '../public/chat-markdown.js';

const dom = new JSDOM('<!doctype html><div id="root"></div>');
const root = dom.window.document.querySelector('#root');
renderMarkdown(root, '# Başlık\n\n- biri\n- [x] tamam\n\n```js\nalert(1)\n```');
assert.equal(root.querySelector('h3')?.textContent, 'Başlık');
assert.equal(root.querySelectorAll('ul > li').length, 2);
assert.equal(root.querySelector('.md-task-marker')?.textContent, '✓');
assert.equal(root.querySelector('.md-code code')?.textContent, 'alert(1)');
assert.equal(root.querySelector('.md-code-copy')?.textContent, 'Kopyala');
assert.equal(root.querySelector('.md-code-copy')?.getAttribute('aria-label'), 'Kod bloğunu kopyala');
assert.equal(root.querySelectorAll('script').length, 0);
assert.equal(root.querySelectorAll('img').length, 0);

const linkRoot = dom.window.document.createElement('div');
renderMarkdown(linkRoot, '[ok](https://example.com) [bad](javascript:alert(1))');
assert.equal(linkRoot.querySelectorAll('a').length, 1);
assert.equal(linkRoot.querySelector('a')?.getAttribute('rel'), 'noopener noreferrer nofollow');
assert.match(linkRoot.textContent, /bad/);

const tableRoot = dom.window.document.createElement('div');
renderMarkdown(tableRoot, '| A | B |\n| :--- | ---: |\n| x | 1 |');
assert.equal(tableRoot.querySelector('table')?.rows.length, 2);
assert.equal(tableRoot.querySelectorAll('tbody td').length, 2);
assert.equal(tableRoot.querySelectorAll('th')[1]?.style.textAlign, 'right');

console.log('test-chat-markdown-rendering: ok');
