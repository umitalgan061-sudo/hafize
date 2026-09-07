import assert from 'node:assert/strict';
import { createSkillSelector, rankSkills, selectSkill } from '../lib/skill-selector.mjs';

const skills = [
  { name: 'code-inspection', description: 'kod davranışını ve risklerini incele', triggers: ['kod incele', 'code review'] },
  { name: 'runtime-diagnostics', description: 'runtime durumunu teşhis et', triggers: ['sistem kontrol', 'runtime kontrol'] },
  { name: 'delegation-plan', description: 'işi alt görevlere ayır', triggers: ['delege et', 'alt görevlere ayır'] }
];

assert.equal(selectSkill(skills, 'kod incele').name, 'code-inspection');
assert.equal(selectSkill(skills, 'runtime durumunu kontrol et').name, 'runtime-diagnostics');
assert.equal(selectSkill(skills, 'bilinmeyen konu', { minScore: 0.2 }), null);
const ranked = rankSkills(skills, 'kod incele');
assert.equal(ranked[0].name, 'code-inspection');
assert.ok(ranked[0].score > ranked[1].score);
const selector = createSkillSelector(skills);
assert.equal(selector.size, 3);
assert.equal(selector.select('delege et').name, 'delegation-plan');
assert.equal(selector.rank('runtime kontrol')[0].name, 'runtime-diagnostics');
assert.throws(() => selectSkill(null, 'x'), /INVALID_SKILL_SELECTION_CATALOG/);

console.log('skill selector tests passed');
