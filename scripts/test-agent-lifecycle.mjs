import assert from 'node:assert/strict';
import { createAgentLifecycle } from '../lib/agent-lifecycle.mjs';

// Eşzamanlılık bütçesi aşılamaz ve serbest kalan slot yeniden kullanılabilir.
const bounded = createAgentLifecycle({ maxConcurrent: 2 });
assert.equal(bounded.concurrencyLimit, 2);
bounded.start({ taskId: 'task_1', agentId: 'agency-code-reviewer' });
bounded.start({ taskId: 'task_2', agentId: 'agency-minimal-engineer' });
assert.equal(bounded.activeCount, 2);
assert.throws(() => bounded.start({ taskId: 'task_3', agentId: 'agency-code-reviewer' }), /AGENT_CONCURRENCY_EXCEEDED/);
assert.equal(bounded.finish('task_1', { ok: true }).ok, true);
assert.equal(bounded.activeCount, 1);
assert.equal(bounded.start({ taskId: 'task_3', agentId: 'agency-code-reviewer' }).state, 'running');

// Geçersiz veya beklenmeyen alan taşıyan koşu tanımı fail-closed reddedilir.
assert.throws(() => bounded.start({ taskId: 'task_9', agentId: 'a', depth: 1 }), /INVALID_AGENT_RUN_FIELD/);
assert.throws(() => bounded.start({ taskId: '   ', agentId: 'a' }), /INVALID_AGENT_RUN/);
assert.throws(() => bounded.start(null), /INVALID_AGENT_RUN/);
assert.throws(() => bounded.start({ taskId: 'task_2', agentId: 'a' }), /AGENT_RUN_DUPLICATE/);
assert.throws(() => createAgentLifecycle({ now: 'şimdi' }), /INVALID_AGENT_LIFECYCLE:now/);
assert.throws(() => createAgentLifecycle({ parentSignal: {} }), /INVALID_AGENT_LIFECYCLE:parentSignal/);

// İptal açık bir durumdur: signal düşer, sonuç artık kabul edilmez.
const lifecycle = createAgentLifecycle({ maxConcurrent: 3 });
const handle = lifecycle.start({ taskId: 'task_1', agentId: 'agency-code-reviewer' });
assert.equal(handle.signal.aborted, false);
assert.equal(lifecycle.isCancelled('task_1'), false);
assert.equal(lifecycle.cancel('task_1', 'USER_STOPPED').ok, true);
assert.equal(handle.signal.aborted, true);
assert.equal(lifecycle.isCancelled('task_1'), true);
assert.equal(lifecycle.read('task_1').reason, 'USER_STOPPED');
assert.deepEqual(lifecycle.finish('task_1', { ok: true }), { ok: false, error: 'AGENT_RUN_CANCELLED' });
assert.equal(lifecycle.read('task_1').state, 'cancelled');

// Tamamlanmış koşu iptal edilemez ve iki kez kapatılamaz.
lifecycle.start({ taskId: 'task_2', agentId: 'agency-minimal-engineer' });
assert.equal(lifecycle.finish('task_2', { ok: false, error: 'DELEGATED_TOOL_FAILED' }).run.state, 'failed');
assert.deepEqual(lifecycle.cancel('task_2'), { ok: false, error: 'AGENT_RUN_ALREADY_FINISHED' });
assert.deepEqual(lifecycle.finish('task_2', { ok: true }), { ok: false, error: 'AGENT_RUN_ALREADY_FINISHED' });
assert.deepEqual(lifecycle.cancel('yok'), { ok: false, error: 'AGENT_RUN_NOT_FOUND' });
assert.deepEqual(lifecycle.finish(null), { ok: false, error: 'AGENT_RUN_NOT_FOUND' });

// Uzun veya geçersiz iptal gerekçesi dışarıya olduğu gibi taşınmaz.
lifecycle.start({ taskId: 'task_3', agentId: 'agency-code-reviewer' });
lifecycle.cancel('task_3', 'x'.repeat(500));
assert.equal(lifecycle.read('task_3').reason, 'AGENT_RUN_CANCELLED');

