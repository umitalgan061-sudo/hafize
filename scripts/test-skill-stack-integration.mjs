import assert from 'node:assert/strict';
import { createSkillRegistry } from '../lib/skill-registry.mjs';
import { createSkillService } from '../lib/skill-service.mjs';
import { createSkillAgentRunBoundary } from '../lib/skill-agent-run-boundary.mjs';

const agentRegistry = {
  agents: [
    {
      id: 'hafize-general',
      kind: 'primary',
      toolPolicy: {
        default: 'deny',
        allow: ['agent.delegate'],
        approvalRequired: ['external.send']
      }
    },
    {
      id: 'agency-code-reviewer',
      kind: 'specialist',
      toolPolicy: { default: 'deny', allow: [], deny: ['external.send'] }
    }
  ]
};
const agent = agentRegistry.agents[0];
const registry = createSkillRegistry({
  builtin: [
    {
      id: 'plan',
      name: 'Plan',
      description: 'Plan request',
      triggers: ['/plan'],
      allowedPermissions: [],
      prompt: 'Plan this:\n$ARGUMENTS',
      execution: 'inline',
      arguments: [],
      userInvocable: true
    },
    {
      id: 'review',
      name: 'Review',
      description: 'Review request',
      triggers: ['/review'],
      allowedPermissions: ['agent.delegate'],
      prompt: 'Review this:\n$ARGUMENTS',
      execution: 'fork',
      forkAgentId: 'agency-code-reviewer',
      arguments: [],
      userInvocable: true
    }
  ]
});
const skillRuntime = {
  registry,
  listPublic() {
    return [...registry.values()].map((skill) => ({
      id: skill.id,
      name: skill.name,
      description: skill.description,
      triggers: [...skill.triggers],
      execution: skill.execution,
      source: skill.source
    }));
  }
};
const service = createSkillService({ skillRuntime, agentRegistry });
const boundary = createSkillAgentRunBoundary({ skillService: service });

const planned = await boundary.prepare({
  messages: [{ role: 'user', content: '/plan ship safely' }],
  agent
});
assert.equal(planned.kind, 'continue');
assert.equal(planned.skill.id, 'plan');
assert.equal(planned.messages[0].role, 'user');
assert.match(planned.messages[0].content, /Plan this:\nship safely/);
assert.doesNotMatch(planned.messages[0].content, /role.?system/i);

let delegated = null;
const reviewed = await boundary.prepare({
  messages: [{ role: 'user', content: '/review lib/tool-runtime.mjs' }],
  agent,
  async delegateAgent(input) {
    delegated = input;
    return {
      ok: true,
      value: {
        agentId: 'agency-code-reviewer',
        agentName: 'Code Reviewer',
        content: 'No blocker found.',
        internal: 'do-not-leak'
      }
    };
  }
});
assert.equal(reviewed.kind, 'complete');
assert.equal(reviewed.skill.id, 'review');
assert.equal(reviewed.delegatedAgent.id, 'agency-code-reviewer');
assert.equal(reviewed.content, 'No blocker found.');
assert.equal(JSON.stringify(reviewed).includes('do-not-leak'), false);
assert.equal(delegated.agentId, 'agency-code-reviewer');
assert.match(delegated.task, /Review this:\nlib\/tool-runtime\.mjs/);

const normal = await boundary.prepare({
  messages: [{ role: 'user', content: 'normal chat' }],
  agent
});
assert.equal(normal.kind, 'continue');
assert.equal(normal.skill, null);
assert.deepEqual(normal.messages, [{ role: 'user', content: 'normal chat' }]);

console.log('skill stack integration tests passed');
