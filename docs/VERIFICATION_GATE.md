# Doğrulama kapısı (verification gate)

`npm run check` Hafize'nin tek doğrulama kapısıdır ve `scripts/run-checks.mjs`
tarafından yürütülür.

## Neden keşif tabanlı

Kapı daha önce `package.json` içinde elle bakılan tek satırlık uzun bir komut
zinciriydi. Bu yaklaşımın iki ölçülmüş hatası vardı:

- Yeni test dosyaları zincire eklenmeyi unutulabiliyordu. Zincir 84 test
  dosyasından yalnız 51'ini çalıştırıyordu; OAuth, PKCE, token şifreleme,
  Canva token exchange/refresh/revoke ve personal memory encryption testleri
  hiç çalışmıyordu.
- `&&` zinciri ilk hatada duruyordu. `scripts/test-tool-runtime.mjs` içindeki
  eskimiş tool envanteri kilidi başarısız olunca ondan sonraki tüm testler
  sessizce atlanıyordu ve bu, `lib/gmail-read-client.mjs` içindeki gerçek bir
  girdi doğrulama hatasını gizledi.

Keşif tabanlı runner bu iki hata sınıfını da ortadan kaldırır.

## Kapı ne yapar

1. `server.mjs`, `lib/*.mjs`, `public/*.js` ve `scripts/*.mjs` dosyalarının
   tümüne `node --check` uygular.
2. `scripts/test-*.mjs` dosyalarının tümünü ve `scripts/validate-agent-registry.mjs`
   dosyasını çalıştırır.
3. İlk hatada durmaz; tüm hedefleri çalıştırır ve sonunda başarısız olanların
   tam çıktısını raporlar.
4. Herhangi bir hedef başarısızsa süreç sıfırdan farklı kodla biter.

Runner kendini tekrar çalıştırmaz (`scripts/run-checks.mjs` çalıştırma
listesinden hariç tutulur), ancak kendi syntax kontrolüne dahildir.

## Kapsam değişmezi

`scripts/test-check-runner.mjs` şunları kilitler:

- her `lib/*.mjs` ve `public/*.js` dosyası syntax kontrolündedir;
- her `scripts/test-*.mjs` dosyası çalıştırma listesindedir;
- runner kendini çalıştırma listesine almaz;
- hedefler tekrarsızdır ve syntax kontrolleri testlerden önce gelir;
- başarısız bir hedef raporlanır, çalıştırmayı erken kesmez ve kapıyı düşürür.

Yeni bir modül veya test eklendiğinde ek bir kayıt adımı gerekmez; dosya
`lib/`, `public/` veya `scripts/` altına konduğu anda kapıya dahil olur.

## Yerel kullanım

```bash
npm run check      # tam kapı (syntax + tüm testler)
npm run precheck   # hızlı UI alt kümesi (voice, ui-shell, erişilebilirlik)
```

`scripts/test-redis-schedule-lease-live.mjs` canlı bir Redis yoksa kendi
içinde atlanır, bu yüzden kapıya dahil edilmesi güvenlidir.

## Geri alma

`package.json` içindeki `check` script'i eski komut zincirine döndürülebilir;
`scripts/run-checks.mjs` ve `scripts/test-check-runner.mjs` başka hiçbir
modül tarafından import edilmez.
