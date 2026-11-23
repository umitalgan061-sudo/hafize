/**
 * Exact, owner-approved Cloud Run routing. Never guess a service/region from
 * the Firebase site name. This code only operates on the temporary CI copy of
 * firebase.json; the owner's Hosting secret remains unchanged.
 */
import { readFileSync } from 'node:fs';

export const HAFIZE_CLOUD_RUN = Object.freeze({
  projectId: 'projelerim-8fecd',
  siteId: 'hafize-ua',
  serviceId: 'hafize-backend',
  region: 'europe-west1'
});
export const ACTIVATION_MARKER_PATH = 'config/hafize-cloud-backend-live.json';

export function backendRouteActivated(read = readFileSync) {
  try {
    const marker = JSON.parse(read(ACTIVATION_MARKER_PATH, 'utf8'));
    return marker && marker.activated === true &&
      Object.entries(HAFIZE_CLOUD_RUN).every(([key, value]) => marker[key] === value);
  } catch {
    return false;
  }
}

export function attachCloudRunRewrite(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config) ||
      !config.hosting || typeof config.hosting !== 'object' || Array.isArray(config.hosting)) {
    throw new Error('HAFIZE_BACKEND_INVALID_HOSTING_CONFIG');
  }
  const hosting = config.hosting;
  if (hosting.site !== HAFIZE_CLOUD_RUN.siteId) {
    throw new Error('HAFIZE_BACKEND_WRONG_HOSTING_SITE');
  }
  if (hosting.rewrites != null && !Array.isArray(hosting.rewrites)) {
    throw new Error('HAFIZE_BACKEND_INVALID_REWRITES');
  }
  const old = hosting.rewrites || [];
  const other = old.filter((rule) => rule?.source !== '/api/**');
  const api = {
    source: '/api/**',
    run: { serviceId: HAFIZE_CLOUD_RUN.serviceId, region: HAFIZE_CLOUD_RUN.region }
  };
  return {
    ...config,
    hosting: {
      ...hosting,
      rewrites: [api, ...other]
    }
  };
}
