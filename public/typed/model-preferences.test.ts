import { describe, expect, it, vi } from 'vitest';
import {
  MODEL_PREFERENCES_LIMITS,
  MODEL_PREFERENCES_STORAGE_KEY,
  clearModelPreferences,
  createProfile,
  exportModelPreferences,
  importModelPreferences,
  loadModelPreferences,
  normalizeProfile,
  normalizeState,
  rankProfiles,
  rememberSelection,
  removeProfile,
  renameProfile,
  duplicateProfile,
  saveModelPreferences,
  touchProfile,
  upsertProfile,
  type ModelPreferenceState
} from './model-preferences.ts';

function state(overrides: Partial<ModelPreferenceState> = {}): ModelPreferenceState {
  return {
    version: 1,
    selectedModel: '',
    selectedAgentId: '',
    profiles: [],
    updatedAt: new Date().toISOString(),
    ...overrides
  };
}

function profile(overrides: Record<string, unknown> = {}) {
  return normalizeProfile({
    id: 'profile-1',
    name: 'Yazı',
    model: 'model-a',
    agentId: 'general',
    toolsEnabled: false,
    useCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  });
}

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value); },
    removeItem: (key: string) => { map.delete(key); }
  } as unknown as Storage;
}

describe('model-preferences normalization', () => {
  it('uses safe defaults for malformed state', () => {
    const result = normalizeState(null);
    expect(result.version).toBe(1);
    expect(result.selectedModel).toBe('');
    expect(result.selectedAgentId).toBe('');
    expect(result.profiles).toEqual([]);
  });

  it('rejects profiles without model or agent', () => {
    expect(normalizeProfile({ id: 'x', model: '', agentId: 'a' })).toBeNull();
    expect(normalizeProfile({ id: 'x', model: 'm', agentId: '' })).toBeNull();
  });

  it('bounds names and identifiers', () => {
    const result = profile({
      name: 'x'.repeat(200),
      model: 'm'.repeat(400),
      agentId: 'a'.repeat(400)
    });
    expect(result?.name.length).toBe(MODEL_PREFERENCES_LIMITS.maxName);
    expect(result?.model.length).toBe(MODEL_PREFERENCES_LIMITS.maxModel);
    expect(result?.agentId.length).toBe(MODEL_PREFERENCES_LIMITS.maxAgentId);
  });

  it('normalizes invalid use counts to zero and caps valid values', () => {
    expect(profile({ useCount: 'abc' })?.useCount).toBe(0);
    expect(profile({ useCount: -4 })?.useCount).toBe(0);
    expect(profile({ useCount: 100000 })?.useCount).toBe(9999);
    expect(profile({ useCount: 4.8 })?.useCount).toBe(4);
  });

  it('deduplicates profile ids and respects capacity', () => {
    const raw = Array.from({ length: 12 }, (_, index) => ({
      ...profile({ id: 'p-' + index }),
      ...(index > 0 && index % 3 === 0 ? { id: 'p-0' } : {})
    }));
    const result = normalizeState(state({ profiles: raw.filter(Boolean) as never[] }));
    expect(result.profiles.length).toBeLessThanOrEqual(MODEL_PREFERENCES_LIMITS.maxProfiles);
    expect(new Set(result.profiles.map((item) => item.id)).size).toBe(result.profiles.length);
  });
});

describe('model-preferences state operations', () => {
  it('remembers selected model and agent', () => {
    const result = rememberSelection(state(), { model: 'nvidia/a', agentId: 'planner' });
    expect(result.selectedModel).toBe('nvidia/a');
    expect(result.selectedAgentId).toBe('planner');
  });

  it('creates, inserts and replaces profiles by id', () => {
    const created = createProfile('Kod', 'model-a', 'coder', true);
    expect(created).not.toBeNull();
    let current = upsertProfile(state(), created!);
    expect(current.profiles).toHaveLength(1);
    current = upsertProfile(current, { ...created!, name: 'Kod v2' });
    expect(current.profiles).toHaveLength(1);
    expect(current.profiles[0].name).toBe('Kod v2');
  });

  it('removes a profile without affecting others', () => {
    const a = profile({ id: 'a' })!;
    const b = profile({ id: 'b', model: 'model-b' })!;
    const result = removeProfile(state({ profiles: [a, b] }), 'a');
    expect(result.profiles.map((item) => item.id)).toEqual(['b']);
  });

  it('touches existing profiles and safely ignores missing ones', () => {
    const current = state({ profiles: [profile({ id: 'a', useCount: 3 })!] });
    expect(touchProfile(current, 'a').profiles[0].useCount).toBe(4);
    expect(touchProfile(current, 'missing')).toEqual(current);
  });

  it('ranks the current profile before frequency and recency', () => {
    const current = profile({ id: 'current', model: 'model-a', agentId: 'general', useCount: 0 })!;
    const frequent = profile({ id: 'frequent', model: 'model-b', useCount: 9, updatedAt: '2026-02-01T00:00:00.000Z' })!;
    const recent = profile({ id: 'recent', model: 'model-c', useCount: 1, updatedAt: '2026-03-01T00:00:00.000Z' })!;
    const ranked = rankProfiles(state({ profiles: [frequent, recent, current] }), { model: 'model-a', agentId: 'general' });
    expect(ranked.map((item) => item.id)).toEqual(['current', 'frequent', 'recent']);
  });
});

