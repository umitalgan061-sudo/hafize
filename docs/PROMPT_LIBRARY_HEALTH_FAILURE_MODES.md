# Health Center Failure Modes

## Storage erişim hatası

Local storage okunamazsa tanı boş ve güvenli varsayımlarla devam eder.

UI yazma gerektiren onarım işlemini başarıyla tamamladığını iddia etmez.

## Geçersiz JSON

Bozuk JSON dizi olarak kabul edilmez.

Sorun hata severity'siyle gösterilir.

Onarım mevcut çekirdek normalizer üzerinden ilerler.

## Çok büyük veri

Prompt, collection, revision ve issue listeleri bounded olarak işlenir.

Benzerlik karşılaştırması 120 prompt ile sınırlıdır.

Export boyutu 900000 karakterle sınırlıdır.

## Yinelenen id

Duplicate id hata olarak raporlanır.

Onarım çekirdeğin normalize davranışını kullanır.

## Yetim collection üyesi

Warning olarak listelenir.

Koleksiyon onarımı geçerli prompt id kümesine göre üyeleri temizleyebilir.

## Yetim revision

Warning olarak listelenir.

Revision geçmişi kullanıcı onayı olmadan otomatik silinmez.

## Network yokluğu

Health center hiçbir network API'ye bağlı olmadığından internet olmaması tanıyı etkilemez.

## UI mount edilmemesi

Prompt Library kartı yoksa health paneli sessizce kurulmaz.

Uygulamanın temel sohbet akışı bu nedenle kesilmez.

## Browser API eksikliği

Clipboard veya Blob benzeri yardımcı API kullanılamıyorsa ilgili dışa aktarma eylemi hata mesajı verir; tarama devam eder.

## Rollback senaryosu

Health modülü kaldırıldığında yalnızca tanı yüzeyi kaybolur. Ana Prompt Library kayıtları ayrı kalır.
