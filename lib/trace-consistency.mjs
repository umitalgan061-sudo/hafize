import { randomUUID } from 'node:crypto';

const TRACE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{7,127}$/;
const TASK_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{3,119}$/;

function id(value, pattern, code) {
  const result = typeof value === 'string' ? value.trim() : '';
  if (!pattern.test(result)) throw new Error(code);
  return result;
}

export function createTraceContext(traceId = randomUUID(), parentTaskId = '') {
  const trace = id(traceId, TRACE_ID_PATTERN, 'INVALID_TRACE_ID');
  const parent = parentTaskId ? id(parentTaskId, TASK_ID_PATTERN, 'INVALID_PARENT_TASK_ID') : null;
  return Object.freeze({ traceId: trace, parentTaskId: parent });
}

export function assertTraceContinuity(expectedTraceId, receivedTraceId) {
  const expected = id(expectedTraceId, TRACE_ID_PATTERN, 'INVALID_EXPECTED_TRACE_ID');
  const received = id(receivedTraceId, TRACE_ID_PATTERN, 'INVALID_RECEIVED_TRACE_ID');
  if (expected !== received) throw new Error('TRACE_ID_MISMATCH');
  return expected;
}

export function normalizeTaskRelation({ traceId, taskId, parentTaskId = null } = {}) {
  const context = createTraceContext(traceId, parentTaskId || '');
  const normalizedTask = id(taskId, TASK_ID_PATTERN, 'INVALID_TASK_ID');
  if (context.parentTaskId === normalizedTask) throw new Error('TASK_SELF_PARENT');
  return Object.freeze({ traceId: context.traceId, taskId: normalizedTask, parentTaskId: context.parentTaskId });
}

export const TRACE_CONSISTENCY_LIMITS = Object.freeze({ maxTraceIdLength: 128, maxTaskIdLength: 120 });
