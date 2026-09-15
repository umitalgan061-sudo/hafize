# Revision Privacy Operations

## Veri sınıflandırması

Revision body, Prompt Library body ile aynı hassasiyet sınıfında kabul edilir.

## Saklama

Veri yalnız browser local storage'da tutulur ve prompt başına 10 revision ile bounded'dır.

## Export

Kullanıcı açıkça export istediğinde JSON dosyası oluşturulur. Export sırasında network upload yapılmaz.

## Support

Destek talebinde ham revision içeriği istemek yerine ekran davranışı ve redacted sample tercih edilir.

## Clear

History clear yalnız ilgili prompt'un revision map entry'sini kaldırır.

## Browser temizliği

Site verilerinin temizlenmesi revision history'yi silebilir. Bu nedenle önemli history için kullanıcı export alabilir.

## Cloud sync

Mevcut turda cloud sync bulunmaz. Gelecekte eklenecekse ayrı privacy review gerekir.

## Telemetry

Revision action telemetry'si tutulmaz.

## Shared devices

Ortak browser profilleri history için uygun kabul edilmez.

## Restore

Restore sırasında mevcut state manual snapshot ile korunur.

## Incident

Revision storage'a erişimde beklenmeyen exception görülürse feature rollback düşünülebilir; ana chat data'sı etkilenmemelidir.

## Audit

Source review, no-network ve text-only DOM kontratlarını tekrar doğrular.
