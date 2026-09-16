export type ConversationRole = 'user' | 'assistant' | 'system';
export type ConversationSort = 'updated-desc' | 'updated-asc' | 'title-asc' | 'created-desc' | 'created-asc';
export type ConversationFilter = 'all' | 'active' | 'archived' | 'pinned' | 'tagged';

export interface ToolActivity { readonly label: string; readonly state: 'running' | 'success' | 'failure'; }
export interface ConversationMessage { readonly id: string; readonly role: ConversationRole; readonly content: string; readonly at: string; readonly toolActivities?: readonly ToolActivity[]; }
export interface Conversation { readonly id: string; readonly title: string; readonly agentId: string; readonly toolsEnabled: boolean; readonly archived: boolean; readonly pinned: boolean; readonly tags: readonly string[]; readonly createdAt: string; readonly updatedAt: string; readonly messages: readonly ConversationMessage[]; }
export interface ConversationQuery { readonly filter: ConversationFilter; readonly sort: ConversationSort; readonly tag: string; readonly query: string; readonly selected: readonly string[]; }

export const CONVERSATION_LIMITS = Object.freeze({ maxConversations: 30, maxMessages: 200, maxTitle: 80, maxTag: 24, maxTags: 8, maxMessage: 12000, maxImportBytes: 1_000_000 });
export const DEFAULT_CONVERSATION_QUERY: ConversationQuery = Object.freeze({ filter: 'all', sort: 'updated-desc', tag: '', query: '', selected: [] });

const normalizeSpace = (value: unknown): string => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
export const normalizeSearch = (value: unknown): string => normalizeSpace(value).toLocaleLowerCase('tr-TR').slice(0, 120);
export const normalizeTitle = (value: unknown): string => normalizeSpace(value).slice(0, CONVERSATION_LIMITS.maxTitle) || 'Yeni sohbet';
export const normalizeTag = (value: unknown): string => normalizeSpace(value).replace(/^#+\s*/, '').slice(0, CONVERSATION_LIMITS.maxTag);
export const normalizeIso = (value: unknown, fallback = new Date(0).toISOString()): string => { if (typeof value !== 'string') return fallback; const time = Date.parse(value); return Number.isFinite(time) ? new Date(time).toISOString() : fallback; };

export function normalizeMessage(value: unknown, fallbackId = 'message'): ConversationMessage | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  const role = item.role === 'assistant' || item.role === 'system' || item.role === 'user' ? item.role : null;
  const content = typeof item.content === 'string' ? item.content.slice(0, CONVERSATION_LIMITS.maxMessage) : '';
  if (!role || !content) return null;
  const toolActivities = Array.isArray(item.toolActivities) ? item.toolActivities.filter((activity): activity is Record<string, unknown> => Boolean(activity && typeof activity === 'object')).slice(0, 4).map((activity) => ({ label: normalizeSpace(activity.label).slice(0, 80) || 'Araç', state: activity.state === 'running' || activity.state === 'failure' ? activity.state : 'success' })) : [];
  return Object.freeze({ id: typeof item.id === 'string' && item.id ? item.id.slice(0, 120) : fallbackId, role, content, at: normalizeIso(item.at, new Date().toISOString()), ...(toolActivities.length ? { toolActivities } : {}) });
}

export function normalizeConversation(value: unknown, index = 0): Conversation | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  const id = typeof item.id === 'string' && item.id ? item.id.slice(0, 120) : '';
  if (!id) return null;
  const fallback = new Date(Date.now() - index).toISOString();
  const tags = Array.isArray(item.tags) ? [...new Set(item.tags.map(normalizeTag).filter(Boolean))].slice(0, CONVERSATION_LIMITS.maxTags) : [];
  const messages = Array.isArray(item.messages) ? item.messages.slice(0, CONVERSATION_LIMITS.maxMessages).map((message, messageIndex) => normalizeMessage(message, `${id}-${messageIndex}`)).filter((message): message is ConversationMessage => message !== null) : [];
  return Object.freeze({ id, title: normalizeTitle(item.title), agentId: typeof item.agentId === 'string' ? item.agentId.slice(0, 120) : '', toolsEnabled: item.toolsEnabled === true, archived: item.archived === true, pinned: item.pinned === true, tags, createdAt: normalizeIso(item.createdAt, fallback), updatedAt: normalizeIso(item.updatedAt, fallback), messages });
}

export function normalizeConversationList(value: unknown): Conversation[] { if (!Array.isArray(value)) return []; const seen = new Set<string>(); const output: Conversation[] = []; value.forEach((item, index) => { const conversation = normalizeConversation(item, index); if (!conversation || seen.has(conversation.id)) return; seen.add(conversation.id); output.push(conversation); }); return output.slice(0, CONVERSATION_LIMITS.maxConversations); }
export function matchesConversation(conversation: Conversation, query: ConversationQuery): boolean { if (query.filter === 'active' && conversation.archived) return false; if (query.filter === 'archived' && !conversation.archived) return false; if (query.filter === 'pinned' && !conversation.pinned) return false; if (query.filter === 'tagged' && conversation.tags.length === 0) return false; const wantedTag = normalizeSearch(query.tag); if (wantedTag && !conversation.tags.some((tag) => normalizeSearch(tag) === wantedTag)) return false; const wanted = normalizeSearch(query.query); if (!wanted) return true; const haystack = normalizeSearch([conversation.title, conversation.agentId, ...conversation.tags, ...conversation.messages.map((message) => message.content)].join(' ')); return haystack.includes(wanted); }
export function sortConversations(conversations: readonly Conversation[], sort: ConversationSort): Conversation[] { const list = [...conversations]; const collator = new Intl.Collator('tr-TR', { sensitivity: 'base', numeric: true }); return list.sort((a, b) => { if (sort === 'title-asc') return collator.compare(a.title, b.title); const left = Date.parse(sort.startsWith('created') ? a.createdAt : a.updatedAt); const right = Date.parse(sort.startsWith('created') ? b.createdAt : b.updatedAt); return sort.endsWith('asc') ? left - right : right - left; }); }
export function filterAndSortConversations(conversations: readonly Conversation[], query: ConversationQuery): Conversation[] { return sortConversations(conversations.filter((conversation) => matchesConversation(conversation, query)), query.sort); }
export function collectConversationTags(conversations: readonly Conversation[]): readonly { readonly label: string; readonly count: number }[] { const map = new Map<string, { label: string; count: number }>(); for (const conversation of conversations) for (const raw of conversation.tags) { const label = normalizeTag(raw); const key = normalizeSearch(label); if (!key) continue; const current = map.get(key) ?? { label, count: 0 }; current.count += 1; map.set(key, current); } return [...map.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'tr-TR')); }
