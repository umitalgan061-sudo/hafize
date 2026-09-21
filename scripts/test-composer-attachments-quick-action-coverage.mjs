import assert from 'node:assert/strict';
import fs from 'node:fs';
const s=fs.readFileSync('public/composer-attachments.js','utf8');
assert.ok(s.includes("summary: 'Seçili dosya parçalarını"));
assert.ok(s.includes("review: 'Seçili kodu incele"));
assert.ok(s.includes("bugs: 'Seçili kodu incele"));
assert.ok(s.includes("requirements: 'Seçili dosya parçalarından"));
console.log('attachment quick action coverage: ok');