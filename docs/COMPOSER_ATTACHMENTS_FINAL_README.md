# Composer Ekleri — Özet

Composer Ekleri artık güvenli bir local preparation workspace olarak çalışır.

Kullanıcı dosya seçer, içeriği browser'da inceler, gerekirse satır aralığı seçer ve açıkça composer'a ekler.

Büyük dosyalar read öncesi byte limitiyle reddedilir. Secret scanner yaygın credential desenlerinde ek onay ister.

Insert cursor/selection aware'dir ve kapasiteyi aşan içerik kısmi olarak yazılmaz.

Hızlı analiz eylemleri seçili dosya parçalarından özet, kod inceleme, bug taraması veya gereksinim talebi hazırlar.

Hiçbir attachment içeriği storage veya telemetry'ye yazılmaz. PWA yalnız uygulama kodu/CSS assetlerini cache'ler.

Bu özellik dosya upload servisi değildir; normal chat gönderimi ancak kullanıcı tarafından ayrıca yapılır.