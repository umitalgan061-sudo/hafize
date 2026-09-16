import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'public/typed/platform-performance.ts'), 'utf8');
for (const metric of ['navigation', 'largest-contentful-paint', 'longtask', 'event', 'resource', 'layout-shift']) assert.ok(source.includes(`metric: '${metric}'`), `budget missing: ${metric}`);
assert.ok(source.includes('export function evaluateBudget'));
assert.ok(source.includes('export function createPerformanceReport'));
assert.ok(source.includes('export function summarizePerformance'));
assert.ok(source.includes("status === 'fail'"));
assert.ok(source.includes("status === 'warn'"));
assert.ok(source.includes('slice(-'));
assert.ok(source.includes('Number.isFinite'));
assert.ok(source.includes('Object.freeze'));
console.log('platform performance: ok');
