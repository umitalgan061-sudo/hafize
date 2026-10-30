import { X509Certificate } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { certificateCovers, ensureLocalCertificates, isPrivateIpv4, lanAddresses } from './local-tls.ts';
import { createLocalhostServers, resolveStaticFile } from './localhost-servers.ts';
import { createScreenWatch, SCREEN_LIMITS } from './screen-watch.ts';

const temp: string[] = [];
const tempDir = () => { const dir = mkdtempSync(join(tmpdir(), 'hafize-reach-')); temp.push(dir); return dir; };
afterEach(() => { for (const dir of temp.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe('localhost servers', () => {
  it('publishes a folder and serves no secrets or anything outside it', async () => {
    const dir = tempDir();
    mkdirSync(join(dir, 'site'));
    writeFileSync(join(dir, 'site', 'index.html'), '<h1>Merhaba</h1>');
    writeFileSync(join(dir, 'site', '.env'), 'X=1');
    writeFileSync(join(dir, 'site', 'server.key'), 'gizli');
    writeFileSync(join(dir, 'outside.txt'), 'dış');
    const servers = createLocalhostServers({ workspaceDir: dir });
    const started = await servers.start('me', { path: 'site' });
    try {
      expect(started.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);
      expect(await (await fetch(started.url)).text()).toBe('<h1>Merhaba</h1>');
      for (const path of ['.env', 'server.key', '..%2Foutside.txt', '%2e%2e/outside.txt']) {
        expect((await fetch(`${started.url}${path}`)).status, path).toBe(404);
      }
    } finally { servers.stopAll(); }
  });

  it('has no cap on how many run at once and gives each its own port', async () => {
    const dir = tempDir();
    const servers = createLocalhostServers({ workspaceDir: dir });
    try {
      const started = await Promise.all(Array.from({ length: 40 }, () => servers.start('me', {})));
      expect(new Set(started.map((item) => item.port)).size).toBe(40);
      expect(servers.list('me').filter((item) => item.status === 'running')).toHaveLength(40);
    } finally { servers.stopAll(); }
  });

  it('keeps owners apart and stops only on request', async () => {
    const servers = createLocalhostServers({ workspaceDir: tempDir() });
    const started = await servers.start('me', {});
    try {
      expect(servers.list('other')).toEqual([]);
      expect(servers.stop('other', started.id)).toBe(false);
      expect((await fetch(started.url)).status).toBe(404);
      expect(servers.stop('me', started.id)).toBe(true);
      await expect(fetch(started.url)).rejects.toThrow();
    } finally { servers.stopAll(); }
  });

  it('refuses folders outside the workspace', async () => {
    const dir = tempDir();
    const servers = createLocalhostServers({ workspaceDir: join(dir, 'ws') });
    await expect(servers.start('me', { path: '..' })).rejects.toMatchObject({ code: 'LOCALHOST_PATH_OUTSIDE_WORKSPACE' });
    await expect(servers.start('me', { path: 'yok' })).rejects.toMatchObject({ code: 'LOCALHOST_FOLDER_NOT_FOUND' });
  });

  it('never runs a command without approval', async () => {
    const servers = createLocalhostServers({ workspaceDir: tempDir() });
    await expect(servers.start('me', { command: 'node -v' })).rejects.toMatchObject({ code: 'LOCALHOST_NEEDS_APPROVAL' });
    await expect(servers.start('me', { command: 'node -v' }, async () => false)).rejects.toMatchObject({ code: 'LOCALHOST_DENIED' });
    expect(servers.list('me')).toEqual([]);
  });

  it('runs an approved command, hands it a port, and stops the whole process tree', async () => {
    const dir = tempDir();
    writeFileSync(join(dir, 'app.mjs'), "import { createServer } from 'node:http';\ncreateServer((_q, r) => r.end(process.env.NVIDIA_API_KEY || 'temiz')).listen(Number(process.env.PORT), process.env.HOST);\n");
    process.env.NVIDIA_API_KEY = 'sizmamali';
    const servers = createLocalhostServers({ workspaceDir: dir });
    try {
      const started = await servers.start('me', { command: `& "${process.execPath}" app.mjs` }, async () => true);
      expect(started.status).toBe('running');
      expect(await (await fetch(started.url)).text()).toBe('temiz');
      expect(servers.stop('me', started.id)).toBe(true);
      await new Promise((done) => setTimeout(done, 400));
      await expect(fetch(started.url)).rejects.toThrow();
    } finally { delete process.env.NVIDIA_API_KEY; servers.stopAll(); }
  }, 60_000);

  it('does not follow a link out of the folder', () => {
    const dir = tempDir();
    mkdirSync(join(dir, 'site'));
    writeFileSync(join(dir, 'gizli.txt'), 'x');
    try { symlinkSync(join(dir, 'gizli.txt'), join(dir, 'site', 'link.txt')); } catch { return; } // Windows needs a privilege for links
    expect(resolveStaticFile(join(dir, 'site'), '/link.txt')).toBeNull();
  });
});

describe('local TLS', () => {
  it('recognises only private addresses', () => {
    for (const address of ['10.1.2.3', '172.16.0.1', '172.31.255.1', '192.168.1.5', '100.100.1.1']) expect(isPrivateIpv4(address), address).toBe(true);
    for (const address of ['8.8.8.8', '172.32.0.1', '192.169.0.1', '127.0.0.1', '100.128.0.1', 'x']) expect(isPrivateIpv4(address), address).toBe(false);
    expect(lanAddresses({ a: [{ family: 'IPv4', internal: false, address: '192.168.1.9' }, { family: 'IPv4', internal: true, address: '127.0.0.1' }, { family: 'IPv4', internal: false, address: '8.8.8.8' }] } as never)).toEqual(['192.168.1.9']);
  });

  it('issues a constrained CA and a leaf that follows the address', () => {
    const dir = tempDir();
    const first = ensureLocalCertificates({ dir, addresses: ['192.168.1.9'] });
    if (!first) return; // no openssl on this machine
    const ca = new X509Certificate(first.ca);
    const leaf = new X509Certificate(first.cert);
    expect(ca.ca).toBe(true);
    expect(leaf.ca).toBe(false);
    expect(leaf.checkIssued(ca)).toBe(true);
    expect(leaf.subjectAltName).toContain('IP Address:192.168.1.9');
    expect(certificateCovers(first.cert, ['192.168.1.9'])).toBe(true);
    expect(certificateCovers(first.cert, ['192.168.1.10'])).toBe(false);
    expect(certificateCovers(first.cert, ['192.168.1.9'], Date.now() + 900 * 86_400_000)).toBe(false);
    const again = ensureLocalCertificates({ dir, addresses: ['192.168.1.9'] });
    expect(again?.cert).toBe(first.cert);
    const moved = ensureLocalCertificates({ dir, addresses: ['192.168.1.10'] });
    expect(moved?.ca).toBe(first.ca);
    expect(new X509Certificate(moved!.cert).subjectAltName).toContain('IP Address:192.168.1.10');
    expect(readFileSync(join(dir, 'ca.cnf'), 'utf8')).toContain('nameConstraints=critical');
  }, 30_000);
});

describe('screen watch', () => {
  const frame = { ownerId: 'me', bytes: Buffer.from('x'), mime: 'image/jpeg' };

  it('says nothing when no screen is shared', () => {
    const watch = createScreenWatch({ vision: async () => ({ text: 'x' }) });
    expect(watch.contextFor('me')).toBe('');
  });

  it('hands descriptions over as data, newest last, and only to their owner', async () => {
    let moment = 1_000_000;
    const texts = ['Tarayıcıda GitHub açık', 'Terminalde hata var'];
    const watch = createScreenWatch({ vision: async () => ({ text: texts.shift()! }), now: () => moment });
    await watch.observe(frame);
    moment += 30_000;
    await watch.observe(frame);
    const context = watch.contextFor('me');
    expect(context).toContain('veri olarak değerlendir');
    expect(context.indexOf('GitHub')).toBeLessThan(context.indexOf('Terminalde'));
    expect(context).toContain('[şimdi] Terminalde hata var');
    expect(context).toContain('[30 sn önce] Tarayıcıda GitHub açık');
    expect(watch.contextFor('other')).toBe('');
  });

  it('forgets everything on stop and when the sharing browser goes away', async () => {
    let moment = 1_000;
    const watch = createScreenWatch({ vision: async () => ({ text: 'ekran' }), now: () => moment });
    await watch.observe(frame);
    expect(watch.end('me')).toBe(true);
    expect(watch.contextFor('me')).toBe('');
    await watch.observe(frame);
    moment += SCREEN_LIMITS.sessionTtlMs + 1;
    expect(watch.contextFor('me')).toBe('');
    expect(watch.status('me').active).toBe(false);
  });

  it('drops background frames while busy but never a frame sent for a question', async () => {
    const releases: (() => void)[] = [];
    const watch = createScreenWatch({ vision: async () => { await new Promise<void>((done) => { releases.push(done); }); return { text: 'ekran' }; } });
    const first = watch.observe(frame);
    expect(await watch.observe(frame)).toEqual({ observed: false });
    const asked = watch.observe({ ...frame, question: 'Bu hata ne?' });
    expect(releases).toHaveLength(2);
    for (const release of releases) release();
    await Promise.all([first, asked]);
  });

  it('keeps a bounded history and redacts credentials', async () => {
    const watch = createScreenWatch({ vision: async () => ({ text: 'token: ghp_0123456789abcdefghijklmnopqrstuvwxyz0123' }) });
    for (let index = 0; index < SCREEN_LIMITS.maxEvents + 3; index += 1) await watch.observe(frame);
    expect(watch.status('me').events).toBe(SCREEN_LIMITS.maxEvents);
    expect(watch.contextFor('me')).not.toContain('ghp_0123456789');
  });
});
