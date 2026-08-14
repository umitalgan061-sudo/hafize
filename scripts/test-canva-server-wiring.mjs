import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const server = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
const registry = JSON.parse(await readFile(new URL('../agents/registry.json', import.meta.url), 'utf8'));

assert.match(server, /import \{ createCanvaAgentRuntime \} from '\.\/lib\/canva-agent-runtime\.mjs';/);
assert.match(server, /const CANVA_AGENT_RUNTIME = createCanvaAgentRuntime\(\);/);
assert.match(server, /CANVA_AGENT_RUNTIME\.requestContext\(\{ headers: req\.headers \}\)/);
assert.match(server, /canvaReadConfigured: CANVA_AGENT_RUNTIME\.configured/);

const agentRunStart = server.indexOf('async function handleAgentRun');
const chatStart = server.indexOf('async function handleChat');
assert.ok(agentRunStart >= 0 && chatStart > agentRunStart);
const agentRun = server.slice(agentRunStart, chatStart);
const chat = server.slice(chatStart, server.indexOf('async function serveStatic'));
assert.equal((agentRun.match(/\.\.\.connectorContext/g) || []).length, 2);
assert.equal(chat.includes('connectorContext'), false);
assert.equal(agentRun.includes('HAFIZE_CONNECTOR_AUTH_TOKEN'), false);
assert.equal(agentRun.includes('HAFIZE_CONNECTOR_OWNER_KEY_B64'), false);

const statusStart = server.indexOf("url.pathname === '/api/connectors/canva/status'");
const schedulesStart = server.indexOf("url.pathname === '/api/schedules'");
assert.ok(statusStart >= 0 && schedulesStart > statusStart);
const statusRoute = server.slice(statusStart, schedulesStart);
assert.match(statusRoute, /CANVA_AGENT_RUNTIME\.connectionStatus\(\{ headers: req\.headers \}\)/);
assert.match(statusRoute, /sendJson\(res, 200, \{ linked: status\.linked \}\)/);
for (const forbidden of ['ownerId', 'accessToken', 'refreshToken', 'subject']) assert.equal(statusRoute.includes(forbidden), false);

const primary = registry.agents.find((agent) => agent.id === 'hafize-general');
assert.ok(primary?.toolPolicy?.allow.includes('connector.canva.read'));
for (const agent of registry.agents.filter((item) => item.id !== 'hafize-general')) {
  assert.equal(agent.toolPolicy?.allow?.includes('connector.canva.read') || false, false);
}

console.log('canva server wiring tests passed');
