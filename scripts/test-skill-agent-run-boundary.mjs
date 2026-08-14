import assert from 'node:assert/strict';
import { createSkillAgentRunBoundary } from '../lib/skill-agent-run-boundary.mjs';

const agent = { id: 'hafize-general' };
const messages = [{ role: 'user', content: 'hello' }];

const inactiveService = {
  prepare(input) {
    assert.equal(input, messages);
    return { active: false };
  },
  async executeFork() { throw new Error('unused'); }
};
const inactiveBoundary = createSkillAgentRunBoundary({ skillService: inactiveService });
const inactive = await inactiveBoundary.prepare({ messages, agent });
assert.equal(inactive.kind, 'continue');
assert.equal(inactive.messages, messages);
assert.equal(inactive.skill, null);

const blockedService = {
  prepare() {
    return {
      active: true,
      executable: false,
      inspection: {
        skill: { id: 'send', name: 'Send', mode: 'inline', prompt: 'private' },
        approvalRequired: ['external.send']
      }
    };
  },
  async executeFork() { throw new Error('unused'); }
};
const blockedBoundary = createSkillAgentRunBoundary({ skillService: blockedService });
const blocked = await blockedBoundary.prepare({ messages, agent });
assert.equal(blocked.kind, 'blocked');
assert.equal(blocked.status, 409);
assert.equal(blocked.body.error, 'SKILL_APPROVAL_REQUIRED');
assert.deepEqual(blocked.body.skill, { id: 'send', name: 'Send', mode: 'inline' });
assert.deepEqual(blocked.body.approvalRequired, ['external.send']);
assert.equal(JSON.stringify(blocked).includes('private'), false);

const inlineMessages = [{ role: 'user', content: '[Hafize skill: plan]\nplanned' }];
const inlineService = {
  prepare() {
    return {
      active: true,
      executable: true,
      mode: 'inline',
      skill: { id: 'plan', name: 'Plan', mode: 'inline', prompt: 'private' },
      messages: inlineMessages
    };
  },
  async executeFork() { throw new Error('unused'); }
};
const inlineBoundary = createSkillAgentRunBoundary({ skillService: inlineService });
const inline = await inlineBoundary.prepare({ messages, agent });
assert.equal(inline.kind, 'continue');
assert.equal(inline.messages, inlineMessages);
assert.deepEqual(inline.skill, { id: 'plan', name: 'Plan', mode: 'inline' });
assert.equal(JSON.stringify(inline).includes('private'), false);

let delegated = null;
const forkService = {
  prepare() {
    return {
      active: true,
      executable: true,
      mode: 'fork',
      skill: { id: 'review', name: 'Review', mode: 'fork' }
    };
  },
  async executeFork(prepared, options) {
    assert.equal(prepared.mode, 'fork');
    const result = await options.delegateAgent({ agentId: 'agency-code-reviewer', task: 'review' });
    return {
      content: result.value.content,
      agentId: result.value.agentId,
      agentName: result.value.agentName
    };
  }
};
const forkBoundary = createSkillAgentRunBoundary({ skillService: forkService });
const fork = await forkBoundary.prepare({
  messages,
  agent,
  async delegateAgent(input) {
    delegated = input;
    return {
      ok: true,
      value: {
        content: 'reviewed',
        agentId: 'agency-code-reviewer',
        agentName: 'Code Reviewer',
        secret: 'must-not-leak'
      }
    };
  }
});
assert.deepEqual(delegated, { agentId: 'agency-code-reviewer', task: 'review' });
assert.equal(fork.kind, 'complete');
assert.equal(fork.content, 'reviewed');
assert.deepEqual(fork.delegatedAgent, { id: 'agency-code-reviewer', name: 'Code Reviewer' });
assert.equal(JSON.stringify(fork).includes('must-not-leak'), false);

assert.throws(() => createSkillAgentRunBoundary({}), /service/);
await assert.rejects(
  () => inactiveBoundary.prepare({ messages: [], agent }),
  /messages/
);
console.log('skill agent-run boundary tests passed');
