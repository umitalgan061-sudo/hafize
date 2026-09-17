# Prompt Library Collections — kullanıcı rehberi

## Koleksiyon nedir?

Koleksiyon, aynı amaçla kullandığın istemleri tek bir yerde toplar. Örneğin `Kod inceleme`, `İş e-postaları`, `Araştırma` veya `Günlük planlama` gibi gruplar oluşturabilirsin.

## Koleksiyon oluşturma

Prompt Library içindeki Koleksiyonlar bölümünden `＋ Koleksiyon` düğmesini kullan. Bir ad zorunludur; açıklama isteğe bağlıdır.

## İstem ekleme

Prompt Library listesindeki istemleri checkbox ile seç. Koleksiyon panelindeki hedef koleksiyonu seçip `Ekle` düğmesine bas. Üyelik prompt metnini kopyalamaz; yalnızca id referansı tutar.

## İstem çıkarma

Aynı seçim yöntemiyle `Çıkar` işlemini kullan. Bu işlem prompt'u kütüphaneden silmez.

## Koleksiyon filtreleme

Bir koleksiyonun `Filtrele` düğmesine basınca Prompt Library listesinde yalnızca o koleksiyona ait istemler gösterilir. Aynı düğme tekrar basıldığında filtre kapanır.

## Arama

Koleksiyon araması ad ve açıklama alanlarında çalışır. Büyük/küçük harf duyarlılığı yoktur ve Türkçe locale karşılaştırması kullanılır.

## Düzenleme

`Düzenle` ile ad veya açıklama değiştirilebilir. Aynı ada sahip ikinci bir koleksiyon oluşturulamaz.

## Silme

`Sil` işlemi açık onay ister. Sadece koleksiyon kaydı kaldırılır; prompt kayıtları etkilenmez.

## Yedekleme

`Dışa aktar` collection id, isim, açıklama ve üyelik referanslarını JSON olarak kaydeder. Prompt gövdeleri dışa aktarılmaz.

`İçe aktar` yalnızca JSON kabul eder. Büyük dosyalar reddedilir, duplicate isimler atlanır ve yeni koleksiyon id'leri üretilir.

## Sınırlar

Kütüphanede en fazla 40 koleksiyon bulunabilir. Bir koleksiyon en fazla 120 istem referansı taşır. İsim 80, açıklama 240, arama sorgusu 100 karakter ile sınırlıdır.

## Silinmiş istemler

Bir prompt sonradan silinirse koleksiyon üyeliğindeki artık id'ler otomatik olarak temizlenir. Kullanıcıya hayali bir kayıt gösterilmez.

## Çevrimdışı kullanım

Koleksiyonlar ağ bağlantısı olmadan çalışır; storage cihazda bulunduğu için API erişimi gerekmez.

## Gizlilik

Koleksiyonlar hesaba, backend analytics'e veya üçüncü taraf servislere gönderilmez. Prompt body'leri collection export'a kopyalanmaz.

## Erişilebilirlik

Düğmeler gerçek button elementidir. Form kontrolleri açık `aria-label` değerlerine sahiptir. Gizle/göster durumları `aria-expanded` ile bildirilir.

## Sorun giderme

Koleksiyonlar görünmüyorsa Prompt Library kartının yüklendiğini kontrol et. Storage kullanılamıyorsa panel failure-safe davranır; boş veri, kalıcı silinmiş veri anlamına gelmez.

## Güvenli geri alma

Yeni panel geri alınsa bile mevcut collection storage anahtarı korunabilir. Sonraki uyumlu sürüm aynı anahtarı yeniden okuyabilir.
