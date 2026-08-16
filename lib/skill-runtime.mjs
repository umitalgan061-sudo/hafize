import { readFile } from 'node:fs/promises';
import { createSkillRegistry, listPublicSkills } from './skill-registry.mjs';

const DEFAULT_SKILL_URL = new URL('../skills/registry.json', import.meta.url);

export async function loadBuiltinSkillRuntime(fileUrl = DEFAULT_SKILL_URL) {
  let payload;
  try {
    payload = JSON.parse(await readFile(fileUrl, 'utf8'));
  } catch {
    throw new Error('INVALID_SKILL_REGISTRY:file');
  }
  if (payload?.schemaVersion !== 1 || !Array.isArray(payload.skills)) {
    throw new Error('INVALID_SKILL_REGISTRY:schema');
  }
  const registry = createSkillRegistry({ builtin: payload.skills });
  return Object.freeze({
    registry,
    listPublic() { return listPublicSkills(registry); },
    size: registry.size
  });
}
