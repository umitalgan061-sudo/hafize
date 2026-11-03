// public/ klasörünü (derlenmiş typed-build/ dahil) Cloudflare'e gidecek dist-cf/ klasörüne kopyalar
// ve server.ts'in her statik yanıta eklediği güvenlik başlıklarını _headers dosyasıyla aynen verir.
import { cpSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const SOURCE = resolve(ROOT, 'public');
const OUT = resolve(ROOT, 'dist-cf');

if (!existsSync(resolve(SOURCE, 'typed-build', 'app-shell.js'))) {
  console.error('public/typed-build eksik: önce `npm run build` çalıştırın.');
  process.exit(1);
}

rmSync(OUT, { recursive: true, force: true });
cpSync(SOURCE, OUT, { recursive: true });

// lib/http-runtime.ts → setSecurityHeaders ile aynı değerler.
const csp = "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: blob:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self' https: wss:; media-src 'self' blob:; worker-src 'self' blob:";

const headers = `/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(self), geolocation=()
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-origin
  Origin-Agent-Cluster: ?1
  Content-Security-Policy: ${csp}

/typed-build/sw.js
  Service-Worker-Allowed: /
  Cache-Control: no-cache

/index.html
  Cache-Control: no-cache
`;

writeFileSync(resolve(OUT, '_headers'), headers);
console.log('dist-cf hazır.');
