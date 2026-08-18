import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../lib/redis-schedule-lease-adapter.mjs', import.meta.url), 'utf8');
assert.equal(source.includes("redis.call('INCR', KEYS[2])"), true);
assert.equal(source.includes("redis.call('PEXPIRE', KEYS[2], ARGV[3])"), true);
assert.equal(source.includes("redis.call('PEXPIRE', KEYS[2], ARGV[4])"), true);
assert.equal(source.includes("redis.call('GET', KEYS[1]) ~= token"), true);
assert.equal(source.includes("redis.call('SET', KEYS[3], ARGV[3], 'PX', ARGV[4])"), true);
for (const forbidden of ['child_process', 'exec(', 'spawn(', 'shell=True', 'GITHUB_TOKEN', 'NVIDIA_API_KEY']) {
  assert.equal(source.includes(forbidden), false, forbidden);
}
console.log('redis schedule fence retention security contract ok');
