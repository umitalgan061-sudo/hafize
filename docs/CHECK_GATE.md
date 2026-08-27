# Doğrulama kapısı (`npm run check`)

## Amaç

Tek komutla tüm syntax kontrollerini, agent registry doğrulamasını ve
`scripts/test-*.mjs` altındaki tüm testleri çalıştırmak; **hiçbir
başarısızlığı gizlemeden** raporlamak.

```bash
npm run check     # veya: npm test
```

## Neden ayrı bir runner

Kapı daha önce `package.json` içinde elle bakımı yapılan tek satırlık bir
`&&` zinciriydi. Bu yapının iki sessiz arıza modu vardı:

1. **İlk hata zinciri durduruyordu.** `scripts/test-tool-runtime.mjs`
   içindeki bayat bir assertion (`listToolPermissions()` hâlâ 3 araç
   bekliyordu, oysa `canva_read` ve `gmail_read` eklenmişti) yüzünden
   zincirin geri kalanı hiç çalışmıyordu. Kapı kırmızıydı ama arkasında
   kaç testin çalışmadığı görünmüyordu.
2. **Yeni test dosyaları zincire elle eklenmezse hiç çalışmıyordu.** Bu
   yolla 33 test dosyası — OAuth, token şifreleme, PKCE, personal memory
   ve connector read client testlerinin tamamı dâhil — kapının dışında
   kalmıştı.

`scripts/run-checks.mjs` her iki arıza modunu da kapatır:

- Test dosyalarını diskten **keşfeder**; yeni `scripts/test-*.mjs`
  dosyası eklemek onu otomatik olarak kapıya dâhil eder.
- Her testi ayrı süreçte çalıştırır ve **hepsini** çalıştırır; ilk hata
  sonrakileri durdurmaz. Tur sonunda başarısız kontrollerin tamamı
  çıktılarıyla birlikte listelenir.
- Herhangi bir kontrol başarısızsa süreç `1` ile çıkar.

## Kapsam

| Aşama | İçerik |
| --- | --- |
| syntax | `lib/*.mjs`, `scripts/*.mjs`, `public/*.js`, kök `*.mjs` için `node --check` |
| registry | `scripts/validate-agent-registry.mjs` |
| test | `scripts/test-*.mjs` (opt-out listesi hariç) |

## Opt-out listesi

`scripts/run-checks.mjs` içindeki `OPT_OUT` haritası kapıdan bilinçli
olarak çıkarılan testleri **gerekçesiyle birlikte** tutar. Gerekçesiz
çıkarma yapılmaz. Şu an tek giriş:

- `test-redis-schedule-lease-live.mjs` — canlı Redis sunucusu gerektirir,
  manuel çalıştırılır.

## Bakım kuralı

- Yeni test dosyası eklemek için `package.json` düzenlenmez; dosyayı
  `scripts/test-*.mjs` adıyla eklemek yeterlidir.
- Bir testi kapı dışına almak gerekiyorsa `OPT_OUT` içine gerekçesiyle
  yazılır; sessizce silinmez veya yeniden adlandırılmaz.
- Kapı kırmızıyken yeşilmiş gibi raporlanmaz; PR açıklamasında açıkça
  belirtilir.
