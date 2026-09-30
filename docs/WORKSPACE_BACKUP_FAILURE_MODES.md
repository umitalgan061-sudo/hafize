# Çalışma Alanı Yedekleme Failure Modes

## Local storage erişilemiyor

Neden browser privacy mode veya storage policy olabilir.

safeStorage null döndürür.

Export işlemi NO_LOCAL_DATA veya benzeri kontrollü hata ile sonlanır.

Mevcut server state etkilenmez.

## Quota dolu

Export metadata yazımı başarısız olabilir.

Ana download yine oluşturulabilir.

Restore sırasında setItem exception oluşabilir.

Restore rollback yolu devreye girer.

## Dosya çok büyük

2 MB üstündeki dosya preview aşamasına ulaşmaz.

Kullanıcı boyut sınırı mesajı görür.

Local state değiştirilmez.

## Section çok büyük

Section inspection sırasında reddedilebilir.

Diğer section'lar preview'da kalabilir.

Geçersiz section restore edilmez.

## Bozuk JSON

JSON.parse exception yakalanır.

Preview açılmaz.

Storage değişmez.

## Unknown format

Root format mismatch oluşur.

Import reddedilir.

Storage değişmez.

## Unsupported version

Version 1 dışı belge şu an desteklenmez.

Import kontrollü hata verir.

Future parser yolu ayrı implement edilmelidir.

## Integrity mismatch

Digest değişmiş olabilir.

Section data değişmiş olabilir.

Export dosyası kısmen bozulmuş olabilir.

Inspection failed döner.

Restore disabled olur.

## Crypto unavailable

Web Crypto subtle API bulunmayabilir.

Digest doğrulaması yapılamaz.

İmzalı dosya verified olmaz.

Dosya unverified olarak raporlanabilir.

Policy gereği kullanıcı explicit seçim yapmadan restore uygulanmaz.

## Unknown storage key

Import root section key allowlist'te değildir.

Section skip edilir.

Key storage'a yazılmaz.

Sensitive-looking key ayrıca denylist'ten geçmez.

## Malicious Smart Fill key

Prefix doğru olabilir.

Suffix unsafe karakter içerebilir.

Suffix regex doğrulaması bunu reddeder.

Token veya secret gibi suffix'ler denylist'ten reddedilir.

## DOM injection

Malicious title HTML içeriyor olabilir.

title textContent ile yazıldığı için markup olarak çalışmaz.

Description aynı şekilde güvenlidir.

Status mesajı da textContent kullanır.

## Restore yarıda kesilmesi

Birinci section yazılmış olabilir.

İkinci section quota exception üretebilir.

Captured raw map mevcut state'i içerir.

Rollback önceki değerleri geri yazmayı dener.

Sonuç rolledBack true ise UI false success üretmez.

## Rollback başarısızlığı

Browser storage ikinci write'i de reddedebilir.

Bu durumda uygulama partial state bırakabilir.

Sonuç warnings alanında bu risk raporlanır.

Kullanıcı orijinal backup dosyasıyla tekrar restore deneyebilir.

## Kullanıcı iptali

Import preview iptal edilebilir.

Restore confirmation iptal edilebilir.

Bu durumda storage write gerçekleşmez.

## Empty workspace

Hiç local state yoksa list boş olur.

Panel bunun hata değil normal durum olduğunu belirtmelidir.

## Missing dependencies

CSS eksik olsa JS çalışabilir.

Vite entry eksikse production bundle oluşmaz.

HTML entry eksikse browser module çalışmaz.

PWA entry eksikse offline davranış bozulur.

Bu üç sınır ayrı testlerle kontrol edilir.

## Recovery

Backup dosyası feature dışındaki bir recovery kaynağıdır.

Metadata backup payload değildir.

Feature revert edilse bile harici backup dosyası geçerliliğini koruyabilir.

## Operasyon önceliği

Önce veri kaybını engelle.

Sonra kullanıcıya durumu açıkça bildir.

Sonra rollback dene.

Son olarak yeniden restore öner.

Sessiz başarısızlık kabul edilmez.

## Test

Her failure mode en az bir source veya unit test ile temsil edilmelidir.

Critical destructive path için executable unit test bulunmalıdır.

No-network boundary source test ile korunmalıdır.

## Kabul

No local state hasar görmez.

Failed integrity restore edilmez.

Unknown key yazılmaz.

Large file parse edilmez.

Quota restore rollback dener.

User cancel write üretmez.
