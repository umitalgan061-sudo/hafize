import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');

// Streaming deltas are written straight into the message node, so nothing scrolls the
// page unless the composer does it. Following is opt-out, driven by where the reader is.
assert.match(app, /const SCROLL_FOLLOW_THRESHOLD_PX = 120;/);
assert.match(app, /let followStream = true;/);
assert.match(app, /function isNearBottom\(\)/);
assert.match(app, /document\.body\.scrollHeight - \(window\.scrollY \+ window\.innerHeight\)/);
assert.match(app, /return distance <= SCROLL_FOLLOW_THRESHOLD_PX;/);
assert.match(app, /if \(node && followStream\) scrollToLatest\(\);/);

// Scrolling up during a stream must survive the next delta, and coming back to the
// bottom must resume following.
assert.match(app, /window\.addEventListener\('scroll', \(\) => \{\s*followStream = isNearBottom\(\);\s*\}, \{ passive: true \}\);/);

// A full render is an explicit state change (new message, conversation switch), so it
// re-pins to the bottom instead of honouring a stale scroll position.
assert.match(app, /followStream = true;\s*scrollToLatest\(\);/);

// One frame-coalesced scroll per burst, and never the smooth variant: a smooth scroll
// lands short of a bottom that is still growing and its own events would unfollow.
assert.match(app, /if \(scrollFrame\) cancelAnimationFrame\(scrollFrame\);/);
assert.match(app, /scrollFrame = requestAnimationFrame\(\(\) => \{/);
assert.match(app, /window\.scrollTo\(\{ top: document\.body\.scrollHeight, behavior: 'auto' \}\);/);
assert.doesNotMatch(app, /behavior: 'smooth'/);
assert.equal((app.match(/window\.scrollTo\(/g) || []).length, 1, 'scrolling stays in one place');

console.log('chat stream follow contract passed: deltas follow the bottom, a scrolled-up reader is left alone');
