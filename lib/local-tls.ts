// HTTPS for the local network. A phone only installs the app, reaches the microphone and runs the
// service worker in a secure context, and a plain LAN address is not one. Certificates come from a
// small local CA whose name constraints limit it to private addresses, so a stolen CA key could not
// impersonate any public site even on a device that trusts it.
import { spawnSync } from 'node:child_process';
import { X509Certificate } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import type { Server as HttpServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';
import { createServer as createTlsServer } from 'node:tls';

const CA_DAYS = 3650;
// Apple refuses server certificates valid for longer than 825 days.
const LEAF_DAYS = 825;
const RENEW_BEFORE_MS = 30 * 24 * 60 * 60 * 1000;
const OPENSSL_CANDIDATES = Object.freeze(['openssl', 'C:\\Program Files\\Git\\mingw64\\bin\\openssl.exe', 'C:\\Program Files\\Git\\usr\\bin\\openssl.exe']);

/** RFC 1918 and carrier-grade NAT (Tailscale) addresses: what a phone can reach and a CA may cover. */
export function isPrivateIpv4(address: string): boolean {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts as [number, number, number, number];
  return a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 100 && b >= 64 && b <= 127);
}

export function lanAddresses(interfaces: ReturnType<typeof networkInterfaces> = networkInterfaces()): string[] {
  const found = new Set<string>();
  for (const items of Object.values(interfaces)) {
    for (const item of items ?? []) if (item.family === 'IPv4' && !item.internal && isPrivateIpv4(item.address)) found.add(item.address);
  }
  return [...found].sort();
}

/** True when the certificate covers every address and is not about to expire. */
export function certificateCovers(pem: string, addresses: readonly string[], now = Date.now()): boolean {
  try {
    const certificate = new X509Certificate(pem);
    if (new Date(certificate.validTo).getTime() - now < RENEW_BEFORE_MS) return false;
    const names = certificate.subjectAltName ?? '';
    return addresses.every((address) => names.includes(`IP Address:${address}`));
  } catch { return false; }
}

function findOpenssl(): string | null {
  for (const candidate of OPENSSL_CANDIDATES) {
    const probe = spawnSync(candidate, ['version'], { windowsHide: true, stdio: 'ignore' });
    if (probe.status === 0) return candidate;
  }
  return null;
}

