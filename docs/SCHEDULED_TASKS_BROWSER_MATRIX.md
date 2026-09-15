# Zamanlanmış Görevler — Tarayıcı Matrisi

## Chrome masaüstü

Dialog açma ve kapatma kontrol edilir.

Ajan select seçenekleri kontrol edilir.

Datetime-local picker kontrol edilir.

Textarea maxLength kontrol edilir.

POST request DevTools network panelinde görülür.

GET request panel açılışında görülür.

30 saniyelik refresh davranışı kontrol edilir.

Status filter kontrol edilir.

Cancel confirmation kontrol edilir.

Trace ID button kontrol edilir.

Ctrl+Shift+T kontrol edilir.

Input içinde shortcut bastığında modal açılmadığı kontrol edilir.

## Edge masaüstü

Chrome ile aynı Chromium davranışları beklenir.

PWA installed mode ile browser mode karşılaştırılır.

Forced colors Windows high contrast ile kontrol edilir.

## Firefox masaüstü

Datetime-local desteği ve native picker davranışı gözlemlenir.

Dialog focus davranışı kontrol edilir.

Escape ile close kontrol edilir.

Filter select keyboard interaction kontrol edilir.

Status live region değişiklikleri kontrol edilir.

## Safari macOS

Datetime-local parsing kontrol edilir.

Dialog mobile-ish resizing breakpoint kontrol edilir.

Same-origin credentials gönderildiği kontrol edilir.

AbortController desteği ve unsupported fallback kontrol edilir.

## iOS Safari

Modal ekranı alt sheet düzeninde görünmelidir.

Sanal klavye açıldığında textarea görünür kalmalıdır.

Scroll container ekranı aşmamalıdır.

Native datetime picker görev zamanını değiştirebilmelidir.

Touch ile cancel ve refresh çalışmalıdır.

Escape shortcut gereksinimi iOS fiziksel keyboard varsa kontrol edilir.

## Android Chrome

Bottom-sheet layout kontrol edilir.

Datetime picker kontrol edilir.

Task list scroll kontrol edilir.

Template button touch interaction kontrol edilir.

Status filter touch interaction kontrol edilir.

## Reduced motion

OS reduced-motion ayarı açıkken özel hareketli efekt oluşmamalıdır.

## Forced colors

High contrast ile border ve text contrast kontrol edilir.

## Offline

UI shell yüklenebilir.

Schedule GET network-only olduğu için eski API sonucu cache'den gösterilmemelidir.

Offline hata mesajı açıklayıcı olmalıdır.

## Slow network

Loading state görünmelidir.

POST düğmesi tekrar tıklanmayı engellemelidir.

Abort edilen GET close sonrası görünümü bozmamalıdır.

## Network reconnection

Connection geri geldiğinde manual refresh server snapshot'ı getirmelidir.

## Browser storage

Schedule task data localStorage'a yazılmamalıdır.

Client auth token localStorage'a yazılmamalıdır.

Only transient DOM state client tarafında tutulabilir.

## Security inspection

Bundle içinde schedule auth secret araması yapılmalıdır.

NVIDIA_API_KEY araması yapılmalıdır.

HAFIZE_SCHEDULE_AUTH_TOKEN araması yapılmalıdır.

innerHTML kullanımı araması yapılmalıdır.

## Accessibility inspection

Screen reader ile dialog başlığı okunmalıdır.

Agent field label okunmalıdır.

Task field label okunmalıdır.

Datetime label okunmalıdır.

Attempts label okunmalıdır.

Filter label okunmalıdır.

Cancel button erişilebilir olmalıdır.

Trace button içeriği anlaşılır olmalıdır.

## Regression inspection

Yeni görev paneli açıldıktan sonra ana composer textarea kullanılabilmelidir.

Prompt Library görünürlüğü değişmemelidir.

Conversation list çalışmaya devam etmelidir.

Sidebar toggle çalışmalıdır.

Theme toggle schedule modalını stil olarak güncellemelidir.

## Release browser gate

Desktop Chromium geçer.

Firefox geçer.

Safari desktop geçer.

iOS/Android temel akış geçer.

Accessibility temel akış geçer.

Offline network-only davranışı geçer.
