import { describe, expect, it } from 'vitest';
import { allowSafeGitHubAutonomy } from './github-agent-autonomy.ts';

const owner = 'primary-user';
const session = 'f'.repeat(64);
const valid = () => ({
  optedIn: true,
  authenticatedRuntime: true,
  configuredOwnerId: owner,
  primaryAgentId: 'hafize-general',
  agentId: 'hafize-general',
  principal: { ownerId: owner, sessionId: session }
});

describe('preapproved GitHub branch-only development authorization', () => {
  it('requires an explicit server opt-in AND enabled authentication', () => {
    expect(allowSafeGitHubAutonomy(valid())).toBe(true);
    expect(allowSafeGitHubAutonomy({ ...valid(), optedIn: false })).toBe(false);
    expect(allowSafeGitHubAutonomy({ ...valid(), authenticatedRuntime: false })).toBe(false);
  });

  it('never trusts anonymous/connector/different-user or malformed sessions', () => {
    expect(allowSafeGitHubAutonomy({ ...valid(), principal: null })).toBe(false);
    expect(allowSafeGitHubAutonomy({ ...valid(), principal: { ownerId: owner } })).toBe(false);
    expect(allowSafeGitHubAutonomy({ ...valid(), principal: { ownerId: 'connector:' + owner, sessionId: session } })).toBe(false);
    expect(allowSafeGitHubAutonomy({ ...valid(), principal: { ownerId: 'other-user', sessionId: session } })).toBe(false);
    expect(allowSafeGitHubAutonomy({ ...valid(), principal: { ownerId: owner, sessionId: 'not-signed' } })).toBe(false);
  });

  it('allows only the registered primary assistant, not delegated or substituted agents', () => {
    expect(allowSafeGitHubAutonomy({ ...valid(), agentId: 'expert-code' })).toBe(false);
  });
});
