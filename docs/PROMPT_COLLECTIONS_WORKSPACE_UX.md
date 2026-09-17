# Prompt Collection Workspace — UX

## Hiyerarşi

Workspace başlığı koleksiyon alanının neyi yönettiğini açıkça belirtir.

Özet satırı toplam, favori, arşiv ve kullanım bilgisini verir.

Arama ve filtre kontrolleri listeyi doğrudan etkiler.

İstatistik kartları karar gerektirmeyen salt okunur bilgidir.

Liste ana çalışma yüzeyidir.

Ayrıntı görünümü yalnızca seçilen koleksiyonu genişletir.

## Oluşturma

Oluşturma akışı ayrı bir modal form kullanır.

Ad ilk odak noktasıdır.

Açıklama opsiyoneldir.

Renk seçimi sınırlı bir seçenek listesidir.

Favori ve arşiv ayrı boolean kontrollerdir.

Kaydet form submit ile çalışır.

Vazgeç değişiklikleri saklamaz.

Overlay dışına tıklama düzenleyiciyi kapatır.

Escape düzenleyiciyi kapatır.

## Liste satırı

Her satır seçim kutusuyla başlar.

Renk noktası koleksiyonun görsel kimliğini gösterir.

Ad en görünür metindir.

Açıklama yardımcı bilgidir.

Üye ve kullanım özeti son satırda kalır.

Aç işlemi detay görünümünü açar.

Favori ikonu yalnızca favori state'ini değiştirir.

Arşiv eylemi kaydı kaldırmaz.

Oklar sıralamayı bir komşu konuma taşır.

Düzenle mevcut formu doldurur.

Çoğalt yeni kimlik üretir.

Silme kullanıcı onayından sonra çalışır.

## Filtreleme

Arama boş olduğunda tüm kayıtlar değerlendirilir.

Arama adı ve açıklamayı dikkate alır.

Aktif filtresi arşivlenmemiş kayıtları gösterir.

Favori filtresi favorileri gösterir.

Arşiv filtresi arşivli kayıtları gösterir.

Filtre değişimi kalıcı workspace state'e yazılır.

## Ayrıntı

Açılan koleksiyon başlığı detay alanında tekrar gösterilir.

Üye araması ayrı bir sorgudur.

Üyeler prompt başlığı ve kısa önizleme ile sunulur.

Üye çıkarma yalnızca membership ilişkisini değiştirir.

Seçili prompt'ları eklemek ana Prompt Library seçimiyle çalışır.

Üye seçme işlemi kullanıcıya ana liste bağlamını hatırlatır.

## Toplu işlemler

Bulk toolbar yalnızca en az bir koleksiyon seçildiğinde görünür.

Favorileme hızlı bir metadata işlemidir.

Arşivleme geri alınabilir.

Arşivden çıkarma geri alınabilir.

Toplu silme ayrı onay gerektirir.

Seçimi kaldırmak veri değiştirmez.

## Durum mesajları

Başarılı işlemler kısa status mesajıyla bildirilir.

Hatalar listeden kaybolmadan önce kullanıcıya gösterilir.

Boş liste açıklayıcı metin kullanır.

İçe aktarma sonucu imported/skipped sayıları bildirir.

## Mobil

Kontroller dar ekranda iki kolona düşer.

Liste satırı işlemleri ikinci satıra taşır.

İstatistikler üçlü grid olur.

Üye araçları input'u tam genişlikte kullanır.

Modal küçük ekranlarda maksimum yüksekliği sınırlar.

## Tasarım ilkeleri

Koleksiyon silmek prompt silmek anlamına gelmez.

Arşiv veri gizleme aracıdır.

Favori erişim hızlandırma aracıdır.

Sıralama kullanıcı düzenine saygı gösterir.

Kullanım sayısı analytics olarak dışarı gönderilmez.

State değişiklikleri görünür ve geri alınabilir davranışlardan oluşur.
