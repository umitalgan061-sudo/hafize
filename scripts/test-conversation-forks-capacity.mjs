import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// The capacity guards live in the pure core, and the DOM layer refuses to
// create a fork without asking it first. Asserting both sides keeps the split
// honest: a guard in the core that nothing consults is not a limit.
const core = readFileSync('public/typed/conversation-fork-core.ts','utf8');
const ui = readFileSync('public/typed/conversation-forks.ts','utf8');

assert.match(core,/if \(all\.length >= FORK_LIMITS\.maxConversations\) return \{ error: FORK_ERRORS\.conversationLimit \}/);
assert.match(core,/if \(countDirectBranches\(source\.id, all\) >= FORK_LIMITS\.maxBranchesPerParent\) return \{ error: FORK_ERRORS\.branchLimit \}/);
assert.match(core,/if \(depth >= FORK_LIMITS\.maxDepth\) return \{ error: FORK_ERRORS\.depthLimit \}/);

assert.match(ui,/const preview = makeFork\(source, messageId, all\);/);
assert.match(ui,/if \(preview\.error\) return showToast\(/);
assert.match(ui,/if \(created\.error\) return showToast\(/);
for (const code of ['DEPTH_LIMIT', 'BRANCH_LIMIT', 'CONVERSATION_LIMIT', 'EMPTY_FORK', 'MESSAGE_NOT_FOUND']) {
  assert.match(ui, new RegExp(code + ':'), `${code} has a reader-facing message`);
}
console.log('conversation fork capacity: ok');
