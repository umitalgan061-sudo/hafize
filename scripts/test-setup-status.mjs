import assert from 'node:assert/strict';
import { buildSetupStatus, formatFatalSetupError, formatSetupStatus, SETUP_VARIABLES } from '../lib/setup-status.mjs';

function groupOf(status, id) {
  const group = status.groups.find((entry) => entry.id === id);
  assert.ok(group, `missing group: ${id}`);
  return group;
}

// An empty environment is a valid state: everything optional is simply off.
const empty = buildSetupStatus({ env: {} });
assert.equal(empty.ready, false);
assert.equal(empty.fatal.length, 0);
assert.equal(empty.incomplete.length, 0);
assert.equal(groupOf(empty, 'chat').state, 'off');
assert.deepEqual(groupOf(empty, 'chat').missing, ['NVIDIA_API_KEY']);

// A key alone is enough to hold a conversation.
const chatOnly = buildSetupStatus({ env: { NVIDIA_API_KEY: 'nvapi-test' } });
assert.equal(chatOnly.ready, true);
assert.equal(groupOf(chatOnly, 'chat').state, 'ready');
assert.equal(chatOnly.fatal.length, 0);

// Whitespace is not configuration.
assert.equal(buildSetupStatus({ env: { NVIDIA_API_KEY: '   ' } }).ready, false);
assert.equal(buildSetupStatus({ env: { NVIDIA_API_KEY: '' } }).ready, false);

// A half-configured GitHub group is silently disabled, not fatal: the tool is
// withheld from agents but the server still serves chat.
const partialGithub = buildSetupStatus({ env: { NVIDIA_API_KEY: 'k', GITHUB_TOKEN: 't' } });
const github = groupOf(partialGithub, 'github');
assert.equal(github.state, 'incomplete');
assert.equal(github.fatal, false);
assert.deepEqual(github.missing, ['HAFIZE_GITHUB_READ_REPOS']);
assert.equal(partialGithub.fatal.length, 0);
assert.equal(partialGithub.incomplete.length, 1);
assert.equal(partialGithub.ready, true);

// A half-configured connector group aborts startup, so it must be flagged fatal.
const partialConnector = buildSetupStatus({
  env: { NVIDIA_API_KEY: 'k', HAFIZE_CONNECTOR_AUTH_TOKEN: 't', HAFIZE_CONNECTOR_AUTH_SUBJECT: 'owner' }
});
const connectors = groupOf(partialConnector, 'connectors');
assert.equal(connectors.state, 'incomplete');
assert.equal(connectors.fatal, true);
assert.deepEqual(connectors.missing, [
  'HAFIZE_CONNECTOR_OWNER_KEY_B64',
  'HAFIZE_OAUTH_TOKEN_STORAGE_DIR',
  'HAFIZE_OAUTH_TOKEN_KEY_B64'
]);
assert.equal(partialConnector.fatal.length, 1);

// Every group the server can abort on must be reachable through `fatal` when
// only one of its variables is set.
const FATAL_GROUP_PROBE = {
  connectors: 'HAFIZE_CONNECTOR_AUTH_TOKEN',
  scheduleApi: 'HAFIZE_SCHEDULE_AUTH_TOKEN',
  scheduleStorage: 'HAFIZE_SCHEDULE_STORAGE_FILE',
  memory: 'HAFIZE_MEMORY_STORAGE_DIR'
};
for (const [id, variable] of Object.entries(FATAL_GROUP_PROBE)) {
  const status = buildSetupStatus({ env: { NVIDIA_API_KEY: 'k', [variable]: 'set' } });
  assert.equal(groupOf(status, id).fatal, true, `${id} should be fatal when partial`);
  assert.equal(status.fatal.length, 1, `${id} should surface in fatal`);
}

const fullConnector = buildSetupStatus({
  env: {
    NVIDIA_API_KEY: 'k',
    HAFIZE_CONNECTOR_AUTH_TOKEN: 't',
    HAFIZE_CONNECTOR_AUTH_SUBJECT: 'owner',
    HAFIZE_CONNECTOR_OWNER_KEY_B64: 'key',
    HAFIZE_OAUTH_TOKEN_STORAGE_DIR: '/tmp/tokens',
    HAFIZE_OAUTH_TOKEN_KEY_B64: 'key'
  }
});
assert.equal(groupOf(fullConnector, 'connectors').state, 'ready');
assert.equal(fullConnector.fatal.length, 0);

// Secret values must never reach the rendered report — only variable names.
const secretEnv = {
  NVIDIA_API_KEY: 'nvapi-SUPER-SECRET-VALUE',
  GITHUB_TOKEN: 'github_pat_SUPER_SECRET',
  HAFIZE_CONNECTOR_AUTH_TOKEN: 'CONNECTOR_SECRET',
  HAFIZE_MEMORY_KEY_B64: 'MEMORY_SECRET'
};
const secretStatus = buildSetupStatus({ env: secretEnv });
const rendered = `${JSON.stringify(secretStatus)}\n${formatSetupStatus(secretStatus)}\n${formatFatalSetupError(secretStatus)}`;
for (const value of Object.values(secretEnv)) {
  assert.equal(rendered.includes(value), false, `setup report leaked ${value}`);
}
// Names of the variables still missing are exactly what the operator needs.
assert.equal(rendered.includes('HAFIZE_GITHUB_READ_REPOS'), true);
assert.equal(rendered.includes('HAFIZE_CONNECTOR_AUTH_SUBJECT'), true);

// The unconfigured summary must point at the setup docs, not just report a state.
const emptyText = formatSetupStatus(empty);
assert.match(emptyText, /NVIDIA_API_KEY tanımlı değil/);
assert.match(emptyText, /docs\/KURULUM\.md/);
assert.match(emptyText, /\.env\.example/);
assert.equal(formatSetupStatus(chatOnly).includes('Sohbet kapalı'), false);

const fatalText = formatFatalSetupError(partialConnector);
assert.match(fatalText, /Hafize başlatılamadı/);
assert.match(fatalText, /HAFIZE_OAUTH_TOKEN_KEY_B64/);
assert.match(fatalText, /docs\/KURULUM\.md/);

assert.throws(() => buildSetupStatus({ env: null }), /INVALID_SETUP_STATUS:env/);
assert.throws(() => buildSetupStatus({ env: [] }), /INVALID_SETUP_STATUS:env/);
assert.throws(() => formatSetupStatus(null), /INVALID_SETUP_STATUS:status/);
assert.doesNotThrow(() => buildSetupStatus(null), 'null options must fall back to process.env');

// .env.example is the operator-facing list, so it must stay in sync with the code.
const example = await import('node:fs/promises').then((fs) => fs.readFile(new URL('../.env.example', import.meta.url), 'utf8'));
for (const name of SETUP_VARIABLES) {
  assert.match(example, new RegExp(`^${name}=`, 'm'), `.env.example is missing ${name}`);
}

console.log('setup status tests passed');
