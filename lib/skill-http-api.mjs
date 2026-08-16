function response(status, body, headers = {}) {
  return Object.freeze({
    status,
    headers: Object.freeze({ 'Cache-Control': 'no-store', ...headers }),
    body: Object.freeze(body)
  });
}

function cleanMethod(value) {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

function cleanPath(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function validatePublicSkill(skill) {
  if (!skill || typeof skill !== 'object') throw new Error('INVALID_SKILL_HTTP_API:skill');
  const allowed = new Set(['id', 'name', 'description', 'triggers', 'execution', 'source']);
  for (const key of Object.keys(skill)) {
    if (!allowed.has(key)) throw new Error(`INVALID_SKILL_HTTP_API:private_field:${key}`);
  }
  if (
    typeof skill.id !== 'string'
    || typeof skill.name !== 'string'
    || typeof skill.description !== 'string'
    || !Array.isArray(skill.triggers)
    || !['inline', 'fork'].includes(skill.execution)
    || typeof skill.source !== 'string'
  ) {
    throw new Error('INVALID_SKILL_HTTP_API:shape');
  }
  return Object.freeze({
    id: skill.id,
    name: skill.name,
    description: skill.description,
    triggers: Object.freeze([...skill.triggers]),
    execution: skill.execution,
    source: skill.source
  });
}

export function createSkillHttpApi({ skillRuntime } = {}) {
  if (typeof skillRuntime?.listPublic !== 'function') {
    throw new Error('INVALID_SKILL_HTTP_API:runtime');
  }

  function list() {
    const skills = skillRuntime.listPublic();
    if (!Array.isArray(skills)) throw new Error('INVALID_SKILL_HTTP_API:list');
    return Object.freeze(skills.map(validatePublicSkill));
  }

  async function handle({ method, pathname } = {}) {
    const verb = cleanMethod(method);
    const path = cleanPath(pathname);
    if (path !== '/api/skills') return Object.freeze({ matched: false });
    if (verb !== 'GET') {
      return Object.freeze({
        matched: true,
        ...response(405, { error: 'METHOD_NOT_ALLOWED' }, { Allow: 'GET' })
      });
    }
    return Object.freeze({
      matched: true,
      ...response(200, { skills: list() })
    });
  }

  return Object.freeze({ handle, list });
}
