# Çalışma Alanı Yedeği Tasarım Review

## Mimari karar

Backup çekirdeği TypeScript içinde tutulur.

UI aynı dosyada controller olarak yer alır.

Vite production build typed entry üzerinden yapılır.

Legacy runtime içine yeni bir network katmanı eklenmez.

## Neden local-first

Workspace state'in büyük kısmı zaten browser local storage kullanır.

Backup merkezinin server dependency taşıması gereksizdir.

Offline PWA kullanımında export ve import çalışabilmelidir.

## Neden section tabanlı

Tam workspace overwrite risklidir.

Section selection blast radius'u azaltır.

Kullanıcı yalnız istediği çalışma alanını taşıyabilir.

Yeni storage yüzeyleri açık allowlist ile eklenebilir.

## Neden SHA-256

Browser Web Crypto native olarak bulunur.

Digest dosya değişikliklerini hızlıca algılar.

Remote verification servisi gerekmez.

Algoritma kullanıcı için yeterince açık bir integrity sinyalidir.

## Neden rollback

localStorage transaction sunmaz.

Çoklu key restore kısmen tamamlanabilir.

Capture and rollback failure etkisini azaltır.

## Neden metadata küçük

Backup dosyasını ikinci kez storage'a koymak quota sorununu büyütür.

Sadece son export zamanı ve boyutu kullanıcı için yeterlidir.

## Neden dynamic Smart Fill ayrı

Smart Fill prompt-id tabanlı dynamic keys kullanır.

Static allowlist bunu tek tek listeleyemez.

Prefix plus suffix validation kontrollü esneklik sağlar.

## Neden server task state yok

Server scheduled tasks backend lifecycle'ına aittir.

Browser backup onların authoritative state'i değildir.

Task templates kullanıcı cihazındaki reusable state'tir.

Bu ikisinin karıştırılması yanlış restore sonuçları doğurabilir.

## Neden confirmation

Restore mevcut state'i overwrite edebilir.

Kullanıcının son anda vazgeçebilmesi gerekir.

Preview destructive action'dan önce karar noktasıdır.

## Neden no auto-upload

Backup dosyası potansiyel olarak hassas içerik taşır.

Cloud sync ayrı bir ürün ve auth modelidir.

Bu feature'ın görevi local snapshot taşımaktır.

## UX dengesi

Export scope listesi bilgi yoğunluğunu artırır.

Section description kullanıcıya kapsam kararında yardım eder.

Import preview ikinci bir seçim katmanıdır.

Summary panelin mevcut veri durumunu görünür tutar.

## Accessibility

Native checkbox ve button kullanılır.

Status live region ile bildirilir.

Keyboard shortcut editable control dışında çalışır.

Forced colors ve reduced motion dikkate alınır.

## Performance

Section'lar bounded şekilde taranır.

Smart Fill dynamic key taraması sınırlıdır.

Hash tek JSON string üzerinde çalışır.

UI listeleri seçilen section sayısıyla sınırlıdır.

## Güvenlik

Network yok.

Credential key yok.

Unknown storage key yok.

Destructive restore confirmation ile çevrilidir.

## Maintainability

Public API fonksiyonları küçük tutulur.

UI helper'ları DOM creation yapar.

Tests source contract ve executable unit olarak ayrılır.

Dokümanlar feature boundary'lerini açıklar.

## Review sonucu

Feature mevcut workspace modules'in state ownership'ine saygı gösterir.

Backup merkezi tek authoritative data store değildir.

Restore sonrası paneller kendi mevcut state mekanizmalarını kullanır.
