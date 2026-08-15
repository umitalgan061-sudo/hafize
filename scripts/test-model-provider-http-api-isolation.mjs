import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../lib/model-provider-http-api.mjs', import.meta.url), 'utf8');
assert.doesNotMatch(source, /process\.env|NVIDIA_API_KEY|HAFIZE_LOCAL_PROVIDER|Authorization\s*:/);
assert.doesNotMatch(source, /child_process|exec\(|spawn\(|shell\s*:/);
assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB/);
assert.doesNotMatch(source, /toolsRequired\s*:\s*true/);
assert.match(source, /MODEL_PROVIDER_HTTP_TOOLS_NOT_ALLOWED/);
assert.match(source, /authorization.*cookie.*set-cookie.*proxy-authorization/s);

console.log('model provider http api isolation tests passed');
