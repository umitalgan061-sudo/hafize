export type PermissionAction = 'read' | 'write' | 'delete' | 'execute';
export type PermissionScope = 'local' | 'github' | 'google' | 'gmail' | 'canva' | 'scheduler';
export interface ToolPermission { readonly tool: string; readonly scope: PermissionScope; readonly actions: readonly PermissionAction[]; readonly requiresApproval: boolean; readonly expiresAt?: string; }
export interface ApprovalRequest { readonly id: string; readonly tool: string; readonly scope: PermissionScope; readonly action: PermissionAction; readonly resource?: string; readonly createdAt: string; }
export interface ApprovalDecision { readonly requestId: string; readonly approved: boolean; readonly decidedAt: string; readonly reason?: string; }

const MAX = Object.freeze({ tool: 80, resource: 240, reason: 400, approvalId: 120, list: 16 });
const SCOPES: readonly PermissionScope[] = Object.freeze(['local', 'github', 'google', 'gmail', 'canva', 'scheduler']);
const ACTIONS: readonly PermissionAction[] = Object.freeze(['read', 'write', 'delete', 'execute']);
const clamp = (value: unknown, limit: number): string => typeof value === 'string' ? value.slice(0, limit) : '';

export function isPermissionScope(value: unknown): value is PermissionScope { return typeof value === 'string' && SCOPES.includes(value as PermissionScope); }
export function isPermissionAction(value: unknown): value is PermissionAction { return typeof value === 'string' && ACTIONS.includes(value as PermissionAction); }
export function requiresApproval(scope: PermissionScope, action: PermissionAction): boolean { return action !== 'read' || (scope !== 'local' && scope !== 'scheduler'); }
export function normalizePermission(value: unknown): ToolPermission | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  const tool = clamp(item.tool, MAX.tool).trim(); if (!tool || !isPermissionScope(item.scope)) return null;
  const actions = Array.isArray(item.actions) ? [...new Set(item.actions.filter(isPermissionAction))].slice(0, MAX.list) : [];
  if (!actions.length) return null;
  const expiry = typeof item.expiresAt === 'string' && Number.isFinite(Date.parse(item.expiresAt)) ? new Date(item.expiresAt).toISOString() : undefined;
  return Object.freeze({ tool, scope: item.scope, actions, requiresApproval: item.requiresApproval === true || actions.some((action) => requiresApproval(item.scope as PermissionScope, action)), ...(expiry ? { expiresAt: expiry } : {}) });
}

export function permissionAllows(permission: ToolPermission | null, scope: PermissionScope, action: PermissionAction, now = Date.now()): boolean {
  if (!permission || permission.scope !== scope || !permission.actions.includes(action)) return false;
  if (permission.expiresAt && Date.parse(permission.expiresAt) <= now) return false;
  return true;
}
export function approvalRequired(permission: ToolPermission | null, scope: PermissionScope, action: PermissionAction): boolean { return !permissionAllows(permission, scope, action) || Boolean(permission?.requiresApproval) || requiresApproval(scope, action); }

export function createApprovalRequest(tool: string, scope: PermissionScope, action: PermissionAction, resource?: string): ApprovalRequest {
  if (!tool.trim() || !isPermissionScope(scope) || !isPermissionAction(action)) throw new Error('INVALID_APPROVAL_REQUEST');
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return Object.freeze({ id, tool: clamp(tool, MAX.tool).trim(), scope, action, ...(resource ? { resource: clamp(resource, MAX.resource) } : {}), createdAt: new Date().toISOString() });
}

export function decideApproval(request: ApprovalRequest, approved: boolean, reason?: string): ApprovalDecision {
  return Object.freeze({ requestId: clamp(request.id, MAX.approvalId), approved: Boolean(approved), decidedAt: new Date().toISOString(), ...(reason ? { reason: clamp(reason, MAX.reason) } : {}) });
}

export class PermissionGate {
  readonly #permissions = new Map<string, ToolPermission>();
  set(permission: ToolPermission): void { const normalized = normalizePermission(permission); if (!normalized) throw new Error('INVALID_TOOL_PERMISSION'); this.#permissions.set(`${normalized.tool}:${normalized.scope}`, normalized); }
  remove(tool: string, scope: PermissionScope): boolean { return this.#permissions.delete(`${clamp(tool, MAX.tool)}:${scope}`); }
  get(tool: string, scope: PermissionScope): ToolPermission | null { return this.#permissions.get(`${clamp(tool, MAX.tool)}:${scope}`) ?? null; }
  can(tool: string, scope: PermissionScope, action: PermissionAction): boolean { return permissionAllows(this.get(tool, scope), scope, action); }
  needsApproval(tool: string, scope: PermissionScope, action: PermissionAction): boolean { return approvalRequired(this.get(tool, scope), scope, action); }
  clear(): void { this.#permissions.clear(); }
  size(): number { return this.#permissions.size; }
}

export const HafizeToolPermissions = Object.freeze({ isPermissionScope, isPermissionAction, requiresApproval, normalizePermission, permissionAllows, approvalRequired, createApprovalRequest, decideApproval, PermissionGate });
