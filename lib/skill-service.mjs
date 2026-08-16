import { applyInlineSkill, executeForkSkill, inspectSkillRequest } from './skill-request-runtime.mjs';

export function createSkillService({ skillRuntime, agentRegistry } = {}) {
  if (!skillRuntime?.registry || typeof skillRuntime.listPublic !== 'function') {
    throw new Error('INVALID_SKILL_SERVICE:runtime');
  }
  if (!agentRegistry || !Array.isArray(agentRegistry.agents)) {
    throw new Error('INVALID_SKILL_SERVICE:agentRegistry');
  }

  function inspect(messages, agent) {
    return inspectSkillRequest({
      messages,
      skillRegistry: skillRuntime.registry,
      agent,
      agentRegistry
    });
  }

  function prepare(messages, agent) {
    const inspection = inspect(messages, agent);
    if (!inspection.active) {
      return Object.freeze({ active: false, messages, inspection });
    }
    if (!inspection.executable) {
      return Object.freeze({ active: true, executable: false, messages, inspection });
    }
    if (inspection.plan.mode === 'inline') {
      return Object.freeze({
        active: true,
        executable: true,
        mode: 'inline',
        skill: inspection.skill,
        messages: applyInlineSkill(messages, inspection),
        inspection
      });
    }
    return Object.freeze({
      active: true,
      executable: true,
      mode: 'fork',
      skill: inspection.skill,
      messages,
      inspection
    });
  }

  async function executeFork(prepared, { delegateAgent } = {}) {
    if (!prepared?.active || !prepared.executable || prepared.mode !== 'fork') {
      throw new Error('SKILL_FORK_PREPARATION_INVALID');
    }
    return executeForkSkill(prepared.inspection, { delegateAgent });
  }

  return Object.freeze({
    listPublic: () => skillRuntime.listPublic(),
    inspect,
    prepare,
    executeFork
  });
}
