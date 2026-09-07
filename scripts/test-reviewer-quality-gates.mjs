import assert from 'node:assert/strict';
import {
  checkCredentialHygiene,
  checkEvidenceContract,
  checkUiFinishContract,
  evaluateQualityGates
} from '../lib/reviewer-quality-gates.mjs';

assert.deepEqual(checkCredentialHygiene([{ path: 'lib/a.mjs', content: 'const value = 1;' }]), []);
const secretFindings = checkCredentialHygiene([{ path: 'config.js', content: 'api_key = "sk-abcdefghijklmnopqrstuvwxyz"' }]);
assert.equal(secretFindings.length, 1);
assert.equal(secretFindings[0].severity, 'blocker');
assert.throws(() => checkCredentialHygiene([{ path: '.env', content: '' }]), /nothing/i);

const evidenceMissing = checkEvidenceContract({ claims: ['a'], evidence: [] });
assert.equal(evidenceMissing[0].code, 'MISSING_EVIDENCE');
const evidenceInvalid = checkEvidenceContract({ claims: ['a'], evidence: [{ source: '', note: '' }] });
assert.equal(evidenceInvalid[0].code, 'INVALID_EVIDENCE');
assert.deepEqual(checkEvidenceContract({ claims: [], evidence: [] }), []);

const uiFindings = checkUiFinishContract({ responsive: true, keyboard: true, focusVisible: false, contrast: true, emptyStates: true, loadingStates: true, errorStates: false });
assert.equal(uiFindings.length, 2);
assert.equal(uiFindings[0].code, 'UI_FOCUSVISIBLE');
assert.equal(uiFindings[1].code, 'UI_ERRORSTATES');

const pass = evaluateQualityGates({
  files: [{ path: 'lib/app.mjs', content: 'safe' }],
  result: { claims: ['a'], evidence: [{ source: 'test', note: 'verified' }] },
  ui: { responsive: true, keyboard: true, focusVisible: true, contrast: true, emptyStates: true, loadingStates: true, errorStates: true }
});
assert.equal(pass.pass, true);
assert.equal(pass.blockerCount, 0);

const fail = evaluateQualityGates({
  files: [{ path: 'private.pem', content: 'BEGIN PRIVATE KEY' }],
  result: { claims: ['a'], evidence: [] },
  ui: {}
});
assert.equal(fail.pass, false);
assert.ok(fail.blockerCount >= 2);
assert.ok(fail.findings.some((item) => item.code === 'CREDENTIAL_FILE'));
assert.ok(fail.findings.some((item) => item.code === 'MISSING_EVIDENCE'));

console.log('reviewer quality gate tests passed');
