export const MODEL_PREFERENCES_STORAGE_KEY = 'hafize.model-preferences.v1';

export const MODEL_PREFERENCES_LIMITS = Object.freeze({
  maxProfiles: 6,
  maxName: 48,
  maxModel: 180,
  maxAgentId: 140,
  maxImport: 200_000,
  maxExport: 200_000
});

export interface ModelPreferenceProfile {
  id: string;
  name: string;
  model: string;
  agentId: string;
  toolsEnabled: boolean;
  useCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ModelPreferenceState {
  version: 1;
  selectedModel: string;
  selectedAgentId: string;
  profiles: ModelPreferenceProfile[];
  updatedAt: string;
}

const now = (): string => new Date().toISOString();

const trim = (value: unknown, limit: number): string =>
  typeof value === 'string' ? value.trim().slice(0, limit) : '';

const uid = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function normalizeProfile(value: unknown): ModelPreferenceProfile | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const model = trim(source.model, MODEL_PREFERENCES_LIMITS.maxModel);
  const agentId = trim(source.agentId, MODEL_PREFERENCES_LIMITS.maxAgentId);
  if (!model || !agentId) return null;
  const createdAt = trim(source.createdAt, 40) || now();
  const updatedAt = trim(source.updatedAt, 40) || createdAt;
  const numericUseCount = Number(source.useCount);
  const useCount = Number.isFinite(numericUseCount) && numericUseCount >= 0
    ? Math.min(9999, Math.floor(numericUseCount))
    : 0;
  return Object.freeze({
    id: trim(source.id, 120) || uid(),
    name: trim(source.name, MODEL_PREFERENCES_LIMITS.maxName) || 'Yeni profil',
    model,
    agentId,
    toolsEnabled: source.toolsEnabled === true,
    useCount,
    createdAt,
    updatedAt
  });
}

export function normalizeState(value: unknown): ModelPreferenceState {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const rawProfiles = Array.isArray(source.profiles) ? source.profiles : [];
  const seen = new Set<string>();
  const profiles: ModelPreferenceProfile[] = [];
  for (const raw of rawProfiles) {
    const profile = normalizeProfile(raw);
    if (!profile || seen.has(profile.id)) continue;
    seen.add(profile.id);
    profiles.push(profile);
    if (profiles.length >= MODEL_PREFERENCES_LIMITS.maxProfiles) break;
  }
  return Object.freeze({
    version: 1,
    selectedModel: trim(source.selectedModel, MODEL_PREFERENCES_LIMITS.maxModel),
    selectedAgentId: trim(source.selectedAgentId, MODEL_PREFERENCES_LIMITS.maxAgentId),
    profiles,
    updatedAt: trim(source.updatedAt, 40) || now()
  });
}

export function loadModelPreferences(storage: Storage | null | undefined = globalThis.localStorage): ModelPreferenceState {
  try {
    const raw = storage?.getItem(MODEL_PREFERENCES_STORAGE_KEY);
    return normalizeState(raw ? JSON.parse(raw) : null);
  } catch {
    return normalizeState(null);
  }
}

export function saveModelPreferences(
  state: ModelPreferenceState,
  storage: Storage | null | undefined = globalThis.localStorage
): boolean {
  try {
    const normalized = normalizeState(state);
    storage?.setItem(MODEL_PREFERENCES_STORAGE_KEY, JSON.stringify(normalized));
    return true;
  } catch {
    return false;
  }
}

export function rememberSelection(
  state: ModelPreferenceState,
  selection: { model: string; agentId: string }
): ModelPreferenceState {
  const next = normalizeState({
    ...state,
    selectedModel: trim(selection.model, MODEL_PREFERENCES_LIMITS.maxModel),
    selectedAgentId: trim(selection.agentId, MODEL_PREFERENCES_LIMITS.maxAgentId),
    updatedAt: now()
  });
  return next;
}

export function createProfile(
  name: string,
  model: string,
  agentId: string,
  toolsEnabled = false
): ModelPreferenceProfile | null {
  return normalizeProfile({
    id: uid(),
    name,
    model,
    agentId,
    toolsEnabled,
    useCount: 0,
    createdAt: now(),
    updatedAt: now()
  });
}

export function upsertProfile(
  state: ModelPreferenceState,
  profile: ModelPreferenceProfile
): ModelPreferenceState {
  const normalized = normalizeProfile(profile);
  if (!normalized) return normalizeState(state);
  const existingIndex = state.profiles.findIndex((item) => item.id === normalized.id);
  const profiles = state.profiles.slice();
  if (existingIndex >= 0) profiles.splice(existingIndex, 1, normalized);
  else profiles.unshift(normalized);
  return normalizeState({ ...state, profiles, updatedAt: now() });
}

export function removeProfile(
  state: ModelPreferenceState,
  profileId: string
): ModelPreferenceState {
  const profiles = state.profiles.filter((item) => item.id !== profileId);
  return normalizeState({ ...state, profiles, updatedAt: now() });
}

