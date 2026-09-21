export interface RuntimePrincipal {
  readonly authenticated: true;
  readonly subject: string;
}

export interface AuthResult {
  readonly ok: boolean;
  readonly principal?: RuntimePrincipal;
}

export interface RuntimeAuthenticator {
  authenticate(input: { readonly headers?: unknown }): AuthResult;
}

export interface RuntimeOwnership {
  readonly ownerId: string;
}

export interface RuntimeOwnerResolver {
  resolve(principal: RuntimePrincipal): RuntimeOwnership | null;
}

export interface RuntimeTokenRecord {
  readonly [key: string]: unknown;
}

export interface RuntimeTokenStore {
  load(input: { readonly ownerId: string; readonly provider: string }): Promise<RuntimeTokenRecord | null>;
}

export interface RuntimeReadBoundary {
  execute(args: Record<string, unknown>, context: { readonly principal: RuntimePrincipal }): Promise<unknown>;
}

export interface RuntimeHttpCommandResponse {
  readonly matched: boolean;
  readonly status: number;
  readonly body: unknown;
  readonly headers: Record<string, string>;
}

export interface RuntimeScheduleCommands {
  create(input: Record<string, unknown>): Promise<unknown>;
  list(input: Record<string, unknown>): Promise<unknown>;
  cancel(input: Record<string, unknown>): Promise<unknown>;
}
