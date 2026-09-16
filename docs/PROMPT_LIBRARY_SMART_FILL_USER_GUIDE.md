# İstem Kütüphanesi — Akıllı Doldurma Kullanım Kılavuzu

## Temel kullanım

Değişken içeren bir prompt kartında `Alanları doldur` düğmesi görünür.

Düğmeye basınca istemin değişkenleri ayrı alanlar halinde açılır.

Örneğin `{{konu}}` ve `{{hedef_kitle}}` için iki alan görünür.

Alanları doldurdukça önizleme güncellenir.

`Mesaja aktar` yalnızca tamamlanan metni sohbet kutusuna taşır.

Gönderme işlemi ayrıca kullanıcı tarafından yapılır.

## Hatırlama

`Dolu değerleri bu cihazda hatırla` seçeneği belirli değişken değerlerini sonraki kullanım için saklar.

Bu seçim kapalıysa form kapanınca değerler kalıcı olarak kaydedilmez.

Hatırlanan değerler prompt metninden ayrı storage alanında tutulur.

Hatırlama, aynı cihazdaki aynı prompt id'si için çalışır.

Başlığı aynı olan başka prompt otomatik olarak aynı değerleri devralmaz.

## Preset

Preset, birden fazla değişkeni isimlendirilmiş bir grup halinde saklar.

Örneğin `Kurumsal müşteri` presetinde `hedef_kitle=kurumsal müşteri` ve `ton=resmi` bulunabilir.

Preset seçildiğinde form alanları doldurulur.

Preview hemen güncellenir.

Presetler cihaz üzerinde tutulur.

Prompt export'larıyla karıştırılmaz.

## İptal

`Vazgeç` veya `Kapat` formu iptal eder.

İptal prompt metnini değiştirmez.

İptal kullanım sayacını artırmaz.

## Güvenlik

Prompt içindeki HTML metni çalıştırılmaz.

Değişken alanına girilen HTML metni çalıştırılmaz.

Preset adı HTML olarak yorumlanmaz.

Smart Fill secret veya token okumaz.

Smart Fill kendi başına ağ çağrısı yapmaz.

## Mobil kullanım

Form küçük ekranda dikey açılır.

Değişken alanları kaydırılabilir.

Önizleme kaydırılabilir.

Action butonları ekran genişliğine uyarlanır.

## Klavye

Dialog açıldığında ilk değişken alanı focus alır.

Tab ile diğer alanlara geçilebilir.

Escape ile form kapatılabilir.

Enter ile form submit akışı yalnızca panelin açık `Mesaja aktar` davranışıyla ilişkilidir; chat gönderme düğmesi otomatik çağrılmaz.

## Sık sorunlar

Prompt kartında düğme yoksa prompt içinde tanınabilir değişken bulunmuyor olabilir.

Eski değer görünmüyorsa hatırlama seçeneği kapalı olabilir veya storage temizlenmiş olabilir.

Preset listesi boşsa o prompt için preset kaydedilmemiştir.

Composer yoksa aktarım tamamlanmaz.

Storage erişim hatası kullanım arayüzünü bozmaz; kalıcı hatırlama çalışmayabilir.

## Gizlilik

Hatırlanan değerleri cihazını paylaşan kişiler görebilir.

Bu nedenle hassas parola, API anahtarı veya tek kullanımlık doğrulama kodlarını preset/hatırlama alanlarında saklamayın.

Tarayıcı verileri temizlenirse bu değerler kaybolabilir.

## Kullanım örneği

Prompt:

`{{konu}} hakkında {{hedef_kitle}} için {{ton}} tonda bir özet yaz.`

Değerler:

`konu = ürün lansmanı`

`hedef_kitle = satış ekibi`

`ton = kısa ve resmi`

Sonuç composer'a aktarılır ve kullanıcı isterse gönderir.

## Destek bilgisi

Sorun tekrarlanıyorsa prompt id, prompt başlığı ve kullanılan tarayıcı paylaşılabilir.

Secret veya token paylaşılmamalıdır.
