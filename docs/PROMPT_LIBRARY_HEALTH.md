# Prompt Library Kalite Merkezi

## Amaç

Kalite merkezi, yerel Prompt Library verisinin yapısal ve kullanım kalitesini cihaz üzerinde inceleyen yardımcı yüzeydir.

Ana hedefi prompt'ları otomatik silmek değil, kullanıcıya hangi kayıtların incelenmeye değer olduğunu görünür kılmaktır.

## Veri kaynakları

Panel yalnızca şu local storage alanlarını okur:

- `hafize.prompt-library.v1`
- `hafize.prompt-library.collections.v1`
- `hafize.prompt-library.revisions.v1`
- `hafize.prompt-library.health.v1`

Sunucu çağrısı yapılmaz.

## Kontroller

Prompt kayıtlarında yapı, id benzersizliği, başlık tekrarları, gövde tekrarları, yakın tekrarlar, etiket eksikliği, gövde uzunluğu, kullanım sayacı, yaş ve değişken sınırı incelenir.

Koleksiyonlarda bozuk kayıt, yinelenen id, boş koleksiyon ve artık bulunmayan prompt üyeleri incelenir.

Revizyonlarda bozuk kayıt ve artık bulunmayan prompt'a bağlı revizyonlar incelenir.

## Sonuç sınıfları

`error` veri bütünlüğü açısından düzeltilmesi gereken durumları gösterir.

`warning` kullanım veya bakım kalitesini düşürebilecek durumları gösterir.

`info` kullanıcının daha sonra değerlendirebileceği öneri niteliğindeki bulguları gösterir.

## Kullanıcı kontrolü

Onarım yalnızca kullanıcı açıkça onay verdiğinde çalışır. Sağlık paneli kendi başına veri silmez.

Dışa aktarma işlemleri yalnızca kullanıcı düğmeye bastığında başlar.

## Sınırlar

120 prompt, 40 koleksiyon, 600 revizyon ve 240 sağlık bulgusu üst sınırları performans ve bozuk veri dayanıklılığı sağlar.

Yakın tekrar karşılaştırması en fazla 120 prompt üzerinden yürür.

## UX

Panel açılışta mevcut durumunu gösterir, filtre ile hata/uyarı/bilgi ayrıştırılabilir ve rapor kopyalanabilir veya indirilebilir.

Mobil görünümde grid iki kolona iner ve uzun sorun listesi bağımsız kaydırılır.

## Geri alma

Panel kaldırılırsa ana Prompt Library kayıt biçimi değişmez. Sağlık durum anahtarı bağımsızdır.
