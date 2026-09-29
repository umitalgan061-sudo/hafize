# Model ve Ajan Tercihleri Uyumluluk

## Tarayıcı

Özellik modern localStorage ve DOM API'leri gerektirir.
Kullanılamayan storage durumunda uygulama sohbet işlevine devam eder.
Blob ve URL API'leri yalnız export eyleminde kullanılır.

## PWA

CSS shell cache'de tutulur.
Typed model preference kodu app-shell bundle'ı içinde gelir.
API cevapları service worker shell cache'ine alınmaz.

## Mobil

Dar ekranlarda profil satırları tek kolona düşer.
Panel viewport dışına taşmaz.
Klavye kısayolu fiziksel klavye bulunan ortamlarda isteğe bağlıdır.

## Backend

Yeni endpoint yoktur.
Model ve ajan listesi mevcut endpointlerden gelmeye devam eder.
Yetki ve credential kontrolleri backend tarafında kalır.

## Veri formatı

Version 1 JSON export desteklenir.
Array payload import desteği korunur.
Bilinmeyen alanlar ignore edilir.

## Sürüm yükseltme

Uygulama yeni versiyonda eski profile JSON'larını açabilmelidir.
Schema değişikliği test matrisi güncellenmeden yayınlanmamalıdır.
