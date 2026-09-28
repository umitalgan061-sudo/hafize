# Yerel Görev Presetleri

## Amaç
Sık kullanılan zamanlanmış görev ayarlarını cihaz üzerinde tekrar kullanmak.

## Storage
Anahtar: `hafize.scheduled-task-presets.v1`.
Sunucuya preset gönderilmez.
Prompt, recurrence ve agentId yalnız kullanıcı cihazında tutulur.

## Kapasite
En fazla 40 preset.
Preset başlığı 80 karakter.
Görev metni 6000 karakter.
JSON yedeği 256 KB.

## Kullanım
Yeni preset mevcut form değerlerinden oluşturulur.
Preset seçmek görev metnini ve tekrar ayarlarını forma aktarır.
Planlama isteği yine kullanıcı tarafından gönderilir.

## Import
JSON dizi veya `items` alanı kabul edilir.
Geçersiz satırlar normalize edilerek atılır.
Aynı başlığa sahip mevcut kayıt korunur.
Kapasite aşılırsa ilk 40 güvenli kayıt tutulur.

## Export
Version, source, exportedAt ve items alanlarıyla JSON üretilir.
Blob yalnız tarayıcı içinde oluşturulur.
Uzak endpoint çağrısı yapılmaz.

## Gizlilik
Presetler analytics veya telemetry'ye gönderilmez.
Service worker preset içeriğini cache'lemez; yalnız asset dosyalarını cache'ler.

## Recovery
Storage yazılamazsa kullanıcıya status mesajı gösterilir.
Import başarısızsa mevcut presetler değiştirilmez.

## Erişilebilirlik
Preset bölümünün aria-label'ı vardır.
Butonlar button type kullanır.
Klavye odağı visible kalır.

## Test
Bounds, malformed JSON, duplicate title, local storage failure,
DOM safety ve lifecycle kontrolleri korunur.
