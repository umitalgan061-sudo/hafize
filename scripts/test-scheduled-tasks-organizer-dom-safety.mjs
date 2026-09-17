import assert from 'node:assert/strict';
import fs from 'node:fs';

const files = [
  'public/scheduled-tasks-organizer.js',
  'public/scheduled-tasks-actions.js',
  'public/scheduled-tasks-dashboard.js'
];

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(source, /innerHTML\s*=/, `${file} must not assign innerHTML`);
  assert.doesNotMatch(source, /outerHTML\s*=/, `${file} must not assign outerHTML`);
  assert.match(source, /textContent/, `${file} must render dynamic text safely`);
  assert.match(source, /createElement/, `${file} must use DOM construction`);
}

const index = fs.readFileSync('public/index.html', 'utf8');
assert.match(index, /scheduled-tasks-organizer\.js/);
assert.match(index, /scheduled-tasks-dashboard\.js/);
console.log('scheduled-task organizer DOM safety: ok');
