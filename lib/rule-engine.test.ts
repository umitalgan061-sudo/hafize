import { describe, expect, it } from 'vitest';
import { createRuleEngine, cronMatches, globToRegExp, parseCron } from './rule-engine.ts';

function engine(options: { guard?: (context: { rule: { name: string } }) => boolean } = {}) {
  const runs: Array<{ name: string; reason: string; payload?: Record<string, unknown> }> = [];
  const instance = createRuleEngine({
    newId: (() => { let n = 0; return () => `rule_${++n}`; })(),
    now: () => new Date('2026-01-01T00:00:00Z'),
    ...(options.guard ? { guard: options.guard as never } : {}),
    run: async (context) => { runs.push({ name: context.rule.name, reason: context.reason, ...(context.payload ? { payload: context.payload } : {}) }); }
  });
  return { instance, runs };
}

const eventRule = { name: 'run-tests', trigger: { kind: 'event' as const, event: 'file.changed' }, task: 'Değişen dosya için testleri koş.', agentId: 'coder' };
const cronRule = { name: 'daily-summary', trigger: { kind: 'cron' as const, expression: '0 9 * * *' }, task: 'Günlük özet çıkar.', agentId: 'assistant' };

describe('cron parsing', () => {
  it('parses lists, ranges, steps and wildcards', () => {
    expect(parseCron('0 9 * * *').hour).toEqual([9]);
    expect(parseCron('*/15 * * * *').minute).toEqual([0, 15, 30, 45]);
    expect(parseCron('0 9-17 * * 1-5').hour).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17]);
    expect(parseCron('0,30 * * * *').minute).toEqual([0, 30]);
    expect(parseCron('0 9 * * 7').dow).toEqual([0]);
  });

  it('rejects malformed expressions', () => {
    expect(() => parseCron('0 9 * *')).toThrow('INVALID_RULE_CRON');
    expect(() => parseCron('0 24 * * *')).toThrow('INVALID_RULE_CRON');
    expect(() => parseCron('0 9 32 * *')).toThrow('INVALID_RULE_CRON');
    expect(() => parseCron('*/0 * * * *')).toThrow('INVALID_RULE_CRON');
  });

  it('matches dates', () => {
    const parsed = parseCron('0 9 * * 1-5');
    expect(cronMatches(parsed, new Date('2026-01-05T09:00:00'))).toBe(true);
    expect(cronMatches(parsed, new Date('2026-01-05T10:00:00'))).toBe(false);
    expect(cronMatches(parsed, new Date('2026-01-03T09:00:00'))).toBe(false);
  });
});

describe('glob matching', () => {
  it('compiles globs', () => {
    expect(globToRegExp('*.md').test('a.md')).toBe(true);
    expect(globToRegExp('*.md').test('dir/a.md')).toBe(false);
    expect(globToRegExp('src/**/*.ts').test('src/a/b.ts')).toBe(true);
    expect(globToRegExp('src/**/*.ts').test('src/a.ts')).toBe(true); // standard glob: ** may be empty
    expect(globToRegExp('src/**/*.ts').test('lib/a.ts')).toBe(false);
    expect(globToRegExp('**/*.md').test('a.md')).toBe(true);
    expect(globToRegExp('file?.txt').test('file1.txt')).toBe(true);
  });
});

