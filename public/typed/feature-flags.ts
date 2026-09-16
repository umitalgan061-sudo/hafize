export type FeatureValue = boolean | string | number;
export interface FeatureFlag<T extends FeatureValue = FeatureValue> { readonly name: string; readonly defaultValue: T; readonly value?: T; readonly source: 'default' | 'storage' | 'runtime'; readonly updatedAt?: string; }
export interface FeatureFlagStore { readonly get: <T extends FeatureValue>(name: string, fallback: T) => T; readonly set: <T extends FeatureValue>(name: string, value: T) => boolean; readonly remove: (name: string) => boolean; readonly list: () => readonly FeatureFlag[]; }

const STORAGE_KEY = 'hafize.feature-flags.v1';
const MAX_FLAGS = 64;
const MAX_NAME = 80;
const MAX_STRING = 300;
const normalizeName = (name: unknown): string => String(name ?? '').trim().slice(0, MAX_NAME).replace(/[^a-zA-Z0-9._-]/g, '-');
function coerce<T extends FeatureValue>(value: unknown, fallback: T): T { if (typeof fallback === 'boolean') return (value === true || value === 'true') as T; if (typeof fallback === 'number') { const number = Number(value); return (Number.isFinite(number) ? number : fallback) as T; } return String(value ?? fallback).slice(0, MAX_STRING) as T; }

export function createFeatureFlagStore(storage: Storage | undefined = globalThis.localStorage): FeatureFlagStore {
  const read = (): Record<string, FeatureFlag> => { try { const parsed: unknown = JSON.parse(storage?.getItem(STORAGE_KEY) || '{}'); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, FeatureFlag> : {}; } catch { return {}; } };
  const write = (flags: Record<string, FeatureFlag>): boolean => { try { storage?.setItem(STORAGE_KEY, JSON.stringify(flags)); return true; } catch { return false; } };
  const get = <T extends FeatureValue>(name: string, fallback: T): T => { const key = normalizeName(name); const flags = read(); return key && flags[key] ? coerce(flags[key].value, fallback) : fallback; };
  const set = <T extends FeatureValue>(name: string, value: T): boolean => { const key = normalizeName(name); if (!key) return false; const flags = read(); flags[key] = Object.freeze({ name: key, defaultValue: value, value, source: 'runtime' as const, updatedAt: new Date().toISOString() }); const keys = Object.keys(flags).slice(-MAX_FLAGS); return write(Object.fromEntries(keys.map((item) => [item, flags[item]]))); };
  const remove = (name: string): boolean => { const key = normalizeName(name); const flags = read(); if (!Object.prototype.hasOwnProperty.call(flags, key)) return false; delete flags[key]; return write(flags); };
  const list = (): readonly FeatureFlag[] => Object.freeze(Object.values(read()).slice(-MAX_FLAGS));
  return Object.freeze({ get, set, remove, list });
}

export function isFlagEnabled(store: FeatureFlagStore, name: string, fallback = false): boolean { return store.get(name, fallback); }
export function registerDefaults(store: FeatureFlagStore, defaults: Readonly<Record<string, FeatureValue>>): void { for (const [name, value] of Object.entries(defaults)) { const flags = store.list(); if (!flags.some((flag) => flag.name === normalizeName(name))) store.set(name, value); } }

export const HafizeFeatureFlags = Object.freeze({ createFeatureFlagStore, isFlagEnabled, registerDefaults });
