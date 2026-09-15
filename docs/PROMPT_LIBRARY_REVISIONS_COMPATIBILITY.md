# Revision History Compatibility

## Tarayıcı

Özellik modern browser DOM, localStorage, Blob ve StorageEvent API'leri üzerine kuruludur. Eksik StorageEvent desteğinde refresh event fallback'i bulunur.

## Existing Prompt Library

Revision module mevcut `HafizePromptLibrary` API'sine bağımlıdır. Core modül yüklenmezse revision mount edilmez; uygulama çalışmaya devam eder.

## Storage schema

Revision storage key `hafize.prompt-library.revisions.v1` olarak versionlanmıştır. Prompt Library'nin ana storage key'i ile karıştırılmaz.

## Eski veriler

Revision anahtarı bulunmuyorsa boş history gösterilir. Bozuk revision object'leri normalize edilir ve atılır.

## Yeni veriler

İçerik alanları bounded değerlerle kaydedilir. Yeni reason değeri desteklenmese bile `before-edit` fallback'i uygulanır.

## PWA

Revision scripti shell cache'e girdiğinden offline sayfa açılışında kodun bulunması beklenir. API çağrısı yapmadığı için network yokluğu revision okunmasını engellemez.

## Geriye uyumluluk

Ana prompt kayıt modeline yeni alan eklenmez. Restore mevcut core `normalizeItem` fonksiyonunu kullanır.

## Upgrade

Script değişimlerinde service worker cache version artırılır. Önceki revision verileri migration gerektirmez.

## Rollback

Revision UI geri alınsa dahi storage anahtarının korunması bilinçli davranıştır. Sonraki sürüm tekrar aynı anahtarı okuyabilir.
