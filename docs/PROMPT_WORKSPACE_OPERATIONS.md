# Prompt Workspace — Operations Runbook

## Normal kullanım

Prompt Workspace browser storage kullandığı için normal operasyon backend erişimi gerektirmez. Kullanıcı tarayıcıyı yenilediğinde kayıtlar yerel storage'dan normalize edilerek açılır.

## Sağlık kontrolü

Kütüphane sağlığı paneli istem ID, revision referansı, collection assignment ve workspace selectedIds tutarlılığını kontrol eder. Uyarı varsa önce export alınması tavsiye edilir.

## Backup

Tam Prompt Pack export, temel istemler ve desteklenen yerel çalışma metadatası için önerilen yedektir. Seçimli pack yalnızca işaretli istemleri taşır.

Export dosyaları uygulama tarafından şifrelenmez. Hassas prompt içeren paketler güvenli ortamda saklanmalıdır.

## Restore

Import Review ekranı dosya boyutunu ve schema'yı kontrol eder. Başarılı import'ta mevcut prompt'lar duplicate ID ile korunur. Import işlemi başarısız olduğunda mevcut local storage verisi değiştirilmemelidir.

## Storage doluluğu

Prompt Library 120 istemle sınırlıdır. Workspace 16, collection 24 ve workflow 24 ile sınırlandırılmıştır. Limit doluysa yeni nesne oluşturma güvenli başarısızlık mesajı vermelidir.

## Bozuk storage

JSON parse hatası görüldüğünde modül fallback boş/default yapı kullanır. Bu durumda kullanıcı tekrar export almak yerine mevcut storage'ı hemen silmemelidir; farklı alanlar bağımsız olduğundan kısmi kurtarma mümkün olabilir.

## Revizyonlar

Revision sayısı per prompt 8 ile sınırlandırılır. Prompt silinse bile revision storage kalabilir. Hassas verilerin tamamen temizlenmesi gerekiyorsa revision anahtarı ayrıca ele alınmalıdır.

## Workflow sorunları

Compile null döndürüyorsa ilk kontrol prompt ID'lerinin mevcut olup olmadığıdır. Workflow otomatik network çağrısı yapmadığı için sorun genellikle yerel veri tutarlılığı veya prompt silinmesidir.

## UI sorunları

Panel görünmüyorsa Prompt Library core mount edilmiş mi kontrol edilir. Bootstrap mevcut `prompt-library-usage.js` üzerinden yeni asset'leri yükler. Script bulunamıyorsa service worker cache değil, tarayıcı network tabı incelenmelidir.

## Release sonrası

PWA shell cache yeni statik asset listesini içermiyorsa bootstrap yine network üzerinden modülleri yükleyebilir. Cache güncellemesi ayrı olarak test edilmelidir.

## Incident sınıfları

P0: Prompt içeriği dış servise gönderiliyor veya kullanıcı verisi kayboluyor.

P1: Import mevcut veriyi overwrite ediyor veya restore mevcut revision'ı korumuyor.

P2: Workspace/collection UI bozuk ama temel sohbet ve prompt core çalışıyor.

P3: Dokümantasyon veya görsel düzen sorunu.

P0/P1 durumlarında feature rollback önceliklidir.
