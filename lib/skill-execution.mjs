import { applyInlineSkill, resolveSkill } from './skill-runtime.mjs';

function failure(error) {
  return { ok: false, error };
}

export function prepareSkillActivation({ skillRegistry, agent, skillId, systemMessage }) {
  const resolved = resolveSkill(skillRegistry, agent, skillId);
  if (!resolved.ok) return resolved;
  if (!resolved.skill) {
    return { ok: true, mode: 'none', systemMessage, skill: null, approvalRequired: [] };
  }

  const approvalRequired = resolved.permissions
    .filter(({ authorization }) => authorization.reason === 'approval_required')
    .map(({ permission }) => permission);

  if (resolved.skill.context === 'inline') {
    return {
      ok: true,
      mode: 'inline',
      skill: resolved.skill,
      systemMessage: applyInlineSkill(systemMessage, resolved.skill),
      approvalRequired
    };
  }

  return {
    ok: true,
    mode: 'fork',
    skill: resolved.skill,
    systemMessage,
    approvalRequired,
    forkRequest: Object.freeze({
      skillId: resolved.skill.id,
      agentId: agent.id,
      prompt: resolved.skill.prompt,
      requiredPermissions: [...resolved.skill.requiredPermissions],
      approvalRequired
    })
  };
}

export async function executeForkSkill(activation, { forkExecutor, approvalGranted = false } = {}) {
  if (!activation?.ok || activation.mode !== 'fork' || !activation.forkRequest) {
    return failure('INVALID_FORK_ACTIVATION');
  }
  if (activation.approvalRequired.length && !approvalGranted) {
    return failure('SKILL_APPROVAL_REQUIRED');
  }
  if (typeof forkExecutor !== 'function') return failure('FORK_EXECUTOR_UNAVAILABLE');

  try {
    const value = await forkExecutor(activation.forkRequest);
    return { ok: true, value };
  } catch (error) {
    return {
      ok: false,
      error: typeof error?.code === 'string' && error.code ? error.code : 'FORK_EXECUTION_FAILED'
    };
  }
}
