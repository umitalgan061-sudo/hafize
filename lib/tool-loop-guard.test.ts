import { describe, expect, it } from 'vitest';
import { createToolLoopGuard } from './tool-loop-guard.ts';

describe('createToolLoopGuard', () => {
  it('allows a call once and blocks an identical retry', () => {
    const guard = createToolLoopGuard();
    expect(guard.shouldRun('fs_read', '{"path":"README.md"}')).toBe(true);
    expect(guard.shouldRun('fs_read', '{"path":"README.md"}')).toBe(false);
  });
  it('does not block a different call', () => {
    const guard = createToolLoopGuard();
    expect(guard.shouldRun('fs_read', '{"path":"README.md"}')).toBe(true);
    expect(guard.shouldRun('fs_read', '{"path":"package.json"}')).toBe(true);
  });
});

describe('long-run duplicate detection', () => {
  it('blocks semantically equal JSON with reordered nested keys and whitespace', () => {
    const guard = createToolLoopGuard();
    expect(guard.shouldRun('github_read_file', '{"repo":"example","options":{"ref":"main","path":"app.ts"}}')).toBe(true);
    expect(guard.shouldRun('github_read_file', '{ "options": { "path":"app.ts", "ref":"main" }, "repo":"example" }')).toBe(false);
  });
  it('preserves array ordering and distinct mutations', () => {
    const guard = createToolLoopGuard();
    expect(guard.shouldRun('tool', '{"items":[1,2]}')).toBe(true);
    expect(guard.shouldRun('tool', '{"items":[2,1]}')).toBe(true);
    expect(guard.shouldRun('tool', '{"items":[1,2]}')).toBe(false);
  });
  it('does not confuse prototype keys or malformed arguments', () => {
    const guard = createToolLoopGuard();
    expect(guard.shouldRun('tool', '{"__proto__":{"x":1}}')).toBe(true);
    expect(guard.shouldRun('tool', '{}')).toBe(true);
    expect(guard.shouldRun('tool', '{"__proto__":{"x":1}}')).toBe(false);
    expect(guard.shouldRun('tool', '{broken')).toBe(true);
    expect(guard.shouldRun('tool', '{broken')).toBe(false);
  });
});
