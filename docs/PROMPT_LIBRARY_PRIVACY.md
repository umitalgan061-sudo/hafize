# Prompt Library Privacy

## Local by default

Prompt kayıtları cihazdaki browser storage'da tutulur.

Bu özellik kendi başına prompt içeriğini sunucuya göndermez.

## Chat boundary

Bir prompt `Kullan` ile composer'a aktarıldığında değer yalnız input alanına yazılır.

Gönderim ayrı chat eylemidir.

Bu ayrım kullanıcının son prompt'u görmesini ve değiştirmesini sağlar.

## Export

Kullanıcı açıkça `Dışa aktar` dediğinde dosya cihazda oluşturulur.

Export için uzak upload endpoint'i kullanılmaz.

## Import

Import edilen dosyanın kaynağı doğrulanmaz; içerik yalnız veri olarak normalize edilir.

Import edilen kayıtlar local collection'a eklenir.

## Telemetri

Prompt Library kendi telemetri event'ini server'a göndermez.

Kullanım sayısı local kaydın parçasıdır.

## Multi-device

Automatic sync yoktur.

Bu yüzden bir cihazdaki prompt diğer cihazdan kendiliğinden erişilebilir değildir.

JSON export/import kullanıcı kontrollü taşıma yoludur.

## Silme

Kullanıcı kaydı tekli veya bulk silebilir.

Silme işlemi local storage'dan çıkarılır.

Conversation history ayrıca etkilenmez.

## Hassas içerik

Kullanıcı hassas promptları yerelde saklayabilir; browser storage gizli kasa olarak tasarlanmamıştır.

Cihaz paylaşımı veya browser profile paylaşımı varsa kullanıcı buna göre davranmalıdır.

İleride encrypted storage eklenmesi ayrı bir güvenlik çalışması gerektirir.
