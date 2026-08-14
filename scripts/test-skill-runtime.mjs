import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadAgentRegistry, resolveAgent } from '../lib/agent-runtime.mjs';
import {
  applyInlineSkill,
  listPublicSkills,
  loadSkillRegistry,
  resolveSkill
} from '../lib/skill-runtime.mjs';

const agents = await loadAgentRegistry();
const skills = await loadSkillRegistry(agents);
assert.equal(skills.schemaVersion, 1);
assert.equal(skills.skills.length, 2);

const engineer = resolveAgent(agents, 'agency-minimal-engineer');
const reviewer = resolveAgent(agents, 'agency-code-reviewer');
const general = resolveAgent(agents, 'hafize-general');

const engineerSkills = listPublicSkills(skills, engineer.id);
assert.deepEqual(engineerSkills.map((item) => item.id), ['safe-repo-change']);
assert.deepEqual(engineerSkills[0].approvalRequired, ['repo.write_branch']);
assert.equal('prompt' in engineerSkills[0], false);
assert.deepEqual(listPublicSkills(skills, reviewer.id).map((item) => item.id), ['evidence-code-review']);
assert.equal(listPublicSkills(skills, general.id).length, 0);

const resolved = resolveSkill(skills, engineer, 'safe-repo-change');
assert.equal(resolved.ok, true);
assert.equal(resolved.skill.id, 'safe-repo-change');
assert.equal(
  resolved.permissions.find((item) => item.permission === 'repo.write_branch').authorization.reason,
  'approval_required'
);
assert.deepEqual(resolveSkill(skills, engineer, ''), { ok: true, skill: null });
assert.equal(resolveSkill(skills, general, 'safe-repo-change').error, 'SKILL_NOT_ALLOWED_FOR_AGENT');
assert.equal(resolveSkill(skills, engineer, '../secret').error, 'INVALID_SKILL');

const baseSystem = { role: 'system', content: 'base-system' };
const applied = applyInlineSkill(baseSystem, resolved.skill);
assert.equal(baseSystem.content, 'base-system');
assert.match(applied.content, /Aktif prosedür: Safe Repo Change/);
assert.match(applied.content, /backend izinleri değişmez/);
assert.throws(
  () => applyInlineSkill(baseSystem, { ...resolved.skill, context: 'fork' }),
  /SKILL_REQUIRES_FORK/
);

async function expectInvalid(payload, pattern) {
  const dir = await mkdtemp(join(tmpdir(), 'hafize-skill-'));
  const file = join(dir, 'registry.json');
  await writeFile(file, JSON.stringify(payload), 'utf8');
  await assert.rejects(() => loadSkillRegistry(agents, pathToFileURL(file)), pattern);
}

const valid = {
  schemaVersion: 1,
  skills: [{
    id: 'sample-skill',
    name: 'Sample',
    description: 'Sample skill',
    context: 'inline',
    userInvocable: true,
    allowedAgents: ['agency-code-reviewer'],
    requiredPermissions: ['repo.read'],
    prompt: 'Review evidence.'
  }]
};

await expectInvalid({ ...valid, schemaVersion: 2 }, /schemaVersion/);
await expectInvalid({
  ...valid,
  skills: [{ ...valid.skills[0], allowedAgents: ['missing-agent'] }]
}, /unknownAgent/);
await expectInvalid({
  ...valid,
  skills: [{ ...valid.skills[0], requiredPermissions: ['repo.write_branch'] }]
}, /permissionMismatch/);
await expectInvalid({
  ...valid,
  skills: [{ ...valid.skills[0], requiredPermissions: ['secret.read'] }]
}, /forbiddenPermission/);
await expectInvalid({
  ...valid,
  skills: [valid.skills[0], valid.skills[0]]
}, /skill.id:sample-skill/);
await expectInvalid({
  ...valid,
  skills: [{ ...valid.skills[0], context: 'background' }]
}, /context/);

console.log('skill runtime tests passed');
