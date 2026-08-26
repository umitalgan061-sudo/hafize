import assert from 'node:assert/strict';
import { SKILL_MANIFEST_LIMITS, SKILL_SOURCE_TRUST, normalizeSkillManifest } from '../lib/skill-manifest.mjs';

const base = {
  id: 'daily-brief',
  name: 'Günlük Özet',
  description: 'Kullanıcının gününü kısa bir özet hâlinde toparlar.',
  triggers: ['Günlük Özet', 'gunun ozeti'],
  allowedTools: ['connector.gmail.read', 'task.read'],
  arguments: [{ name: 'day', required: true, description: 'Özetlenecek gün.' }, { name: 'tone' }],
  model: 'nvidia/llama-3.3-70b-instruct',
  execution: 'inline',
  prompt: 'Kullanıcının gününü maddeler hâlinde özetle.'
};
const reject = (input, source, pattern) => assert.throws(() => normalizeSkillManifest(input, { source }), pattern);

const skill = normalizeSkillManifest(base, { source: 'builtin' });
assert.equal(skill.trust, SKILL_SOURCE_TRUST.builtin);
assert.deepEqual([...skill.triggers], ['günlük özet', 'gunun ozeti']);
assert.deepEqual([...skill.allowedTools], ['connector.gmail.read', 'task.read']);
assert.deepEqual(skill.arguments.map((argument) => argument.required), [true, false]);
assert.equal(skill.arguments[1].description, '');
assert.equal(skill.projectScope, '');
assert.equal(Object.isFrozen(skill), true);
assert.throws(() => skill.allowedTools.push('secret.read'), TypeError);

assert.equal(SKILL_SOURCE_TRUST.builtin > SKILL_SOURCE_TRUST.user, true);
assert.equal(SKILL_SOURCE_TRUST.user > SKILL_SOURCE_TRUST.project, true);
assert.equal(SKILL_MANIFEST_LIMITS.maxTriggers > 0, true);

const minimal = normalizeSkillManifest(
  { id: 'note-it', name: 'Not', description: 'Not alır.', triggers: ['not al'], execution: 'fork', prompt: 'Not al.' },
  { source: 'user' }
);
assert.deepEqual([...minimal.allowedTools], []);
assert.deepEqual([...minimal.arguments], []);
assert.equal(minimal.model, '');
assert.equal(normalizeSkillManifest({ ...base, projectScope: 'hafize/self-dev' }, { source: 'project' }).projectScope, 'hafize/self-dev');

// Şema sertliği: bilinmeyen alan ve geçersiz değer sessizce düzeltilmez.
reject(base, 'plugin', /INVALID_SKILL_MANIFEST:source/);
reject(null, 'user', /INVALID_SKILL_MANIFEST:manifest/);
reject({ ...base, extra: 1 }, 'user', /INVALID_SKILL_MANIFEST:field/);
reject({ ...base, id: 'Bad Id' }, 'user', /INVALID_SKILL_MANIFEST:id/);
reject({ ...base, execution: 'bypass' }, 'user', /INVALID_SKILL_MANIFEST:execution/);
reject({ ...base, triggers: [] }, 'user', /INVALID_SKILL_MANIFEST:triggers/);
reject({ ...base, triggers: ['ozet', ' OZET '] }, 'user', /INVALID_SKILL_MANIFEST:trigger.duplicate/);
reject({ ...base, model: 'nvidia model' }, 'user', /INVALID_SKILL_MANIFEST:model/);

// Project scope zorunlu, diğer kaynaklarda yasak.
reject(base, 'project', /INVALID_SKILL_MANIFEST:projectScope/);
reject({ ...base, projectScope: 'x' }, 'user', /INVALID_SKILL_MANIFEST:projectScope.unexpected/);

// Yetki yükseltme ve secret sızıntısı sınırları.
reject({ ...base, allowedTools: ['secret.read'] }, 'builtin', /SKILL_FORBIDDEN_TOOL:secret.read/);
reject({ ...base, allowedTools: ['repo.delete'] }, 'builtin', /SKILL_FORBIDDEN_TOOL:repo.delete/);
reject({ ...base, arguments: [{ name: 'apiKey' }] }, 'user', /SKILL_SECRET_ARGUMENT:apiKey/);
reject({ ...base, arguments: [{ name: 'day', secret: true }] }, 'user', /INVALID_SKILL_MANIFEST:argument.field/);
reject({ ...base, prompt: 'Anahtar: ${process.env.NVIDIA_API_KEY}' }, 'user', /SKILL_PROMPT_SECRET_INTERPOLATION/);
reject({ ...base, prompt: 'process.env okumasını yap' }, 'user', /SKILL_PROMPT_SECRET_INTERPOLATION/);

console.log('skill manifest tests passed');
