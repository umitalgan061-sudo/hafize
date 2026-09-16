import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createEncryptedFileScheduleAdapter } from '../lib/encrypted-file-schedule-adapter.mjs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const directory = await mkdtemp(join(tmpdir(), 'hafize-schedule-'));
const filePath = join(directory, 'schedules.enc');
const key = randomBytes(32);
try {
  const adapter = createEncryptedFileScheduleAdapter({ filePath, key });
  const largeEntries = Array.from({ length: 800 }, (_, index) => ({
    scheduleId: `schedule_${index + 1}`,
    traceId: `trace-${index}`,
    ownerId: 'owner',
    agentId: 'hafize-general',
    task: `A repeating task with useful payload ${index}`,
    runAt: '2026-09-17T06:00:00.000Z',
    status: 'scheduled',
    attempts: 0,
    maxAttempts: 1,
    lastError: null,
    createdAt: '2026-09-16T06:00:00.000Z',
    updatedAt: null
  }));
  await adapter.save({ schemaVersion: 1, snapshot: { entries: largeEntries } });
  const encrypted = await readFile(filePath, 'utf8');
  assert.match(encrypted, /"version":2/);
  assert.match(encrypted, /"compressed":true/);
  const restored = await adapter.load();
  assert.equal(restored.snapshot.entries.length, 800);
  assert.equal(restored.snapshot.entries[799].scheduleId, 'schedule_800');

  const legacy = createEncryptedFileScheduleAdapter({ filePath, key });
  const legacyPayload = JSON.parse(encrypted);
  assert.equal(legacyPayload.version, 2);
  await writeFile(filePath, encrypted, 'utf8');
  assert.equal((await legacy.load()).snapshot.entries.length, 800);

  const tiny = createEncryptedFileScheduleAdapter({ filePath, key, maxFileBytes: 4096 });
  await assert.rejects(() => tiny.save({ schemaVersion: 1, snapshot: { entries: largeEntries } }), /ENCRYPTED_SCHEDULE_SAVE_FAILED/);
} finally {
  key.fill(0);
  await rm(directory, { recursive: true, force: true });
}

console.log('encrypted schedule storage scale tests passed');
