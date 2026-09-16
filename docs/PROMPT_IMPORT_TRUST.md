# Prompt Library güvenli içe aktarma

## Amaç

Yerel prompt yedeklerinin doğrudan storage'a yazılmasından önce kullanıcıya anlaşılır bir önizleme sunulur.

## Akış

1. Kullanıcı JSON dosyası seçer.
2. Dosya 1 MB üzerinde ise işlem durur.
3. JSON parse edilir ve mevcut Prompt Library normalizer'ından geçirilir.
4. Mevcut kayıt sayısı, yeni kayıt sayısı, id çakışmaları ve kapasite gösterilir.
5. Kullanıcı `İçe aktar` ile açıkça onaylarsa merge yapılır.
6. Çakışan id'ler mevcut kaydı ezmez; yeni id üretilir.
7. Kütüphane 120 kayıt sınırında tutulur.

## Veri güvenliği

Önizleme yalnızca tarayıcı içi DOM'da oluşturulur. Başlık ve içerik `textContent` ile yazılır. Dosya sunucuya yüklenmez ve ağ isteği yapılmaz.

## İptal

Escape, `Vazgeç`, başlık kapatma veya karartılmış arka plana tıklama önizlemeyi kapatır ve mevcut storage değiştirilmez.

## Erişilebilirlik

Panel `role=dialog` ve `aria-modal=true` kullanır. Başlık `aria-labelledby` ile bağlanır. Tab odağı panel içinde tutulur ve Escape kapanışı desteklenir.

## Sınır durumları

Boş JSON dizisi geçerlidir fakat onay düğmesi aktif edilmez. Geçersiz kayıtlar normalizer tarafından atılır. Dosya okuma hatasında mevcut kütüphane korunur. Storage yazma başarısız olursa kullanıcıya durum mesajı gösterilir.

## Geri alma

İçe aktarma yalnızca kullanıcı onayından sonra tek bir local storage yazımı yapar. Kullanıcı mevcut verisini değiştirmek istemezse işlem iptal edilebilir.
