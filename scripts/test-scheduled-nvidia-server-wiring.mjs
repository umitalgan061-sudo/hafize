import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');

assert.match(source, /import \{ createScheduledNvidiaCompletion \} from '\.\/lib\/scheduled-nvidia-completion\.mjs';/);
assert.match(source, /const SCHEDULE_RUN_TIMEOUT_MS = boundedEnvInteger\([^\n]+120_000, 10_000, 300_000\);/);
assert.match(source, /const SCHEDULED_NVIDIA_COMPLETE = createScheduledNvidiaCompletion\(\{\s*complete: nvidiaJsonCompletion,\s*timeoutMs: SCHEDULE_RUN_TIMEOUT_MS\s*\}\);/s);
assert.match(source, /createScheduledAgentExecutor\(\{[\s\S]*?complete: SCHEDULED_NVIDIA_COMPLETE[\s\S]*?\}\);/);
assert.doesNotMatch(source, /async complete\(payload\) \{\s*const controller = new AbortController\(\);\s*const timeout = setTimeout/s);

assert.match(source, /const scheduleWorkerController = new AbortController\(\);/);
assert.match(source, /SCHEDULE_WORKER\.runDue\(\{ signal: scheduleWorkerController\.signal \}\)/);

const shutdownStart = source.indexOf('async function shutdown()');
assert.notEqual(shutdownStart, -1);
const shutdownSource = source.slice(shutdownStart, source.indexOf("process.once('SIGINT'", shutdownStart));
const abortIndex = shutdownSource.indexOf('scheduleWorkerController.abort();');
const stopIndex = shutdownSource.indexOf('stopScheduleWorkerLoop();');
const waitIndex = shutdownSource.indexOf('if (scheduleTickPromise) await scheduleTickPromise;');
const leaseCloseIndex = shutdownSource.indexOf('await SCHEDULE_LEASE_RUNTIME.close();');
assert.equal(abortIndex >= 0, true);
assert.equal(stopIndex > abortIndex, true);
assert.equal(waitIndex > stopIndex, true);
assert.equal(leaseCloseIndex > waitIndex, true);

const executorImport = source.indexOf("./lib/scheduled-agent-executor.mjs");
const completionImport = source.indexOf("./lib/scheduled-nvidia-completion.mjs");
assert.equal(executorImport >= 0 && completionImport > executorImport, true);

assert.match(source, /approvalGranted: false/);
assert.doesNotMatch(source, /approvalGranted:\s*true/);
assert.doesNotMatch(source, /shell\s*:\s*true/);
assert.doesNotMatch(source, /child_process/);

process.stdout.write('scheduled NVIDIA production server wiring passed\n');
