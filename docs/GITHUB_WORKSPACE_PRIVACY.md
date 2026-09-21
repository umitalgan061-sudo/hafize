# GitHub çalışma alanı privacy

## Veri akışı

Browser yalnız repository, ref, path, state ve action gibi kullanıcı tarafından girilmiş tanımlayıcıları gönderir. GitHub token server-side kalır.

## Yerel durum

Workspace repository/ref/path ve recent repository geçmişini sessionStorage içinde tutar. Bu kayıtlar session sınırındadır ve Prompt Library veya conversation history içine yazılmaz.

## Analytics

Workspace kendi analytics, telemetry veya event ingestion servisini kullanmaz.

## API yanıtları

GitHub yanıtları yalnız gerekli bounded alanlara normalize edilir. PR body ve commit message gibi metinler sınırlandırılır; UI bunları HTML olarak çalıştırmaz.

## Secret davranışı

Secret dosya isimleri mevcut github-read.ts politikasınca engellenir. Plaintext credential içeren dosya gövdeleri browser'a gönderilmeden reddedilir.

## Cache

Service worker API prefix'i network-only sınıfında tutar. Workspace verisinin offline shell cache'e yazılması amaçlanmaz.

## Linkler

Harici GitHub linkleri yalnız github.com HTTPS URL'leri kabul edilerek noopener noreferrer ile açılır.

## Kullanıcı kontrolü

Workspace yalnız okuma yapar. Kullanıcı seçmedikçe hiçbir repository yazılmaz, branch oluşturulmaz veya PR değiştirilmez.

## Saklama sınırı

30 öğelik API listeleri ve bounded metin uzunlukları tarayıcıda gereksiz büyük veri birikimini sınırlar.

## Veri silme

Workspace rollback'inde local prompt veya chat verileri silinmez. Session history kullanıcı oturumu sona erdiğinde doğal browser davranışına bırakılır.
