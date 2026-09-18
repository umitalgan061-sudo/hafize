# Import operasyon runbook

## Normal kullanım
Kullanıcı İçe aktar → dosya seç → önizleme → kapsamı incele → İçe aktar.

## Şüpheli yedek
Önce Yedek indir ile recovery snapshot alın. Sonra diagnostics Tara ile durum kontrol edilir.

## Repair
Güvenli onarım yalnızca açık kullanıcı onayıyla çalıştırılır. Çok yüksek orphan sayısında işlem durur.

## Hata
Storage hatası görülürse yeni import tekrar edilmeden önce recovery yedeği alınır.

## Rollback
Import preview katmanı revert edildiğinde mevcut storage formatı korunur; eski import davranışına dönülür.
