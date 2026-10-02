import { describe, expect, it } from 'vitest';
import { buildSystemReadiness } from './system-readiness.ts';

const allReadyRuntime = {
  auth: { status: 'ready' }, pwa: { status: 'ready' }, skills: { status: 'ready' },
  memory: { status: 'ready' }, schedule: { status: 'ready' }, connectors: { status: 'ready' }, model: { status: 'ready' }
};

describe('buildSystemReadiness', () => {
  it('normalizes a fully healthy system without exposing secret values', () => {
    const authToken = 'a'.repeat(40);
    const report = buildSystemReadiness({
      env: {
        HOST: '127.0.0.1',
        NODE_ENV: 'development',
        HAFIZE_AUTH_TOKEN: authToken,
        NVIDIA_API_KEY: 'nvapi-never-report-this',
        GITHUB_TOKEN: 'ghp_never_report_this'
      },
      runtime: allReadyRuntime,
      pwaReady: true,
      releaseReady: true,
      releaseChecksPass: true
    });
    expect(report.state).toBe('ready');
    expect(report.releaseable).toBe(true);
    expect(report.summary).toEqual({ total: 8, ready: 8, warning: 0, blocked: 0, unknown: 0 });
    expect(report.components).toMatchObject({ auth: 'ready', pwa: 'ready', release: 'ready' });

    // Variable names are public documentation; the values behind them must
    // never reach a readiness report.
    const serialized = JSON.stringify(report);
    expect(serialized).toContain('"HAFIZE_AUTH_TOKEN"');
    expect(serialized).not.toContain(authToken);
    expect(serialized).not.toContain('nvapi-never-report-this');
    expect(serialized).not.toContain('ghp_never_report_this');
  });

  it('blocks public production without a valid auth secret', () => {
    const report = buildSystemReadiness({
      env: { HOST: '0.0.0.0', NODE_ENV: 'production', HAFIZE_AUTH_TOKEN: 'short' },
      runtime: allReadyRuntime,
      pwaReady: true,
      releaseReady: true,
      releaseChecksPass: true
    });
    expect(report.state).toBe('blocked');
    expect(report.releaseable).toBe(false);
    expect(report.components.auth).toBe('blocked');
    expect(report.summary.blocked).toBeGreaterThan(0);
  });

  it('keeps unknown PWA status explicit instead of guessing readiness', () => {
    const report = buildSystemReadiness({
      env: { HOST: '127.0.0.1', NODE_ENV: 'development' },
      runtime: allReadyRuntime,
      releaseReady: true
    });
    expect(report.components.pwa).toBe('unknown');
    expect(report.state).toBe('unknown');
    expect(report.releaseable).toBe(false);
  });

  it('maps runtime warnings to user-visible warning states', () => {
    const report = buildSystemReadiness({
      env: { HOST: '127.0.0.1', NODE_ENV: 'development' },
      runtime: {
        ...allReadyRuntime,
        schedule: { status: 'warning' },
        connectors: { status: 'warning' }
      },
      pwaReady: true,
      releaseReady: true,
      releaseChecksPass: true
    });
    expect(report.components.schedule).toBe('warning');
    expect(report.components.connectors).toBe('warning');
    expect(report.state).toBe('degraded');
  });

  it('honors an explicit failed release check', () => {
    const report = buildSystemReadiness({
      env: { HOST: '127.0.0.1', NODE_ENV: 'development' },
      runtime: allReadyRuntime,
      pwaReady: true,
      releaseReady: true,
      releaseChecksPass: false
    });
    expect(report.state).toBe('ready');
    expect(report.releaseable).toBe(false);
  });

  it('counts every component deterministically', () => {
    const report = buildSystemReadiness({
      env: { HOST: '127.0.0.1', NODE_ENV: 'development' },
      runtime: {
        auth: { status: 'ready' },
        pwa: { status: 'unknown' },
        skills: { status: 'blocked' },
        memory: { status: 'warning' },
        schedule: { status: 'ready' },
        connectors: { status: 'ready' },
        model: { status: 'ready' }
      },
      pwaReady: false,
      releaseReady: false,
      releaseChecksPass: true
    });
    expect(report.summary.total).toBe(8);
    expect(report.summary.ready).toBe(4);
    expect(report.summary.warning).toBe(1);
    expect(report.summary.blocked).toBe(2);
    expect(report.summary.unknown).toBe(1);
  });
});
