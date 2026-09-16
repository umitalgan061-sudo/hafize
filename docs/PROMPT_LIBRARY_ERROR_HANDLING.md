# Prompt Library Error Handling

## Principle

Trust araçları kullanıcı verisini kaybetmek yerine operasyonu güvenli biçimde durdurur. Parse, read, write ve DOM hataları izole edilir.

## Import

Dosya boyutu önce kontrol edilir. Parse hatasında preview gösterilmez. Normalization hatasında geçersiz kayıtlar kabul edilmez. Merge başarısızsa mevcut library snapshot'ı korunur.

## Storage

`localStorage.getItem` veya `setItem` hata verirse ilgili operasyon başarısız kabul edilir. Ana sohbet runtime'ına exception taşınmaz.

## Diagnostics

Bozuk root JSON, geçersiz item, duplicate id veya orphan reference tanı sonucu olarak raporlanır. Tanı itself read-only'dir. Repair ayrı kullanıcı işlemi olarak çalışır.

## Bulk organizer

Selection boşsa işlem başlamaz. Etiket alanı boşsa add/replace/remove işlemi uygulanmaz. Yazma başarısızsa modal kapanmaz ve kullanıcı tekrar deneyebilir.

## Accessibility errors

Dialog ilk odak noktasını bulamazsa kapanış ve Escape hâlâ kullanılabilir kalmalıdır. UI yüzeyi yoksa ilgili modül sessizce mount edilmez.

## Network independence

Trust workflows network error üretmez çünkü uzak API çağrısı yoktur. PWA offline durumda statik JS/CSS yükleyebildiğinde yerel fonksiyonlar kullanılabilir.

## User messaging

Mesajlar kısa, yerel ve eylem odaklıdır. Hata metinleri ham exception veya dosya yolu gibi gereksiz ayrıntıları kullanıcıya göstermez.

## Recovery order

1. Mevcut storage snapshot'ını koru.
2. UI'ya anlaşılır hata bildir.
3. Kullanıcıya yeniden deneme veya iptal seçeneği sun.
4. Yalnız açık onay varsa repair/import yaz.

## DoD

Her destructive veya state-changing işlem için başarısızlık yolu test edilebilir olmalıdır. Hata, temel sohbeti veya Prompt Library listesini kullanılmaz hale getirmemelidir.
