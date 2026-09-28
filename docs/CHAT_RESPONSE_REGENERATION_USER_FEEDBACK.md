# Kullanıcı Feedback Akışı

## Positive
Kullanıcı 👍 ile cevabı yararlı olarak işaretler.

## Negative
Kullanıcı 👎 ile cevabı yetersiz olarak işaretler.

## Toggle
Aynı state tekrar seçilirse kaldırılır.

## Mutual exclusion
Positive seçildiğinde negative kalmaz. Negative seçildiğinde positive kalmaz.

## Local only
Feedback current conversation storage içinde tutulur.

## No remote
Feedback backend'e otomatik gönderilmez.

## Regeneration
Feedback seçimi yeni response üretmez.

## Variant
Varyant seçimi feedback state'i otomatik değiştirmez.

## Support
Support debugging için feedback state okunabilir; message content paylaşılması gerekmez.

## Privacy
Kullanıcı control state'ini local olarak bırakabilir veya conversation'ı temizleyebilir.
