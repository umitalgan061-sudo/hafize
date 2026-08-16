import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [server, compactor, delegated, boundary] = await Promise.all([
  readFile(new URL('../server.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../lib/context-compaction.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../lib/delegated-agent-runner.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../lib/model-provider-tool-boundary.mjs', import.meta.url), 'utf8')
]);

assert.match(server, /async function handleAgentRun\(req, res\)/);
assert.match(server, /prepareConversation\([\s\S]*?model,[\s\S]*?controller\.signal/);
assert.match(server, /const prepared = await CONTEXT_COMPACTOR\.prepare\(messages, \{ model, signal \}\)/);
assert.match(server, /runDelegatedAgent\([\s\S]*?model,[\s\S]*?complete: \(payload, completionSignal\) => nvidiaJsonCompletion/);

assert.match(compactor, /assertNvidiaToolModel/);
assert.match(compactor, /summarizeOverride == null\) assertNvidiaToolModel\(model\)/);
assert.match(delegated, /checkNvidiaToolModel\(model\)/);
assert.match(delegated, /if \(!providerBoundary\.ok\) return \{ ok: false, error: providerBoundary\.error \}/);
assert.match(boundary, /LOCAL_PROVIDER_TOOLS_UNSUPPORTED/);
assert.match(boundary, /status = 400/);

const guardIndex = delegated.indexOf('checkNvidiaToolModel(model)');
const completionIndex = delegated.indexOf('await complete(firstPayload');
const toolsIndex = delegated.indexOf('executeNvidiaToolCall');
assert.ok(guardIndex >= 0 && completionIndex > guardIndex, 'delegated provider guard must precede completion');
assert.ok(guardIndex >= 0 && toolsIndex >= 0, 'delegated provider guard and tool runtime must both remain wired');

assert.doesNotMatch(boundary, /fetch\s*\(|Authorization|Bearer|process\.env/);
assert.doesNotMatch(compactor, /localStorage|sessionStorage|document\.cookie/);

console.log('local agent provider server wiring tests passed');
