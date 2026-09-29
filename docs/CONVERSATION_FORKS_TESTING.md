# Konuşma Dalları Test Planı

## Unit
conversation-fork-core.test.ts;
message normalization, custom title, note bound, branch limit, conversation limit, depth, cycle, lineage ve snapshot davranışını kapsar.

## Static
test-conversation-forks-*.mjs paketleri source, DOM, accessibility, build, PWA, storage timing, global hub ve navigation sözleşmelerini kontrol eder.

## Build
Vite'da development transform zinciri ve production lib entry aynı conversation-forks.ts kaynağına işaret etmelidir.

## PWA
Index script ve CSS bağlantıları service worker shell listesinde bulunmalıdır. API endpoint'leri fork modülünün parçası değildir.

## Regression
Full regression gate:
scripts/test-conversation-forks-regression.mjs

Gate başarısızsa PR merge edilmeden önce ilgili contract düzeltilir.

## Manuel smoke
1. Sohbet oluştur.
2. Bir mesajı forkla.
3. Custom title ve note gir.
4. Child sohbet açılır.
5. Yeni mesaj gönder.
6. Parent ve child arasında geçiş yap.
7. Karşılaştırma ve fork noktası eylemlerini kullan.
8. Dal yedeğini indir.
9. Streaming sırasında fork dene ve reddedildiğini doğrula.

## Başarı ölçütü
Parent mesajları değişmeden kalmalı; child storage'a yazılmalı; fork create kendisi network request üretmemeli; erişilebilirlik semantiği korunmalıdır.
