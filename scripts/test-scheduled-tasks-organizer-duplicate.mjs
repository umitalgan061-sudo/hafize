import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/scheduled-tasks-organizer.js', 'utf8');

assert.match(source, /async function duplicate\(scheduleId\)/);
assert.match(source, /root\.confirm\?\./);
assert.match(source, /apiRequest\('\/api\/schedules'\)/);
assert.match(source, /method: 'POST'/);
assert.match(source, /const target = Date\.parse\(source\.runAt/);
assert.match(source, /Date\.now\(\) \+ 300_000/);
assert.match(source, /maxAttempts: Math\.min\(5, Math\.max\(1/);
assert.match(source, /agentId: clamp\(source\.agentId, MAX_AGENT\)/);
assert.match(source, /task: clamp\(source\.task, 20_000\)/);
assert.match(source, /SCHEDULE_NOT_FOUND/);
assert.match(source, /error\.status === 401/);
assert.match(source, /Görev kopyası planlandı/);
assert.doesNotMatch(source, /fetch\([^)]*https?:\/\//i);
console.log('scheduled-task organizer duplicate: ok');
