import { describe, expect, it } from 'vitest';
import { allowSafeGitHubAutonomy, durableOwnerAdmission } from './github-agent-autonomy.ts';

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

describe('owner durable admission',()=>{
 it('requires a valid conversation and turn for explicit owner GitHub work',()=>{
  for(const validConversation of [false,true])for(const validTurn of [false,true]){
   const accepted=validConversation&&validTurn;
   expect(durableOwnerAdmission({safeOwner:true,githubWork:true,validConversation,validTurn})).toEqual({durable:accepted,missingIds:!accepted,blockStandingWrites:!accepted});
  }
 });
 it('does not enable standing writes in unrelated owner chat',()=>{
  expect(durableOwnerAdmission({safeOwner:true,githubWork:false,validConversation:true,validTurn:true})).toEqual({durable:false,missingIds:false,blockStandingWrites:true});
 });
 it('does not grant standing rights to non-owner or interactive approval callers',()=>{
  expect(durableOwnerAdmission({safeOwner:false,githubWork:true,validConversation:true,validTurn:true})).toEqual({durable:false,missingIds:false,blockStandingWrites:false});
 });
});
