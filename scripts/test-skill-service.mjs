import assert from 'node:assert/strict';
import { createSkillRegistry } from '../lib/skill-registry.mjs';
import { createSkillService } from '../lib/skill-service.mjs';

const registry = createSkillRegistry({ builtin: [
  {
    id: 'plan', name: 'Plan', description: 'Plan', triggers: ['/plan'], allowedPermissions: [],
    prompt: 'Plan:\n$ARGUMENTS', execution: 'inline', userInvocable: true
  },
  {
    id: 'review', name: 'Review', description: 'Review', triggers: ['/review'],
    allowedPermissions: ['agent.delegate'], prompt: 'Review:\n$ARGUMENTS', execution: 'fork',
    forkAgentId: 'reviewer', userInvocable: true
  }
] });
const runtime = {
  registry,
  listPublic: () => registry.list().map(({ id, name, description, triggers, execution, source }) => ({
    id, name, description, triggers, execution, source
  }))
};
const agentRegistry = { agents: [{ id: 'reviewer', name: 'Reviewer', kind: 'specialist' }] };
const primary = { id: 'hafize', toolPolicy: { allow: ['agent.delegate'], approvalRequired: [] } };
const service = createSkillService({ skillRuntime: runtime, agentRegistry });

assert.equal(service.listPublic().length, 2);
const inactiveMessages = [{ role: 'user', content: 'hello' }];
const inactive = service.prepare(inactiveMessages, primary);
assert.equal(inactive.active, false);
assert.equal(inactive.messages, inactiveMessages);

const inline = service.prepare([{ role: 'user', content: '/plan release safely' }], primary);
assert.equal(inline.active, true);
assert.equal(inline.executable, true);
assert.equal(inline.mode, 'inline');
assert.equal(inline.messages[0].role, 'user');
assert.match(inline.messages[0].content, /release safely/);

const fork = service.prepare([{ role: 'user', content: '/review src' }], primary);
assert.equal(fork.mode, 'fork');
let calls = 0;
const forkResult = await service.executeFork(fork, {
  delegateAgent: async (args) => {
    calls += 1;
    assert.equal(args.agentId, 'reviewer');
    return { ok: true, value: { agentId: 'reviewer', agentName: 'Reviewer', content: 'reviewed' } };
  }
});
assert.equal(calls, 1);
assert.equal(forkResult.content, 'reviewed');
await assert.rejects(() => service.executeFork(inline, { delegateAgent: async () => ({ ok: true }) }), /SKILL_FORK_PREPARATION_INVALID/);
assert.throws(() => createSkillService({}), /INVALID_SKILL_SERVICE:runtime/);
assert.throws(() => createSkillService({ skillRuntime: runtime }), /INVALID_SKILL_SERVICE:agentRegistry/);
console.log('skill service tests passed');
