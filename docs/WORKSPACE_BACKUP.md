# Hafize Çalışma Alanı Yedekleme Merkezi

## Amaç

Çalışma Alanı Yedeği, Hafize'nin tarayıcı cihazında tuttuğu kullanıcı verilerini tek bir JSON dosyasında taşınabilir hale getirir.

Özellik yalnızca yerel workspace state üzerinde çalışır.

Sunucu tarafında çalışan planlanmış görev kayıtları bu yedeğin parçası değildir.

API anahtarları, session cookie'leri ve OAuth kimlik bilgileri yedeğe girmez.

Yedekleme işlemi internet bağlantısı gerektirmez.

İntegrity doğrulaması Web Crypto SHA-256 kullanır.

## Kullanıcı akışı

Kullanıcı önce Yedek kapsamı alanından yüzeyleri seçebilir.

Seçim yapılmazsa indirme işlemi başlamaz.

En az bir yüzey seçildiğinde Yedeği indir çalışır.

Yedek JSON içinde format, version ve source alanları bulunur.

Integrity alanı imza algoritmasını ve digest değerini taşır.

Kullanıcı Yedekten geri yükle ile dosya seçer.

Dosya önce parse edilir.

Dosya sonra biçim ve yüzey allowlist'i açısından incelenir.

Varsa SHA-256 digest tekrar hesaplanır.

Preview ekranında içeri alınabilecek yüzeyler gösterilir.

Kullanıcı yalnız istediği yüzeyleri seçerek geri yükleyebilir.

Geri yükleme öncesinde açık bir onay gerekir.

İşlemde hata oluşursa önceki ham localStorage değerleri rollback edilir.

## Kapsanan yüzeyler

Sohbet geçmişi hafize.conversations.v1 anahtarındadır.

Mesaj çalışma alanı hafize.message-workspace.v1 anahtarındadır.

İstem kütüphanesi hafize.prompt-library.v1 anahtarındadır.

İstem filtre durumu ayrı bir state anahtarıyla taşınır.

İstem koleksiyonları ayrı bir storage yüzeyidir.

İstem sürüm geçmişi ayrı bir storage yüzeyidir.

Model tercih profilleri yerel yedek kapsamındadır.

Composer history kullanıcı cihazındaki son girdileri kapsar.

Composer history ayarları ayrıca yedeklenebilir.

Görev şablonları yalnız yerel şablon alanını kapsar.

Görev taslağı geçici local form state olarak taşınabilir.

Smart Fill değerleri güvenli prefix ile keşfedilir.

## Kapsanmayan yüzeyler

Uygulama auth token'ları kapsanmaz.

Connector auth token'ları kapsanmaz.

OAuth access veya refresh token kapsanmaz.

Session ve auth cache anahtarları kapsanmaz.

Backend Redis lease state kapsanmaz.

Sunucu scheduled task execution state kapsanmaz.

Telemetry veya analytics verisi oluşturulmaz.

Harici URL içeriği yedekleme sırasında indirilmez.

Kullanıcıya ait rastgele dosya sistemi içeriği taranmaz.

## Boyut sınırları

Tek yedek için üst sınır 2 MB'dır.

Tek section için üst sınır 1.2 MB'dır.

En fazla 32 section taşınabilir.

Smart Fill için en fazla 24 dinamik key keşfedilir.

Storage anahtarları 180 karakterle sınırlandırılır.

Bu sınırlar bozuk JSON dosyalarının kaynak tüketimini sınırlar.

Import tarafında dosya boyutu parse öncesi kontrol edilir.

Section boyutu parse sonrası tekrar kontrol edilir.

## Bütünlük

Digest, integrity alanı çıkarılarak oluşturulan kanonik gövde üzerinde hesaplanır.

Object key'leri alfabetik sıralanır.

Array sırası korunur.

Import sırasında aynı kanonik temsil tekrar oluşturulur.

Hesaplanan digest eşleşmezse dosya reddedilir.

Web Crypto bulunmuyorsa imzasız dosya unverified olarak raporlanabilir.

Failed integrity durumundaki dosya restore edilemez.

## Kullanıcı deneyimi

Preview içinde section etiketi, açıklaması ve boyutu gösterilir.

Kullanıcı tümünü seçebilir.

Kullanıcı seçimleri temizleyebilir.

İşlem sonrası ilgili workspace panelleri olay tabanlı yenilenir.

Yedek metadata yalnız son export zamanı, section sayısı ve boyutu olarak saklanır.

Gerçek yedek içeriği metadata anahtarında tutulmaz.

Uygulama kalıcı ikinci bir backup kopyası oluşturmaz.

## Operasyon

Bir yedek dosyası sorunluysa mevcut local state korunur.

Restore önce mevcut state'i ham haliyle yakalar.

Birden fazla section geri yükleniyorsa failure sonrası captured state geri yazılır.

Rollback best-effort olarak uygulanır.

Rollback başarısızlığı sonuç nesnesinde ayrıca raporlanır.

Kullanıcıya yalnız başarı mesajı gösterilmez.

## Geliştirici arayüzü

createBackup seçilebilir section id listesi kabul eder.

inspectBackup parse, format, allowlist ve integrity doğrulaması yapar.

restoreSelected seçilen yüzeyleri yazar.

allowedStorageKey storage key güvenlik sınırını denetler.

collectSections cihazdaki export edilebilir state'i toplar.

backupMetadata son export metadata'sını okur.

saveBackupMetadata yalnız küçük bir özet saklar.

formatBytes UI boyutlarını sunar.

## Kabul kriterleri

Export yalnız seçilen yüzeyleri içermelidir.

Import allowlist dışı yüzeyleri kabul etmemelidir.

SHA-256 değişmiş içeriği tespit etmelidir.

Restore confirmation gerektirmelidir.

Restore failure rollback denemelidir.

Kullanıcı içeriği DOM'a raw HTML olarak yazılmamalıdır.

Network çağrısı oluşturulmamalıdır.

PWA asset'leri HTML ve Vite ile senkron olmalıdır.

Dar ekran kullanımı korunmalıdır.

Reduced motion ve forced colors davranışı korunmalıdır.
