# PWA readiness

PWA readiness artık install shell, manifest ve service-worker davranışını tek bir deterministic contract ile kontrol edebilir. API yollarının cache'e girmemesi ve offline navigation fallback'i temel güvenlik/UX koşullarıdır.

Service worker install adımı shell cache'lemesi başarıyla tamamlanmadan `skipWaiting()` çağırmaz. Böylece bozuk veya eksik shell ile yeni worker'ın aktifleşmesi engellenir.

Bu katman browser API'lerini mocklamaz; pure contract testleri ile statik yapılandırmayı doğrular. Gerçek tarayıcı install/offline testi ayrıca yapılmalıdır.

## Shell cache sürüm gate'i

Shell varlık listesinin tek kaynağı `public/sw-policy.js` içindeki `SHELL_ASSETS`
dizisidir. `scripts/test-pwa-cache-policy.mjs` bu listeyi üç değişmezle bağlar:

- `index.html`'in yüklediği her yerel varlık listede olmalıdır; böylece offline
  kabuk eksik dosya yüzünden bozulmaz (`/auth.js` bu nedenle eklendi).
- Listedeki her yol `public/` altında gerçekten bulunmalıdır.
- Liste her değiştiğinde `CURRENT_CACHE` sürümü artmalıdır. Test, liste
  parmak izini beklenen `hafize-shell-v<N>:<hash>` değeriyle karşılaştırır;
  varlık ekleyip sürümü artırmayı unutmak testi düşürür.

Özellik testleri artık sürüm numarasını sabitlemez, yalnız kendi varlıklarının
cache'te olduğunu doğrular. Sürüm beklentisi tek yerde tutulduğu için her
sürüm artışında dört ayrı testin güncellenmesi gerekmez.
