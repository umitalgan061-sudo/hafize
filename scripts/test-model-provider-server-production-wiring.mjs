import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const server = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');

assert.match(server, /createModelProviderNodeServerRuntime/);
assert.match(server, /const MODEL_PROVIDER_NODE_SERVER_RUNTIME = createModelProviderNodeServerRuntime\(\{/);
assert.match(server, /registry: AGENT_REGISTRY/);
assert.match(server, /baseCompactor: CONTEXT_COMPACTOR/);
assert.match(server, /readJson,/);
assert.match(server, /sendJson,/);
assert.match(server, /setSecurityHeaders/);

assert.match(server, /localProviderConfigured: MODEL_PROVIDER_NODE_SERVER_RUNTIME\.localConfigured/);
assert.match(server, /defaultModelProvider: MODEL_PROVIDER_NODE_SERVER_RUNTIME\.defaultProvider/);
assert.match(server, /contextCompactionConfigured: MODEL_PROVIDER_NODE_SERVER_RUNTIME\.contextCompactionConfigured/);

assert.match(
  server,
  /MODEL_PROVIDER_NODE_SERVER_RUNTIME\.handle\(\{\s*request: req,\s*response: res,\s*method: req\.method,\s*pathname: url\.pathname,\s*headers: req\.headers\s*\}\)/s
);
assert.doesNotMatch(server, /await handleModels\(res\)/);
assert.doesNotMatch(server, /await handleChat\(req, res\)/);

// Provider selection must not silently widen tool-enabled agent execution.
assert.match(server, /async function handleAgentRun\(req, res\)/);
assert.match(server, /complete: \(payload, completionSignal\) => nvidiaJsonCompletion/);
assert.match(server, /const first = await nvidiaJsonCompletion\(firstPayload/);
assert.match(server, /nvidiaFetch\('\/chat\/completions'/);

// Scheduler and screen analysis deliberately remain NVIDIA-backed.
assert.match(server, /const SCREEN_ANALYSIS_SERVER_RUNTIME = createScreenAnalysisServerRuntime\(\{[\s\S]*complete: nvidiaJsonCompletion/);
assert.match(server, /const SCHEDULED_AGENT_EXECUTOR = createScheduledAgentExecutor\(\{[\s\S]*nvidiaConfigured: Boolean\(NVIDIA_API_KEY\)/);
assert.match(server, /return await nvidiaJsonCompletion\(payload, controller\.signal\)/);

// The local provider is configured only by the server-side runtime/env contract.
assert.doesNotMatch(server, /HAFIZE_LOCAL_PROVIDER_(?:ENABLED|BASE_URL).*public\//);
assert.doesNotMatch(server, /localProvider.*(?:apiKey|token|secret)/i);

console.log('model provider production server wiring tests passed');
