import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createSkillRegistry,
  listPublicSkills,
  normalizeSkillManifest,
  resolveExplicitSkill
} from '../lib/skill-registry.mjs';
import { authorizeSkillForAgent, prepareSkillExecution } from '../lib/skill-execution.mjs';

const file = JSON.parse(await readFile(new URL('../skills/registry.json', import.meta.url), 'utf8'));
assert.equal(file.schemaVersion, 1);
const registry = createSkillRegistry({ builtin: file.skills });
assert.equal(registry.size, 2);
assert.equal(resolveExplicitSkill(registry, '/plan build it')?.id, 'plan');
assert.equal(resolveExplicitSkill(registry, 'please /plan this'), null);
assert.equal(resolveExplicitSkill(registry, '/unknown'), null);
const publicSkills = listPublicSkills(registry);
assert.equal(publicSkills.length, 2);
assert.equal('prompt' in publicSkills[0], false);
assert.equal('allowedPermissions' in publicSkills[0], false);

const overridden = createSkillRegistry({
  builtin: [file.skills[0]],
  user: [{ ...file.skills[0], name: 'User Plan' }],
  project: [{ ...file.skills[0], name: 'Project Plan' }]
});
assert.equal(overridden.get('plan').name, 'Project Plan');
assert.equal(overridden.get('plan').source, 'project');
assert.throws(() => createSkillRegistry({ builtin: [file.skills[0], file.skills[0]] }), /duplicate:builtin:plan/);
assert.throws(() => normalizeSkillManifest({ ...file.skills[0], unexpected: true }), /unknown:unexpected/);
assert.throws(() => normalizeSkillManifest({ ...file.skills[0], triggers: ['plan'] }), /triggers/);
assert.throws(() => normalizeSkillManifest({ ...file.skills[0], allowedPermissions: ['Secret.Read'] }), /allowedPermissions/);
assert.throws(() => normalizeSkillManifest({ ...file.skills[0], execution: 'fork' }), /forkAgentId/);
assert.throws(() => normalizeSkillManifest({ ...file.skills[0], forkAgentId: 'x' }), /forkAgentId/);

const primary = {
  id: 'hafize-general',
  toolPolicy: {
    allow: ['agent.delegate', 'runtime.status'],
    approvalRequired: ['external.send']
  }
};
const agents = {
  agents: [
    primary,
    { id: 'agency-code-reviewer', kind: 'specialist', toolPolicy: { allow: ['repo.read'] } },
    { id: 'not-specialist', kind: 'primary', toolPolicy: { allow: [] } }
  ]
};

const review = registry.get('review');
assert.deepEqual(authorizeSkillForAgent(review, primary), {
  allowed: true,
  reason: 'allowed',
  approvalRequired: []
});
const forked = prepareSkillExecution({
  skill: review,
  agent: primary,
  argumentsText: 'lib/tool-runtime.mjs',
  agentRegistry: agents
});
assert.equal(forked.mode, 'fork');
assert.equal(forked.fork.agentId, 'agency-code-reviewer');
assert.match(forked.fork.task, /lib\/tool-runtime\.mjs/);
assert.equal(Object.isFrozen(forked.fork), true);

const escalation = normalizeSkillManifest({
  id: 'send', name: 'Send', description: 'x', triggers: ['/send'],
  allowedPermissions: ['external.send'], prompt: '$ARGUMENTS', execution: 'inline'
});
assert.deepEqual(authorizeSkillForAgent(escalation, primary), {
  allowed: true,
  reason: 'allowed',
  approvalRequired: ['external.send']
});
const escalationExecution = prepareSkillExecution({ skill: escalation, agent: primary, argumentsText: 'hello' });
assert.deepEqual(escalationExecution.approvalRequired, ['external.send']);

const forbidden = normalizeSkillManifest({
  id: 'secret', name: 'Secret', description: 'x', triggers: ['/secret'],
  allowedPermissions: ['secret.read'], prompt: 'x', execution: 'inline'
});
assert.equal(authorizeSkillForAgent(forbidden, primary).reason, 'tool_escalation');
assert.throws(() => prepareSkillExecution({ skill: forbidden, agent: primary }), /SKILL_NOT_AUTHORIZED/);

const noDelegate = { id: 'reviewer', toolPolicy: { allow: ['repo.read'], approvalRequired: [] } };
assert.equal(authorizeSkillForAgent(review, noDelegate).reason, 'tool_escalation');
assert.throws(() => prepareSkillExecution({ skill: review, agent: noDelegate, agentRegistry: agents }), /SKILL_NOT_AUTHORIZED/);
assert.throws(() => prepareSkillExecution({
  skill: normalizeSkillManifest({ ...file.skills[1], forkAgentId: 'not-specialist' }),
  agent: primary,
  agentRegistry: agents
}), /SKILL_FORK_TARGET_INVALID/);

const argsSkill = normalizeSkillManifest({
  id: 'args', name: 'Args', description: 'x', triggers: ['/args'], allowedPermissions: [],
  prompt: 'all=$ARGUMENTS first=$TARGET second=$MODE', arguments: ['target', 'mode'], execution: 'inline'
});
const argsResult = prepareSkillExecution({ skill: argsSkill, agent: primary, argumentsText: 'repo strict' });
assert.equal(argsResult.prompt, 'all=repo strict first=repo second=strict');
assert.throws(() => prepareSkillExecution({ skill: argsSkill, agent: primary, argumentsText: '\0' }), /SKILL_ARGUMENTS_INVALID/);
console.log('skill registry and execution tests passed');
