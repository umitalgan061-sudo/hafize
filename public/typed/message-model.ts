export type MessageRole = 'user' | 'assistant' | 'system';
export type MessageFeedback = 'up' | 'down' | null;
export type MessageActivityState = 'running' | 'success' | 'failure';

export interface MessageToolActivity { readonly id?: string; readonly label: string; readonly state: MessageActivityState; readonly detail?: string; }
export interface ChatMessage { readonly id: string; readonly role: MessageRole; content: string; readonly at: string; feedback?: MessageFeedback; note?: string; tags?: readonly string[]; toolActivities?: readonly MessageToolActivity[]; }
export interface MessageDraft { readonly content: string; readonly attachments: readonly string[]; readonly updatedAt: string; }

export const MESSAGE_LIMITS = Object.freeze({ maxContent: 12_000, maxNote: 1_000, maxTag: 24, maxTags: 8, maxToolActivities: 8, maxToolDetail: 400, maxAttachments: 3, maxAttachmentName: 120 });
const normalize = (value: unknown, max: number): string => typeof value === 'string' ? value.replace(/\0/g, '').slice(0, max) : '';
export const normalizeMessageRole = (value: unknown): MessageRole => value === 'assistant' || value === 'system' ? value : 'user';
export const normalizeFeedback = (value: unknown): MessageFeedback => value === 'up' || value === 'down' ? value : null;
export const normalizeMessageTag = (value: unknown): string => normalize(value, MESSAGE_LIMITS.maxTag).replace(/[,\r\n]/g, ' ').trim();

export function normalizeToolActivity(value: unknown): MessageToolActivity | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  const label = normalize(item.label, 80).trim() || 'Araç';
  const state: MessageActivityState = item.state === 'running' || item.state === 'failure' ? item.state : 'success';
  const detail = normalize(item.detail, MESSAGE_LIMITS.maxToolDetail).trim();
  return Object.freeze({ ...(typeof item.id === 'string' && item.id ? { id: normalize(item.id, 120) } : {}), label, state, ...(detail ? { detail } : {}) });
}

export function normalizeChatMessage(value: unknown, fallbackId = 'message'): ChatMessage | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  const content = normalize(item.content, MESSAGE_LIMITS.maxContent);
  if (!content) return null;
  const at = typeof item.at === 'string' && Number.isFinite(Date.parse(item.at)) ? new Date(item.at).toISOString() : new Date().toISOString();
  const tags = Array.isArray(item.tags) ? [...new Set(item.tags.map(normalizeMessageTag).filter(Boolean))].slice(0, MESSAGE_LIMITS.maxTags) : [];
  const activities = Array.isArray(item.toolActivities) ? item.toolActivities.map(normalizeToolActivity).filter((entry): entry is MessageToolActivity => entry !== null).slice(0, MESSAGE_LIMITS.maxToolActivities) : [];
  return Object.freeze({ id: typeof item.id === 'string' && item.id ? normalize(item.id, 120) : fallbackId, role: normalizeMessageRole(item.role), content, at, feedback: normalizeFeedback(item.feedback), ...(normalize(item.note, MESSAGE_LIMITS.maxNote).trim() ? { note: normalize(item.note, MESSAGE_LIMITS.maxNote).trim() } : {}), ...(tags.length ? { tags } : {}), ...(activities.length ? { toolActivities: activities } : {}) });
}

export function updateMessage(message: ChatMessage, patch: Partial<Pick<ChatMessage, 'content' | 'feedback' | 'note' | 'tags' | 'toolActivities'>>): ChatMessage {
  const next = normalizeChatMessage({ ...message, ...patch }, message.id);
  if (!next) throw new Error('INVALID_MESSAGE_PATCH');
  return next;
}

export function addMessageTag(message: ChatMessage, tag: string): ChatMessage { const tags = [...(message.tags ?? []), normalizeMessageTag(tag)]; return updateMessage(message, { tags }); }
export function removeMessageTag(message: ChatMessage, tag: string): ChatMessage { const wanted = normalizeMessageTag(tag).toLocaleLowerCase('tr-TR'); return updateMessage(message, { tags: (message.tags ?? []).filter((item) => item.toLocaleLowerCase('tr-TR') !== wanted) }); }
export function messageSearchText(message: ChatMessage): string { return [message.content, ...(message.tags ?? []), message.note ?? '', ...(message.toolActivities ?? []).map((activity) => `${activity.label} ${activity.detail ?? ''}`)].join('\n').toLocaleLowerCase('tr-TR'); }
export function messageMatches(message: ChatMessage, query: string): boolean { const wanted = normalize(query, 120).toLocaleLowerCase('tr-TR'); return !wanted || messageSearchText(message).includes(wanted); }
