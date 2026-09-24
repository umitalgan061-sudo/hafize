# Bağlantılar entegrasyon sınırı

## Mevcut API'ler

Hub üç mevcut endpoint kullanır:

- /api/health
- /api/connectors/gmail/status
- /api/connectors/canva/status

## Navigation

WorkspaceNavigation connections workspace'i yönetir.

Hub yalnız direct card children üretir.

## Server

Server connector runtime'ları değiştirilmez.

Gmail ownership server'da çözülür.

Canva ownership server'da çözülür.

GitHub readiness health üzerinden okunur.

## PWA

Service worker yalnız hub static asset'lerini shell'e alır.

API response cache yapılmaz.

## Settings

Ayarlar çalışma alanı hub state'ine müdahale etmez.

## Prompt Library

Hub prompt storage'ına erişmez.

## Conversations

Hub conversation history'ye erişmez.

## Scheduled Tasks

Hub task API'sini çağırmaz.

## Voice

Hub microphone veya speech API'sini çağırmaz.

## Tool runtime

Hub tool execution başlatmaz.

## Result

Bu izolasyon bağlantı gözlemini diğer kullanıcı çalışma alanlarından ayırır.
