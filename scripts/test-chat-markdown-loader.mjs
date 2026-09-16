// Loading contract: the Markdown renderer is part of the application shell.
//
// It used to be injected at runtime by an unrelated Prompt Library
// enhancement, which meant the feature depended on that module loading first
// and on sessionStorage surviving. The shell now loads it directly, so this
// suite guards the single, static load path.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('public/index.html', 'utf8');
const swPolicy = fs.readFileSync('public/sw-policy.js', 'utf8');
const enhancements = fs.readFileSync('public/prompt-library-revisions-enhancements.js', 'utf8');

assert.match(html, /<link rel="stylesheet" href="\/chat-markdown\.css" \/>/);
assert.match(html, /<script src="\/markdown-renderer\.js" defer><\/script>/);
assert.match(html, /<script src="\/chat-markdown\.js" defer><\/script>/);

for (const asset of ['/chat-markdown.css', '/markdown-renderer.js', '/chat-markdown.js']) {
  assert.ok(swPolicy.includes(`'${asset}'`), `${asset} is part of the offline shell`);
}

// No module may inject the renderer a second time.
for (const asset of ['chat-markdown.css', 'markdown-renderer.js', 'chat-markdown.js']) {
  assert.doesNotMatch(enhancements, new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${asset} is no longer injected at runtime`);
}
assert.doesNotMatch(enhancements, /createElement\(['"]script['"]/);

console.log('chat markdown loader contract: ok');
