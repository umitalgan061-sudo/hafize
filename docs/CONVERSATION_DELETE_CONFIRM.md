# Sohbet silme onayı

Tek bir sohbeti silmek geri alınamaz bir yerel veri kaybı oluşturduğu için `.conversation-delete` aksiyonu artık açık kullanıcı onayı gerektirir.

- Onay metni görünür sohbet başlığını en fazla 120 karakterle gösterir.
- Kullanıcı iptal ederse event capture aşamasında durdurulur ve odak silme düğmesine döner.
- Kullanıcı onaylarsa mevcut `app.js` delete handler'ı aynen çalışır; paralel storage veya silme yolu oluşturulmaz.
- Aktif sohbette gönderilmemiş taslak varsa onay diyaloğu açılmaz; önce `draft-navigation-guard` taslak güvenliğini uygular.
- Aktif olmayan sohbet silme işlemleri de açık onay ister.

Controller network, storage, clipboard, cookie, secret veya tool permission erişimi açmaz. Backend default-deny ve external write/send/merge approval sözleşmeleri değişmez.
