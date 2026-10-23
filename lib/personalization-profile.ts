// TypeScript migration wave 2026-10.
// User-specific adaptation: style, terminology, LoRA/RAG profile.
function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

export function createPersonalizationProfile({ userId }) {
  const profile = {
    userId,
    style: {},
    terminology: {},
    preferences: {}
  };

  function updateStyle(patch) {
    profile.style = { ...profile.style, ...patch };
  }

  function updateTerminology(patch) {
    profile.terminology = { ...profile.terminology, ...patch };
  }

  function applyToPrompt(prompt) {
    // Stub: inject style and terminology
    let out = prompt;
    for (const [k, v] of Object.entries(profile.terminology)) {
      out = out.replace(new RegExp(k, 'gi'), v);
    }
    return out;
  }

  return Object.freeze({ updateStyle, updateTerminology, applyToPrompt, getProfile: () => ({ ...profile }) });
}
