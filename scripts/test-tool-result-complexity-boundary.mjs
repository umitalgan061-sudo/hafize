import assert from 'node:assert/strict';
import {
  TOOL_EXECUTION_RESULT_POLICY,
  createToolSuccessResult,
  normalizeToolValue
} from '../lib/tool-execution-result-policy.mjs';

{
  const atLimit = Array.from({ length: TOOL_EXECUTION_RESULT_POLICY.maxArrayItems }, (_value, index) => index);
  const result = createToolSuccessResult(atLimit);
  assert.equal(result.ok, true);
  assert.equal(result.value.length, TOOL_EXECUTION_RESULT_POLICY.maxArrayItems);

  const overLimit = [...atLimit, 1];
  assert.deepEqual(createToolSuccessResult(overLimit), { ok: false, error: 'TOOL_RESULT_TOO_COMPLEX' });
}

{
  const atLimit = {};
  for (let index = 0; index < TOOL_EXECUTION_RESULT_POLICY.maxKeys; index += 1) atLimit[`k${index}`] = index;
  const result = createToolSuccessResult(atLimit);
  assert.equal(result.ok, true);
  assert.equal(Object.keys(result.value).length, TOOL_EXECUTION_RESULT_POLICY.maxKeys);

  atLimit.extra = true;
  assert.deepEqual(createToolSuccessResult(atLimit), { ok: false, error: 'TOOL_RESULT_TOO_COMPLEX' });
}

{
  const nodes = Array.from(
    { length: TOOL_EXECUTION_RESULT_POLICY.maxNodes },
    (_value, index) => ({ index })
  );
  const container = { nodes };
  const result = createToolSuccessResult(container);
  assert.deepEqual(result, { ok: false, error: 'TOOL_RESULT_TOO_COMPLEX' }, 'container + child nodes exceed global node budget');
}

{
  const unicode = '🙂'.repeat(100_000);
  const result = createToolSuccessResult({ unicode });
  assert.deepEqual(result, { ok: false, error: 'TOOL_RESULT_TOO_LARGE' }, 'limit is UTF-8 bytes, not JavaScript characters');
}

{
  const nullPrototype = Object.create(null);
  nullPrototype.safe = 'value';
  const value = normalizeToolValue(nullPrototype);
  assert.deepEqual(value, { safe: 'value' });
  assert.equal(Object.isFrozen(value), true);
}

{
  const object = {};
  Object.defineProperty(object, '__proto__', {
    value: { polluted: true },
    enumerable: true,
    configurable: true
  });
  const value = normalizeToolValue(object);
  assert.equal(Object.getPrototypeOf(value), Object.prototype);
  assert.equal(Object.prototype.polluted, undefined);
  assert.deepEqual(Object.getOwnPropertyDescriptor(value, '__proto__')?.value, { polluted: true });
}

{
  const sparse = [];
  sparse.length = 2;
  sparse[1] = 'present';
  assert.deepEqual(createToolSuccessResult(sparse), { ok: false, error: 'TOOL_RESULT_INVALID' });
}

{
  const nonEnumerable = {};
  Object.defineProperty(nonEnumerable, 'hidden', { value: 'included-by-own-data-policy', enumerable: false });
  const value = normalizeToolValue(nonEnumerable);
  assert.deepEqual(value, { hidden: 'included-by-own-data-policy' });
  assert.equal(Object.getOwnPropertyDescriptor(value, 'hidden')?.enumerable, true);
}

{
  const sharedLeaf = { value: 'same source object' };
  const result = createToolSuccessResult({ one: sharedLeaf, two: sharedLeaf, three: [sharedLeaf] });
  assert.equal(result.ok, true);
  assert.notEqual(result.value.one, result.value.two);
  assert.notEqual(result.value.one, result.value.three[0]);
  assert.deepEqual(result.value.one, result.value.two);
}

console.log('tool result complexity boundary tests passed');
