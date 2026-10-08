/**
 * Shared assertions for `executeNvidiaToolCall()` results.
 *
 * The tool boundary reports the tool name and the measured duration alongside
 * every outcome, so a `deepEqual` against `{ ok, value }` or `{ ok, error }`
 * can never hold and a test written that way says nothing about the payload it
 * meant to check. These helpers assert the parts that are contractual and leave
 * the timing out of it.
 *
 * It is a helper, not a suite: `run-checks.mjs` only executes `test-*` and
 * `validate-*` files.
 */

import assert from 'node:assert/strict';

function assertEnvelope(result, tool) {
  assert.ok(result && typeof result === 'object', 'the tool boundary returns a result object');
  assert.equal(result.tool, tool, `result names the ${tool} tool`);
  assert.equal(typeof result.durationMs, 'number', 'result carries a measured duration');
  assert.ok(result.durationMs >= 0, 'the measured duration is not negative');
}

/** Asserts a successful tool call and deep-equals its value. */
export function assertToolSuccess(result, tool, value) {
  assertEnvelope(result, tool);
  assert.equal(result.ok, true, `${tool} succeeds`);
  assert.deepEqual(result.value, value, `${tool} returns the expected value`);
}

/** Asserts a failed tool call, its error code and optionally the refusal reason. */
export function assertToolFailure(result, tool, error, reason) {
  assertEnvelope(result, tool);
  assert.equal(result.ok, false, `${tool} fails`);
  assert.equal(result.error, error, `${tool} reports ${error}`);
  if (reason !== undefined) assert.equal(result.reason, reason, `${tool} reports why it refused`);
}
