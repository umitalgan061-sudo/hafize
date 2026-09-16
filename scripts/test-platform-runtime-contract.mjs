import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const file = path.join(root, 'public', 'typed', 'platform-runtime.ts');
const source = fs.readFileSync(file, 'utf8');

for (const token of [
  'export type PlatformPhase',
  'export interface RuntimeCapabilities',
  'export interface PlatformSnapshot',
  'export interface PlatformFeatureContext',
  'export interface PlatformFeature',
  'export class PlatformRuntime',
  'addFeature(feature: PlatformFeature)',
  'startFeature(id: string)',
  'stopFeature(id: string)',
  'async start(): Promise<PlatformSnapshot>',
  'stop(): void'
]) assert.ok(source.includes(token), `missing runtime contract: ${token}`);

assert.ok(source.includes("'hafize:platform-snapshot'"));
assert.ok(source.includes("'hafize:platform-ready'"));
assert.ok(source.includes("'hafize:platform-stopped'"));
assert.ok(source.includes('AbortController'));
assert.ok(source.includes('Object.freeze'));
assert.ok(!source.includes('fetch('));
assert.ok(!source.includes('XMLHttpRequest'));
assert.ok(!source.includes('WebSocket'));

const maxMetrics = source.match(/MAX_METRICS\s*=\s*(\d+)/)?.[1];
const maxErrors = source.match(/MAX_ERRORS\s*=\s*(\d+)/)?.[1];
const maxFeatures = source.match(/MAX_FEATURES\s*=\s*(\d+)/)?.[1];
assert.ok(Number(maxMetrics) > 0 && Number(maxMetrics) <= 200);
assert.ok(Number(maxErrors) > 0 && Number(maxErrors) <= 100);
assert.ok(Number(maxFeatures) > 0 && Number(maxFeatures) <= 100);

console.log('platform runtime contract: ok');
