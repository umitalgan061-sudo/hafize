# Check gate — otomatik keşifli test kapısı

`npm run check` artık `scripts/run-tests.mjs` üzerinden çalışır. Gate hedefleri
`package.json` içindeki elle tutulan uzun komut zincirinden değil, doğrudan dosya
sisteminden keşfedilir.

## Neden değişti

Elle tutulan zincirde iki somut sorun ölçüldü:

- `scripts/` altındaki 86 test dosyasının **33'ü** hiçbir npm script'i tarafından
  çağrılmıyordu (canva OAuth/token, google OAuth, oauth-pkce, encrypted token store,
  personal memory encryption/runtime, device bridge, screen share, hands-free,
  local model provider, schedule lease executor testleri dâhil). Bu testler yeşil
  olsa bile regresyon yakalamıyorlardı.
- Zincirde yer alan iki kontrol kırıktı ve kapı kırmızıydı:
  `scripts/test-tool-runtime.mjs` connector araçları (`canva_read`, `gmail_read`)
  katalog'a eklendikten sonra güncellenmemişti; `lib/gmail-read-client.mjs`
  `read(null)` çağrısında `INVALID_GMAIL_READ` yerine `TypeError` fırlatıyordu.

Her yeni test dosyasının ayrıca `package.json`'a eklenmesini gerektiren yapı,
bu tür sessiz kapsam kaybını tekrar üretir. Keşif tabanlı runner bunu yapısal
olarak engeller.

## Gate ne çalıştırır

1. **Syntax kontrolü** (`node --check`): `server.mjs`, `lib/*.mjs`,
   `public/*.js`, `scripts/*.mjs`.
2. **Testler**: `scripts/test-*.mjs` dosyalarının tamamı, alfabetik ve
   deterministik sırayla, ayrı Node süreçlerinde.

Runner kendini test olarak çalıştırmaz; her hedef için 120 saniyelik zaman aşımı
uygulanır ve başarısız hedeflerin son satırları özet bloğunda toplanır. Çıkış
kodu, tek bir hedef bile başarısızsa sıfırdan farklıdır.

## Kullanım

```bash
npm run check              # tüm kapı (yaklaşık 16 s)
npm run check -- gmail     # yalnız adı "gmail" içeren hedefler
```

Filtre hem syntax hem test hedeflerine uygulanır; hiçbir hedefe uymayan filtre
sessizce yeşil dönmez, çalıştırılan test sayısı `0` olarak raporlanır.

## Kapının kendi testi

`scripts/test-check-gate.mjs`, keşfin `scripts/test-*.mjs` ve `lib/*.mjs`
dosyalarının tamamını kapsadığını, sıralamanın deterministik olduğunu, runner'ın
kendini çalıştırmadığını ve filtre davranışını doğrular. Yeni bir test dosyası
eklenip kapsam dışı kalırsa bu test kırmızıya döner.

## Geri alma

`package.json` içindeki `check` script'i eski komut zinciriyle değiştirilebilir;
`scripts/run-tests.mjs` ve `scripts/test-check-gate.mjs` silinebilir. Runtime
davranışı etkilenmez — bu katman yalnız geliştirme kapısıdır.
