import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../public/prompt-library-starters.js', import.meta.url), 'utf8');
assert.match(source, /STARTERS/);
assert.match(source, /Metin editörü/);
assert.match(source, /Kısa özet/);
assert.match(source, /Kod incelemesi/);
assert.match(source, /Araştırma çerçevesi/);
assert.match(source, /Fikirden gereksinime/);
assert.match(source, /HafizePromptLibraryStarters/);
assert.match(source, /force/);
assert.match(source, /existingTitles/);
console.log('test-prompt-library-starters: ok');
