/** Explicit opt-in. Gateway credentials are never taken from the NVIDIA configuration. */
export function freeLlmGateway(env: Record<string, string | undefined>) {
  const endpoint = env.HAFIZE_FREELLM_BASE_URL?.trim();
  const key = env.HAFIZE_FREELLM_API_KEY?.trim();
  const model = env.HAFIZE_FREELLM_MODEL?.trim();
  if (!endpoint && !key && !model) return null;
  if (!endpoint || !key || !model) throw new Error('FREELLM_CONFIG_INCOMPLETE');
  const url = new URL(endpoint);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) ||
      url.username || url.password || url.search || url.hash) throw new Error('FREELLM_INVALID_ENDPOINT');
  return { baseUrl: url.href.replace(/\/+$/, ''), apiKey: key, model };
}
