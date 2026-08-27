# Doğrulama kapısı (check gate)

Hafize'nin tüm statik ve smoke doğrulaması tek bir runner üzerinden yürür:
`scripts/run-checks.mjs`.

## Komutlar

| Komut | Kapsam |
| --- | --- |
| `npm run check` | Tüm kaynakların syntax kontrolü + tüm test/doğrulayıcı betikleri |
| `npm run precheck` | Yalnız frontend alt kümesi (voice, ui-shell, sidebar erişilebilirliği) |
| `node scripts/run-checks.mjs <filtre...>` | Adı filtreyi içeren kaynak ve testler |

Örnek: `node scripts/run-checks.mjs schedule` yalnız zamanlama testlerini çalıştırır.

## Neden runner

Önceki kapı `package.json` içinde tek satırlık dev bir `&&` zinciriydi. Bu iki
yapısal soruna yol açtı:

1. **Sessiz kapsam boşluğu.** Yeni bir test dosyası zincire elle eklenmezse
   hiçbir yerde çalışmıyordu; depoda 32 test dosyası bu şekilde kapının
   dışında kalmıştı.
2. **Erken kısa devre.** Zincirdeki ilk hata sonraki tüm testleri atlıyordu;
   böylece tek bir kırık test, arkasındaki ikinci bir kırılmayı gizliyordu.

Runner her iki sorunu da kapatır:

- `scripts/test-*.mjs` ve `scripts/validate-*.mjs` **otomatik keşfedilir**;
  yeni test eklemek için `package.json` düzenlenmez.
- `server.mjs` ile `lib/`, `public/`, `scripts/` altındaki tüm `.mjs`/`.js`
  dosyaları otomatik olarak `node --check` ile doğrulanır.
- Bir test başarısız olsa bile **kalan testler çalışmaya devam eder**; çıktının
  sonunda başarısız dosyaların tam listesi verilir ve çıkış kodu `1` olur.
- Her test için 120 sn, her syntax kontrolü için 30 sn zaman aşımı uygulanır;
  asılı kalan bir test kapıyı sonsuza kadar bekletmez.

## Kurallar

- Yeni bir `lib/` modülü veya `public/` betiği geldiğinde ek bir kayıt adımı
  gerekmez; runner onu kendiliğinden kapsar.
- Yeni davranış eklerken test dosyası adı `scripts/test-*.mjs` biçiminde olmalıdır.
- Dış servis gerektiren testler ortam değişkeni yoksa kendini atlamalı ve `0`
  ile çıkmalıdır (`scripts/test-redis-schedule-lease-live.mjs` bu deseni izler).
- Kapı kırmızıyken yeni özellik turu başlatılmaz; önce kapı yeşile döndürülür.

Runner'ın kendi davranışı `scripts/test-check-runner.mjs` ile doğrulanır:
keşfin depodaki her test/doğrulayıcıyı kapsadığı, filtrelerin çalıştığı ve
başarısız bir test veya bozuk bir kaynağın kapıyı gerçekten kırmızıya çevirdiği
test edilir.
