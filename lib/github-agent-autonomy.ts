/**
 * Owner-only standing authorization for reversible GitHub development actions.
 *
 * This permits ONLY the separate-branch/file/draft-PR API bridge; it does not
 * grant shell, secret, workflow, merge, deploy or repository administration.
 * An authenticated owner session and an explicit server configuration flag
 * are both required, not a chat message or model tool argument.
 */
export interface SafeAutonomyRequest {
  readonly optedIn: boolean;
  readonly authenticatedRuntime: boolean;
  readonly principal: { readonly ownerId?: string; readonly sessionId?: string } | null;
  readonly configuredOwnerId: string;
  readonly agentId: string;
  readonly primaryAgentId: string;
}

export function allowSafeGitHubAutonomy(input: SafeAutonomyRequest): boolean {
  if (input.optedIn !== true || input.authenticatedRuntime !== true) return false;
  if (!input.principal || input.agentId !== input.primaryAgentId) return false;
  const ownerId = input.principal.ownerId;
  const sessionId = input.principal.sessionId;
  if (!ownerId || ownerId !== input.configuredOwnerId || ownerId.startsWith('connector:')) return false;
  // The production guard derives a 64-char SHA-256 session identifier only
  // after authenticating a signed session (or bearer connector, excluded above).
  return typeof sessionId === 'string' && /^[a-f0-9]{64}$/.test(sessionId);
}

/** A standing write grant cannot bypass durable task admission. Read-only
 * chat and separately approved non-owner flows retain their existing policy. */
export function durableOwnerAdmission({safeOwner,githubWork,validConversation,validTurn}:{safeOwner:boolean;githubWork:boolean;validConversation:boolean;validTurn:boolean}){
 const durable=safeOwner&&githubWork&&validConversation&&validTurn;
 return {durable,missingIds:safeOwner&&githubWork&&(!validConversation||!validTurn),blockStandingWrites:safeOwner&&!durable};
}
