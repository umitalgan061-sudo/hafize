# Organizer — Code Review Rehberi

## Mimari

Özellik üç bounded browser modülüne ayrılmıştır: organizer, actions ve dashboard.

Her modül mevcut Scheduled Tasks panelini gözlemler ve panel yoksa sessizce çıkar.

Server API modeli değiştirilmez.

## Organizer incelemesi

Search, agent, sort ve duplicate davranışlarını kontrol edin.

Local storage yalnızca görünüm state'i taşımalıdır.

Duplicate POST için açık kullanıcı onayı bulunmalıdır.

Task ID URL path içinde encoded olmalıdır.

## Actions incelemesi

Checkbox yalnızca scheduled durumunda etkin olmalıdır.

Toplu işlem limiti 40'tır.

DELETE çağrıları kullanıcı onayı olmadan başlamamalıdır.

Export fresh GET snapshot kullanmalıdır.

Export task verisini persistent storage'a yazmamalıdır.

## Dashboard incelemesi

Time filter yalnızca görünümü değiştirmelidir.

Preset uygulamak server request üretmemelidir.

Preset sayısı altı ile sınırlı olmalıdır.

Detail dialog sadece mevcut satır snapshot'ını göstermelidir.

## DOM

Dynamic task data textContent ile yazılmalıdır.

User-controlled text HTML olarak parse edilmemelidir.

Native button, input, select ve dialog semantiği korunmalıdır.

## PWA

Yeni asset'ler shell listesinde bulunmalıdır.

API response'ları cache kapsamı dışında kalmalıdır.

Cache version güncellenmelidir.

## Regression

Existing scheduled task create/list/cancel davranışı korunmalıdır.

Countdown modülü ile organizer birlikte çalışabilmelidir.

Existing keyboard shortcut input alanlarını bozmamalıdır.

## Accessibility

ARIA labels, live status, keyboard close ve mobile layout kontrol edilmelidir.

Forced colors ve reduced motion stilleri bulunmalıdır.

## Release risk

En büyük risk, birden fazla MutationObserver'ın aynı panelde birbirini tetiklemesidir.

Marker dataset alanları duplicate mount riskini azaltır.

Bulk DELETE işlemlerinin seri yürütülmesi burst riskini azaltır.

## Acceptance

Review sırasında davranış değişikliği backend endpoint'lerinde görülmemelidir.

Diff 3000 changed-line sınırını aşmamalıdır.

Test dosyaları yeni kritik contract'ları kapsamalıdır.
