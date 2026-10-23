// TypeScript migration wave 2026-10.
// Vision encoder API stub.
function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

export function createVisionEncoder({ model = 'stub-vision' } = {}) {
  function encode(imageBuffer) {
    if (!imageBuffer) fail('INVALID_VISION_INPUT');
    // Stub: real implementation would run CLIP / ViT.
    return Object.freeze({ embedding: new Array(512).fill(0), model, dim: 512 });
  }

  function similarity(a, b) {
    if (!a.embedding || !b.embedding) fail('INVALID_VISION_EMBEDDING');
    let dot = 0;
    for (let i = 0; i < a.embedding.length; i++) dot += a.embedding[i] * b.embedding[i];
    return dot;
  }

  return Object.freeze({ encode, similarity });
}
