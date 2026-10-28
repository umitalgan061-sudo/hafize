import { describe, expect, it } from 'vitest';
import { createSandboxRunner } from './sandbox-runner.ts';

const sandbox = createSandboxRunner();

describe('sandbox runner', () => {
  it('runs code against input and captures logs', async () => {
    const result = await sandbox.run({ code: 'console.log("toplam"); return input.values.reduce((a, b) => a + b, 0);', input: { values: [1, 2, 3.5] } });
    expect(result).toMatchObject({ ok: true, result: 6.5, logs: ['toplam'] });
  });

  it('supports async code', async () => {
    const result = await sandbox.run({ code: 'await new Promise((r) => setTimeout(r, 20)); return { done: true };' });
    expect(result.result).toEqual({ done: true });
  });

  it('cannot reach Node APIs, the file system or the network', async () => {
    const attempts = [
      'return typeof require',
      'return typeof process',
      'return typeof fetch',
      'const p = this.constructor.constructor("return process")(); return p.getBuiltinModule("node:fs").readFileSync("C:/Windows/win.ini", "utf8")',
      'const p = (function(){ return this })().constructor.constructor("return process")(); return p.binding("fs")',
      'return eval("1+1")'
    ];
    const results = await Promise.all(attempts.map((code) => sandbox.run({ code })));
    expect(results[0]).toMatchObject({ ok: true, result: 'undefined' });
    expect(results[1]).toMatchObject({ ok: true, result: 'undefined' });
    expect(results[2]).toMatchObject({ ok: true, result: 'undefined' });
    for (const result of results.slice(3)) expect(result.ok).toBe(false);
  });

  it('stops infinite loops and runaway memory', async () => {
    const loop = await sandbox.run({ code: 'while (true) {}', timeoutMs: 300 });
    expect(loop.ok).toBe(false);
    expect(loop.error).toMatch(/timed out|TIMEOUT/i);
    const memory = await sandbox.run({ code: 'const a = []; while (true) a.push(new Array(1e6).fill(1));', timeoutMs: 20_000 });
    expect(memory.ok).toBe(false);
  }, 30_000);
});
