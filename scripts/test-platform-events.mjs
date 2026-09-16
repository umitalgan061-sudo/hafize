import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'public/typed/platform-events.ts'), 'utf8');
assert.ok(source.includes('export type PlatformEventMap'));
assert.ok(source.includes('export type PlatformEventName'));
assert.ok(source.includes('export type PlatformEventListener'));
assert.ok(source.includes('export interface PlatformSubscription'));
assert.ok(source.includes('class PlatformEventBus'));
assert.ok(source.includes('on<K extends PlatformEventName>'));
assert.ok(source.includes('emit<K extends PlatformEventName>'));
assert.ok(source.includes('unsubscribe: () => void'));
assert.ok(source.includes('clear(name?: PlatformEventName)'));
assert.ok(source.includes('size(name?: PlatformEventName)'));
assert.ok(source.includes('try { listener(payload); } catch'));
assert.ok(source.includes('hafizePlatformEvents'));
console.log('platform events: ok');
