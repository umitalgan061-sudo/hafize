# Yanıt Regeneration Olayları

## UI events
Feature yeni global custom event gerektirmez. Mevcut click ve input event modelini kullanır.

## Streaming
SSE message event'leri mevcut consumeAssistantStream fonksiyonundan geçer.

## Tool activity
Tool mode açıkken mevcut tool activity eventleri assistant message'a yazılmaya devam eder.

## Storage
Conversation save mevcut persistence fonksiyonudur.

## Feedback
Feedback state doğrudan message object üzerinde güncellenir.

## Lifecycle
beforeunload ve visibilitychange mevcut app lifecycle kontrolüyle uyumludur.

## Event güvenliği
Kullanıcı metni event name veya dataset olarak kullanılmaz.

## Failure
Hata toast'a taşınır ve response state rollback edilir.

## Restore
Restore sonrası tam render yapılır ve focus akışı composer'a döner.

## Extension
Gelecekte analytics eklenirse ayrı kullanıcı izni ve privacy review gerekir.
