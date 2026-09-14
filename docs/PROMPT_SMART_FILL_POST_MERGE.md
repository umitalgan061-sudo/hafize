# Prompt Smart Fill — Post-Merge Handoff

Bu turda akıllı doldurma kapsamı tamamlanmıştır. Merge sonrası korunması gereken davranışlar aşağıdadır.

## Korunacak sözleşme

Değişkenli `Kullan` akışı uygulama içi smart-fill panelini açmalı; değişkensiz istemler doğrudan composer'a aktarılmalıdır. Aktarım hiçbir koşulda sohbeti otomatik göndermemelidir.

## Veri sınırları

Yerel preset alanı prompt başına ayrı storage anahtarı kullanır. En fazla 6 preset, 12 değişken ve değişken başına 1000 karakter kabul edilir. Prompt gövdesi için mevcut Prompt Library limitleri geçerliliğini korur.

## Erişilebilirlik

Dialog başlık/açıklama ilişkisi, canlı preview, Escape kapanışı ve Tab odak döngüsü regresyona karşı korunmalıdır.

## Güvenlik

Smart-fill istemcisi sunucuya değer göndermemeli, yetkilendirme bilgisi okumamalı ve dinamik içeriği `innerHTML` ile basmamalıdır.

## Sonraki geliştirici notu

Yeni smart-fill davranışı eklenecekse önce mevcut veri modelini ve test matrisini güncellemek; ardından 3000 satırlık tur bütçesini ayrı bir self-development turunda ölçmek gerekir.
