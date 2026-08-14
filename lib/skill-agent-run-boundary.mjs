function publicSkill(skill) {
  if (!skill || typeof skill !== 'object') return null;
  return Object.freeze({
    id: typeof skill.id === 'string' ? skill.id : '',
    name: typeof skill.name === 'string' ? skill.name : '',
    mode: typeof skill.mode === 'string' ? skill.mode : ''
  });
}

function fail(field) {
  throw new Error(`INVALID_SKILL_AGENT_RUN:${field}`);
}

export function createSkillAgentRunBoundary({ skillService } = {}) {
  if (
    typeof skillService?.prepare !== 'function'
    || typeof skillService?.executeFork !== 'function'
  ) {
    fail('service');
  }

  async function prepare({ messages, agent, delegateAgent } = {}) {
    if (!Array.isArray(messages) || messages.length === 0) fail('messages');
    if (!agent || typeof agent.id !== 'string') fail('agent');

    const prepared = skillService.prepare(messages, agent);
    if (!prepared?.active) {
      return Object.freeze({
        kind: 'continue',
        messages,
        skill: null
      });
    }

    const skill = publicSkill(prepared.skill || prepared.inspection?.skill);
    if (!prepared.executable) {
      const approvals = Array.isArray(prepared.inspection?.approvalRequired)
        ? prepared.inspection.approvalRequired.filter((item) => typeof item === 'string')
        : [];
      return Object.freeze({
        kind: 'blocked',
        status: 409,
        body: Object.freeze({
          error: 'SKILL_APPROVAL_REQUIRED',
          skill,
          approvalRequired: Object.freeze([...approvals])
        })
      });
    }

    if (prepared.mode === 'inline') {
      return Object.freeze({
        kind: 'continue',
        messages: prepared.messages,
        skill
      });
    }

    if (prepared.mode !== 'fork') fail('mode');
    if (typeof delegateAgent !== 'function') fail('delegator');
    const result = await skillService.executeFork(prepared, { delegateAgent });
    return Object.freeze({
      kind: 'complete',
      skill,
      content: typeof result?.content === 'string' ? result.content : '',
      delegatedAgent: Object.freeze({
        id: typeof result?.agentId === 'string' ? result.agentId : '',
        name: typeof result?.agentName === 'string' ? result.agentName : ''
      })
    });
  }

  return Object.freeze({ prepare });
}
