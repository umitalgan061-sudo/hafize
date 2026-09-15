# Revision History Support Guide

## Belirti: Geçmiş görünmüyor

Prompt kartında `Geçmiş` action'ı yoksa önce revision scriptinin yüklenip yüklenmediği ve card mutation observer'ın çalıştığı kontrol edilir.

## Belirti: Geçmiş boş

Boş history normal olabilir. Snapshot yalnız mevcut bir istem `Düzenle` ile açıldığında oluşur.

## Belirti: Restore başarısız

Storage quota, prompt'un silinmiş olması veya bozuk revision verisi olası nedenlerdir. Kullanıcıya mevcut prompt'un korunduğu açıklanır.

## Belirti: Export dosyası küçük

1 MB üstü history exportları en yeni 5 revision ile sınırlandırılır. Bu bilinçli bounded davranıştır.

## Belirti: Eski sürüm kaybolmuş

Prompt başına 10 kayıt retention vardır. 11. benzersiz snapshot geldiğinde en eski kayıt çıkar.

## Belirti: Kullanım sayısı değişti

Restore sırasında useCount korunmalıdır. Fark varsa core normalize ve restore kodu regression testleriyle karşılaştırılır.

## Privacy uyarısı

Revision body, kullanıcının prompt metnini içerir. Support talebinde raw export paylaşılmadan önce hassas bilgiler temizlenmelidir.

## Browser kontrolü

Private browsing veya storage engeli varsa history yazımı çalışmayabilir. Bu durum uygulamanın sohbet yazımını durdurmamalıdır.

## PWA kontrolü

Offline kullanımda revision scripti bulunamıyorsa cache asset listesi ve cache version incelenir.

## Rollback

Özellikten geri dönüldüğünde revision local storage verisi silinmez. Bu, gelecekte uyumlu kodun veriyi kurtarmasını sağlar.

## Escalation

Kod davranışı ile dokümantasyon çelişirse release branch'teki source ve revision testleri authoritative kabul edilir.
