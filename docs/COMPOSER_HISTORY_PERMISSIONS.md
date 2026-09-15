# Composer History — Yetki Sınırları

Composer History browser APIs dışında yeni bir yetki istemez.

## Storage

localStorage access browser permission modeline tabidir.

Uygulama storage'ı yalnız kendi origin'inde okur.

## File access

Import yalnız kullanıcı tarafından seçilen dosyayı okur.

Directory traversal veya arbitrary path access yoktur.

## Download

Export browser download mekanizması ile kullanıcı cihazına bırakılır.

## Network

History modülü network permission veya remote service istemez.

API anahtarlarına erişmez.

OAuth tokenlarına erişmez.

## User control

History capture submit eylemine bağlıdır.

Retention ve opt-out kullanıcı ayarlarıyla yönetilir.

Clear işlemi onay gerektirir.

## Future changes

Cross-device sync eklenirse açık kullanıcı onayı, yeni storage model ve yeni güvenlik incelemesi gerekir.

Bu modül kendi başına yetki yükseltmemelidir.
