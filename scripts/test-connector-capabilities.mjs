import assert from 'node:assert/strict';
import { CONNECTOR_CAPABILITY_NAMES, createConnectorCapabilityMatrix, enforceCapabilityImplication } from '../lib/connector-capabilities.mjs';

const matrix = createConnectorCapabilityMatrix({ githubRead: true, gmailRead: true, canvaRead: false, calendarRead: true, reminderRead: true });
assert.equal(matrix.has('github.read'), true);
assert.equal(matrix.has('canva.read'), false);
assert.equal(matrix.has('unknown'), false);
assert.deepEqual(matrix.list(), ['github.read', 'gmail.read', 'calendar.read', 'reminder.read']);
assert.equal(matrix.canWrite(), false);
assert.equal(enforceCapabilityImplication(matrix.matrix).pass, true);

const invalidWrite = createConnectorCapabilityMatrix({ calendarWrite: true });
const invalidReport = enforceCapabilityImplication(invalidWrite.matrix);
assert.equal(invalidReport.pass, false);
assert.deepEqual(invalidReport.issues, ['CALENDAR_WRITE_REQUIRES_READ']);
const validWrite = createConnectorCapabilityMatrix({ calendarRead: true, calendarWrite: true, reminderRead: true, reminderWrite: true });
assert.equal(enforceCapabilityImplication(validWrite.matrix).pass, true);
assert.equal(validWrite.canWrite(), true);
assert.deepEqual(CONNECTOR_CAPABILITY_NAMES, ['github.read', 'gmail.read', 'canva.read', 'calendar.read', 'calendar.write', 'reminder.read', 'reminder.write']);

console.log('connector capability tests passed');
