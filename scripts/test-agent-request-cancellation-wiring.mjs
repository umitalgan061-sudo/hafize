import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
const start = source.indexOf('async function handleAgentRun');
const end = source.indexOf('const server = createServer', start);
assert.ok(start > 0 && end > start, 'agent-run handler remains bounded before server routing');
const agentRun = source.slice(start, end);

assert.match(agentRun, /const controller = new AbortController\(\);/);
assert.match(agentRun, /res\.once\('close', \(\) => controller\.abort\(\)\);/);
assert.match(agentRun, /createAgentDelegator\(\{[\s\S]*?parentSignal: controller\.signal,/);
assert.match(agentRun, /depth: delegatedDepth,/);
assert.match(agentRun, /signal: delegatedSignal/);
assert.match(agentRun, /runDelegatedAgent\(\{[\s\S]*?depth: delegatedDepth,[\s\S]*?signal: delegatedSignal,/);
assert.match(agentRun, /complete: \(payload, completionSignal\) => nvidiaJsonCompletion\(payload, completionSignal \|\| controller\.signal\)/);

const createIndex = agentRun.indexOf('createAgentDelegator({');
const skillIndex = agentRun.indexOf('SKILL_AGENT_RUN.prepare');
assert.ok(createIndex > 0 && skillIndex > createIndex);
assert.doesNotMatch(agentRun, /complete: \(payload\) => nvidiaJsonCompletion\(payload, controller\.signal\)/);

console.log('agent request cancellation wiring tests passed');
