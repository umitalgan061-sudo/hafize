# GitHub Güvenli Yazma

GitHub çalışma alanının bu katmanı üç açık kullanıcı eylemini destekler: yeni branch oluşturma, non-default branch üzerinde tek dosya commit etme ve head/base arasında pull request açma.

## Tasarım
Yazma yüzeyi salt-okunur workspace'ten ayrı bir modüldür. UI önce yazma planını oluşturur. Kullanıcı açık onay vermeden sunucuya yazma niyeti gönderilmez.

Onay endpoint'i gerçek GitHub write çağrısı yapmaz. Payload normalize edilir ve SHA-256 parmak iziyle kısa ömürlü tek kullanımlık bir bilet üretilir. İkinci endpoint yalnız aynı action, repository ve normalize edilmiş payload için bu bileti tüketebilir.

## Desteklenen işlemler
Branch oluşturma source ref'ten güncel commit SHA'sını çözer ve Git refs API'sine yeni head ekler. Mevcut branch üzerine yazma davranışı yoktur.

Dosya commit'i GitHub Contents API kullanır. Yeni dosyada mevcut SHA verilmez; mevcut dosya güncellemesinde kullanıcıdan okunan SHA istenir. Varsayılan branch'e doğrudan commit engellenir.

Pull request açma yalnız mevcut head branch ile base ref arasında çalışır. Merge, squash, rebase, force-push ve branch silme bu API'nin parçası değildir.

## Sınırlar
Repository 120, ref 200, branch 200, path 400 karakterle; dosya içeriği 96 KiB; commit mesajı 180; PR başlığı 240; PR açıklaması 4000 karakterle sınırlıdır.

Secret, credential, token, private-key benzeri yollar ve .github/workflows altındaki yollar yazmaya kapalıdır. Plaintext credential görünen içerik de reddedilir.
