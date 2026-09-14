# Prompt Smart Fill — PR Scope

## Ana iyileştirme

Yerel Prompt Library'de değişkenli istemlerin daha güvenli, anlaşılır ve erişilebilir biçimde doldurulması.

## Kullanıcı akışı

Değişken içeren `Kullan` eylemi uygulama içi smart-fill dialogunu açar. Kullanıcı her değişkeni ayrı alanda doldurur, sonucu canlı önizlemede kontrol eder ve `Mesaja aktar` ile composer'a aktarır. Aktarım sohbeti göndermez.

Değişkensiz istemler mevcut hızlı aktarım davranışını korur.

## Yerel veri

Preset setleri istem bazlı storage anahtarlarında tutulur. Altı preset, on iki değişken ve değişken başına 1000 karakter üst sınırı vardır. Dış ağ veya telemetry kullanılmaz.

## Erişilebilirlik

Dialog semantiği, başlık/açıklama bağlantısı, canlı preview, Escape kapanışı ve Tab odak yönetimi uygulanır. Mobil, forced-colors ve reduced-motion durumları ele alınır.

## Doğrulama

Kaynak kontratları; intercept, no-submit, DOM güvenliği, storage izolasyonu, veri sınırları, preset yapısı, preview, PWA asset'leri ve kullanıcı yolculuğunu kapsar.