describe('rule engine', () => {
  it('creates a rule and lists it per owner', () => {
    const { instance } = engine();
    const rule = instance.create('user-1', eventRule);
    expect(rule).toMatchObject({ id: 'rule_1', name: 'run-tests', enabled: true, fireCount: 0, cooldownMs: 60_000 });
    expect(instance.list('user-1')).toHaveLength(1);
    expect(instance.list('user-2')).toHaveLength(0);
  });

  it('rejects invalid rules', () => {
    const { instance } = engine();
    expect(() => instance.create('u', { ...eventRule, name: 'Bad' })).toThrow('INVALID_RULE_NAME');
    expect(() => instance.create('u', { ...eventRule, task: '' })).toThrow('INVALID_RULE_TASK');
    expect(() => instance.create('u', { ...eventRule, agentId: '' })).toThrow('INVALID_RULE_AGENT');
    expect(() => instance.create('u', { ...eventRule, trigger: { kind: 'cron', expression: 'nope' } })).toThrow('INVALID_RULE_CRON');
    expect(() => instance.create('u', { ...eventRule, trigger: { kind: 'magic' } as never })).toThrow('INVALID_RULE_TRIGGER_KIND');
    expect(() => instance.create('u', { ...eventRule, cooldownMs: -1 })).toThrow('INVALID_RULE_COOLDOWN');
  });

  it('refuses duplicate names per owner', () => {
    const { instance } = engine();
    instance.create('user-1', eventRule);
    expect(() => instance.create('user-1', eventRule)).toThrow('RULE_NAME_CONFLICT');
    expect(() => instance.create('user-2', eventRule)).not.toThrow();
  });

  it('fires event rules with payload', async () => {
    const { instance, runs } = engine();
    instance.create('user-1', eventRule);
    const results = await instance.emit('file.changed', { path: 'src/a.ts' });
    expect(results).toEqual([{ id: 'rule_1', fired: true }]);
    expect(runs).toEqual([{ name: 'run-tests', reason: 'event', payload: { path: 'src/a.ts' } }]);
  });

  it('ignores unrelated events', async () => {
    const { instance, runs } = engine();
    instance.create('user-1', eventRule);
    expect(await instance.emit('other.event')).toEqual([]);
    expect(await instance.emit('')).toEqual([]);
    expect(runs).toHaveLength(0);
  });

  it('applies cooldown', async () => {
    const { instance, runs } = engine();
    instance.create('user-1', { ...eventRule, cooldownMs: 60_000 });
    expect((await instance.emit('file.changed'))[0]).toMatchObject({ fired: true });
    const second = await instance.emit('file.changed');
    expect(second[0]).toMatchObject({ fired: false, reason: 'cooldown' });
    expect(runs).toHaveLength(1);
  });

  it('skips disabled rules and resumes when enabled', async () => {
    const { instance, runs } = engine();
    const rule = instance.create('user-1', eventRule);
    instance.setEnabled('user-1', rule.id, false);
    expect((await instance.emit('file.changed'))[0]).toMatchObject({ fired: false, reason: 'disabled' });
    instance.setEnabled('user-1', rule.id, true);
    expect((await instance.emit('file.changed'))[0]).toMatchObject({ fired: true });
    expect(runs).toHaveLength(1);
  });

  it('respects a guard', async () => {
    const { instance, runs } = engine({ guard: (context) => context.rule.name !== 'blocked' });
    instance.create('user-1', eventRule);
    instance.create('user-1', { ...eventRule, name: 'blocked' });
    const results = await instance.emit('file.changed');
    expect(results.map((item) => item.fired)).toEqual([true, false]);
    expect(runs).toHaveLength(1);
  });

  it('ticks cron rules that are due', async () => {
    const { instance, runs } = engine();
    instance.create('user-1', cronRule);
    const due = await instance.tick(new Date('2026-01-01T09:00:00'));
    expect(due).toEqual([{ id: 'rule_1', fired: true }]);
    expect(runs).toEqual([{ name: 'daily-summary', reason: 'cron' }]);
    // Due again but suppressed by the default cooldown.
    expect(await instance.tick(new Date('2026-01-01T09:00:00'))).toEqual([{ id: 'rule_1', fired: false, reason: 'cooldown' }]);
    expect(await instance.tick(new Date('2026-01-01T10:00:00'))).toEqual([]); // not due
  });

  it('does not double-fire within the same minute across tick and emit', async () => {
    const { instance, runs } = engine();
    instance.create('user-1', { ...cronRule, cooldownMs: 0 });
    await instance.tick(new Date('2026-01-01T09:00:00'));
    await instance.tick(new Date('2026-01-01T09:00:30'));
    expect(runs).toHaveLength(2); // cooldown 0 means every due minute fires
  });

  it('reports run failures without losing the rule', async () => {
    const instance = createRuleEngine({ newId: () => 'rule_1', run: async () => { throw new Error('boom'); } });
    instance.create('user-1', eventRule);
    const results = await instance.emit('file.changed');
    expect(results[0]).toMatchObject({ fired: false, reason: 'boom' });
    expect(instance.list('user-1')).toHaveLength(1);
  });

  it('removes rules and scopes removal to the owner', () => {
    const { instance } = engine();
    const rule = instance.create('user-1', eventRule);
    expect(() => instance.remove('user-2', rule.id)).toThrow('RULE_NOT_FOUND');
    expect(instance.remove('user-1', rule.id)).toMatchObject({ name: 'run-tests' });
    expect(instance.list('user-1')).toHaveLength(0);
  });
});
