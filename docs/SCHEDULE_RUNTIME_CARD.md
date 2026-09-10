# Görev motoru durum kartı

`Görevler` çalışma alanı bugüne kadar yalnız başlık metni gösteriyordu: `public/workspace-navigation.js`
içindeki `CARD_IDS.tasks` listesi `scheduleRuntimeCard` ve `scheduleListCard` kimliklerini bekliyor, fakat
bu kartlar `public/index.html` içinde yoktu. Bu tur ilk kartı ekler; kullanıcı 7×24 zamanlanmış görevlerin
gerçekten çalıştırılabilir durumda olup olmadığını uygulamadan görebilir.

## Veri kaynağı

Kart yalnız mevcut `GET /api/health` yüzeyini okur; yeni HTTP ucu, yeni yetki veya yeni secret gerekmez.
Yalnız dört boolean bayrak projeksiyona alınır: `scheduleWorkerConfigured` (görev motoru),
`scheduleStorageDurable` (kalıcı görev deposu), `scheduleLeaseConfigured` (çift çalıştırma kilidi) ve
`scheduleApiConfigured` (dış worker API).

Genel durum deterministic'tir: motor kapalıysa `offline`, motor açık ve dört bayrak da doğruysa `armed`,
aksi hâlde `partial`. Gövde nesne değilse veya istek başarısızsa `unknown` gösterilir.

## Güvenlik sınırı

- Yalnız `=== true` boolean değerler "hazır" sayılır; `"true"` veya `1` gibi truthy değerler fail-closed
  şekilde "eksik" kabul edilir.
- Yanıt gövdesindeki serbest metin alanları (model adı, subject, sağlayıcı ayrıntısı) DOM'a yazılmaz;
  kart yalnız kendi sabit Türkçe açıklamalarını render eder ve test bunu doğrular.
- Kart schedule komut yüzeyine (`/api/schedules`) dokunmaz; o uç `HAFIZE_SCHEDULE_AUTH_TOKEN` ile korunan
  ayrı worker kimliğinde kalır ve tarayıcıya taşınmaz.
- Ağ isteği tembeldir: yalnız `hafize:workspace-changed` olayı `tasks` bildirdiğinde veya kullanıcı
  "Durumu yenile" düğmesine bastığında yapılır; otomatik yenilemeler 15 saniyelik soğuma penceresindedir.

## Test

`node scripts/test-schedule-runtime-card.mjs` (`npm run check` kapısında) projeksiyon kurallarını,
fail-closed hata yollarını, tembel yüklemeyi, soğuma penceresini, dinleyici temizliğini, serbest metin
sızmamasını ve PWA kabuk bağlantısını doğrular. `scripts/test-pwa-cache-policy.mjs` yeni varlıkların
`SHELL_ASSETS` içinde olmasını zorunlu kıldığı için kabuk sürümü `v20`'ye yükseltildi. Ek olarak headless
Chromium ile `npm start` üzerinde elle doğrulandı: kart sohbet görünümünde gizli, `Görevler` açıldığında
`/api/health` okunup `offline` durumu ve dört sinyal render edildi.

## Geri alma

Tek PR olarak geri alınabilir: yeni üç dosya ve bu doküman silinir; `public/index.html` kart bloğu ile iki
varlık referansı, `public/sw-policy.js` iki liste girdisi ve kabuk sürümü geri alınır. Kaldırıldığında
`Görevler` çalışma alanı önceki boş hâline döner; başka hiçbir yüzey etkilenmez.
