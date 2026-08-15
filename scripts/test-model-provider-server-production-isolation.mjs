import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [server, agentRuntime, toolRuntime] = await Promise.all([
  readFile(new URL('../server.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../lib/agent-runtime.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../lib/tool-runtime.mjs', import.meta.url), 'utf8')
]);

const providerRouteIndex = server.indexOf("url.pathname === '/api/models' || url.pathname === '/api/chat'");
const agentRouteIndex = server.indexOf("url.pathname === '/api/agent/run'");
assert.ok(providerRouteIndex > 0);
assert.ok(agentRouteIndex > providerRouteIndex);

const agentRunStart = server.indexOf('async function handleAgentRun');
const staticStart = server.indexOf('async function serveStatic');
const agentRunSource = server.slice(agentRunStart, staticStart);
assert.match(agentRunSource, /nvidiaJsonCompletion/);
assert.match(agentRunSource, /nvidiaFetch/);
assert.doesNotMatch(agentRunSource, /MODEL_PROVIDER_NODE_SERVER_RUNTIME/);
assert.doesNotMatch(agentRunSource, /localProviderConfigured|HAFIZE_LOCAL_PROVIDER/);

const schedulerStart = server.indexOf('const SCHEDULED_AGENT_EXECUTOR');
const schedulerEnd = server.indexOf('const SCHEDULE_EXECUTION_RUNTIME');
const schedulerSource = server.slice(schedulerStart, schedulerEnd);
assert.match(schedulerSource, /nvidiaConfigured: Boolean\(NVIDIA_API_KEY\)/);
assert.match(schedulerSource, /nvidiaJsonCompletion/);
assert.doesNotMatch(schedulerSource, /MODEL_PROVIDER_NODE_SERVER_RUNTIME|local:/);

const screenStart = server.indexOf('const SCREEN_ANALYSIS_SERVER_RUNTIME');
const mimeStart = server.indexOf('const MIME');
const screenSource = server.slice(screenStart, mimeStart);
assert.match(screenSource, /configured: Boolean\(NVIDIA_API_KEY\)/);
assert.match(screenSource, /complete: nvidiaJsonCompletion/);
assert.doesNotMatch(screenSource, /MODEL_PROVIDER_NODE_SERVER_RUNTIME|local:/);

// Provider choice must never become an authorization primitive.
assert.match(agentRuntime, /default.*deny|default !== 'deny'/i);
assert.match(toolRuntime, /authorizeAgentTool/);
assert.doesNotMatch(toolRuntime, /local:.*approvalGranted|approvalGranted.*local:/s);
assert.doesNotMatch(toolRuntime, /provider.*(?:repo\.write|repo\.merge|external\.send)/i);

// Public health exposes capability booleans/labels only, never endpoint or secret material.
const healthStart = server.indexOf("url.pathname === '/api/health'");
const healthEnd = server.indexOf("url.pathname === '/api/skills'");
const healthSource = server.slice(healthStart, healthEnd);
assert.match(healthSource, /localProviderConfigured/);
assert.match(healthSource, /defaultModelProvider/);
assert.doesNotMatch(healthSource, /HAFIZE_LOCAL_PROVIDER_BASE_URL|NIM_BASE_URL|NVIDIA_API_KEY\s*[,}]/);

console.log('model provider production isolation tests passed');
