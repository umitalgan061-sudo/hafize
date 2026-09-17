# Prompt Collection Workspace — Data Model

## Anahtarlar

`hafize.prompt-library.collections.v1` koleksiyonların kanonik kaynağıdır.

`hafize.prompt-library.collections-workspace.v1` yalnızca workspace durumunu ve metadata'yı tutar.

Bu ayrım çekirdek API'nin veri şeklini değiştirmeden yeni UI özellikleri eklemeyi sağlar.

## State

State nesnesinin sürümü 2'dir.

`query` en fazla 100 karakterdir.

`memberQuery` en fazla 100 karakterdir.

`sort` sabit sıralama seçeneklerinden biridir.

`filter` sabit filtre seçeneklerinden biridir.

`activeId` var olan bir koleksiyon kimliğine işaret eder veya boştur.

`selectedIds` en fazla 40 kimlik içerir.

`hidden` workspace'in daraltılmış durumunu temsil eder.

## Metadata

Her koleksiyon için metadata nesnesi bulunabilir.

`favorite` boolean'dır.

`archived` boolean'dır.

`useCount` sıfırdan büyük/eşit tam sayı olarak saklanır.

`useCount` üst sınırı 9999'dur.

`lastUsedAt` ISO biçimli kısa bir zaman metnidir.

Metadata eksikse varsayılan değerler oluşturulur.

Silinmiş koleksiyonların metadata kayıtları prune edilir.

Yeni bir koleksiyon oluşturulunca metadata otomatik oluşur.

## Normalize

Kayıt kimliği string olarak sınırlandırılır.

Geçersiz state alanları varsayılana döner.

Bilinmeyen sort değeri `updated-desc` olur.

Bilinmeyen filter değeri `all` olur.

Geçersiz activeId temizlenir.

Seçim listesinde olmayan koleksiyon kimlikleri atılır.

Metadata map anahtarları mevcut koleksiyonlarla sınırlandırılır.

## Sıralama

`updated-desc` çekirdek `updatedAt` değerini kullanır.

`name-asc` Türkçe locale ile ada göre sıralar.

`members-desc` üye sayısını azalan biçimde sıralar.

`usage-desc` koleksiyon kullanımını azalan biçimde sıralar.

`favorite-first` favorileri başa alır ve güncellemeyi ikincil anahtar yapar.

## Üyeler

Koleksiyon üyeleri yalnızca mevcut Prompt Library kimliklerine bağlıdır.

Üye araması başlık, gövde ve etiketler üzerinden yapılır.

Silinmiş prompt kimlikleri çekirdek prune davranışıyla temizlenir.

Workspace yeni prompt içeriğini kopyalamaz; yalnızca prompt kimliğini okur.

Bu sayede aynı istemin sürümleri veya gövdesi iki veri deposunda tutulmaz.

## Sıra değişimi

Koleksiyon sırası çekirdek koleksiyon dizisinde tutulur.

Yukarı/aşağı hareket komşu elemanları yer değiştirir.

İlk eleman yukarı taşınamaz.

Son eleman aşağı taşınamaz.

Başarısız storage yazımı sonrası workspace yeni sıra üretmez.

## Import metadata

Yedek metadata isimle eşlenir.

Import sonrası yeni koleksiyon kimliği üretilebilse bile isim eşleşmesi korunur.

Aynı isimli mevcut koleksiyon tekrar import edilmez.

Yedekten gelen metadata geçersizse varsayılan metadata kullanılır.

## Export

Export sürüm numarası 2'dir.

Export kaynağı `hafize-prompt-library-collections-workspace` olarak işaretlenir.

Koleksiyonlar ve metadataByName birlikte taşınır.

Zaman damgası export sırasında üretilir.

Export bounded bir metin çıktısıdır.

## Uyumluluk

Eski collection kayıtları metadata olmadan geçerli kalır.

Yeni workspace kurulumu mevcut collection storage'ını migrate etmez.

Yalnızca workspace state için ayrı bir alan yaratılır.

Bu yapı eski Prompt Library import/export dosyalarının okunmasını engellemez.

## Gizlilik

State yerel storage'da tutulur.

Prompt içeriği workspace metadata'ya kopyalanmaz.

Koleksiyon adları yedek dosyasına dahil edilebilir; kullanıcı dosyayı dışa aktardığında bunun farkında olmalıdır.

## Veri kaybı önleme

Silme işlemleri kullanıcı onayıyla yapılır.

Bulk delete tek bir onaydan sonra seçili kayıtların tümünü etkiler.

Import mevcut kayıtları aynı isim üzerinden tekrar eklemez.

Storage yazma hataları sessizce başarı olarak bildirilmemelidir.