export function ensureLocalCertificates({ dir, addresses, openssl = findOpenssl() }: { readonly dir: string; readonly addresses: readonly string[]; readonly openssl?: string | null }): { key: string; cert: string; ca: string } | null {
  mkdirSync(dir, { recursive: true });
  const path = (name: string) => join(dir, name);
  const haveLeaf = existsSync(path('server.key')) && existsSync(path('server.crt')) && existsSync(path('ca.crt'));
  if (haveLeaf && certificateCovers(readFileSync(path('server.crt'), 'utf8'), addresses)) return load();
  if (!openssl) return haveLeaf ? load() : null;

  const run = (args: readonly string[]) => {
    const result = spawnSync(openssl, args, { cwd: dir, windowsHide: true, stdio: 'ignore' });
    if (result.status !== 0) throw new Error('LOCAL_TLS_OPENSSL_FAILED');
  };
  const privateFile = (name: string) => { try { chmodSync(path(name), 0o600); } catch { /* Windows has no POSIX modes */ } };

  if (!existsSync(path('ca.key')) || !existsSync(path('ca.crt'))) {
    writeFileSync(path('ca.cnf'), [
      '[req]', 'prompt=no', 'distinguished_name=dn', 'x509_extensions=ext',
      '[dn]', 'CN=Hafize Yerel CA', 'O=Hafize',
      '[ext]', 'basicConstraints=critical,CA:TRUE,pathlen:0', 'keyUsage=critical,keyCertSign,cRLSign', 'subjectKeyIdentifier=hash',
      'nameConstraints=critical,permitted;IP:127.0.0.0/255.0.0.0,permitted;IP:10.0.0.0/255.0.0.0,permitted;IP:172.16.0.0/255.240.0.0,permitted;IP:192.168.0.0/255.255.0.0,permitted;IP:100.64.0.0/255.192.0.0,permitted;DNS:localhost'
    ].join('\n'));
    run(['req', '-x509', '-new', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes', '-sha256', '-days', String(CA_DAYS), '-keyout', 'ca.key', '-out', 'ca.crt', '-config', 'ca.cnf']);
    privateFile('ca.key');
  }
  const names = ['DNS.1=localhost', 'IP.1=127.0.0.1', ...addresses.map((address, index) => `IP.${index + 2}=${address}`)];
  writeFileSync(path('server.cnf'), [
    '[req]', 'prompt=no', 'distinguished_name=dn', 'req_extensions=ext',
    '[dn]', 'CN=Hafize',
    '[ext]', 'basicConstraints=critical,CA:FALSE', 'keyUsage=critical,digitalSignature', 'extendedKeyUsage=serverAuth', 'subjectAltName=@san',
    '[san]', ...names
  ].join('\n'));
  run(['req', '-new', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes', '-sha256', '-keyout', 'server.key', '-out', 'server.csr', '-config', 'server.cnf']);
  privateFile('server.key');
  run(['x509', '-req', '-in', 'server.csr', '-CA', 'ca.crt', '-CAkey', 'ca.key', '-CAcreateserial', '-sha256', '-days', String(LEAF_DAYS), '-extfile', 'server.cnf', '-extensions', 'ext', '-out', 'server.crt']);
  rmSync(path('server.csr'), { force: true });
  return load();

  function load() {
    return { key: readFileSync(path('server.key'), 'utf8'), cert: readFileSync(path('server.crt'), 'utf8'), ca: readFileSync(path('ca.crt'), 'utf8') };
  }
}

/**
 * Serves the existing HTTP app over TLS on all interfaces. Decrypted sockets go straight into the
 * HTTP server, so the auth guard still sees the real client address: a phone is never mistaken for
 * a loopback caller. Refuses to start without authentication, because this opens the LAN.
 */
export function startLocalHttps({ httpServer, port, dataDir, authRequired, log = console.log }: { readonly httpServer: HttpServer; readonly port: number; readonly dataDir: string; readonly authRequired: boolean; readonly log?: (line: string) => void }) {
  if (!Number.isInteger(port) || port < 1 || port > 65_535) return null;
  if (!authRequired) { log('Hafize HTTPS kapalı: yerel ağa açmak için HAFIZE_AUTH_REQUIRED=true olmalı.'); return null; }
  const addresses = lanAddresses();
  let material: ReturnType<typeof ensureLocalCertificates> = null;
  try { material = ensureLocalCertificates({ dir: join(dataDir, 'tls'), addresses }); } catch { /* reported below */ }
  if (!material) { log('Hafize HTTPS kapalı: sertifika üretilemedi (openssl bulunamadı).'); return null; }
  const { ca } = material;

  const server = createTlsServer({ key: material.key, cert: material.cert, ALPNProtocols: ['http/1.1'], minVersion: 'TLSv1.2' }, (socket) => { httpServer.emit('connection', socket); });
  // A phone that does not trust the CA yet aborts the handshake; that is not an application error.
  server.on('tlsClientError', () => {});
  server.on('error', (error: NodeJS.ErrnoException) => { log(`Hafize HTTPS başlatılamadı: ${error.code || 'bilinmeyen hata'}`); });
  server.listen(port, '0.0.0.0', () => { log(`Hafize HTTPS: ${addresses.map((address) => `https://${address}:${port}`).join(', ') || `https://127.0.0.1:${port}`}`); });

  return Object.freeze({
    caCertificate: () => ca,
    info: () => ({ port, urls: addresses.map((address) => `https://${address}:${port}/`), caPath: '/hafize-ca.crt' }),
    close: () => { server.close(); }
  });
}
