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
