import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'public/typed/platform-policy.ts'), 'utf8');
for (const id of ['local-state', 'persistent-state', 'offline-shell', 'voice-output', 'voice-input', 'screen-share', 'clipboard', 'trusted-content', 'performance-monitoring', 'idle-work', 'modern-streaming']) {
  assert.ok(source.includes(`id: '${id}'`), `policy missing: ${id}`);
}
assert.ok(source.includes("export type PolicyDecision"));
assert.ok(source.includes("export interface PolicyResult"));
assert.ok(source.includes('evaluatePolicy(policy: CapabilityPolicy'));
assert.ok(source.includes('evaluatePolicies(capabilities: RuntimeCapabilities)'));
assert.ok(source.includes('policyFor(id: string)'));
assert.ok(source.includes("decision: PolicyDecision"));
assert.ok(source.includes("'allowed'"));
assert.ok(source.includes("'fallback'"));
assert.ok(!source.includes('requestPermission'));
console.log('platform policy: ok');
