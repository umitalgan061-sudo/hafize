import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const server = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
const registry = JSON.parse(await readFile(new URL('../agents/registry.json', import.meta.url), 'utf8'));

assert.match(server, /import \{ createGmailAgentRuntime \} from '\.\/lib\/gmail-agent-runtime\.mjs';/);
assert.match(server, /const GMAIL_AGENT_RUNTIME = createGmailAgentRuntime\(\);/);
assert.match(server, /gmailReadConfigured: GMAIL_AGENT_RUNTIME\.configured/);
assert.match(server, /url\.pathname === '\/api\/connectors\/gmail\/status'/);
assert.match(server, /GMAIL_AGENT_RUNTIME\.connectionStatus\(\{ headers: req\.headers \}\)/);

const agentRunStart = server.indexOf('async function handleAgentRun');
const staticStart = server.indexOf('async function serveStatic');
assert.ok(agentRunStart >= 0 && staticStart > agentRunStart);
const agentRun = server.slice(agentRunStart, staticStart);
assert.match(agentRun, /GMAIL_AGENT_RUNTIME\.requestContext\(\{ headers: req\.headers \}\)/);
assert.equal((agentRun.match(/\.\.\.connectorContext/g) || []).length, 2);
assert.equal(agentRun.includes('HAFIZE_CONNECTOR_AUTH_TOKEN'), false);
assert.equal(agentRun.includes('HAFIZE_CONNECTOR_OWNER_KEY_B64'), false);

const providerRouteStart = server.indexOf("url.pathname === '/api/models' || url.pathname === '/api/chat'");
const agentsRouteStart = server.indexOf("url.pathname === '/api/agents'");
assert.ok(providerRouteStart >= 0 && agentsRouteStart > providerRouteStart);
const providerRoute = server.slice(providerRouteStart, agentsRouteStart);
assert.match(providerRoute, /MODEL_PROVIDER_NODE_SERVER_RUNTIME\.handle\(/);
assert.equal(providerRoute.includes('connectorContext'), false);
assert.equal(providerRoute.includes('GMAIL_AGENT_RUNTIME'), false);

const statusRoute = server.slice(server.indexOf("'/api/connectors/gmail/status'"), server.indexOf("'/api/schedules'"));
assert.match(statusRoute, /sendJson\(res, 200, \{ linked: status\.linked \}\)/);
assert.equal(statusRoute.includes('ownerId'), false);
assert.equal(statusRoute.includes('accessToken'), false);
assert.equal(statusRoute.includes('refreshToken'), false);

const primary = registry.agents.find((agent) => agent.id === registry.defaultAgent);
assert.equal(primary?.id, 'minimal-engineer');
assert.ok(primary?.toolPolicy?.allow.includes('connector.gmail.read'));
for (const agent of registry.agents.filter((item) => item.id !== registry.defaultAgent)) {
  assert.equal(agent.toolPolicy?.allow?.includes('connector.gmail.read') || false, false);
}

console.log('gmail server wiring tests passed');