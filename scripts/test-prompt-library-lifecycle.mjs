import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../public/prompt-library.js', import.meta.url), 'utf8');

// Mounting twice is a no-op rather than a second card.
assert.match(source, /if \(documentRef\.getElementById\('promptLibraryCard'\)\)/);
assert.match(source, /return \{ mounted: false, reason: 'already-mounted' \}/);

// Cross-tab updates are picked up from the storage event.
assert.match(source, /storage/);

// Teardown releases every listener the mount registered and removes the card.
assert.match(source, /destroy: \(\) =>/);
assert.match(source, /releaseListeners/, 'teardown is funnelled through one helper');
assert.match(source, /for \(const off of listeners\.splice/);
assert.match(source, /card\.remove\(\)/);

// Teardown is explicit, never driven by an unload listener: registering
// `beforeunload`/`unload` disqualifies the page from the back/forward cache, and
// a cancelled navigation would leave the card on screen with its listeners
// already released.
assert.doesNotMatch(source, /'beforeunload'/, 'no beforeunload listener is registered');
assert.doesNotMatch(source, /'unload'/, 'no unload listener is registered');

console.log('test-prompt-library-lifecycle: ok');
