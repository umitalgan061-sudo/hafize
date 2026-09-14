# Prompt Library Runbook

## Açılış kontrolü

Uygulama açılırken prompt library modülleri `defer` ile yüklenir.

Core module yüklenmeden starter veya enhancement katmanı çalışmaz.

Card aynı id ile iki kez mount edilmez.

## Normal çalışma

Kütüphane verisi `hafize.prompt-library.v1` anahtarından okunur.

Filtre durumu `.state` anahtarından okunur.

Veri normalize edilerek UI'ye aktarılır.

## Starter seed

Kütüphane boşsa 10 başlangıç kaydı oluşturulur.

Kütüphane doluysa başlangıç seed'i tekrar çalışmaz.

Eksik starter'lar kullanıcı eylemiyle tamamlanabilir.

Var olan kullanıcı kaydı başlık çakışması dışında değiştirilmez.

## Import

Dosya boyutu önce kontrol edilir.

JSON parse hatası current collection'a dokunmaz.

Normalize sonrası id'ler kontrol edilir.

Çakışan id yeni random id ile eklenir.

Koleksiyon 120 kayıtta kesilir.

## Export

Seçim varsa seçilen kayıtlar dikkate alınır.

Seçim yoksa mevcut filtered collection kullanılır.

Export payload sürüm numarası taşımalıdır.

Blob url işlem bitince revoke edilir.

## Storage incident

Storage read hata veriyorsa boş collection/state kullanılır.

Storage write hata veriyorsa kullanıcıya status mesajı verilir.

Chat history key'i silinmez veya yeniden yazılmaz.

## PWA incident

Önce `/prompt-library.js`, `/prompt-library-starters.js`, `/prompt-library-enhancements.js` ve CSS asset'lerinin shell listesinde olduğunu kontrol edin.

Sonra cache version'ın arttığını doğrulayın.

API request sınıflandırması network-only kalmalıdır.

## UI incident

Card iki kez görünüyorsa duplicate mount kontrol edilir.

Enhancement butonları iki kez görünüyorsa MutationObserver ve `data-prompt-enhancement` guard'ı incelenir.

Mobile taşma varsa 700px media query ve max-height/overflow kontrol edilir.

## Rollback

Index'ten prompt library script/style referanslarını kaldırın.

Service worker shell listesinden prompt library asset'lerini çıkarın ve cache version'ı artırın.

Kullanıcı localStorage verisi backward compatible bırakılabilir.
