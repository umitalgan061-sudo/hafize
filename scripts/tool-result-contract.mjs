// Shared helper for tool-execution result suites.
//
// `executeNvidiaToolCall` returns the tool outcome plus observability metadata:
// the tool name and the measured `durationMs`. A duration is timing-dependent,
// so a suite that pins the whole object with `deepEqual` fails on a fast or slow
// machine. These helpers assert the outcome contract and check the metadata for
// shape rather than value. This module is a helper, not a suite (run-checks only
// executes test-*/validate-*).

import assert from 'node:assert/strict';

/**
 * Assert a tool result matches `expected` ({ ok, value } or { ok, error }) and
 * carries the observability metadata for `tool`.
 */
export function assertToolResult(actual, expected, tool) {
  assert.ok(actual && typeof actual === 'object', 'tool result should be an object');
  const { durationMs, tool: toolName, ...outcome } = actual;
  assert.deepEqual(outcome, expected);
  if (tool !== undefined) assert.equal(toolName, tool, 'tool result should name its tool');
  assert.equal(typeof durationMs, 'number', 'tool result should measure its duration');
  assert.ok(durationMs >= 0, 'tool result duration should not be negative');
}

/** Assert a tool result failed with exactly `error`. */
export function assertToolError(actual, error, tool) {
  assertToolResult(actual, { ok: false, error }, tool);
}
