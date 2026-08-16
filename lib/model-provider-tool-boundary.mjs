const LOCAL_MODEL_PREFIX = 'local:';

function fail(code, status = 400) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  throw error;
}

export function isLocalModelId(value) {
  return typeof value === 'string' && value.trim().startsWith(LOCAL_MODEL_PREFIX);
}

export function assertNvidiaToolModel(value) {
  if (isLocalModelId(value)) fail('LOCAL_PROVIDER_TOOLS_UNSUPPORTED', 400);
  return value;
}

export function checkNvidiaToolModel(value) {
  try {
    assertNvidiaToolModel(value);
    return Object.freeze({ ok: true });
  } catch (error) {
    return Object.freeze({
      ok: false,
      error: typeof error?.code === 'string' ? error.code : 'MODEL_PROVIDER_TOOL_BOUNDARY_FAILED',
      status: Number.isInteger(error?.status) ? error.status : 400
    });
  }
}

export const MODEL_PROVIDER_TOOL_BOUNDARY = Object.freeze({
  localModelPrefix: LOCAL_MODEL_PREFIX
});
