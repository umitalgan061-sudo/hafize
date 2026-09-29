# Konuşma Dalları Tasarım İncelemesi

## State
Fork child kayıtları mevcut conversation store içinde kalır. Ayrı bir state graph tutulmaz.

## UI
Mesaj action, branch panel, global hub, context banner ve comparison dialog aynı local event sözleşmesini kullanır.

## Navigation
open-conversation event'i app-shell tarafından doğrulanır. Fork modülü activeConversationId state'ini doğrudan sahiplenmez.

## Data safety
Parent messages mutate edilmez. Child yeni ID ile oluşturulur ve yalnız seçilen message'a kadar kopyalanır.

## Performance
Observer duplicate action üretimini engeller. Branch listeleri bounded, lineage traversal depth-limited ve snapshot export tek conversation ile sınırlıdır.

## Accessibility
Dialog focus trap, Escape, Enter ve semantic labels ile kuruludur. Banner ve branch panel text-only durum bilgisi sunar.

## Security
Fork creation network-free'dır; user supplied title, note ve message preview textContent üzerinden yazılır.

## Maintainability
Pure data policy conversation-fork-core.ts içindedir; DOM orchestration conversation-forks.ts'te kalır. Unit test pure core davranışını doğrular, static tests integration boundaries'i kontrol eder.
