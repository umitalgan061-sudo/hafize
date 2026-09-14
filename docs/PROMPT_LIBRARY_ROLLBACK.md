# Prompt Library Rollback

## Hızlı geri alma

1. `public/index.html` içinden prompt library CSS ve dört JavaScript referansını kaldırın.
2. `public/sw-policy.js` içinden prompt library asset'lerini kaldırın.
3. Service worker cache version değerini artırın.
4. Eski prompt localStorage anahtarlarını silmeyin.

## Neden veri silinmiyor?

Prompt Library `hafize.prompt-library.v1` altında izole çalışır.

Kod referansları kaldırıldığında kayıtlar erişilemez hâle gelir ancak conversation history'yi etkilemez.

İleride feature geri getirilirse aynı v1 parser kayıtları tekrar okuyabilir.

## Kısmi rollback

Sadece enhancement katmanı sorunluysa `prompt-library-enhancements.js` ve `prompt-library-keyboard.js` referansları kaldırılabilir.

Core CRUD ve starter davranışı çalışmaya devam eder.

Sadece import sorunu varsa import button davranışı ayrıca devre dışı bırakılabilir ancak bu ayrı bir kod değişikliği gerektirir.

## Cache

Rollback sonrası eski shell cache'inin yeni uygulama dosyalarını taşımaması gerekir.

Bu nedenle version numarası azaltılmaz; ileriye alınır.

## Kontrol

Rollback sonrası `index.html` local prompt asset'i yüklememeli ve `sw-policy.js` bu asset'i shell listesinde bulundurmamalıdır.

`hafize.prompt-library.v1` key'i tek başına güvenlik riski oluşturmaz çünkü server'a aktarılmaz.

## Incident notu

Veri kaybı görülürse önce browser storage temizleme, private mode ve quota davranışlarını kontrol edin.

Import sırasında overwrite olmadığı için rollback öncesi dış dosyanın local kaydı ezmesi beklenmez.
