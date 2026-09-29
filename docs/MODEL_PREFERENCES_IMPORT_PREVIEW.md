# Model ve Ajan Tercihleri Import Önizleme

## Amaç

Import dosyası storage'a yazılmadan önce kullanıcıya etkisini göstermek.

## Hesaplanan alanlar

candidateCount toplam aday kayıt sayısıdır.
validCount normalize edilebilen profil sayısıdır.
rejectedCount geçersiz profil sayısıdır.
collisionCount mevcut ID ile çakışan profil sayısıdır.
capacityRemaining mevcut profil kapasitesidir.
willImport kapasiteye gerçekten girecek kayıt sayısıdır.

## Güvenlik

Preview hiçbir storage yazımı yapmaz.
Preview network çağrısı yapmaz.
Kullanıcı onayı olmadan import state'i kalıcı hale gelmez.

## UI

Kullanıcıya alınacak, reddedilecek ve çakışan kayıt özeti gösterilir.
Kapasite yetersizse import sonlandırılır.
Kullanıcı iptal ederse mevcut state olduğu gibi kalır.

## Test

Preview veri şekli.
Kapasite hesabı.
Collision hesabı.
Geçersiz kayıt hesabı.
Confirm sonrası write.
Cancel sonrası no-write.