describe('model-preferences storage', () => {
  it('writes and restores under its dedicated key', () => {
    const storage = memoryStorage();
    const item = profile()!;
    const current = state({ selectedModel: 'model-a', selectedAgentId: 'general', profiles: [item] });
    expect(saveModelPreferences(current, storage)).toBe(true);
    expect(storage.getItem(MODEL_PREFERENCES_STORAGE_KEY)).toContain('model-a');
    expect(loadModelPreferences(storage).profiles[0].id).toBe('profile-1');
    expect(loadModelPreferences(storage).selectedAgentId).toBe('general');
  });

  it('survives malformed stored JSON', () => {
    const storage = memoryStorage();
    storage.setItem(MODEL_PREFERENCES_STORAGE_KEY, '{broken');
    expect(loadModelPreferences(storage).profiles).toEqual([]);
  });

  it('clears only its own key', () => {
    const storage = memoryStorage();
    storage.setItem(MODEL_PREFERENCES_STORAGE_KEY, JSON.stringify(state()));
    storage.setItem('unrelated', 'keep');
    expect(clearModelPreferences(storage)).toBe(true);
    expect(storage.getItem(MODEL_PREFERENCES_STORAGE_KEY)).toBeNull();
    expect(storage.getItem('unrelated')).toBe('keep');
  });

  it('fails safely when storage throws', () => {
    const storage = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
      removeItem: () => { throw new Error('blocked'); }
    } as unknown as Storage;
    expect(loadModelPreferences(storage).profiles).toEqual([]);
    expect(saveModelPreferences(state(), storage)).toBe(false);
    expect(clearModelPreferences(storage)).toBe(false);
  });
});

describe('model-preferences import/export', () => {
  it('exports a bounded payload with a stable source marker', () => {
    const payload = JSON.parse(exportModelPreferences(state({
      selectedModel: 'model-a',
      selectedAgentId: 'general',
      profiles: [profile()!]
    })));
    expect(payload.version).toBe(1);
    expect(payload.source).toBe('hafize-model-preferences');
    expect(Array.isArray(payload.profiles)).toBe(true);
    expect(JSON.stringify(payload).length).toBeLessThanOrEqual(MODEL_PREFERENCES_LIMITS.maxExport);
  });

  it('imports valid profiles and counts rejected data', () => {
    const result = importModelPreferences(state(), {
      profiles: [profile({ id: 'incoming' }), { model: '', agentId: 'x' }, null]
    });
    expect(result.imported).toBe(1);
    expect(result.rejected).toBe(2);
  });

  it('does not overwrite ids on collision', () => {
    vi.stubGlobal('crypto', { randomUUID: vi.fn().mockReturnValue('generated-id') });
    const existing = profile({ id: 'same' })!;
    const incoming = profile({ id: 'same', name: 'Gelen' })!;
    const result = importModelPreferences(state({ profiles: [existing] }), [incoming]);
    expect(result.imported).toBe(1);
    expect(result.state.profiles[0].id).toBe('same');
    expect(result.state.profiles[1]?.id).not.toBe('same');
    vi.unstubAllGlobals();
  });

  it('never grows beyond the six-profile limit', () => {
    const currentProfiles = Array.from({ length: MODEL_PREFERENCES_LIMITS.maxProfiles - 1 }, (_, index) =>
      profile({ id: 'existing-' + index })!
    );
    const incoming = Array.from({ length: 8 }, (_, index) => profile({ id: 'incoming-' + index })!);
    const result = importModelPreferences(state({ profiles: currentProfiles }), incoming);
    expect(result.state.profiles.length).toBe(MODEL_PREFERENCES_LIMITS.maxProfiles);
  });

  it('accepts an array payload', () => {
    const result = importModelPreferences(state(), [profile({ id: 'array-item' })!]);
    expect(result.imported).toBe(1);
    expect(result.state.profiles[0].id).toBe('array-item');
  });
});


