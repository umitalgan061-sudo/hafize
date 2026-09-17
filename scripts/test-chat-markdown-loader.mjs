// Loading contract: the markdown renderer, the chat layer and their stylesheet
// are ordinary shell assets declared once in index.html. They used to be
// injected at runtime by an unrelated Prompt Library module, which kept them
// out of the offline shell cache and gave the same assets two loading paths.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PUBLIC_DIR, assertShellAssets } from './shell-cache-contract.mjs';

const MARKDOWN_ASSETS = ['/chat-markdown.css', '/markdown-renderer.js', '/chat-markdown.js'];
const html = fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8');

for (const asset of MARKDOWN_ASSETS) {
  assert.ok(fs.existsSync(path.join(PUBLIC_DIR, asset.slice(1))), `${asset} exists on disk`);
  const references = html.split(`"${asset}"`).length - 1;
  assert.equal(references, 1, `${asset} is declared exactly once in the shell`);
}

// Cached with the rest of the shell, so an offline reload still renders answers.
assertShellAssets(MARKDOWN_ASSETS, 'markdown asset');

// No module may add a second loading path for them at runtime.
for (const entry of fs.readdirSync(PUBLIC_DIR)) {
  if (!entry.endsWith('.js') || entry === 'sw.js' || entry === 'sw-policy.js') continue;
  const source = fs.readFileSync(path.join(PUBLIC_DIR, entry), 'utf8');
  for (const asset of MARKDOWN_ASSETS) {
    assert.ok(
      !source.includes(`'${asset}'`) && !source.includes(`"${asset}"`),
      `${entry} must not inject ${asset}; index.html already loads it`
    );
  }
}

console.log('chat markdown loader contract: ok');
