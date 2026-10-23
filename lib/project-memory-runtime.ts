// TypeScript migration wave 2026-10.
// Project-based persistent memory with workspace context continuity.
function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

export function createProjectMemory({ storagePath = './.hafize/project-memory.json', maxSummaries = 1000 } = {}) {
  const memory = {
    projects: new Map(),
    summaries: []
  };

  function ensureProject(projectId) {
    if (!memory.projects.has(projectId)) {
      memory.projects.set(projectId, { id: projectId, sessions: [], context: {} });
    }
    return memory.projects.get(projectId);
  }

  function appendSession(projectId, sessionId, summary) {
    const proj = ensureProject(projectId);
    proj.sessions.push({ sessionId, summary, ts: Date.now() });
    // Keep rolling summary
    memory.summaries.push({ projectId, sessionId, summary });
    if (memory.summaries.length > maxSummaries) memory.summaries.shift();
  }

  function getContext(projectId, window = 10) {
    const proj = memory.projects.get(projectId);
    if (!proj) return { context: {}, recent: [] };
    const recent = proj.sessions.slice(-window);
    return { context: proj.context, recent };
  }

  function updateContext(projectId, patch) {
    const proj = ensureProject(projectId);
    proj.context = { ...proj.context, ...patch };
  }

  return Object.freeze({ appendSession, getContext, updateContext });
}
