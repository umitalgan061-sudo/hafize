import { normalizeSkillManifest } from './skills-manifest.mjs';

const ENTRY_FIELDS = new Set(['source', 'projectScope', 'manifest']);
const MAX_SKILLS = 64;
const MAX_QUERY_LENGTH = 2_000;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

/**
 * Doğrulanmış skill kayıtlarından deterministik bir registry kurar.
 * Aynı isim iki kaynakta varsa daha güvenilir kaynak kazanır; daha az
 * güvenilen kayıt yüklenmez ve `shadowed` listesinde görünür. Aynı güven
 * düzeyinde çakışma sessizce çözülmez, hata verir.
 */
export function buildSkillRegistry(entries = [], { agent, allowedProjectScopes = [] } = {}) {
  if (!Array.isArray(entries) || entries.length > MAX_SKILLS) fail('INVALID_SKILL_REGISTRY');

  const byName = new Map();
  const shadowed = [];
  for (const entry of entries) {
    if (!entry || Array.isArray(entry) || typeof entry !== 'object') fail('INVALID_SKILL_REGISTRY_ENTRY');
    for (const field of Object.keys(entry)) if (!ENTRY_FIELDS.has(field)) fail('INVALID_SKILL_REGISTRY_ENTRY_FIELD');

    const skill = normalizeSkillManifest(entry.manifest, {
      source: entry.source,
      projectScope: entry.projectScope ?? null,
      agent,
      allowedProjectScopes
    });

    const existing = byName.get(skill.name);
    if (!existing) {
      byName.set(skill.name, skill);
    } else if (existing.trust === skill.trust) {
      fail('SKILL_NAME_CONFLICT');
    } else {
      const [winner, loser] = existing.trust > skill.trust ? [existing, skill] : [skill, existing];
      byName.set(skill.name, winner);
      shadowed.push(Object.freeze({ name: skill.name, source: loser.source, shadowedBy: winner.source }));
    }
  }

  const skills = Object.freeze([...byName.values()].sort((a, b) => b.trust - a.trust || a.name.localeCompare(b.name)));

  return Object.freeze({
    skills,
    shadowed: Object.freeze(shadowed),
    get(name) {
      return (typeof name === 'string' && byName.get(name.trim())) || null;
    },
    /** Kullanıcı metnindeki tetikleyicilere göre aday skill'leri güven sırasıyla döndürür. */
    match(query) {
      const text = typeof query === 'string' ? query.trim().slice(0, MAX_QUERY_LENGTH).toLowerCase() : '';
      if (!text) return Object.freeze([]);
      return Object.freeze(skills.filter((skill) => skill.triggers.some((trigger) => text.includes(trigger))));
    },
    /** Modele sunulacak, prompt ve iç alanları taşımayan güvenli özet. */
    listPublic() {
      return skills.map(({ name, description, source, execution }) => ({ name, description, source, execution }));
    }
  });
}
