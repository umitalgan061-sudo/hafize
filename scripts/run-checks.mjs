import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { discoverCheckPlan, summarizeCheckPlan } from './check-suite-policy.mjs';

function fail(code, detail = '') {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  throw error;
}

export function runNode(args, { rootDir = process.cwd() } = {}) {
  const result = spawnSync(process.execPath, args, {
    cwd: rootDir,
    encoding: 'utf8',
    env: process.env,
    stdio: 'pipe'
  });
  return Object.freeze({
    ok: !result.error && result.status === 0,
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error: result.error || null
  });
}

function runStep(label, args, options) {
  options.onProgress?.(label);
  const result = options.run(args, { rootDir: options.rootDir });
  if (result?.ok === true) return;
  if (result?.stdout) options.writeError(result.stdout);
  if (result?.stderr) options.writeError(result.stderr);
  fail('CHECK_STEP_FAILED', label);
}

export function executeCheckPlan(plan, {
  rootDir = process.cwd(),
  run = runNode,
  syntaxOnly = false,
  onProgress = (label) => process.stdout.write(`check ${label}\n`),
  writeError = (value) => process.stderr.write(value)
} = {}) {
  if (!plan || typeof run !== 'function') fail('INVALID_CHECK_RUNNER');
  const options = { rootDir, run, onProgress, writeError };

  for (const file of plan.syntaxFiles) runStep(`syntax ${file}`, ['--check', file], options);
  if (syntaxOnly) return summarizeCheckPlan(plan);
  for (const file of plan.validators) runStep(`validator ${file}`, [file], options);
  for (const file of plan.tests) runStep(`test ${file}`, [file], options);
  return summarizeCheckPlan(plan);
}

function parseArgs(argv) {
  const allowed = new Set(['--list', '--syntax-only']);
  for (const arg of argv) if (!allowed.has(arg)) fail('INVALID_CHECK_ARGUMENT', arg);
  if (argv.includes('--list') && argv.includes('--syntax-only')) fail('INVALID_CHECK_ARGUMENT_COMBINATION');
  return Object.freeze({ list: argv.includes('--list'), syntaxOnly: argv.includes('--syntax-only') });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const plan = await discoverCheckPlan();
  if (options.list) {
    process.stdout.write(`${JSON.stringify({ ...summarizeCheckPlan(plan), optIn: plan.optInTests }, null, 2)}\n`);
    return;
  }
  const summary = executeCheckPlan(plan, { syntaxOnly: options.syntaxOnly });
  process.stdout.write(`check suite passed: ${summary.syntaxFiles} syntax, ${summary.validators} validators, ${summary.tests} tests; ${summary.optInTests} opt-in\n`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main().catch((error) => {
  process.stderr.write(`${error?.code || 'CHECK_FAILED'}\n`);
  process.exitCode = 1;
});
