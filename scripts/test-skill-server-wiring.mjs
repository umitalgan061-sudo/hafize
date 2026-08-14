import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');

assert.match(source, /loadBuiltinSkillRuntime/);
assert.match(source, /createSkillService/);
assert.match(source, /createSkillHttpApi/);
assert.match(source, /createSkillAgentRunBoundary/);
assert.match(source, /const SKILL_RUNTIME = await loadBuiltinSkillRuntime\(\)/);
assert.match(source, /const SKILL_SERVICE = createSkillService/);
assert.match(source, /const SKILL_AGENT_RUN = createSkillAgentRunBoundary/);
assert.match(source, /url\.pathname === '\/api\/skills'/);
assert.match(source, /SKILL_HTTP_API\.handle\(\{ method: req\.method, pathname: url\.pathname \}\)/);
assert.match(source, /SKILL_AGENT_RUN\.prepare\(\{/);
assert.match(source, /delegateAgent: \(args\) => delegator\.delegate\(args, \{ depth: 0 \}\)/);
assert.match(source, /skillRun\.kind === 'blocked'/);
assert.match(source, /skillRun\.kind === 'complete'/);
assert.match(source, /\[buildAgentSystemMessage\(agent, traceId\), \.\.\.skillRun\.messages\]/);
assert.match(source, /X-Hafize-Skill-Id/);
assert.match(source, /skillsConfigured: SKILL_RUNTIME\.size > 0/);

const chatStart = source.indexOf('async function handleChat');
const chatEnd = source.indexOf('async function serveStatic');
assert.ok(chatStart > 0 && chatEnd > chatStart);
const chatSource = source.slice(chatStart, chatEnd);
assert.doesNotMatch(chatSource, /SKILL_AGENT_RUN|SKILL_SERVICE|delegateAgent/);

const blockedIndex = source.indexOf("skillRun.kind === 'blocked'");
const nvidiaIndex = source.indexOf('const first = await nvidiaJsonCompletion', blockedIndex);
assert.ok(blockedIndex > 0 && nvidiaIndex > blockedIndex);

assert.doesNotMatch(source, /skillRun\.inspection|skillRun\.plan|skillRun\.prompt/);
await import('./test-skill-stack-integration.mjs');
console.log('skill server wiring tests passed');
