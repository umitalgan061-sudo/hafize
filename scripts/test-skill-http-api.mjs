import assert from 'node:assert/strict';
import { createSkillHttpApi } from '../lib/skill-http-api.mjs';

const publicSkills = [
  {
    id: 'plan',
    name: 'Plan',
    description: 'Plan üretir',
    triggers: ['/plan'],
    execution: 'inline',
    source: 'builtin'
  },
  {
    id: 'review',
    name: 'Review',
    description: 'Salt-okunur inceleme başlatır',
    triggers: ['/review'],
    execution: 'fork',
    source: 'builtin'
  }
];
const api = createSkillHttpApi({
  skillRuntime: { listPublic: () => publicSkills }
});

const listed = api.list();
assert.equal(listed.length, 2);
assert.equal(listed[0].id, 'plan');
assert.deepEqual([...listed[1].triggers], ['/review']);
assert.equal(Object.prototype.hasOwnProperty.call(listed[0], 'prompt'), false);
assert.equal(Object.prototype.hasOwnProperty.call(listed[0], 'allowedPermissions'), false);
assert.equal(Object.prototype.hasOwnProperty.call(listed[0], 'model'), false);
assert.equal(Object.prototype.hasOwnProperty.call(listed[0], 'forkAgentId'), false);

const getResult = await api.handle({ method: 'get', pathname: '/api/skills' });
assert.equal(getResult.matched, true);
assert.equal(getResult.status, 200);
assert.equal(getResult.headers['Cache-Control'], 'no-store');
assert.equal(getResult.body.skills.length, 2);
assert.equal(JSON.stringify(getResult.body).includes('allowedPermissions'), false);
assert.equal(JSON.stringify(getResult.body).includes('prompt'), false);

const postResult = await api.handle({ method: 'POST', pathname: '/api/skills' });
assert.equal(postResult.matched, true);
assert.equal(postResult.status, 405);
assert.equal(postResult.headers.Allow, 'GET');
assert.equal(postResult.body.error, 'METHOD_NOT_ALLOWED');

const miss = await api.handle({ method: 'GET', pathname: '/api/agents' });
assert.deepEqual(miss, { matched: false });

const privateFieldApi = createSkillHttpApi({
  skillRuntime: {
    listPublic: () => [{
      ...publicSkills[0],
      prompt: 'must not leak'
    }]
  }
});
assert.throws(() => privateFieldApi.list(), /private_field:prompt/);
await assert.rejects(
  () => privateFieldApi.handle({ method: 'GET', pathname: '/api/skills' }),
  /private_field:prompt/
);
assert.throws(() => createSkillHttpApi({}), /INVALID_SKILL_HTTP_API:runtime/);
assert.throws(() => createSkillHttpApi({ skillRuntime: { listPublic: () => null } }).list(), /INVALID_SKILL_HTTP_API:list/);
console.log('skill http api tests passed');
