# Revision History Privacy

## Local-only

Revision history browser local storage alanında tutulur. Server-side persistence bulunmaz.

## No analytics

Revision açma, karşılaştırma, restore, silme ve export olayları analytics event'i üretmez.

## No connector access

GitHub, Google, Gmail, Canva veya başka connector revision içeriğine erişemez.

## Export boundary

Export kullanıcının açık eylemiyle oluşturulur ve browser download mekanizmasını kullanır. Upload endpoint'i yoktur.

## Sensitive content

Prompt body kişisel veya kurumsal bilgi içerebilir. Revision history aynı hassasiyet seviyesinde değerlendirilmelidir.

## Shared device

Ortak bilgisayarda browser profil erişimi olan kişiler local revision history'yi görebilir. Uygulama bunu bir erişim kontrol sistemi olarak sunmaz.

## Clear semantics

Clear yalnız revision storage kaydını kaldırır. Ana prompt ve sohbet history korunur.

## Browser lifecycle

Tarayıcı site verileri temizlenirse revision history kaybolabilir. Bunun için kullanıcı isterse düzenli export alabilir.

## Retention

10 revision sınırı veri minimizasyonu için bounded retention sağlar.

## Recovery

Restore öncesi manual snapshot ile yanlış değişikliğin tekrar geri alınabilmesi amaçlanır.

## Privacy regression

Kod review sırasında revision source içinde fetch, XMLHttpRequest, WebSocket veya telemetry helper bulunmadığı doğrulanmalıdır.
