# Revision History User Flows

## Akış A — Geçmişi görüntüleme

Kullanıcı prompt kartında `Geçmiş` düğmesine basar.

Uygulama prompt kaydını yeniden çözer.

Panel açılır.

Focus kapatma düğmesine alınır.

Current body gösterilir.

Revision listesi gösterilir.

Kullanıcı istediği revision'ı seçebilir.

## Akış B — Karşılaştırma

Kullanıcı `Karşılaştır` seçer.

Current ve revision body bounded preview olarak iki alanda gösterilir.

Aynıysa status bunu belirtir.

## Akış C — Restore

Kullanıcı `Geri yükle` seçer.

Confirmation sorulur.

Current state manual snapshot olur.

Revision restore edilir.

Core refresh event yayınlanır.

Panel yeni current state ile render edilir.

## Akış D — Manual checkpoint

Kullanıcı prompt kartında `Sürümü koru` seçer.

Current prompt revision olarak saklanır.

Aynı snapshot zaten varsa duplicate eklenmez.

## Akış E — Silme

Kullanıcı eski revision için `Sil` seçer.

Confirmation alınır.

Revision kaldırılır.

## Akış F — History clear

Kullanıcı `Geçmişi temizle` seçer.

Confirmation alınır.

Yalnız active prompt history'si kaldırılır.

## Akış G — Export

Kullanıcı export seçer.

JSON oluşturulur.

Blob download başlatılır.

Object URL revoke edilir.

## Akış H — Escape

Kullanıcı Escape'e basar.

Panel kapanır.

Previous focus geri gelir.

## Akış I — Storage error

Storage failure olursa status mesajı kullanılır.

Ana prompt shell çalışmaya devam eder.

## Akış J — PWA

Offline shell revision scriptini cache'ten alır.

History local storage mevcutsa kullanılabilir.
