// TypeScript migration wave 2026-10.
// Offline/local runtime adapter for llama.cpp/Ollama/vLLM.
function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

export function createOfflineRuntime({ provider = 'ollama', model = 'llama3', baseUrl = 'http://localhost:11434' } = {}) {
  async function complete({ prompt, maxTokens = 512 } = {}) {
    // Stub: real call would POST to provider API
    return { text: '', tokensUsed: 0, provider };
  }

  async function embed({ text } = {}) {
    return { embedding: new Array(768).fill(0) };
  }

  function health() {
    return { ok: true, provider, model };
  }

  return Object.freeze({ complete, embed, health });
}
