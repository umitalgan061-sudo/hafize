function normalizeText(value) {
  // Noktalama ayırıcı sayılır: `hangi servisler hazır?` ile `hangi servisler
  // hazır` ve `code-inspection` ile `code inspection` aynı şekilde eşleşir.
  return typeof value === 'string'
    ? value.normalize('NFKC').toLocaleLowerCase('tr-TR').replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim()
    : '';
}

function scoreSkill(skill, query) {
  const text = normalizeText(query);
  if (!text) return 0;
  const haystack = [skill.name, skill.description, ...(skill.triggers || [])].map(normalizeText);
  const exactTrigger = (skill.triggers || []).some((trigger) => normalizeText(trigger) === text);
  if (exactTrigger) return 100;
  const terms = [...new Set(text.split(' ').filter((term) => term.length > 1))];
  if (!terms.length) return 0;
  // Skor, sorgu terimlerinin ne kadarının karşılandığıdır. Eski formül hit
  // sayısını haystack uzunluğuna böldüğü için trigger eklemek skill'in kendi
  // skorunu düşürüyordu.
  const matched = terms.filter((term) => haystack.some((value) => value.includes(term))).length;
  return matched / terms.length;
}

export function selectSkill(skills, query, { minScore = 0.2 } = {}) {
  if (!Array.isArray(skills)) throw new Error('INVALID_SKILL_SELECTION_CATALOG');
  const ranked = skills
    .filter((skill) => skill && typeof skill.name === 'string')
    .map((skill, index) => ({ skill, index, score: scoreSkill(skill, query) }))
    .filter((item) => item.score >= minScore)
    .sort((a, b) => b.score - a.score || a.skill.name.localeCompare(b.skill.name) || a.index - b.index);
  return ranked[0]?.skill || null;
}

export function rankSkills(skills, query) {
  if (!Array.isArray(skills)) throw new Error('INVALID_SKILL_SELECTION_CATALOG');
  return Object.freeze(skills
    .filter((skill) => skill && typeof skill.name === 'string')
    .map((skill, index) => Object.freeze({ name: skill.name, score: scoreSkill(skill, query), index }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name) || a.index - b.index));
}

export function createSkillSelector(skills) {
  const catalog = Object.freeze(skills?.filter(Boolean).slice() || []);
  return Object.freeze({
    select(query, options) { return selectSkill(catalog, query, options); },
    rank(query) { return rankSkills(catalog, query); },
    size: catalog.length
  });
}
