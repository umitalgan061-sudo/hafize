# Composer Ekleri — Migration

## Mevcut kullanıcılar
Yeni attachment özelliği mevcut conversation kayıtlarını veya Prompt Library verisini migrate etmez.

Eski composer davranışı korunur; Dosya ekle düğmesi artık yerel attachment panelini açar.

## Storage
Yeni kalıcı storage key oluşturulmaz.

## Service worker
Shell cache version artırılır ve uygulama asset'leri listeye eklenir.

## Geri uyumluluk
Prompt Library ve Composer History aynı storage sözleşmeleriyle devam eder.

## İlk yükleme
Eski browser attachment script'lerini cache'den taşısa bile uygulama asset version değişimi yeni shell'i seçer.

## Future migration
Kalıcı attachment history istenirse ayrı namespace, retention politikası ve explicit user consent gerekir.

## Rollback
Migration olmadığı için rollback yalnız code wiring ve shell asset listesini etkiler.

## Veri kaybı
Sayfa yenilemesinde staged attachment queue'nin kaybolması beklenen davranıştır ve migration failure değildir.