describe('model-preferences profile management', () => {
  it('renames an existing profile and preserves its settings', () => {
    const original = profile({ id: 'rename-me', name: 'Eski', model: 'model-x', agentId: 'writer', toolsEnabled: true, useCount: 7 })!;
    const result = normalizeState({ ...state(), profiles: [original] });
    const renamed = renameProfile(result, 'rename-me', 'Yeni ad');
    expect(renamed.profiles[0].name).toBe('Yeni ad');
    expect(renamed.profiles[0].model).toBe('model-x');
    expect(renamed.profiles[0].toolsEnabled).toBe(true);
    expect(renamed.profiles[0].useCount).toBe(7);
  });

  it('ignores empty profile names during rename', () => {
    const original = profile({ id: 'rename-me', name: 'Eski' })!;
    const result = normalizeState({ ...state(), profiles: [original] });
    const renamed = (require('./model-preferences.ts') as typeof import('./model-preferences.ts')).renameProfile(result, 'rename-me', '   ');
    expect(renamed.profiles[0].name).toBe('Eski');
  });

  it('duplicates a profile with a fresh identity and reset usage', () => {
    const original = profile({ id: 'copy-me', name: 'Kod', model: 'model-x', agentId: 'coder', toolsEnabled: true, useCount: 9 })!;
    const result = duplicateProfile(
      normalizeState({ ...state(), profiles: [original] }),
      'copy-me'
    );
    expect(result.profiles).toHaveLength(2);
    expect(result.profiles[0].id).not.toBe('copy-me');
    expect(result.profiles[0].name).toBe('Kod kopyası');
    expect(result.profiles[0].useCount).toBe(0);
    expect(result.profiles[0].toolsEnabled).toBe(true);
  });

  it('does not duplicate at capacity', () => {
    const profiles = Array.from({ length: MODEL_PREFERENCES_LIMITS.maxProfiles }, (_, index) =>
      profile({ id: 'p-' + index, name: 'Profil ' + index })!
    );
    const result = (require('./model-preferences.ts') as typeof import('./model-preferences.ts')).duplicateProfile(
      normalizeState({ ...state(), profiles }),
      'p-0'
    );
    expect(result.profiles).toHaveLength(MODEL_PREFERENCES_LIMITS.maxProfiles);
  });

  it('uses explicit duplicate names but still bounds them', () => {
    const original = profile({ id: 'copy-me' })!;
    const longName = 'x'.repeat(200);
    const result = (require('./model-preferences.ts') as typeof import('./model-preferences.ts')).duplicateProfile(
      normalizeState({ ...state(), profiles: [original] }),
      'copy-me',
      longName
    );
    expect(result.profiles[0].name.length).toBe(MODEL_PREFERENCES_LIMITS.maxName);
  });
});

describe('model-preferences edge behavior', () => {
  it('does not let selected values expand without normalization', () => {
    const result = rememberSelection(state(), {
      model: 'm'.repeat(500),
      agentId: 'a'.repeat(500)
    });
    expect(result.selectedModel.length).toBe(MODEL_PREFERENCES_LIMITS.maxModel);
    expect(result.selectedAgentId.length).toBe(MODEL_PREFERENCES_LIMITS.maxAgentId);
  });

  it('keeps unrelated state fields out of exported profiles', () => {
    const payload = JSON.parse(exportModelPreferences(state({
      profiles: [profile({ id: 'safe', secret: 'should-not-export' }) as never]
    })));
    expect(JSON.stringify(payload)).not.toContain('should-not-export');
    expect(payload.profiles[0]).not.toHaveProperty('secret');
  });

  it('keeps export free of conversation storage data', () => {
    const payload = exportModelPreferences(state({
      profiles: [profile({ id: 'safe', name: 'Prompt' })!]
    }));
    expect(payload).not.toContain('conversation');
    expect(payload).not.toContain('messageInput');
  });
});
