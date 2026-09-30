import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const docs = [
  'docs/PROMPT_SMART_FILL.md','docs/PROMPT_SMART_FILL_ACCEPTANCE.md','docs/PROMPT_SMART_FILL_ACCESSIBILITY.md',
  'docs/PROMPT_SMART_FILL_BROWSER_MATRIX.md','docs/PROMPT_SMART_FILL_CHANGELOG.md','docs/PROMPT_SMART_FILL_CHECKLIST.md',
  'docs/PROMPT_SMART_FILL_COMPATIBILITY.md','docs/PROMPT_SMART_FILL_DATA_MODEL.md','docs/PROMPT_SMART_FILL_DECISIONS.md',
  'docs/PROMPT_SMART_FILL_DEVELOPER.md','docs/PROMPT_SMART_FILL_EVENTS.md','docs/PROMPT_SMART_FILL_EXAMPLES.md',
  'docs/PROMPT_SMART_FILL_FAILURES.md','docs/PROMPT_SMART_FILL_FINAL_SIGNOFF.md','docs/PROMPT_SMART_FILL_LOCALIZATION.md',
  'docs/PROMPT_SMART_FILL_MIGRATION.md','docs/PROMPT_SMART_FILL_OBSERVABILITY.md','docs/PROMPT_SMART_FILL_OPERATIONS.md',
  'docs/PROMPT_SMART_FILL_PERFORMANCE.md','docs/PROMPT_SMART_FILL_PRIVACY.md','docs/PROMPT_SMART_FILL_QA.md',
  'docs/PROMPT_SMART_FILL_RELEASE.md','docs/PROMPT_SMART_FILL_REVIEW.md','docs/PROMPT_SMART_FILL_ROLLBACK.md',
  'docs/PROMPT_SMART_FILL_SECURITY.md','docs/PROMPT_SMART_FILL_SECURITY_REVIEW.md','docs/PROMPT_SMART_FILL_STATE_MACHINE.md',
  'docs/PROMPT_SMART_FILL_SUPPORT.md','docs/PROMPT_SMART_FILL_TEST_MATRIX.md','docs/PROMPT_SMART_FILL_THREAT_MODEL.md',
  'docs/PROMPT_SMART_FILL_USER_GUIDE.md'
];
for (const file of docs) {
  const text = fs.readFileSync(path.join(root,file),'utf8');
  assert.ok(text.startsWith('# '), `${file} heading`);
  assert.ok(text.length >= 200, `${file} content`);
}
const requiredTerms = ['güvenlik','rollback','PWA','keyboard','storage'];
const corpus = docs.map((file) => fs.readFileSync(path.join(root,file),'utf8').toLocaleLowerCase('tr-TR')).join('\n');
// The corpus is folded to lower case, so the terms are folded the same way
// instead of being compared against their original casing.
for (const term of requiredTerms) {
  assert.ok(corpus.includes(term.toLocaleLowerCase('tr-TR')), `missing term: ${term}`);
}
console.log('prompt smart-fill documentation regression: ok');
