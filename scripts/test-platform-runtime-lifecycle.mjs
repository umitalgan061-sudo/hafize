import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'public/typed/platform-runtime.ts'), 'utf8');

assert.ok(source.includes("listen(this.windowRef, 'online'"));
assert.ok(source.includes("listen(this.windowRef, 'offline'"));
assert.ok(source.includes("listen(this.windowRef, 'visibilitychange'"));
assert.ok(source.includes("listen(this.windowRef, 'error'"));
assert.ok(source.includes("listen(this.windowRef, 'unhandledrejection'"));
assert.ok(source.includes("listen(this.windowRef, 'pagehide'"));
assert.ok(source.includes('this.listeners.push'));
assert.ok(source.includes('for (const off of this.listeners.splice(0)) off();'));
assert.ok(source.includes('if (this.started) return this.snapshotValue;'));
assert.ok(source.includes('this.started = false;'));
assert.ok(source.includes("controller.abort('feature-stopped')"));
assert.ok(source.includes('featureStates.set(id, \'starting\')'));
assert.ok(source.includes('featureStates.set(id, \'running\')'));
assert.ok(source.includes('featureStates.set(id, \'failed\')'));
assert.ok(source.includes('featureStates.set(id, \'stopped\')'));
assert.ok(source.includes('startFeatures(): Promise<void>'));
assert.ok(source.includes('addFeature(feature: PlatformFeature): void'));
assert.ok(source.includes('removeFeature(id: string): void'));
console.log('platform lifecycle: ok');
