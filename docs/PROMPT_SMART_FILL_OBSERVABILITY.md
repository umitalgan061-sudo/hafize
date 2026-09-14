# Smart Fill Gözlemlenebilirlik Sınırları

Smart Fill için server-side analytics veya kullanıcı metni telemetry'si eklenmez.

## UI durumları

Kullanıcı, panel içinde kısa durum mesajlarıyla işlem sonucunu görür. Başarılı işlemler, clipboard hatası, storage yazma hatası ve geçersiz akışlar arayüzde gösterilir.

## Server logları

Smart Fill event'leri server'a gönderilmediği için server loglarında prompt, değişken veya preset bilgisi oluşmaz.

## Hata sınıfları

- storage read failure,
- storage write failure,
- invalid preset JSON,
- missing composer,
- clipboard rejection,
- missing Smart Fill core.

Her sınıf ana sohbet akışını durdurmayan bir fallback'e sahiptir.

## Debug

Geliştirici, browser devtools üzerinden DOM, storage ve event akışını inceleyebilir. Debug çıktısı kullanıcı metnini remote endpoint'e göndermemelidir.

## Performance

Live hints ve MutationObserver küçük bounded DOM ağaçlarında çalışır. Feature açılırken network round-trip yapılmaz.

## Release verification

Release öncesi index ve service worker asset eşleşmesi, cache version ve source testleri kontrol edilir.

## Privacy

Kullanım istatistiği Prompt Library kullanım verisinden ayrı bir remote event olarak gönderilmez. Smart Fill presetleri export dışıdır.

## Incident

Güvenlik olayı durumunda önce feature revert edilir. İçerik örneği paylaşılmadan commit ve browser koşulu kayda alınır.
