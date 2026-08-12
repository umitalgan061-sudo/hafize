function executorError(code, status = 400) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  return error;
}

function normalizeDelegationTask(value) {
  const task = typeof value === 'string' ? value.trim() : '';
  if (!task || task.length > 12000) throw executorError('INVALID_DELEGATION_TASK');
  return task;
}

export function validateDelegation({ registry, sourceAgent, targetAgentId, task, depth = 0 }) {
  const maxDepth = Number.isInteger(registry?.policy?.maxDelegationDepth)
    ? Math.max(0, Math.min(registry.policy.maxDelegationDepth, 8))
    : 0;
  if (depth >= maxDepth) throw executorError('DELEGATION_DEPTH_EXCEEDED', 422);

  const targetId = typeof targetAgentId === 'string' ? targetAgentId.trim() : '';
  const target = registry?.agents?.find((agent) => agent.id === targetId) || null;
  if (!target) throw executorError('DELEGATION_TARGET_NOT_FOUND', 404);
  if (target.id === sourceAgent?.id) throw executorError('DELEGATION_SELF_TARGET_BLOCKED', 422);
  if (target.kind !== 'specialist') throw executorError('DELEGATION_TARGET_NOT_SPECIALIST', 422);

  return {
    target,
    task: normalizeDelegationTask(task),
    nextDepth: depth + 1,
    maxDepth
  };
}

function normalizeAssistantMessage(response) {
  const message = response?.choices?.[0]?.message;
  if (!message || message.role !== 'assistant') throw executorError('INVALID_NVIDIA_RESPONSE', 502);
  return message;
}

function normalizeToolCalls(message) {
  if (!Array.isArray(message?.tool_calls)) return [];
  return message.tool_calls.slice(0, 4)
    .filter((call) => call?.id && call?.function?.name)
    .map((call) => ({
      id: String(call.id),
      type: 'function',
      function: {
        name: String(call.function.name),
        arguments: typeof call.function.arguments === 'string' ? call.function.arguments : '{}'
      }
    }));
}

export function createAgentExecutor({
  registry,
  complete,
  buildSystemMessage,
  getAllowedTools,
  executeTool,
  toolContextFactory = () => ({})
}) {
  if (!registry || typeof complete !== 'function' || typeof buildSystemMessage !== 'function') {
    throw new Error('INVALID_AGENT_EXECUTOR_CONFIG');
  }
  if (typeof getAllowedTools !== 'function' || typeof executeTool !== 'function') {
    throw new Error('INVALID_AGENT_EXECUTOR_CONFIG');
  }

  async function run({
    model,
    agent,
    messages,
    traceId,
    signal,
    depth = 0,
    maxTokens = 2048,
    ledger = []
  }) {
    const delegateAgent = async ({ agentId, task }) => {
      const validated = validateDelegation({
        registry,
        sourceAgent: agent,
        targetAgentId: agentId,
        task,
        depth
      });
      const ledgerEntry = {
        parentAgentId: agent.id,
        agentId: validated.target.id,
        depth: validated.nextDepth,
        status: 'running'
      };
      ledger.push(ledgerEntry);

      try {
        const child = await run({
          model,
          agent: validated.target,
          messages: [{ role: 'user', content: validated.task }],
          traceId,
          signal,
          depth: validated.nextDepth,
          maxTokens,
          ledger
        });
        ledgerEntry.status = 'completed';
        ledgerEntry.toolCount = child.tools.length;
        return {
          agent: { id: validated.target.id, name: validated.target.name },
          content: child.content,
          tools: child.tools
        };
      } catch (error) {
        ledgerEntry.status = 'failed';
        ledgerEntry.error = typeof error?.code === 'string' ? error.code : 'DELEGATION_FAILED';
        throw error;
      }
    };

    const baseContext = toolContextFactory({ agent, traceId, depth }) || {};
    const context = {
      ...baseContext,
      traceId,
      agent,
      registry,
      delegationDepth: depth,
      maxDelegationDepth: Number.isInteger(registry?.policy?.maxDelegationDepth)
        ? registry.policy.maxDelegationDepth
        : 0,
      delegateAgent,
      approvalGranted: false
    };
    const tools = getAllowedTools(agent, context);
    const conversation = [buildSystemMessage(agent, traceId), ...messages];
    const firstPayload = {
      model,
      messages: conversation,
      stream: false,
      max_tokens: maxTokens
    };
    if (tools.length) {
      firstPayload.tools = tools;
      firstPayload.tool_choice = 'auto';
    }

    const first = await complete(firstPayload, signal);
    const assistant = normalizeAssistantMessage(first);
    const toolCalls = normalizeToolCalls(assistant);
    if (!toolCalls.length) {
      return {
        content: typeof assistant.content === 'string' ? assistant.content : '',
        tools: [],
        ledger
      };
    }

    const toolMessages = [];
    const toolSummary = [];
    for (const call of toolCalls) {
      const result = await executeTool(agent, call, context);
      toolSummary.push({ name: call.function.name, ok: result.ok, error: result.error || null });
      toolMessages.push({
        role: 'tool',
        tool_call_id: call.id,
        name: call.function.name,
        content: JSON.stringify(result)
      });
    }

    const second = await complete({
      model,
      messages: [
        ...conversation,
        {
          role: 'assistant',
          content: typeof assistant.content === 'string' ? assistant.content : null,
          tool_calls: toolCalls
        },
        ...toolMessages
      ],
      stream: false,
      max_tokens: maxTokens,
      tools,
      tool_choice: 'none'
    }, signal);
    const finalMessage = normalizeAssistantMessage(second);
    return {
      content: typeof finalMessage.content === 'string' ? finalMessage.content : '',
      tools: toolSummary,
      ledger
    };
  }

  return { run };
}
