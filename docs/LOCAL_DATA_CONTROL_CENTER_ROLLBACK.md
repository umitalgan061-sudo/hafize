# Yerel Veri Merkezi — Rollback

## Amaç

Rollback, kontrol merkezi UI katmanını kaldırırken mevcut yerel veriyi zorunlu olarak silmemelidir.

## Güvenli geri alma

PR revert edildiğinde `local-data-center.js`, CSS ve cache wiring geri alınır. Kullanıcı storage kayıtları kendiliğinden silinmez; ilgili feature'ların normal persistence davranışı devam eder.

## Cache

Service worker cache sürümü eski asset setine geri döndürülür. Browser eski cache'i kullanıyorsa uygulama yeniden açılışta aktivasyonu bekleyebilir.

## Veri kaybı

Rollback işlemi storage mutation olarak değerlendirilmez. Veri temizliği ayrı bir kullanıcı aksiyonudur.

## Doğrulama

Rollback sonrası sohbet, taslak, prompt library ve composer history işlevleri bağımsız smoke testlerden geçmelidir.

## Kısmi geri alma

Yalnız insights alt modülü kaldırılacaksa ana data center registry ve clear semantiği korunabilir. Yalnız CSS kaldırılması, JS'nin beklediği görsel yüzeyi bozabileceği için tercih edilmez.

## İletişim

Kullanıcıya rollback nedeniyle verisinin silindiği söylenmez. Gerçek storage temizliği yalnız explicit clear aksiyonu sonrasında gerçekleşir.
