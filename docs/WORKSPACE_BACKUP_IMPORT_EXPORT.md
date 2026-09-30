# Yedek Import ve Export Operasyonları

## Export hazırlığı

Kullanıcı Yedek kapsamı bölümünü açar.

Listelenen her yüzey bir checkbox ile seçilebilir.

Seçimler başlangıçta mevcut export edilebilir yüzeyler için açık gelir.

Tümünü seç bütün checkbox'ları açar.

Seçimleri temizle bütün checkbox'ları kapatır.

Boş kapsam ile export başlatılamaz.

## Export veri akışı

createBackup local storage snapshot'ını toplar.

Snapshot yalnız allowlist'teki yüzeyleri içerir.

Kullanıcı seçimi ile section listesi daraltılır.

Section'lar JSON byte ölçümünden geçer.

Root backup object oluşturulur.

Kanonik gövde için integrity alanı çıkarılır.

SHA-256 digest hesaplanır.

Digest root integrity alanına yerleştirilir.

Final JSON byte uzunluğu tekrar kontrol edilir.

Blob oluşturulur.

Object URL oluşturulur.

Browser download tetiklenir.

URL işlem sonunda revoke edilir.

## Export dosya sözleşmesi

Dosya adı hafize-workspace-backup.json'dır.

Format değeri hafize-workspace-backup olmalıdır.

Version değeri 1 olmalıdır.

Source local-device olmalıdır.

Sections seçilen verileri taşımalıdır.

Skipped varsa dışarıda bırakılan yüzeyleri açıklar.

Integrity SHA-256 bilgisi taşır.

## Import ön kontrol

Dosya boşsa işlem başarısızdır.

Dosya boyutu 2 MB üstündeyse işlem reddedilir.

Metin parse edilir.

JSON parse exception kontrollü hata üretir.

Root array beklenen format değildir.

Root object format alanı kontrol edilir.

Version kontrol edilir.

Source kontrol edilir.

Sections array kontrol edilir.

## Section doğrulaması

Section key allowlist'te aranır.

Statik key tanımsızsa section restore'a girmez.

Smart Fill prefix güvenli suffix ile birlikte doğrulanır.

Section data undefined ise reddedilir.

Section byte uzunluğu 1.2 MB sınırında kontrol edilir.

En fazla 32 section işlenir.

Unknown section'lar skipped sonucuna eklenir.

## Integrity doğrulaması

Integrity yoksa dosya unverified olabilir.

Integrity algorithm SHA-256 dışında ise verified kabul edilmez.

Digest tekrar hesaplanır.

Hesaplanan değer saklanan değerle karşılaştırılır.

Mismatch failed sonucudur.

Failed dosyada restore disabled olur.

## Preview

Preview dosyayı otomatik uygulamaz.

Her section label, description ve size taşır.

Checkbox'lar varsayılan olarak seçili olabilir.

Kullanıcı seçimleri azaltabilir.

Tümünü seç toplu kontrol sağlar.

Seçimleri temizle toplu kontrol sağlar.

Vazgeç preview'ı kapatır.

Restore butonu yalnız geçerli integrity ile aktif olur.

## Selective restore

Seçilen id listesi tekrar sınırlandırılır.

Restore yalnız id listesinde bulunan section'lara uygulanır.

Seçilmeyen local state değişmez.

Bu yaklaşım tam workspace overwrite zorunluluğunu kaldırır.

## Metadata

Başarılı export sonrası metadata yazılır.

Metadata sadece export tarihi, section sayısı ve byte boyutunu taşır.

Backup JSON metadata key içine kopyalanmaz.

Böylece localStorage içinde ikinci büyük kopya oluşmaz.

## Hata mesajları

Büyük dosya için açık boyut mesajı gösterilir.

Geçersiz JSON açık biçim mesajı gösterilir.

Geçersiz backup formatı açıklanır.

Unknown section restore'a eklenmez.

Integrity failure kullanıcıya bildirilir.

Empty selection export'u durdurur.

Quota failure restore rollback'i çalıştırır.

## Dosya güvenliği

Import file text yalnız memory üzerinden okunur.

File object ayrı bir storage key'e yazılmaz.

Dosya remote endpoint'e gönderilmez.

Download blob server'a upload edilmez.

## Uyumluluk

Version 1 parser kontrollü bir yüzey setine sahiptir.

Gelecekte version 2 ayrı parser ile eklenmelidir.

Version 1 parser yeni section kind'larını kendiliğinden kabul etmemelidir.

Eski backup dosyasını import etmek yeni server sürümüne bağlı değildir.

## Test senaryoları

Tek section export.

Birden fazla section export.

Selective export.

Empty selection.

Unknown section.

Malformed JSON.

Large file.

Large section.

Missing integrity.

Valid integrity.

Tampered integrity.

Selective restore.

Restore cancel.

Restore quota failure.

Smart Fill restore.

## Operasyon sonucu

Export başarılıysa kullanıcı dosyaya sahiptir.

Import preview başarılıysa henüz state değişmemiştir.

Restore sonrası custom event yayınlanır.

İlgili paneller kendi state'lerini tekrar okuyabilir.

Bu yüzden backup merkezi workspace'in tek state sahibi değildir.
