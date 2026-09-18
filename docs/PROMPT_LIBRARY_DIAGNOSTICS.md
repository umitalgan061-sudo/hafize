# Prompt Library diagnostics

## Amaç
Diagnostics paneli kullanıcıya yerel kütüphanenin veri sağlığını görünür kılar.

## Kontroller
Bozuk kayıt, yinelenen id, geçersiz kullanım sayacı, kapasite taşması, koleksiyon yetim üyesi, revizyon yetim referansı ve snapshot uyuşmazlığı taranır.

## Okuma
Tarama read-only başlayarak rapor üretir. Kullanıcı açıkça onay vermeden repair uygulanmaz.

## Güvenli onarım
Normalleştirilebilen prompt alanları canonical modele çekilir. Yinelenen prompt ID'leri yeni kimlikle korunur. Koleksiyon yetimleri geçerli prompt ID'lerine göre budanır. Revizyonlar geçerli prompt kimlikleriyle sınırlandırılır.

## Yıkıcı onarım
Geçersiz prompt kayıtlarını kaldırma ayrı bir onay gerektirir. Bu işlem kalıcıdır ve kullanıcıya açıkça belirtilir.

## Sınır
Yetim ilişki sayısı 240 değerini aşarsa otomatik güvenli repair uygulanmaz.

## Rapor
getReport() son tarama sonucunu tüketen testler ve yardımcı araçlar için sağlar.
