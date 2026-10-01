# TypeScript platform wave — connector + skills

## Amaç

Bu dalga Hafize'nin connector/OAuth ve skills extensibility katmanındaki kalan JavaScript modüllerini gerçek TypeScript runtime yoluna taşır.

Yeni `.ts` kaynaklar çalışma kodunu taşır; eski `.mjs` yolları yalnızca geriye dönük `export *` köprüsü olarak korunur.

## Taşınan alanlar

### Connector / OAuth

- Canva OAuth policy ve runtime
- Canva read client
- Canva token exchange / refresh / revoke
- Google OAuth policy ve runtime
- Google token exchange
- Gmail read client
- Gmail send contract / boundary
- Ortak OAuth flow runtime
- Encrypted OAuth token store runtime
- Encrypted OAuth token file store

### Skills

- skill selector
- skills manifest doğrulama
- skills registry
- skills runtime
- connector capability matrix

## Güvenlik davranışı

Göç sırasında OAuth state + PKCE, HTTPS redirect URI, connector ownership, encrypted token store, path containment, tool allowlist, secret redaction ve explicit user intent kontrolleri korunur.

## Uyumluluk modeli

Eski `.mjs` import path'leri silinmedi. Bunlar yalnızca typed `.ts` kaynağına re-export yapan ince köprülerdir. Böylece mevcut tüketiciler aynı modül adını kullanırken gerçek çalışma kodu TypeScript'ten yüklenir.

## Doğrulama

`scripts/test-typescript-platform-wave.mjs` migrated `.ts` dosyalarının varlığını, `.mjs` bridge bütünlüğünü, migrated modüller arası legacy import yokluğunu, connector agent runtime wiring'ini, token-store güvenlik kontratını, skills zincirini ve `check:modern` entegrasyonunu doğrular.

## Sonraki aşama

Kalan legacy alanlar domain bazında azaltılabilir. En yüksek etkili adaylar memory/persistence ve schedule-adapter katmanlarıdır; her biri ayrı ve geri alınabilir migration dalgası olarak ele alınmalıdır.

## Rollback

Bir sorun görülürse bridge dosyaları korunarak ilgili typed kaynağın önceki commit'i revert edilebilir. Bu yaklaşım connector ve skills davranışını tek seferde silmek yerine küçük bir yüzeyde geri almayı sağlar.
