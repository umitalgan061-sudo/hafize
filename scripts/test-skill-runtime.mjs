import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadBuiltinSkillRuntime } from '../lib/skill-runtime.mjs';

const runtime = await loadBuiltinSkillRuntime();
assert.equal(runtime.size, 2);
const publicSkills = runtime.listPublic();
assert.equal(publicSkills.some((skill) => skill.id === 'plan'), true);
assert.equal(publicSkills.some((skill) => skill.id === 'review'), true);
assert.equal(JSON.stringify(publicSkills).includes('allowedPermissions'), false);
assert.equal(JSON.stringify(publicSkills).includes('$ARGUMENTS'), false);

const dir = await mkdtemp(join(tmpdir(), 'hafize-skill-'));
const invalidPath = join(dir, 'invalid.json');
await writeFile(invalidPath, JSON.stringify({ schemaVersion: 2, skills: [] }));
await assert.rejects(() => loadBuiltinSkillRuntime(pathToFileURL(invalidPath)), /INVALID_SKILL_REGISTRY:schema/);
console.log('skill runtime tests passed');
