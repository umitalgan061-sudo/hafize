import { describe, expect, it } from 'vitest';
import {
  planLocalGitHubAppEnv,
  GitHubAppLocalConfigError
} from './github-app-local-config.mjs';

const keyPath = 'C:\\Users\\tester\\AppData\\Local\\Hafize\\secrets\\hafize-github-app.pem';

describe('local GitHub App backend configuration', () => {
  it('makes a safe localhost-only config from an empty checkout', () => {
    const output = planLocalGitHubAppEnv('', keyPath);
    expect(output.mode).toBe('create');
    expect(output.content).toContain('NODE_ENV=development\nHOST=127.0.0.1\nPORT=4173');
    expect(output.content).toContain('HAFIZE_GITHUB_APP_ID=5833389');
    expect(output.content).toContain('HAFIZE_GITHUB_APP_INSTALLATION_ID=183684460');
    expect(output.content).toContain('HAFIZE_GITHUB_APP_PRIVATE_KEY_PATH=' + keyPath);
    expect(output.content).toContain('HAFIZE_GITHUB_READ_REPOS=umitalgan061-sudo/hafize');
    expect(output.content).toContain('HAFIZE_GITHUB_WRITE_REPOS=umitalgan061-sudo/hafize');
    expect(output.content).not.toContain('PRIVATE KEY-----');
  });

  it('preserves unrelated credentials and explicit existing repository permissions', () => {
    const oldEnv = [
      'NODE_ENV=development',
      'HOST=127.0.0.1',
      'HAFIZE_AUTH_TOKEN=example-keep-this-unchanged',
      'NVIDIA_API_KEY=example-keep-this-too',
      'GITHUB_TOKEN=example-legacy-token',
      'HAFIZE_GITHUB_READ_REPOS=owner/read-only',
      'HAFIZE_GITHUB_WRITE_REPOS=owner/write-enabled',
      ''
    ].join('\n');
    const output = planLocalGitHubAppEnv(oldEnv, keyPath);
    expect(output.content).toContain('HAFIZE_AUTH_TOKEN=example-keep-this-unchanged');
    expect(output.content).toContain('NVIDIA_API_KEY=example-keep-this-too');
    expect(output.content).toContain('GITHUB_TOKEN=example-legacy-token');
    expect(output.content).toContain('HAFIZE_GITHUB_READ_REPOS=owner/read-only,umitalgan061-sudo/hafize');
    expect(output.content).toContain('HAFIZE_GITHUB_WRITE_REPOS=owner/write-enabled,umitalgan061-sudo/hafize');
    expect(output.content).not.toContain('HAFIZE_GITHUB_READ_REPOS=owner/read-only\n');
  });

  it('is idempotent and avoids duplicate app configuration settings', () => {
    const first = planLocalGitHubAppEnv('', keyPath);
    const second = planLocalGitHubAppEnv(first.content, keyPath);
    expect(second.content).toBe(first.content);
    expect(second.content.match(/HAFIZE_GITHUB_APP_ID=/g)).toHaveLength(1);
    expect(second.content.match(/HAFIZE_GITHUB_WRITE_REPOS=/g)).toHaveLength(1);
  });

  it('fails closed when trying to alter a different existing app or private key', () => {
    for (const line of [
      'HAFIZE_GITHUB_APP_ID=999999',
      'HAFIZE_GITHUB_APP_INSTALLATION_ID=999999',
      'HAFIZE_GITHUB_APP_PRIVATE_KEY_PATH=C:\\Users\\someone\\wrong.pem',
      'HAFIZE_GITHUB_APP_SLUG=other-app'
    ]) {
      expect(() => planLocalGitHubAppEnv(line, keyPath)).toThrowError(
        new GitHubAppLocalConfigError('GITHUB_APP_EXISTING_SETTING_CONFLICT')
      );
    }
  });

  it('rejects production or public bind settings on the local-only path', () => {
    for (const oldEnv of [
      'NODE_ENV=production\nHOST=127.0.0.1',
      'NODE_ENV=development\nHOST=0.0.0.0',
      'NODE_ENV=development\nHOST=::',
      'HOST=192.168.0.10'
    ]) {
      expect(() => planLocalGitHubAppEnv(oldEnv, keyPath)).toThrowError(
        new GitHubAppLocalConfigError('GITHUB_APP_LOCAL_ONLY')
      );
    }
  });

  it('rejects duplicate keys, wildcard repository permissions and unsafe env values', () => {
    expect(() => planLocalGitHubAppEnv('HAFIZE_GITHUB_APP_ID=5833389\nHAFIZE_GITHUB_APP_ID=5833389', keyPath))
      .toThrowError(new GitHubAppLocalConfigError('GITHUB_APP_DUPLICATE_ENV_KEY'));
    expect(() => planLocalGitHubAppEnv('HAFIZE_GITHUB_WRITE_REPOS=*', keyPath))
      .toThrowError(new GitHubAppLocalConfigError('GITHUB_APP_INVALID_REPOSITORY_ALLOWLIST'));
    expect(() => planLocalGitHubAppEnv('', 'C:\\malicious#path'))
      .toThrowError(new GitHubAppLocalConfigError('GITHUB_APP_UNSAFE_KEY_PATH'));
  });

  it('does not duplicate the main repository if already allowlisted', () => {
    const out = planLocalGitHubAppEnv([
      'HAFIZE_GITHUB_READ_REPOS=umitalgan061-sudo/hafize',
      'HAFIZE_GITHUB_WRITE_REPOS=umitalgan061-sudo/hafize'
    ].join('\n'), keyPath);
    expect(out.content.match(/umitalgan061-sudo\/hafize/g)).toHaveLength(2);
  });
});
