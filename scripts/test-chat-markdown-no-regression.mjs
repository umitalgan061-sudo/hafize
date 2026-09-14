import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const messageWorkspace = readFileSync(new URL('../public/message-workspace.js', import.meta.url), 'utf8');
const conversationWorkspace = readFileSync(new URL('../public/conversation-workspace.js', import.meta.url), 'utf8');
const markdown = readFileSync(new URL('../public/chat-markdown.js', import.meta.url), 'utf8');

assert.match(app, /hafize\.conversations\.v1/);
assert.match(messageWorkspace, /hafize\.message-workspace\.v1/);
assert.match(conversationWorkspace, /hafize\.conversation-workspace\.v1/);
assert.doesNotMatch(markdown, /hafize\.conversations\.v1/);
assert.doesNotMatch(markdown, /hafize\.message-workspace\.v1/);
assert.doesNotMatch(markdown, /hafize\.conversation-workspace\.v1/);
assert.doesNotMatch(markdown, /addMessage\(|saveConversations\(/);
assert.doesNotMatch(markdown, /submitMessage\(|streamAssistantReply\(/);
assert.doesNotMatch(markdown, /toolsEnabled|agentSelect|modelSelect/);

assert.match(app, /message\.content/);
assert.match(messageWorkspace, /message/);
assert.match(conversationWorkspace, /conversation/);

console.log('test-chat-markdown-no-regression: ok');
