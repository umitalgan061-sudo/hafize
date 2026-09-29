# Model ve Ajan Tercihleri Kalite Notları

## Kod kalitesi

State helper'ları UI'dan ayrıdır.
UI DOM üretimi textContent ile yapılır.
Storage işlemleri exception-safe tutulur.
Import ve export bounded'dır.

## Performans

En fazla altı profil sıralanır.
Panel render'ı küçük yerel veri üzerinde çalışır.
Yeni periyodik network işi eklenmez.
Profil uygulaması tam sohbet render'ı yerine gerekli UI senkronizasyonlarını kullanır.

## Hata izolasyonu

Storage bozuksa model preference helper boş state döndürür.
Dialog mount edilemezse ana composer çalışmaya devam eder.
Profil uygulanması başarısız olsa bile mevcut profil kaydı korunur.

## UX

Aktif profil sıralamada üstte görünür.
Kullanım sayısı karar vermeyi kolaylaştırır.
Silme işlemi onaylıdır.
Escape ile hızlı kapatma vardır.

## Release

Typed testler çalıştırılır.
Node source contract testleri çalıştırılır.
PWA asset testi çalıştırılır.
Security ve accessibility kontrolleri çalıştırılır.

## Regression

Model/agent seçimlerinin conversation state ile karıştırılmaması gerekir.
Tool mode profil uygulandığında doğru değeri almalıdır.
Streaming sırasında profil apply bloklanmalıdır.
