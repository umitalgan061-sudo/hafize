import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadAgentRegistry } from '../lib/agent-runtime.mjs';

const registry = await loadAgentRegistry();
const directory = await mkdtemp(join(tmpdir(), 'hafize-roster-topology-'));

async function reject(label, mutate, expected) {
  const fixture = JSON.parse(JSON.stringify(registry));
  mutate(fixture);
  const path = join(directory, `${label}.json`);
  await writeFile(path, JSON.stringify(fixture), 'utf8');
  await assert.rejects(() => loadAgentRegistry(path), new RegExp(expected));
}

try {
  await reject(
    'selector-without-delegation',
    (fixture) => {
      fixture.agents.find((agent) => agent.id === 'movie-coordinator').toolPolicy.allow = ['runtime.status'];
    },
    'INVALID_AGENT_REGISTRY:roster.selectorDelegation:movie-coordinator'
  );
  await reject(
    'specialist-with-delegation',
    (fixture) => {
      fixture.agents.find((agent) => agent.id === 'handyman-advisor').toolPolicy.allow.push('agent.delegate');
    },
    'INVALID_AGENT_REGISTRY:roster.specialistDelegation:handyman-advisor'
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}

console.log('agent roster fail-closed topology tests passed');
