import assert from 'node:assert/strict';
import { createSkillRegistry } from '../lib/skill-registry.mjs';
import { inspectSkillRequest, applyInlineSkill, executeForkSkill } from '../lib/skill-request-runtime.mjs';

const registry = createSkillRegistry({ builtin: [
  {
    id: 'plan', name: 'Plan', description: 'Plan', triggers: ['/plan'], allowedPermissions: [],
    prompt: 'Plan:\n$ARGUMENTS', execution: 'inline', userInvocable: true
  },
  {
    id: 'review', name: 'Review', description: 'Review', triggers: ['/review'],
    allowedPermissions: ['agent.delegate'], prompt: 'Review:\n$ARGUMENTS', execution: 'fork',
    forkAgentId: 'reviewer', userInvocable: true
  },
  {
    id: 'send', name: 'Send', description: 'Send', triggers: ['/send'], allowedPermissions: ['external.send'],
    prompt: 'Send:\n$ARGUMENTS', execution: 'inline', userInvocable: true
  }
] });
const agents = { agents: [{ id: 'reviewer', name: 'Reviewer', kind: 'specialist' }] };
const primary = {
  id: 'hafize',
  toolPolicy: { allow: ['agent.delegate'], approvalRequired: ['external.send'] }
};

assert.equal(inspectSkillRequest({
  messages: [{ role: 'user', content: 'hello' }], skillRegistry: registry, agent: primary, agentRegistry: agents
}).active, false);
assert.equal(inspectSkillRequest({
  messages: [{ role: 'user', content: '/plan x' }, { role: 'assistant', content: 'later' }],
  skillRegistry: registry, agent: primary, agentRegistry: agents
}).active, false);

const inline = inspectSkillRequest({
  messages: [{ role: 'system', content: 'sys' }, { role: 'user', content: '/plan build safely' }],
  skillRegistry: registry, agent: primary, agentRegistry: agents
});
assert.equal(inline.active, true);
assert.equal(inline.executable, true);
assert.equal(inline.skill.mode, 'inline');
const transformed = applyInlineSkill(
  [{ role: 'system', content: 'sys' }, { role: 'user', content: '/plan build safely' }],
  inline
);
assert.equal(transformed[0].role, 'system');
assert.equal(transformed[1].role, 'user');
assert.match(transformed[1].content, /build safely/);

const approval = inspectSkillRequest({
  messages: [{ role: 'user', content: '/send hello' }],
  skillRegistry: registry, agent: primary, agentRegistry: agents
});
assert.equal(approval.executable, false);
assert.deepEqual([...approval.approvalRequired], ['external.send']);

const fork = inspectSkillRequest({
  messages: [{ role: 'user', content: '/review src' }],
  skillRegistry: registry, agent: primary, agentRegistry: agents
});
let calls = 0;
const result = await executeForkSkill(fork, {
  delegateAgent: async (args) => {
    calls += 1;
    assert.equal(args.agentId, 'reviewer');
    assert.match(args.task, /src/);
    return { ok: true, value: { agentId: 'reviewer', agentName: 'Reviewer', content: 'ok' } };
  }
});
assert.equal(calls, 1);
assert.equal(result.content, 'ok');
await assert.rejects(
  () => executeForkSkill(fork, { delegateAgent: async () => ({ ok: false, error: 'secret-detail' }) }),
  /SKILL_FORK_FAILED/
);
console.log('skill request runtime tests passed');
