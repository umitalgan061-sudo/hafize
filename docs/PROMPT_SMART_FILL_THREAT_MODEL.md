# Smart Fill Tehdit Modeli

## Varlıklar

Korunan varlıklar: Prompt Library metinleri, yerel preset değerleri, composer içeriği ve kullanıcı odağı.

## Saldırgan varsayımları

Bir saldırgan localStorage'a bozuk veri yazabilir, uzun değerler gönderebilir veya değişken değerine HTML/JavaScript benzeri metin yapıştırabilir.

## Tehditler

1. HTML injection ile preview alanını çalıştırmak.
2. Büyük storage kaydıyla UI performansını düşürmek.
3. Bozuk preset JSON'u ile runtime exception üretmek.
4. Variable değerini istemeden remote telemetry'ye göndermek.
5. `Kullan` olayının iki handler tarafından çift çalışması.
6. PWA stale cache nedeniyle kısmi feature yüklenmesi.
7. Keyboard trap nedeniyle odak kaybı.
8. Yanlışlıkla otomatik submit.

## Kontroller

HTML injection `textContent` ve input `value` ile önlenir. Boyut sınırları değerleri ve sonuçları keser. Safe parse bozuk JSON'u boş listeye dönüştürür.

Remote telemetry ve API yoktur. Intercept yalnız değişkenli promptlarda çalışır. Cache v29 ile yeni asset seti ayrıştırılır.

Dialog focus trap ve focus return kullanır. Composer'a aktarım submit çağrısı içermez.

## Artık riskler

Cihaz erişimine sahip biri localStorage presetlerini okuyabilir. Browser extension veya kötü niyetli aynı-origin script tehdit modeli dışındadır.

## Abuse sınırları

Bir prompt başına 6 preset, 12 değişken, değişken başına 1000 karakter ve preview başına 8000 karakter sınırları maliyeti bounded tutar.

## Operasyon

Güvenlik olayı görülürse önce feature PR revert edilir; prompt kayıtları silinmez; preset anahtarları içerik loglanmadan incelenir.