// Mesaj yalnızca çalışan koşuya teslim edilir.
const messaging = createAgentLifecycle({ maxConcurrent: 2 });
messaging.start({ taskId: 'task_1', agentId: 'agency-code-reviewer' });
assert.deepEqual(messaging.deliverMessage('task_1', ' ek bağlam '), { ok: true, pendingMessages: 1 });
assert.deepEqual(messaging.deliverMessage('task_1', ''), { ok: false, error: 'INVALID_AGENT_MESSAGE' });
assert.deepEqual(messaging.deliverMessage('task_1', 'x'.repeat(2001)), { ok: false, error: 'INVALID_AGENT_MESSAGE' });
assert.deepEqual(messaging.deliverMessage('yok', 'merhaba'), { ok: false, error: 'AGENT_RUN_NOT_FOUND' });
const drained = messaging.drainMessages('task_1');
assert.equal(drained.length, 1);
assert.equal(drained[0].text, 'ek bağlam');
assert.deepEqual(messaging.drainMessages('task_1'), []);
assert.equal(messaging.read('task_1').pendingMessages, 0);

// Kuyruk sınırlıdır; taşan mesaj sessizce düşürülmez, reddedilir.
for (let i = 0; i < 8; i += 1) assert.equal(messaging.deliverMessage('task_1', `mesaj ${i}`).ok, true);
assert.deepEqual(messaging.deliverMessage('task_1', 'dokuzuncu'), { ok: false, error: 'AGENT_INBOX_FULL' });

// Kapanan koşu ne mesaj alır ne de kuyruğunu taşır.
messaging.finish('task_1', { ok: true });
assert.deepEqual(messaging.deliverMessage('task_1', 'geç kalan mesaj'), { ok: false, error: 'AGENT_RUN_NOT_ACCEPTING_MESSAGES' });
assert.deepEqual(messaging.drainMessages('task_1'), []);
assert.equal(messaging.read('task_1').pendingMessages, 0);

// Üst istek düşerse tüm canlı alt koşular iptal olur ve yenisi açılamaz.
const parent = new AbortController();
const propagated = createAgentLifecycle({ maxConcurrent: 3, parentSignal: parent.signal });
const child = propagated.start({ taskId: 'task_1', agentId: 'agency-code-reviewer' });
propagated.start({ taskId: 'task_2', agentId: 'agency-minimal-engineer' });
propagated.finish('task_2', { ok: true });
parent.abort();
assert.equal(child.signal.aborted, true);
assert.equal(propagated.read('task_1').reason, 'PARENT_ABORTED');
assert.equal(propagated.read('task_2').state, 'completed');
assert.equal(propagated.stopped, true);
assert.throws(() => propagated.start({ taskId: 'task_3', agentId: 'agency-code-reviewer' }), /AGENT_LIFECYCLE_STOPPED/);

// Zaten düşmüş bir parent signal ile kurulan lifecycle hiç koşu açmaz.
const alreadyAborted = createAgentLifecycle({ parentSignal: AbortSignal.abort() });
assert.equal(alreadyAborted.stopped, true);
assert.throws(() => alreadyAborted.start({ taskId: 'task_1', agentId: 'a' }), /AGENT_LIFECYCLE_STOPPED/);

// Snapshot gözlemlenebilir ve dondurulmuş kalır; mesaj içeriği taşımaz.
const snapshot = propagated.snapshot();
assert.equal(Object.isFrozen(snapshot), true);
assert.equal(Object.isFrozen(snapshot.runs), true);
assert.equal(snapshot.stoppedReason, 'PARENT_ABORTED');
assert.deepEqual(snapshot.runs.map((run) => run.state), ['cancelled', 'completed']);
assert.equal(JSON.stringify(snapshot).includes('inbox'), false);

console.log('agent lifecycle tests passed');
