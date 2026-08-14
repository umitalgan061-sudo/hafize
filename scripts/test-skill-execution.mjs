import assert from 'node:assert/strict';
import { loadAgentRegistry, resolveAgent } from '../lib/agent-runtime.mjs';
import { loadSkillRegistry } from '../lib/skill-runtime.mjs';
import { executeForkSkill, prepareSkillActivation } from '../lib/skill-execution.mjs';

const agents = await loadAgentRegistry();
const skills = await loadSkillRegistry(agents);
const engineer = resolveAgent(agents, 'agency-minimal-engineer');
const reviewer = resolveAgent(agents, 'agency-code-reviewer');
const systemMessage = { role: 'system', content: 'base-system' };

const none = prepareSkillActivation({ skillRegistry: skills, agent: reviewer, skillId: '', systemMessage });
assert.equal(none.ok, true);
assert.equal(none.mode, 'none');
assert.equal(none.systemMessage, systemMessage);

const inline = prepareSkillActivation({
  skillRegistry: skills,
  agent: reviewer,
  skillId: 'evidence-code-review',
  systemMessage
});
assert.equal(inline.ok, true);
assert.equal(inline.mode, 'inline');
assert.deepEqual(inline.approvalRequired, []);
assert.match(inline.systemMessage.content, /Evidence Code Review/);
assert.equal(systemMessage.content, 'base-system');

const denied = prepareSkillActivation({
  skillRegistry: skills,
  agent: engineer,
  skillId: 'evidence-code-review',
  systemMessage
});
assert.equal(denied.ok, false);
assert.equal(denied.error, 'SKILL_NOT_ALLOWED_FOR_AGENT');

const forkSkill = Object.freeze({
  ...skills.skills.find((item) => item.id === 'safe-repo-change'),
  context: 'fork'
});
const forkRegistry = Object.freeze({ schemaVersion: 1, skills: Object.freeze([forkSkill]) });
const fork = prepareSkillActivation({
  skillRegistry: forkRegistry,
  agent: engineer,
  skillId: forkSkill.id,
  systemMessage
});
assert.equal(fork.ok, true);
assert.equal(fork.mode, 'fork');
assert.deepEqual(fork.approvalRequired, ['repo.write_branch']);
assert.equal(fork.forkRequest.agentId, engineer.id);
assert.equal(fork.forkRequest.skillId, forkSkill.id);
assert.equal(fork.systemMessage, systemMessage);

let calls = 0;
const withoutApproval = await executeForkSkill(fork, {
  forkExecutor() { calls += 1; return 'unexpected'; }
});
assert.equal(withoutApproval.error, 'SKILL_APPROVAL_REQUIRED');
assert.equal(calls, 0);

const executed = await executeForkSkill(fork, {
  approvalGranted: true,
  async forkExecutor(request) {
    calls += 1;
    assert.equal(request.requiredPermissions.includes('repo.write_branch'), true);
    return { status: 'completed' };
  }
});
assert.equal(executed.ok, true);
assert.deepEqual(executed.value, { status: 'completed' });
assert.equal(calls, 1);
assert.equal((await executeForkSkill(inline, {})).error, 'INVALID_FORK_ACTIVATION');

console.log('skill execution tests passed');
