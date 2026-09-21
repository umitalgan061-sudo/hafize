import { describe, expect, it } from 'vitest';
import {
  RUNTIME_CONTRACT_VERSION,
  asRequestHeaders,
  fail,
  freeze,
  isFiniteInteger,
  isNonEmptyString,
  isRecord,
  isStringArray,
  ok,
  toRuntimeError
} from './runtime-types.ts';

describe('runtime-types', () => {
  it('exposes a dated contract version', () => {
    expect(RUNTIME_CONTRACT_VERSION).toBe('2026-09-21');
  });

  it('narrows records without accepting arrays or null', () => {
    expect(isRecord({ value: 1 })).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
  });

  it('validates bounded strings and integers', () => {
    expect(isNonEmptyString(' Hafize ', { maxLength: 10 })).toBe(true);
    expect(isNonEmptyString(' ', { maxLength: 10 })).toBe(false);
    expect(isNonEmptyString('fazla uzun', { maxLength: 4 })).toBe(false);
    expect(isFiniteInteger(4, 0, 5)).toBe(true);
    expect(isFiniteInteger(6, 0, 5)).toBe(false);
    expect(isFiniteInteger(4.5, 0, 5)).toBe(false);
  });

  it('validates string arrays with bounded cardinality', () => {
    expect(isStringArray(['a', 'b'], 2)).toBe(true);
    expect(isStringArray(['a', 2], 2)).toBe(false);
    expect(isStringArray(['a', 'b', 'c'], 2)).toBe(false);
  });

  it('normalizes request header records safely', () => {
    expect(asRequestHeaders({
      Accept: 'application/json',
      Cookie: ['a=b', 'c=d'],
      Bad: 123
    })).toEqual({
      Accept: 'application/json',
      Cookie: ['a=b', 'c=d']
    });
    expect(asRequestHeaders(null)).toEqual({});
  });

  it('normalizes unknown errors without leaking arbitrary values', () => {
    const native = new Error('boom');
    expect(toRuntimeError(native)).toBe(native);
    const object = toRuntimeError({ message: 'safe', code: 'E_SAFE' });
    expect(object.message).toBe('safe');
    expect(object.code).toBe('E_SAFE');
  });

  it('returns frozen result and object wrappers', () => {
    const success = ok({ id: '1' });
    const failure = fail('DENIED');
    const frozen = freeze({ enabled: true });
    expect(success).toEqual({ ok: true, value: { id: '1' } });
    expect(failure).toEqual({ ok: false, error: 'DENIED' });
    expect(Object.isFrozen(success)).toBe(true);
    expect(Object.isFrozen(failure)).toBe(true);
    expect(Object.isFrozen(frozen)).toBe(true);
  });
});
