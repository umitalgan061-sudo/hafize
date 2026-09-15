# Markdown regression matrisi

## Mesaj türleri

- plain text assistant response
- short Markdown response
- streamed response
- long response
- response with code
- response with table
- response with task list
- response with links

## Existing features

Conversation history açma/kapatma.

Message workspace save/search/filter.

Conversation export.

Voice output.

Hands-free mode.

Scheduled tasks.

PWA offline shell.

## Critical assertions

Renderer hiçbir user message'ı biçimlendirmemelidir.

Assistant raw text storage değişmemelidir.

Markdown tercihinin değiştirilmesi conversation kayıtlarını değiştirmemelidir.

Clipboard/download/quote yeni remote request oluşturmamalıdır.

PWA API request'leri cache'lenmemelidir.

## Browser matrix

Chromium masaüstü.

Chromium Android.

Safari masaüstü.

Safari iOS.

Firefox masaüstü.

## Accessibility matrix

Keyboard navigation.

Screen reader headings.

List semantics.

Button labels.

Live status messages.

Forced colors.

Reduced motion.

## Security matrix

HTML injection.

Unsafe URL schemes.

Malformed tables.

Oversized input.

Malformed fenced code.

Clipboard rejection.

Download API failure.

## Release gate

Tüm kırmızı testler release blocker'dır.

Known limitation varsa PR açıklamasında açıkça yazılmalıdır.