export function touchProfile(
  state: ModelPreferenceState,
  profileId: string
): ModelPreferenceState {
  const profile = state.profiles.find((item) => item.id === profileId);
  if (!profile) return normalizeState(state);
  return upsertProfile(state, {
    ...profile,
    useCount: Math.min(9999, profile.useCount + 1),
    updatedAt: now()
  });
}

export function findProfile(
  state: ModelPreferenceState,
  profileId: string
): ModelPreferenceProfile | null {
  return state.profiles.find((item) => item.id === profileId) ?? null;
}

export function rankProfiles(
  state: ModelPreferenceState,
  current: { model: string; agentId: string }
): ModelPreferenceProfile[] {
  return state.profiles
    .slice()
    .sort((a, b) => {
      const aCurrent = a.model === current.model && a.agentId === current.agentId ? 1 : 0;
      const bCurrent = b.model === current.model && b.agentId === current.agentId ? 1 : 0;
      if (aCurrent !== bCurrent) return bCurrent - aCurrent;
      if (a.useCount !== b.useCount) return b.useCount - a.useCount;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
}

export function exportModelPreferences(state: ModelPreferenceState): string {
  const payload = {
    version: 1,
    source: 'hafize-model-preferences',
    exportedAt: now(),
    selectedModel: state.selectedModel,
    selectedAgentId: state.selectedAgentId,
    profiles: normalizeState(state).profiles
  };
  const output = JSON.stringify(payload, null, 2);
  return output.length <= MODEL_PREFERENCES_LIMITS.maxExport
    ? output
    : JSON.stringify({ ...payload, profiles: payload.profiles.slice(0, 3) }, null, 2);
}

export interface ModelPreferenceImportPreview {
  candidateCount: number;
  validCount: number;
  rejectedCount: number;
  collisionCount: number;
  capacityRemaining: number;
  willImport: number;
}

export function previewModelPreferenceImport(
  current: ModelPreferenceState,
  payload: unknown
): ModelPreferenceImportPreview {
  const source = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : {};
  const incoming = Array.isArray(payload)
    ? payload
    : Array.isArray(source.profiles) ? source.profiles : [];
  const existing = normalizeState(current);
  const ids = new Set(existing.profiles.map((profile) => profile.id));
  let validCount = 0;
  let rejectedCount = 0;
  let collisionCount = 0;
  for (const raw of incoming) {
    const profile = normalizeProfile(raw);
    if (!profile) {
      rejectedCount += 1;
      continue;
    }
    validCount += 1;
    if (ids.has(profile.id)) collisionCount += 1;
  }
  const capacityRemaining = Math.max(0, MODEL_PREFERENCES_LIMITS.maxProfiles - existing.profiles.length);
  return {
    candidateCount: incoming.length,
    validCount,
    rejectedCount,
    collisionCount,
    capacityRemaining,
    willImport: Math.min(validCount, capacityRemaining)
  };
}

export function importModelPreferences(
  current: ModelPreferenceState,
  payload: unknown
): { state: ModelPreferenceState; imported: number; rejected: number } {
  const source = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : {};
  const incoming = Array.isArray(payload) ? payload : Array.isArray(source.profiles) ? source.profiles : [];
  let state = normalizeState(current);
  let imported = 0;
  let rejected = 0;
  const ids = new Set(state.profiles.map((profile) => profile.id));
  for (const raw of incoming) {
    const normalized = normalizeProfile(raw);
    if (!normalized) {
      rejected += 1;
      continue;
    }
    let profile = normalized;
    while (ids.has(profile.id)) profile = Object.freeze({ ...profile, id: uid() });
    ids.add(profile.id);
    const nextProfiles = state.profiles.concat(profile);
    state = normalizeState({ ...state, profiles: nextProfiles, updatedAt: now() });
    imported += 1;
    if (state.profiles.length >= MODEL_PREFERENCES_LIMITS.maxProfiles) break;
  }
  return { state, imported, rejected };
}

export function renameProfile(
  state: ModelPreferenceState,
  profileId: string,
  name: string
): ModelPreferenceState {
  const profile = state.profiles.find((item) => item.id === profileId);
  if (!profile) return normalizeState(state);
  const normalizedName = trim(name, MODEL_PREFERENCES_LIMITS.maxName);
  if (!normalizedName) return normalizeState(state);
  return upsertProfile(state, { ...profile, name: normalizedName, updatedAt: now() });
}

export function duplicateProfile(
  state: ModelPreferenceState,
  profileId: string,
  requestedName = ''
): ModelPreferenceState {
  const profile = state.profiles.find((item) => item.id === profileId);
  if (!profile || state.profiles.length >= MODEL_PREFERENCES_LIMITS.maxProfiles) {
    return normalizeState(state);
  }
  const copy = createProfile(
    requestedName || (profile.name + ' kopyası').slice(0, MODEL_PREFERENCES_LIMITS.maxName),
    profile.model,
    profile.agentId,
    profile.toolsEnabled
  );
  return copy ? upsertProfile(state, copy) : normalizeState(state);
}

export function clearModelPreferences(
  storage: Storage | null | undefined = globalThis.localStorage
): boolean {
  try {
    storage?.removeItem(MODEL_PREFERENCES_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
