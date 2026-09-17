# Prompt Collection Workspace — Kullanım Rehberi

## Başlangıç

Prompt Library açıkken `Koleksiyon çalışma alanı` bölümü görünür.

Koleksiyonlar mevcut prompt kayıtlarını gruplamak için kullanılır.

Bir koleksiyon silindiğinde içindeki prompt silinmez.

## Koleksiyon oluşturma

`＋ Koleksiyon` düğmesine bas.

Ad alanını doldur.

İsteğe bağlı açıklama ekle.

Sabit renklerden birini seç.

Favori veya arşiv durumunu başlangıçta belirleyebilirsin.

`Kaydet` ile oluştur.

Aynı isimli koleksiyon ikinci kez oluşturulamaz.

## Arama ve filtre

Üst arama alanı koleksiyon adı ve açıklaması üzerinde arar.

`Ada göre` seçeneği alfabetik sıra verir.

`Üye sayısı` yoğun koleksiyonları öne çıkarır.

`Kullanım` sık açılan koleksiyonları öne çıkarır.

`Favoriler` favori koleksiyonları üstte tutar.

Filtre alanından tümü, aktif, favori veya arşivli kayıtlar seçilir.

## Koleksiyonu açma

Bir satırdaki `Aç` düğmesine bas.

Koleksiyon aktif olduğunda ayrıntı bölümü açılır.

Ana listede aktif koleksiyonun durumu görünür.

Açma işlemi kullanım sayısını bir artırır.

Kullanım tarihi yerel metadata'ya yazılır.

## İstem ekleme

Ana Prompt Library listesinden istemleri seç.

Koleksiyon detayında `Seçili istemleri ekle` düğmesine bas.

Seçilen geçerli prompt kimlikleri koleksiyona eklenir.

Aynı istem tekrar eklenirse duplicate id saklanmaz.

## İstem çıkarma

Koleksiyon detayındaki üyeler listesinde ilgili istemi bul.

`Çıkar` düğmesine bas.

Yalnızca koleksiyon üyeliği kaldırılır.

Prompt ana kütüphanede kalır.

## Toplu koleksiyon işlemleri

Satır kutularından birden fazla koleksiyon seç.

Seçim 40 kayıtla sınırlıdır.

`Favorile` seçili tüm kayıtları favoriler.

`Arşivle` seçili tüm kayıtları arşivler.

`Arşivden çıkar` arşiv bayrağını kaldırır.

`Sil` kalıcı koleksiyon silme onayı ister.

`Seçimi kaldır` yalnızca workspace seçimini temizler.

## Sıralama

Satırdaki yukarı oku koleksiyonu bir konum yukarı taşır.

Aşağı oku bir konum aşağı taşır.

İlk kayıt yukarı, son kayıt aşağı taşınamaz.

Sıra değişimi collection storage'a yazılır.

## Düzenleme

`Düzenle` formu açar.

Ad, açıklama ve renk değiştirilebilir.

Favori ve arşiv seçenekleri aynı formdan güncellenir.

Değişiklik sonrası kayıt yeniden normalize edilir.

## Arşiv

Arşivlenen koleksiyonlar silinmez.

`Arşivliler` filtresi yalnızca arşivdekileri gösterir.

`Aktif` filtresi arşivlenmemiş kayıtları gösterir.

Arşiv durumu prompt üyelerini etkilemez.

## Favori

Favori koleksiyonlar kolayca filtrelenir.

Favori durumu metadata alanında tutulur.

Favori seçimi koleksiyonun üyelik verisini değiştirmez.

## Yedek alma

`Yedeği dışa aktar` JSON dosyası oluşturur.

Dosya prompt metnini değil koleksiyon ilişkilerini ve workspace metadata'sını taşır.

Dosyayı güvenli bir yerde sakla.

Export kullanıcı tarafından başlatılır.

## Yedekten dönme

`Yedeği içe aktar` ile bir JSON dosyası seç.

500 KB üzerindeki dosyalar reddedilir.

Geçersiz JSON reddedilir.

Aynı adlı mevcut koleksiyonlar atlanır.

Yeni koleksiyonlara uygun metadata isim üzerinden yeniden bağlanır.

## Klavye

Ctrl/⌘+Shift+L koleksiyon aramasına götürür.

Satır odaktayken Enter koleksiyonu açar.

F favoriyi değiştirir.

A arşiv durumunu değiştirir.

Delete silme onayı açar.

Yukarı/aşağı oklar satır odağını taşır.

Escape aktif ayrıntıyı kapatır.

Düzenleyici açıkken Escape düzenleyiciyi kapatır.

## Mobil kullanım

Toolbar dar ekranda iki kolonlu düzene geçer.

Satır işlemleri ayrı alt satıra iner.

İstatistikler üçlü karta bölünür.

Üye arama alanı tek başına tam satıra taşınır.

## Hata durumları

Storage yazılamıyorsa kullanıcıya çalışma alanının kaydedilemediği bildirilir.

Boş koleksiyon listesi bilgi mesajı gösterir.

Arama sonucu yoksa eşleşme mesajı görünür.

Geçersiz yedek dosyası hata mesajıyla durur.

Silme onayı verilmezse kayıt korunur.
