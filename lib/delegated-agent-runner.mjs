import { createAgentDelegator } from './agent-delegation.mjs';
import { buildAgentSystemMessage } from './agent-runtime.mjs';
import { executeNvidiaToolCall, getAllowedNvidiaTools } from './tool-runtime.mjs';

function normalizeToolCalls(calls) {
  if (!Array.isArray(calls)) return [];
  return calls.slice(0, 4).filter((call) => call?.id && call?.function?.name).map((call) => ({
    id: String(call.id),
    type: 'function',
    function: {
      name: String(call.function.name),
      arguments: typeof call.function.arguments === 'string' ? call.function.arguments : '{}'
    }
  }));
}

const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 600_000;

function isAbortSignal(value) {
  return Boolean(value) && typeof value === 'object' && typeof value.addEventListener === 'function' && 'aborted' in value;
}

// Dış iptal (istemci bağlantıyı kapattı) ile tur zaman aşımını tek bir sinyalde
// birleştirir. Zaman aşımı nedeni ayrı tutulur ki çağıran hangi durumun
// gerçekleştiğini görebilsin; iç içe delegasyonlar aynı sinyali devralır.
function createRunSignal(parentSignal, timeoutMs) {
  const controller = new AbortController();
  const state = { timedOut: false };
  const abort = () => controller.abort();
  let timer = null;
  if (parentSignal?.aborted) abort();
  else if (parentSignal) parentSignal.addEventListener('abort', abort, { once: true });
  if (timeoutMs !== undefined && !controller.signal.aborted) {
    timer = setTimeout(() => {
      state.timedOut = true;
      abort();
    }, timeoutMs);
  }
  return {
    signal: controller.signal,
    get abortError() {
      if (!controller.signal.aborted) return null;
      return { ok: false, error: state.timedOut ? 'DELEGATED_RUN_TIMEOUT' : 'DELEGATED_RUN_ABORTED' };
    },
    dispose() {
      if (timer) clearTimeout(timer);
      parentSignal?.removeEventListener?.('abort', abort);
    }
  };
}

export async function runDelegatedAgent(options = {}) {
  const { signal, timeoutMs } = options;
  if (signal !== undefined && signal !== null && !isAbortSignal(signal)) {
    return { ok: false, error: 'INVALID_DELEGATED_SIGNAL' };
  }
  if (timeoutMs !== undefined && timeoutMs !== null) {
    const valid = Number.isSafeInteger(timeoutMs) && timeoutMs >= MIN_TIMEOUT_MS && timeoutMs <= MAX_TIMEOUT_MS;
    if (!valid) return { ok: false, error: 'INVALID_DELEGATED_TIMEOUT' };
  }
  const run = createRunSignal(signal ?? undefined, timeoutMs ?? undefined);
  try {
    return await executeDelegatedRun(options, run);
  } finally {
    run.dispose();
  }
}

