function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function permissionSets(agent) {
  const policy = agent?.toolPolicy || {};
  return {
    allow: new Set(Array.isArray(policy.allow) ? policy.allow : []),
    approval: new Set(Array.isArray(policy.approvalRequired) ? policy.approvalRequired : [])
  };
}

export function authorizeSkillForAgent(skill, agent) {
  if (!skill || !agent) return { allowed: false, reason: 'invalid_context' };
  const permissions = permissionSets(agent);
  const approvalRequired = [];
  for (const permission of skill.allowedPermissions || []) {
    if (permissions.allow.has(permission)) continue;
    if (permissions.approval.has(permission)) {
      approvalRequired.push(permission);
      continue;
    }
    return { allowed: false, reason: 'tool_escalation', permission };
  }
  if (skill.execution === 'fork' && !permissions.allow.has('agent.delegate')) {
    return { allowed: false, reason: 'delegation_not_allowed' };
  }
  return { allowed: true, reason: 'allowed', approvalRequired: Object.freeze(approvalRequired) };
}

function splitArguments(text) {
  return text.trim() ? text.trim().split(/\s+/) : [];
}

function substitute(prompt, argsText, names) {
  let output = prompt.replaceAll('$ARGUMENTS', argsText);
  const values = splitArguments(argsText);
  for (let index = 0; index < names.length; index += 1) {
    output = output.replaceAll(`$${names[index].toUpperCase()}`, values[index] || '');
  }
  return output;
}

function resolveForkTarget(agentRegistry, agentId) {
  const agents = Array.isArray(agentRegistry?.agents) ? agentRegistry.agents : [];
  const target = agents.find((agent) => agent?.id === agentId) || null;
  if (!target || target.kind !== 'specialist') fail('SKILL_FORK_TARGET_INVALID');
  return target;
}

export function prepareSkillExecution({ skill, agent, argumentsText = '', agentRegistry } = {}) {
  const authorization = authorizeSkillForAgent(skill, agent);
  if (!authorization.allowed) {
    const error = new Error('SKILL_NOT_AUTHORIZED');
    error.code = 'SKILL_NOT_AUTHORIZED';
    error.reason = authorization.reason;
    error.permission = authorization.permission;
    throw error;
  }
  if (typeof argumentsText !== 'string' || argumentsText.length > 4_000 || argumentsText.includes('\0')) {
    fail('SKILL_ARGUMENTS_INVALID');
  }
  const prompt = substitute(skill.prompt, argumentsText.trim(), skill.arguments || []);
  const base = {
    skillId: skill.id,
    mode: skill.execution,
    prompt,
    requestedPermissions: skill.allowedPermissions,
    approvalRequired: authorization.approvalRequired,
    modelHint: skill.model
  };
  if (skill.execution === 'inline') return Object.freeze(base);
  const target = resolveForkTarget(agentRegistry, skill.forkAgentId);
  return Object.freeze({
    ...base,
    fork: Object.freeze({
      agentId: target.id,
      task: prompt,
      constraints: Object.freeze([
        'Skill tool permissions do not override the target agent backend policy.',
        'External writes, sends, and merges still require backend approval.'
      ])
    })
  });
}
