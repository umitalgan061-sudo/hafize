# Kopyalama Sözleşmesi

Kopyala eylemi yalnız assistant message content'i hedefler.

Clipboard API optional kabul edilir.

Kopyalama başarısız olursa conversation değişmez.

Kopyalama sırasında generation request başlatılmaz.

Kopyalanan içerik mevcut markdown kaynağının text halidir.

HTML, event handler veya metadata clipboard içine eklenmez.

Eylem disabled olduğunda boş response kopyalanmaz.

Kullanıcı action button'a Enter ile de ulaşabilir.

Clipboard izni reddedildiğinde kısa bir toast gösterilir.

Feature herhangi bir uzak clipboard servisine istek göndermez.
