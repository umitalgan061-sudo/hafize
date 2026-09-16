# Prompt Library Sağlık Tanısı

## Uygulama

Panel `public/prompt-library-diagnostics.js` içindedir ve İstem Kütüphanesi kartının altına
eklenir. Varsayılan olarak kapalıdır; `Göster` düğmesi `aria-expanded` durumunu günceller.
Tanı ve onarım, prompt tarafında `normalizeItem` / `normalizeCollection` / `saveItems`,
koleksiyon tarafında `readCollections` / `pruneMembers` / `saveCollections` fonksiyonlarını
kullanır; ayrı bir veri formatı tanımlanmaz.

Sağlık paneli, Prompt Library storage alanlarını okumak için yalnızca tarayıcı API'lerini kullanır. Tanı işlemi veri göndermeyi gerektirmez.

## Ölçülen alanlar

- ham prompt kayıt sayısı,
- normalize edilebilen kayıt sayısı,
- bozuk kayıt sayısı,
- yinelenen id sayısı,
- koleksiyon sayısı,
- artık var olmayan prompt'lara işaret eden koleksiyon üyeleri.

## Sağlıklı durum

Aşağıdaki koşullar sağlanıyorsa panel `Kütüphane sağlıklı` mesajı gösterir:

- storage JSON kökü dizi biçimindedir,
- normalize edilemeyen kayıt yoktur,
- yinelenen id yoktur,
- koleksiyon kökü geçerlidir,
- koleksiyonlarda artık olmayan prompt id'si yoktur.

## Onarım

Onarım düğmesi yalnızca sorun varsa etkinleşir. Kullanıcı onayı alınmadan yazma işlemi yapılmaz.

İstem deposu hiç okunamıyorsa (bozuk JSON, erişimi engellenmiş storage veya dizi olmayan kök)
onarım çalıştırılmaz ve düğme pasif kalır: okunamayan bir depo boş bir depo değildir, onarım
hâlâ orada duran kayıtları boş listeyle değiştirebilirdi.

Prompt kayıtları mevcut normalizer ile yeniden sınırlandırılır ve geçersiz kayıtlar elenir. Koleksiyon üyeleri mevcut prompt id kümesine göre filtrelenir.

## Veri kaybı yaklaşımı

Onarım, bozuk veriyi olduğu gibi kopyalamaz; doğrulanabilir kayıtları korur. Bu nedenle kullanıcı onarım öncesi yedek almak isterse mevcut JSON export özelliği kullanılabilir.

## Sınırlar

Tanı, en fazla 120 prompt kaydını temel alan bounded bir çalışma alanı kullanır. Yetim üyelerin listesi 200 kayıtla sınırlandırılır. Bu sınırlar UI'nin büyük veya bozuk storage nedeniyle kilitlenmesini önler.

## Erişilebilirlik

Panel başlıkla ilişkilendirilir. Durum mesajları status rolü kullanır. Gizle/Göster düğmesi `aria-expanded` durumunu günceller.

## Operasyon

Yeni bir cihazda panel boş storage için sağlıklı sonuç verir. Eski uygulama sürümlerinden gelen collection storage bulunmuyorsa hata üretmeden temel Prompt Library çalışır.

## Geri alma

Tanı modülü kaldırıldığında Prompt Library kayıt formatı değişmez. Storage verisinin temizlenmesi ayrı ve bilinçli bir işlemdir.
