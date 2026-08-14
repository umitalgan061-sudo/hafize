import { resolveExplicitSkill } from './skill-registry.mjs';
import { prepareSkillExecution } from './skill-execution.mjs';

function fail(code, detail = null) {
  const error = new Error(code);
  error.code = code;
  if (detail) error.detail = detail;
  throw error;
}

function finalUserMessage(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return null;
  const index = messages.length - 1;
  const message = messages[index];
  if (message?.role !== 'user' || typeof message.content !== 'string') return null;
  return { index, message };
}

function argumentText(content, skill) {
  const text = content.trim();
  const trigger = skill.triggers.find((candidate) => text === candidate || text.startsWith(`${candidate} `));
  if (!trigger) return '';
  return text.slice(trigger.length).trim();
}

export function inspectSkillRequest({ messages, skillRegistry, agent, agentRegistry } = {}) {
  const finalUser = finalUserMessage(messages);
  if (!finalUser) return Object.freeze({ active: false, reason: 'no_final_user_message' });
  const skill = resolveExplicitSkill(skillRegistry, finalUser.message.content);
  if (!skill) return Object.freeze({ active: false, reason: 'no_explicit_skill' });

  const plan = prepareSkillExecution({
    skill,
    agent,
    argumentsText: argumentText(finalUser.message.content, skill),
    agentRegistry
  });
  if (plan.approvalRequired.length) {
    return Object.freeze({
      active: true,
      executable: false,
      skill: Object.freeze({ id: skill.id, name: skill.name, mode: plan.mode }),
      approvalRequired: plan.approvalRequired,
      reason: 'approval_required'
    });
  }
  return Object.freeze({
    active: true,
    executable: true,
    skill: Object.freeze({ id: skill.id, name: skill.name, mode: plan.mode }),
    plan,
    finalUserIndex: finalUser.index
  });
}

export function applyInlineSkill(messages, inspection) {
  if (!inspection?.active || !inspection.executable || inspection.plan?.mode !== 'inline') {
    fail('SKILL_INLINE_PLAN_INVALID');
  }
  if (!Array.isArray(messages) || !Number.isInteger(inspection.finalUserIndex)) {
    fail('SKILL_MESSAGES_INVALID');
  }
  const output = messages.map((message, index) => {
    if (index !== inspection.finalUserIndex) return message;
    return {
      role: 'user',
      content: `[Hafize skill: ${inspection.skill.id}]\n${inspection.plan.prompt}`
    };
  });
  return Object.freeze(output);
}

export async function executeForkSkill(inspection, { delegateAgent } = {}) {
  if (!inspection?.active || !inspection.executable || inspection.plan?.mode !== 'fork' || !inspection.plan.fork) {
    fail('SKILL_FORK_PLAN_INVALID');
  }
  if (typeof delegateAgent !== 'function') fail('SKILL_DELEGATOR_REQUIRED');
  const result = await delegateAgent({
    agentId: inspection.plan.fork.agentId,
    task: inspection.plan.fork.task,
    constraints: inspection.plan.fork.constraints,
    evidenceRequired: ['Return concrete findings and identify test gaps when relevant.']
  });
  if (!result?.ok) fail('SKILL_FORK_FAILED');
  return Object.freeze({
    skill: inspection.skill,
    agentId: result.value?.agentId || inspection.plan.fork.agentId,
    agentName: result.value?.agentName || '',
    content: typeof result.value?.content === 'string' ? result.value.content : ''
  });
}
