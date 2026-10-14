import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const s=readFileSync('public/typed/conversation-forks.ts','utf8');
assert.match(s,/renderActiveBranchBanner/);
assert.match(s,/hafizeConversationForkBanner/);
assert.match(s,/Üst sohbete dön/);
assert.match(s,/forkNote/);
console.log('conversation fork banner: ok');