async function executeDelegatedRun({
  agent,
  task,
  traceId,
  parentTaskId,
  depth = 1,
  registry,
  runLedger,
  model,
  maxTokens = 2048,
  complete,
  nvidiaConfigured = false,
  githubReadConfigured = false,
  githubReadFile
} = {}, run) {
  if (!agent?.id || typeof task !== 'string' || !task.trim() || !traceId || !parentTaskId) {
    return { ok: false, error: 'INVALID_DELEGATED_RUN' };
  }
  if (!Number.isInteger(depth) || depth < 0) return { ok: false, error: 'INVALID_DELEGATED_DEPTH' };
  if (!registry || typeof runLedger?.recordToolStart !== 'function' || typeof complete !== 'function') {
    return { ok: false, error: 'INVALID_DELEGATED_RUN' };
  }
  if (run.abortError) return run.abortError;

  // Model çağrısı iptal edildiğinde ham AbortError sızdırmak yerine sözleşmeye
  // uygun yapılandırılmış sonuç döner.
  async function callModel(payload) {
    if (run.abortError) return { aborted: run.abortError };
    try {
      return { response: await complete(payload, run.signal) };
    } catch (error) {
      if (run.abortError) return { aborted: run.abortError };
      throw error;
    }
  }

  const nestedDelegator = createAgentDelegator({
    registry,
    traceId,
    parentAgent: agent,
    parentTaskId,
    runLedger,
    executeAgent: ({
      agent: nestedAgent,
      task: nestedTask,
      traceId: nestedTraceId,
      depth: nestedDepth,
      parentTaskId: nestedParentTaskId
    }) => runDelegatedAgent({
      agent: nestedAgent,
      task: nestedTask,
      traceId: nestedTraceId,
      parentTaskId: nestedParentTaskId,
      depth: nestedDepth,
      registry,
      runLedger,
      model,
      maxTokens,
      complete,
      nvidiaConfigured,
      githubReadConfigured,
      githubReadFile,
      signal: run.signal
    })
  });
  const delegateAgent = (args) => nestedDelegator.delegate(args, { depth });
  const tools = getAllowedNvidiaTools(agent, {
    nvidiaConfigured: Boolean(nvidiaConfigured),
    githubReadConfigured: Boolean(githubReadConfigured),
    delegateAgent
  });
  const messages = [buildAgentSystemMessage(agent, traceId), { role: 'user', content: task }];
  const firstPayload = {
    model,
    messages,
    stream: false,
    max_tokens: maxTokens
  };
  if (tools.length) {
    firstPayload.tools = tools;
    firstPayload.tool_choice = 'auto';
  }

  const first = await callModel(firstPayload);
  if (first.aborted) return first.aborted;
  const assistant = first.response?.choices?.[0]?.message;
  if (!assistant || assistant.role !== 'assistant') return { ok: false, error: 'INVALID_NVIDIA_RESPONSE' };

  const rawCalls = Array.isArray(assistant.tool_calls) ? assistant.tool_calls : [];
  if (!rawCalls.length) {
    return { ok: true, content: typeof assistant.content === 'string' ? assistant.content : '' };
  }

  const calls = normalizeToolCalls(rawCalls);
  if (!calls.length) return { ok: false, error: 'INVALID_TOOL_CALL' };

  const toolMessages = [];
  let anyToolFailed = false;
  for (const call of calls) {
    // İptal edilen turda kalan araçlar hiç başlatılmaz; ledger'da askıda kayıt kalmaz.
    if (run.abortError) return run.abortError;
    const toolTask = runLedger.recordToolStart(call.function.name, {
      parentTaskId,
      toolAgentId: agent.id
    });
    const result = await executeNvidiaToolCall(agent, call, {
      traceId,
      agent,
      registry,
      nvidiaConfigured: Boolean(nvidiaConfigured),
      githubReadConfigured: Boolean(githubReadConfigured),
      githubReadFile,
      delegateAgent,
      approvalGranted: false
    });
    runLedger.recordToolFinish(toolTask.taskId, result);
    if (!result.ok) anyToolFailed = true;
    toolMessages.push({
      role: 'tool',
      tool_call_id: call.id,
      name: call.function.name,
      content: JSON.stringify(result)
    });
  }

  const second = await callModel({
    model,
    messages: [
      ...messages,
      {
        role: 'assistant',
        content: typeof assistant.content === 'string' ? assistant.content : null,
        tool_calls: calls
      },
      ...toolMessages
    ],
    stream: false,
    max_tokens: maxTokens,
    tools,
    tool_choice: 'none'
  });
  if (second.aborted) return second.aborted;
  const finalMessage = second.response?.choices?.[0]?.message;
  if (!finalMessage || finalMessage.role !== 'assistant') return { ok: false, error: 'INVALID_NVIDIA_RESPONSE' };
  if (anyToolFailed) return { ok: false, error: 'DELEGATED_TOOL_FAILED' };

  return {
    ok: true,
    content: typeof finalMessage.content === 'string' ? finalMessage.content : ''
  };
}
