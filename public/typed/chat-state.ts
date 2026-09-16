import type { ChatMessage, MessageFeedback } from './message-model';
import type { Conversation, ConversationMessage } from './conversation-model';

export interface ChatState { readonly conversation: Conversation | null; readonly messages: readonly ChatMessage[]; readonly pending: boolean; readonly error: string | null; readonly selectedMessageId: string | null; }
export type ChatAction =
  | { readonly type: 'conversation/set'; readonly conversation: Conversation | null }
  | { readonly type: 'message/add'; readonly message: ChatMessage }
  | { readonly type: 'message/replace'; readonly id: string; readonly message: ChatMessage }
  | { readonly type: 'message/remove'; readonly id: string }
  | { readonly type: 'message/feedback'; readonly id: string; readonly feedback: MessageFeedback }
  | { readonly type: 'pending/set'; readonly pending: boolean }
  | { readonly type: 'error/set'; readonly error: string | null }
  | { readonly type: 'message/select'; readonly id: string | null }
  | { readonly type: 'reset' };

export const INITIAL_CHAT_STATE: ChatState = Object.freeze({ conversation: null, messages: [], pending: false, error: null, selectedMessageId: null });

function freezeState(state: ChatState): ChatState { return Object.freeze({ ...state, messages: Object.freeze([...state.messages]) }); }
function updateMessage(messages: readonly ChatMessage[], id: string, fn: (message: ChatMessage) => ChatMessage): readonly ChatMessage[] { const index = messages.findIndex((message) => message.id === id); if (index < 0) return messages; const next = [...messages]; next[index] = fn(next[index]); return next; }

export function reduceChatState(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'conversation/set': return freezeState({ ...state, conversation: action.conversation, messages: [] , error: null, selectedMessageId: null });
    case 'message/add': return freezeState({ ...state, messages: [...state.messages, action.message], error: null });
    case 'message/replace': return freezeState({ ...state, messages: updateMessage(state.messages, action.id, () => action.message) });
    case 'message/remove': return freezeState({ ...state, messages: state.messages.filter((message) => message.id !== action.id), selectedMessageId: state.selectedMessageId === action.id ? null : state.selectedMessageId });
    case 'message/feedback': return freezeState({ ...state, messages: updateMessage(state.messages, action.id, (message) => Object.freeze({ ...message, feedback: action.feedback })) });
    case 'pending/set': return freezeState({ ...state, pending: action.pending });
    case 'error/set': return freezeState({ ...state, error: action.error });
    case 'message/select': return freezeState({ ...state, selectedMessageId: action.id });
    case 'reset': return INITIAL_CHAT_STATE;
  }
}

export interface ChatStore { readonly get: () => ChatState; readonly dispatch: (action: ChatAction) => ChatState; readonly subscribe: (listener: (state: ChatState) => void) => () => void; }
export function createChatStore(initial: ChatState = INITIAL_CHAT_STATE): ChatStore {
  let state = freezeState(initial); const listeners = new Set<(next: ChatState) => void>();
  const get = (): ChatState => state;
  const dispatch = (action: ChatAction): ChatState => { state = reduceChatState(state, action); for (const listener of listeners) { try { listener(state); } catch { /* subscriber isolation */ } } return state; };
  const subscribe = (listener: (next: ChatState) => void): (() => void) => { listeners.add(listener); return () => listeners.delete(listener); };
  return Object.freeze({ get, dispatch, subscribe });
}

export function conversationMessagesToChatMessages(messages: readonly ConversationMessage[]): ChatMessage[] { return messages.map((message) => Object.freeze({ id: message.id, role: message.role, content: message.content, at: message.at })); }
export function createUserMessage(id: string, content: string, at = new Date().toISOString()): ChatMessage { if (!content.trim()) throw new Error('EMPTY_MESSAGE'); return Object.freeze({ id, role: 'user', content: content.slice(0, 12_000), at }); }
export function createAssistantMessage(id: string, content: string, at = new Date().toISOString()): ChatMessage { if (!content.trim()) throw new Error('EMPTY_MESSAGE'); return Object.freeze({ id, role: 'assistant', content: content.slice(0, 12_000), at }); }
