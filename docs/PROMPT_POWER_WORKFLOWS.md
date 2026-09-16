# Prompt Power Workflows

Bu tur, mevcut Prompt Library altyapısının üzerinde çalışan dört bağlı kullanım akışını belgeler: akıllı değişken doldurma, komut paleti, koleksiyon düzeni ve revizyon geçmişi.

## Kapsam

Prompt kayıtları cihaz üzerinde tutulur. Yeni akışlar mevcut prompt gövdesini, başlığını veya favori durumunu değiştirmek yerine kullanım deneyimini tamamlar.

Akıllı doldurma, `{{konu}}` gibi sınırlı değişkenleri ayrı alanlarda toplar. Kullanıcı, canlı önizlemeyi görür ve sonucu yalnızca composer alanına aktarır; form otomatik olarak gönderilmez.

Değişken profilleri yerel storage altında ayrı bir anahtarda tutulur. Profil değerleri en fazla 1000 karakter, profil sayısı en fazla 24 ve tek şablondaki değişken sayısı en fazla 12 olarak sınırlandırılır.

Komut paleti, kütüphane içinde arama ve klavye odaklı işlem yapmayı kolaylaştırır. Koleksiyonlar prompt id'leri üzerinden üyelik tutar; silinen prompt üyeleri temizlenir. Revizyon geçmişi prompt değişikliklerini yerel bağlamda izlemek için kullanılır.

## Güvenlik

Kullanıcı metinleri DOM'a `textContent`/form değerleri üzerinden aktarılır. HTML enjeksiyonu için `innerHTML` veya `outerHTML` tabanlı kullanıcı verisi oluşturulmaz. Profil içe aktarma boyutu 300 KB ile sınırlıdır.

Hiçbir güç iş akışı backend analytics, telemetry, uzak senkronizasyon veya gizli kimlik doğrulama bilgisi eklemez.

## Geriye dönük uyumluluk

Mevcut `Kullan` akışı korunur. Değişkensiz prompt'lar doğrudan composer'a aktarılır. Yeni paneller yüklenemezse temel Prompt Library çalışmaya devam eder.

## PWA

Yeni statik varlıklar service-worker shell politikasına eklenmelidir. `/api/` istekleri hiçbir koşulda statik cache'e alınmaz.

## Kabul ölçütleri

- Değişkenli prompt, güvenli bir doldurma panelinden geçirilebilir.
- Önizleme her değişkende yeniden üretilir.
- Eksik zorunlu değişkenler composer'a aktarımı engeller.
- Profil kaydetme, silme, dışa/içe aktarma sınırlarla çalışır.
- Klavye ile kapatma ve odak döngüsü korunur.
- Koleksiyon ve revizyon akışları mevcut prompt kimlikleriyle uyumludur.
- Yeni varlıklar shell cache politikasında bulunur.
