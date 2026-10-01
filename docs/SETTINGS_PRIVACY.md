# Yerel Veri ve Gizlilik Merkezi

## Amaç

Bu yüzey, Hafize'nin tarayıcıda tuttuğu kullanıcı kontrollü localStorage verisini tek bir güvenli envanterde görünür kılar. Panel veri içeriklerini okumaz; yalnız izinli storage yüzeylerinin varlığı, kayıt sayısı ve byte büyüklüğü gibi özetleri işler.

## Kapsam

Merkez; sohbet, mesaj workspace, Prompt Library, koleksiyonlar, revizyonlar, Smart Views, Smart Fill, model tercihleri, composer history, görev şablonları ve görsel tercihleri kapsayan sabit bir allowlist kullanır.

Bilinmeyen anahtarlar yalnız sayaç olarak hesaba katılır. Uygulamanın tanımadığı anahtarlar isimleriyle gösterilmez ve toplu temizlemenin parçası değildir.

## İşlemler

Tek yüzey temizleme yalnız seçili allowlist kaynağını siler. Veri yüzeylerini temizleme kullanıcı içeriklerini kaldırır fakat görsel tercihleri korur. Bilinen tüm yerel verileri temizleme ikinci bir metin onayı ister.

Gizlilik raporu yalnız metadata üretir. Rapor formatında `contentIncluded: false` sabiti bulunur; prompt veya mesaj değerleri dışarı aktarılmaz.

## Sınırlar

Storage taraması 300 anahtarla sınırlıdır. Rapor 120 KB ile sınırlıdır. Smart Fill gibi prefix tabanlı alanlar yalnız tanımlı prefix altında işlenir.

## Entegrasyon

Panel Settings Workspace içine eklenir, index.html tarafından CSS/JS asset'i olarak yüklenir ve Service Worker shell cache'ine dahil edilir. API endpoint'i eklemez.

## Yaşam döngüsü

Mount işlemi mevcut Settings panelini bekler. Listener'lar destroy sırasında temizlenir. Storage değişiklikleri ve `hafize:privacy-data-changed` olayı sonrası görünüm yenilenir.

## Tasarım ilkeleri

- allowlist-first
- content-free reporting
- explicit destructive confirmation
- unknown-key preservation
- local-only operation
- accessible DOM primitives
