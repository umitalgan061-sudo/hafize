# Model ve Ajan Tercihleri Threat Model

## Varlıklar

Model kimliği.
Ajan kimliği.
Araç modu tercihi.
Profil adı.
Kullanım sayacı.
Son seçim.
Yerel JSON yedeği.

## Tehditler

Kötü amaçlı import dosyası.
Storage bozulması.
ID çakışması.
Yetkisiz model veya ajan seçimi.
Gizli bilginin profil adına yazılması.
Export dosyasının yanlış kişiye verilmesi.
UI üzerinden istem dışı submit.

## Kontroller

Import boyutla sınırlıdır.
Payload normalize edilir.
Çakışan ID yeni kimliğe taşınır.
Model ve agent uygulanması mevcut seçeneklerle sınırlandırılır.
Dinamik metin textContent ile çizilir.
Profil uygulaması submit çağırmaz.
Export blob URL işlem bitince revoke edilir.

## Kabul ölçütü

Bir import hatası mevcut profilleri silememelidir.
Bir profil uygulaması backend authorization değişikliğine yol açmamalıdır.
Storage exception uygulama bootstrap'ini durdurmamalıdır.
Profil verisi telemetry'ye ulaşmamalıdır.

## Artık riskler

Kullanıcı export dosyasını kendisi paylaşırsa veri dışarı çıkabilir.
Browser extension veya aynı origin script'i localStorage'a erişebiliyorsa bu özellik bunu engellemez.
Bu riskler uygulama güven sınırının dışındadır.

## İzleme

Server-side kullanım metriği yoktur.
Sorunlar kullanıcı desteği ve yerel repro adımları üzerinden incelenir.
