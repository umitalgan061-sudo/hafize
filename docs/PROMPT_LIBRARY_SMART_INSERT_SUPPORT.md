# Smart Insert — Destek Runbook

## Kullanıcı Akışı Sorunu

Kullanıcı Smart Insert düğmesini göremiyorsa önce Prompt Library kartının yüklenip yüklenmediğini kontrol et. Kart görünmüyorsa sorun Smart Insert'ten önceki Prompt Library lifecycle'ındadır. Kart var ancak button yoksa enhancement loader ve `data-prompt-smart-insert` selector'ı kontrol edilir.

## Dialog Açılmıyor

Değişkenli prompt seçildiğinde dialog oluşmalıdır. `promptLibraryVariableDialog` ID'si tekil olmalıdır. Aynı anda ikinci dialog açılmamalıdır. Dialog açılmıyorsa browser console syntax/runtime hatası kontrol edilir.

## Composer'a Aktarım

Aktarım sonrası `#messageInput` value'su çözülmüş prompt olmalı ve `input` event'i yayınlanmalıdır. Submit veya requestSubmit çağrısı bulunmamalıdır. Kullanıcıdan ayrıca Gönder düğmesine basması beklenir.

## Eksik Değişken

Boş değişken varsa aktarım durur, durum mesajı gösterilir ve ilk eksik alan odaklanır. Bu sırada mevcut composer metni değiştirilmez.

## Profil Sorunları

Profil seçilemiyorsa `hafize.prompt-library.variable-profiles.v1` okunabilirliği kontrol edilir. Duplicate isim hatası varsa case-insensitive Türkçe isim karşılaştırması beklenir. Profil sınırı 24'tür. Profil merkezi bozuk olsa bile Smart Insert manuel değerlerle kullanılabilmelidir.

## Profil Yedeği

300 KB üzerindeki dosya reddedilir. Bozuk JSON mevcut profilleri değiştirmemelidir. Aynı isimde kayıt merge edilir. Yeni kayıtlar kapasite dolana kadar alınır. Import sonrası profile ID'leri normalize edilir.

## Geçmiş Sorunları

History görünmüyorsa `hafize.prompt-library.smart-insert-history.v1` okunur. Geçmiş yalnız prompt ID, label, usedAt ve reason taşımalıdır. Prompt body veya değişken değeri bulunması bir privacy regression olarak ele alınmalıdır.

## Activity Özeti

Activity bölümünde toplam giriş, farklı prompt, aktif gün ve en sık kullanılan prompt gösterilir. Son 14 gün günlük özetinde en fazla 7 satır görünür. Bu alan da local-only'dir.

## Kısayollar

Ctrl/Cmd+Shift+I, L ve H global erişim sağlar. Input veya textarea odaktayken shortcut guard çalışmalıdır. Shortcut yalnızca mevcut UI'ı açar; harici network eylemi başlatmaz.

## PWA

Yeni dosya cache listesinde yoksa offline shell eski UI ile açılabilir. `CURRENT_CACHE` sürümü arttırılmalıdır. API istekleri cache'e alınmamalıdır.

## Cache Temizleme

Service worker eski `hafize-shell-*` cache'lerini `shouldDeleteCache` ile ayırır. Cache temizliği local storage verisini silmemelidir.

## Kullanıcı Verisi

Profil/history/preset verileri uygulama sunucusuna gönderilmez. Kullanıcı veri silmek isterse ilgili local storage alanı temizlenebilir; bu işlem Prompt Library istemlerini etkileyebilir yalnızca ilgili key açıkça hedeflenirse.

## Escalation

Bir hata yalnızca Smart Insert'e özgüyse Prompt Library core CRUD, usage insights, collections ve revisions yüzeylerinin çalıştığını doğrula. Aynı anda başka UI alanları da bozuluyorsa loader veya service worker sürümü ortak kök neden olabilir.

## Release Regression

Her release'te syntax, no-network, no-innerHTML, bounds, no-auto-submit, PWA asset, accessibility, lifecycle ve migration testleri çalıştırılmalıdır.
