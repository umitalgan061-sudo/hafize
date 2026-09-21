# TypeScript güvenlik migration sözleşmesi

Bu doküman, güvenlik açısından hassas runtime sınırlarının TypeScript'e taşınırken davranışlarının korunmasını tanımlar.

## OAuth ve credential verisi

PKCE verifier/state üretimi kriptografik rastgelelik kullanır. Authorization URL yalnızca HTTPS endpoint ve HTTPS redirect URI kabul eder; credential içeren URL bileşenleri reddedilir.

OAuth callback yalnızca izin verilen alanları kabul eder. Başarılı callback'te `code + state`, hata callback'inde `error + state` modeli korunur.

OAuth flow store bounded kapasite ve TTL uygular. State collision ile expired flow birbirinden ayrılır ve consume tek kullanımlıdır.

## Token şifreleme

OAuth token envelope ve personal-memory snapshot için AES-256-GCM kullanılır. Anahtar uzunluğu 32 byte, IV 12 byte ve authentication tag 16 byte'tır.

Decrypt işlemi bilinmeyen alan, yanlış sürüm, yanlış algoritma, yanlış anahtar veya bozulmuş ciphertext durumunda fail-closed davranır. Şifreli envelope plaintext içeriği açığa çıkarmaz.

## HTTP sınırı

Typed HTTP runtime:

- JSON body boyutunu sınırlar,
- body'nin object olmasını doğrular,
- `no-store` JSON response üretir,
- SSE response'larında security headers ve buffering kontrolü uygular,
- client disconnect ve timeout için AbortSignal üretir.

API response cache'lenmez; service worker yalnız shell asset'larını cache'ler.

## Connector ve agent sınırları

GitHub read boundary repository allowlist, path traversal, hassas dosya yolu ve plaintext credential içerik kontrolünü korur.

Canva/Gmail runtime'ları authentication, owner resolution ve token store dependency'lerini zorunlu kılar. Partial configuration doğrudan startup error üretir.

Agent tool authorization backend policy tarafından verilir. TypeScript migration yeni yetki üretmez ve approval gerektiren tool'ları bypass etmez.

## Browser auth

Browser auth entry'si erişim anahtarını localStorage'a kaydetmez. Authenticated API request'lerinde SameSite cookie oturumu ve state-changing isteklerde CSRF header modeli korunur.

## Test contract

Her security migration modülü için davranış testi bulunur. Release gate testleri ayrıca:

- TS entry yollarını,
- package start komutlarını,
- Vite typed-build girişlerini,
- PWA cache yollarını,
- legacy entry'lerin HTML dışında bırakılmasını

doğrular.

Migration'ın amacı güvenlik politikalarını değiştirmek değil, aynı politikaları daha güçlü bir statik kaynak diliyle sürdürülebilir hale getirmektir.
