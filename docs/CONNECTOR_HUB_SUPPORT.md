# Bağlantılar destek rehberi

## “Hepsi kapalı”

/api/health içindeki connector configuration boolean'larını kontrol edin.

## “Gmail bağlı değil”

Gmail status endpoint'inin authenticated owner kaydını kontrol edin.

## “Canva bağlı değil”

Canva status endpoint'inin authenticated owner kaydını kontrol edin.

## “Oturum gerekli”

Kullanıcı uygulama oturumundan çıkmış olabilir. Panel yeni token istememelidir.

## “Yenile çalışmıyor”

Network panelinde üç GET isteğine bakın. UI POST göndermemelidir.

## “Panel eski durum gösteriyor”

Refresh sonrası last refresh metnini kontrol edin. API response kalıcı storage'a yazılmamalıdır.

## “Mobilde taşma var”

Connector status row tek kolon kurallarını ve uzun provider açıklamalarının overflow-wrap davranışını kontrol edin.

## “Console error”

Önce controller lifecycle ve destroy çağrısına bakın. Hub exception'ı uygulama shell'ini durduracak şekilde yukarı taşımamalıdır.

## Güvenlik vakası

Kullanıcıdan token istemeyin. Secret değerini issue/comment/log içine yazmayın. Önce UI rollback, sonra ilgili credential operasyonu.
