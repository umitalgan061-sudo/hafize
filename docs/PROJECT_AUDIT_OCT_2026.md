# Ekim 2026 — proje incelemesi ve düzeltme kapsamı

## Kapsam

Bu inceleme, depo ağacındaki 1.800'den fazla izlenen yol içinden kritik üretim sınırlarını ve doğrulama zincirini özellikle ele aldı: Node/TypeScript başlangıcı, HTTP kimlik doğrulama ve oran sınırlama, model yanıtı sözleşmesi, tool izinleri, delege edilen ajanlar, zamanlanmış görevler, tarayıcı modülleri, service worker shell cache ve bunları doğrulayan paketler.

Depodaki bütün dosyalar bu metinde tek tek satır satır onaylanmış gibi değerlendirilmemelidir. Bu PR, inceleme sırasında somut olarak doğrulanabilen ilk düzeltme dilimini içerir; kalan test borcu ayrıca kayıt altındadır.

## Uygulanan düzeltmeler

- Kaynak-sözleşme denetimleri taşınan TypeScript modüllerine ve gerçekten sevk edilen dosyalara yönlendirildi.
- Model yanıtında string olmayan `content` değerlerinin sessizce boş mesaja çevrilmesini önleyen sıkı doğrulama eklendi.
- Araç izinlerinde dizi biçimindeki `allowedPermissions` kapsamı desteklendi; skill araçları izinleri genişletmeden daraltır.
- Ham NUL kontrol karakterleri kaynaklardan kaçış dizilerine taşındı; kaynak paketleri artık dosyaları metin olarak tarayabilir.
- Ses girişi/çıkışı ve PWA shell kaynak sözleşmeleri güçlendirildi.
- Built-in skill runtime sohbet, tool yürütümü, delege edilmiş ajan ve zamanlanmış görev bağlamlarına bağlandı.
- Hazırlık raporu skill runtime'ın gerçekten yüklenmiş olmasına göre durum verir; ajanın varlığını runtime hazır oluşuyla karıştırmaz.
- Delege edilmiş ajanlara ait abort sinyali model isteğine taşınır.

## Doğrulama yaklaşımı

- `scripts/test-check-suite-integrity.mjs` her paket için sözdizimini, referans verdiği dosyaların varlığını ve ESM/legacy uyumluluğunu kontrol eder.
- Yeni skill runtime entegrasyon paketi gerçek `getAllowedNvidiaTools` ve `executeNvidiaToolCall` akışlarını kullanır; yalnızca kaynak metni taklidiyle test yapmaz.
- Tam `npm run check` kapısında bu PR kapsamı dışında kalan başarısız paketler olabilir. `docs/CHECK_SUITE_REPAIR.md` içindeki kalan maddeler gizlenmemeli ve ayrı düzeltme turlarında davranış bazında ele alınmalıdır.
- `.github/workflows/` dosyaları değiştirilmedi.

## Öncelikli devam işleri

1. Tam regresyon kapısındaki kalan her başarısızlık için önce testin eskimiş kaynak yolunu mu, yoksa gerçek runtime regresyonunu mu gösterdiği belirlenmeli.
2. Üretim başlangıcı, graceful shutdown ve health/readiness uçları Node 24 ve 26 altında entegrasyon testleriyle doğrulanmalı.
3. Memory runtime'ın health endpoint'te yalnızca uyarı olarak gösterilen durumu ayrı bir gerçek runtime probe'u ile ele alınmalı.
4. Açık PR'lar ve eski dallar, mevcut `main` ile ortak tabanları doğrulanmadan merge edilmemeli.

## Geri alma

PR'ı revert etmek bu düzeltme dilimini geri alır. Yeni skill runtime bağlantısı yerel katalog verisini kullanır; uzak analytics, telemetry veya yeni secret gerektirmez.
