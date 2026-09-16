import assert from 'node:assert/strict';
import { createTaskSchedulePersistence } from '../lib/task-schedule-persistence.mjs';

let stored={schemaVersion:1,snapshot:{entries:[]}};
const adapter={async load(){return stored;},async save(){throw new Error('disk failure');}};
const runtime=createTaskSchedulePersistence({adapter,storeOptions:{now:()=>new Date('2026-09-16T12:00:00Z')}});
await runtime.open();
await assert.rejects(()=>runtime.add({traceId:'t',ownerId:'u',agentId:'research',task:'x',runAt:'2026-09-16T13:00:00Z',maxAttempts:1}),/SCHEDULE_PERSISTENCE_SAVE_FAILED/);
assert.equal(runtime.snapshot().entries.length,0);
console.log('scheduled task persistence failure rollback ok');
