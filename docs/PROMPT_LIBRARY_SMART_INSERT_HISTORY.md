# Smart Insert — Kullanım Geçmişi

Smart Insert geçmişi, hangi istemlerin son kullanıldığını cihaz üzerinde hatırlamak için tasarlanmıştır. Geçmişte ham prompt gövdesi, değişken değerleri, kullanıcı mesajı veya sohbet cevabı tutulmaz.

## Kayıt yapısı

Her kayıt `promptId`, kısa istem etiketi, kullanım zamanı ve kayıt nedeni taşır. `promptId` 120, etiket 100 ve neden 100 karakterle sınırlıdır. En fazla 40 kayıt tutulur.

## Tekilleştirme

Aynı prompt tekrar kullanıldığında eski kayıt kaldırılır ve yeni kullanım zamanı ile listenin başına alınır. Böylece geçmiş gereksiz tekrarlarla şişmez.

## Gizlilik

Geçmiş için ayrı storage anahtarı kullanılır. Uzak analytics, fetch, XHR veya WebSocket çağrısı yapılmaz. Değişken değerleri geçmişe kopyalanmaz. Bu nedenle bir profilin kişisel alanları geçmiş ekranında görünmez.

## Kullanıcı işlemleri

Son kullanılan istemler listelenebilir, tekrar açılabilir ve tek tek kaldırılabilir. Kullanıcı açıkça onayladığında geçmişin tamamı temizlenebilir. Temizleme Prompt Library istem kayıtlarını silmez.

## Hata toleransı

JSON bozuksa geçmiş boş kabul edilir. Storage yazımı başarısızsa temel Prompt Library akışı çalışmaya devam eder. Geçmiş yardımcı bir özelliktir; uygulamanın ana chat akışına bağımlı değildir.

## Sıralama

Geçmiş kullanım zamanına göre azalan sırada gösterilir. Tarihi parse edilemeyen kayıtlar normalize sırasında güvenli şekilde ele alınır ve geçersiz yapıların UI'a taşınması engellenir.

## PWA

Geçmiş kodu service worker shell cache'e alınır. Storage verisi cache'lenmez; yalnızca uygulama JavaScript'i offline shell'in parçası olur.

## Testler

Kaynak testleri geçmiş anahtarını, 40 kayıt sınırını, NUL temizliğini, promptId/label alanlarını ve prompt gövdesinin saklanmadığını doğrular. Lifecycle testi event listener temizliğini ve bölüm kaldırıldığında DOM kalıntısı bırakılmamasını doğrular.
